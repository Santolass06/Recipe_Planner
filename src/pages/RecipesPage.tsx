import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface RecipeIngredient {
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: number;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  portions: number;
  instructions: string;
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

const UNIT_GROUPS = [
  { label: "Peso", units: ["gram", "kilogram", "milligram", "ounce", "pound", "pinch", "bunch", "clove", "slice"] },
  { label: "Volume", units: ["milliliter", "liter", "fluid_ounce", "cup", "pint", "quart", "gallon"] },
  { label: "Culinário", units: ["teaspoon", "tablespoon"] },
  { label: "Contagem", units: ["piece", "dozen"] },
  { label: "Outros", units: ["centimeter", "celsius", "fahrenheit"] },
];

const UNIT_LABELS: Record<string, string> = {
  gram: "g — Grama", kilogram: "kg — Quilograma", milligram: "mg — Miligrama",
  ounce: "oz — Onça", pound: "lb — Libra", pinch: "pitada — Pitada",
  bunch: "molho — Molho", clove: "dente — Dente", slice: "fatia — Fatia",
  milliliter: "ml — Mililitro", liter: "l — Litro",
  fluid_ounce: "fl oz — Fluid Ounce", cup: "cup — Chávena",
  pint: "pt — Pint", quart: "qt — Quart", gallon: "gal — Galão",
  teaspoon: "tsp — Colher de chá", tablespoon: "tbsp — Colher de sopa",
  piece: "pcs — Peça", dozen: "dz — Dúzia",
  centimeter: "cm — Centímetro", celsius: "°C — Celsius",
  fahrenheit: "°F — Fahrenheit",
};

const CATEGORIES = [
  "Entrada", "Prato principal", "Sobremesa", "Acompanhamento",
  "Sopa", "Salada", "Molho", "Pão", "Bebida", "Outro",
];

const EMPTY_FORM = {
  name: "",
  category: "Prato principal",
  portions: 4,
  instructions: "",
  ingredients: [] as { ingredient_id: number; quantity: number; unit: string }[],
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | "view" | null>(null);
  const isView = modal === "view";
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" | "info" } | null>(null);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [recipesData, ingredientsData] = await Promise.all([
        invoke<Recipe[]>("recipes_list"),
        invoke<Ingredient[]>("ingredients_list"),
      ]);
      setRecipes(recipesData);
      setIngredients(ingredientsData);
    } catch (e) {
      showToast("Erro ao carregar dados", "err");
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, ingredients: [] });
    setEditing(null);
    setModal("create");
  }

  function openEdit(recipe: Recipe) {
    setForm({
      name: recipe.name,
      category: recipe.category,
      portions: recipe.portions,
      instructions: recipe.instructions,
      ingredients: recipe.ingredients.map(ing => ({
        ingredient_id: ing.ingredient_id,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
    });
    setEditing(recipe);
    setModal("edit");
  }

  function openView(recipe: Recipe) {
    setEditing(recipe);
    setModal("view");
  }

  function closeModal() { setModal(null); setEditing(null); }

  function addIngredientRow() {
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { ingredient_id: 0, quantity: 0, unit: "gram" }] }));
  }

  function removeIngredientRow(index: number) {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  }

  function updateIngredientRow(index: number, field: "ingredient_id" | "quantity" | "unit", value: number | string) {
    setForm(f => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) => i === index ? { ...ing, [field]: value } : ing)
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    if (form.ingredients.some(ing => ing.ingredient_id === 0 || ing.quantity <= 0)) {
      showToast("Preenche todos os ingredientes com quantidades válidas", "warn");
      return;
    }
    setLoading(true);
    try {
      if (modal === "create") {
        await invoke("recipe_create", {
          name: form.name.trim(),
          category: form.category,
          portions: form.portions,
          instructions: form.instructions.trim(),
          ingredients: form.ingredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        });
        showToast("Receita criada", "ok");
      } else if (editing) {
        await invoke("recipe_update", {
          id: editing.id,
          name: form.name.trim(),
          category: form.category,
          portions: form.portions,
          instructions: form.instructions.trim(),
          ingredients: form.ingredients.map(ing => ({
            ingredient_id: ing.ingredient_id,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        });
        showToast("Receita actualizada", "ok");
      }
      closeModal();
      await load();
    } catch (e) {
      showToast("Erro ao guardar", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await invoke("recipe_delete", { id });
      setConfirmDelete(null);
      showToast("Receita eliminada", "ok");
      await load();
    } catch (e) {
      showToast("Erro ao eliminar", "err");
    }
  }

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  const getIngredientName = (id: number) => ingredients.find(i => i.id === id)?.name ?? "—";

  return (
    <div className="content">
      {/* Header */}
      <div className="content-header">
        <div>
          <h1 className="content-title">Receitas</h1>
          <p className="content-sub mono">{recipes.length} receitas</p>
        </div>
        <div className="search-bar" role="search" aria-label="Pesquisar receitas">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Pesquisar receitas…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Pesquisar"
          />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nova receita
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="empty" role="status">
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <p className="empty-title">{search ? "Sem resultados" : "Sem receitas"}</p>
          <p className="empty-desc">
            {search ? "Tenta outra pesquisa." : "Adiciona a primeira receita para começar."}
          </p>
          {!search && (
            <button className="btn btn-primary" onClick={openCreate}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Adicionar receita
            </button>
          )}
        </div>
      )}

      {/* Grid / List */}
      {filtered.length > 0 && (
        <div className="recipe-grid" role="list" aria-label="Lista de receitas">
          {filtered.map(recipe => (
            <article key={recipe.id} className="recipe-card card card-interactive" role="listitem" onClick={() => openView(recipe)}>
              <div className="recipe-header">
                <div>
                  <p className="recipe-name">{recipe.name}</p>
                  <p className="recipe-meta mono">{recipe.category} • {recipe.portions} doses</p>
                </div>
                <span className="recipe-badge mono">{recipe.ingredients.length} ing.</span>
              </div>
              <div className="recipe-ingredients">
                {recipe.ingredients.slice(0, 3).map((ing, i) => (
                  <span key={i} className="ingredient-chip mono">
                    {getIngredientName(ing.ingredient_id)}: {ing.quantity} {UNIT_LABELS[ing.unit] ?? ing.unit}
                  </span>
                ))}
                {recipe.ingredients.length > 3 && (
                  <span className="ingredient-chip mono">+{recipe.ingredients.length - 3} mais</span>
                )}
              </div>
              <div className="recipe-actions" role="group" aria-label={`Ações para ${recipe.name}`}>
                <button
                  className="btn-icon"
                  onClick={e => { e.stopPropagation(); openEdit(recipe); }}
                  title="Editar"
                  aria-label={`Editar ${recipe.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  className="btn-icon danger"
                  onClick={e => { e.stopPropagation(); setConfirmDelete(recipe.id); }}
                  title="Eliminar"
                  aria-label={`Eliminar ${recipe.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>

              {confirmDelete === recipe.id && (
                <div className="confirm-inline" role="alert" aria-live="polite">
                  <span>Eliminar “{recipe.name}”?</span>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(recipe.id)}
                    aria-label="Confirmar eliminação"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => setConfirmDelete(null)}
                    aria-label="Cancelar"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {modal === "create" ? "Nova receita" : modal === "edit" ? "Editar receita" : "Detalhes da receita"}
              </h2>
              <button className="modal-close" onClick={closeModal} aria-label="Fechar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </header>
            <div className="modal-body">
              {modal !== "view" && (
                <>
                  <div className="field">
                    <label className="field-label" htmlFor="recipe-name">Nome</label>
                    <input
                      id="recipe-name"
                      className="input"
                      autoFocus
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSave()}
                      placeholder="ex: Arroz de marisco"
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="recipe-category">Categoria</label>
                    <select
                      id="recipe-category"
                      className="select"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="field-row">
                    <div className="field" style={{ flex: 1 }}>
                      <label className="field-label" htmlFor="recipe-portions">Porções</label>
                      <input
                        id="recipe-portions"
                        type="number"
                        className="input input-num"
                        min="1"
                        max="999"
                        value={form.portions}
                        onChange={e => setForm(f => ({ ...f, portions: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="recipe-instructions">Instruções</label>
                    <textarea
                      id="recipe-instructions"
                      className="textarea"
                      value={form.instructions}
                      onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                      placeholder="Descreve os passos da receita..."
                      rows={4}
                    />
                  </div>

                  <div className="field">
                    <div className="field-row">
                      <label className="field-label">Ingredientes</label>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredientRow}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Adicionar
                      </button>
                    </div>
                    {form.ingredients.length === 0 && (
                      <p className="text-4 mono" style={{ marginTop: "var(--space-2)" }}>Nenhum ingrediente adicionado</p>
                    )}
                    <div className="ingredients-table-wrap">
                      <table className="ingredients-table">
                        <thead>
                          <tr>
                            <th style={{ width: "40%" }}>Ingrediente</th>
                            <th style={{ width: "20%" }}>Quantidade</th>
                            <th style={{ width: "25%" }}>Unidade</th>
                            <th style={{ width: "15%" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.ingredients.map((ing, idx) => (
                            <tr key={idx}>
                              <td>
                                <select
                                  className="select"
                                  value={ing.ingredient_id}
                                  onChange={e => updateIngredientRow(idx, "ingredient_id", parseInt(e.target.value))}
                                  disabled={isView}
                                >
                                  <option value={0}>Seleciona ingrediente</option>
                                  {ingredients.map(i => (
                                    <option key={i.id} value={i.id}>{i.name} ({UNIT_LABELS[i.unit] ?? i.unit})</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="input input-num"
                                  min="0.01"
                                  step="0.01"
                                  value={ing.quantity}
                                  onChange={e => updateIngredientRow(idx, "quantity", parseFloat(e.target.value) || 0)}
                                  disabled={isView}
                                />
                              </td>
                              <td>
                                <select
                                  className="select"
                                  value={ing.unit}
                                  onChange={e => updateIngredientRow(idx, "unit", e.target.value)}
                                  disabled={isView}
                                >
                                  {UNIT_GROUPS.map(g => (
                                    <optgroup key={g.label} label={g.label}>
                                      {g.units.map(u => (
                                        <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>
                              </td>
                              <td>
                                {!isView && (
                                  <button
                                    className="btn-icon danger"
                                    onClick={() => removeIngredientRow(idx)}
                                    aria-label="Remover ingrediente"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {isView && editing && (
                <>
                  <div className="detail-row">
                    <span className="detail-label">Categoria</span>
                    <span className="detail-value mono">{editing.category}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Porções</span>
                    <span className="detail-value mono">{editing.portions}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Ingredientes</span>
                    <span className="detail-value mono">{editing.ingredients.length}</span>
                  </div>
                  <div className="divider" />
                  <h3 className="text-3" style={{ marginBottom: "var(--space-3)" }}>Ingredientes</h3>
                  <div className="ingredients-table-wrap">
                    <table className="ingredients-table">
                      <thead>
                        <tr>
                          <th style={{ width: "45%" }}>Ingrediente</th>
                          <th style={{ width: "25%" }}>Quantidade</th>
                          <th style={{ width: "30%" }}>Unidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editing.ingredients.map((ing, i) => (
                          <tr key={i}>
                            <td>{getIngredientName(ing.ingredient_id)}</td>
                            <td className="mono">{ing.quantity}</td>
                            <td>{UNIT_LABELS[ing.unit] ?? ing.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="divider" />
                  <h3 className="text-3" style={{ marginBottom: "var(--space-3)" }}>Instruções</h3>
                  <p className="text-2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{editing.instructions || "—"}</p>
                </>
              )}
            </div>
            <footer className="modal-footer">
              {modal !== "view" && (
                <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              )}
              <button
                className="btn btn-primary"
                onClick={modal !== "view" ? handleSave : () => setModal("edit")}
                disabled={loading || !form.name.trim()}
              >
                {modal === "view" ? "Editar" : loading ? "A guardar…" : "Guardar"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`toast ${toast.type}`}
          role="alert"
          aria-live="polite"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
        >
          {toast.type === "ok" && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
          {toast.type === "err" && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          )}
          {toast.type === "warn" && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          )}
          {toast.type === "info" && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}