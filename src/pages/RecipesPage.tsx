import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import ImageUpload from "../components/ImageUpload";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import StatusPill from "../components/ui/StatusPill";

interface RecipeIngredient {
  ingredient_id: number;
  ingredient_name?: string;
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
  image_path?: string | null;
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
  image_path: null as string | null,
};

// --- Sub-components ---

function RecipeCard({
  recipe,
  getIngredientName,
  onView,
  onEdit,
  onDelete
}: {
  recipe: Recipe;
  getIngredientName: (id: number) => string;
  onView: (r: Recipe) => void;
  onEdit: (r: Recipe) => void;
  onDelete: (r: Recipe) => void;
}) {
  return (
    <article className="recipe-card card card-interactive" role="listitem" onClick={() => onView(recipe)}>
      <div className="recipe-header">
        <div>
          <p className="recipe-name">{recipe.name}</p>
          <div className="recipe-meta mono" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <StatusPill status="info" label={recipe.category} />
            <span>• {recipe.portions} doses</span>
          </div>
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
          onClick={e => { e.stopPropagation(); onEdit(recipe); }}
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
          onClick={e => { e.stopPropagation(); onDelete(recipe); }}
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
    </article>
  );
}

function RecipeFormContent({ form, setForm, ingredients, isView, handleSave, editingId }: any) {
  function addIngredientRow() {
    setForm((f: any) => ({ ...f, ingredients: [...f.ingredients, { ingredient_id: 0, quantity: 0, unit: "gram" }] }));
  }

  function removeIngredientRow(index: number) {
    setForm((f: any) => ({ ...f, ingredients: f.ingredients.filter((_: any, i: number) => i !== index) }));
  }

  function updateIngredientRow(index: number, field: string, value: any) {
    setForm((f: any) => ({
      ...f,
      ingredients: f.ingredients.map((ing: any, i: number) => i === index ? { ...ing, [field]: value } : ing)
    }));
  }

  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor="recipe-name">Nome</label>
        <input
          id="recipe-name"
          className="input"
          autoFocus
          value={form.name}
          onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleSave(); }}
          placeholder="ex: Arroz de marisco"
          disabled={isView}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="recipe-category">Categoria</label>
        <select
          id="recipe-category"
          className="select"
          value={form.category}
          onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}
          disabled={isView}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="field-label">Imagem da receita</label>
        <ImageUpload
          entityType="recipe"
          entityId={editingId ?? 0}
          onImageChange={img => setForm((f: any) => ({ ...f, image_path: img?.path ?? null }))}
        />
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
            onChange={e => setForm((f: any) => ({ ...f, portions: parseInt(e.target.value) || 1 }))}
            disabled={isView}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="recipe-instructions">Instruções</label>
        <textarea
          id="recipe-instructions"
          className="textarea"
          value={form.instructions}
          onChange={e => setForm((f: any) => ({ ...f, instructions: e.target.value }))}
          placeholder="Descreve os passos da receita..."
          rows={4}
          disabled={isView}
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label className="field-label">Ingredientes</label>
          {!isView && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredientRow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Adicionar
            </button>
          )}
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
              {form.ingredients.map((ing: any, idx: number) => (
                <tr key={idx}>
                  <td>
                    <select
                      className="select"
                      value={ing.ingredient_id}
                      onChange={e => updateIngredientRow(idx, "ingredient_id", parseInt(e.target.value))}
                      disabled={isView}
                    >
                      <option value={0}>Seleciona ingrediente</option>
                      {ingredients.map((i: any) => (
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
                        type="button"
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
  );
}

function RecipeViewContent({ recipe, getIngredientName }: { recipe: Recipe, getIngredientName: (id: number) => string }) {
  return (
    <>
      <div className="detail-row">
        <span className="detail-label">Categoria</span>
        <span className="detail-value mono"><StatusPill status="info" label={recipe.category} /></span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Porções</span>
        <span className="detail-value mono">{recipe.portions}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Ingredientes</span>
        <span className="detail-value mono">{recipe.ingredients.length}</span>
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
            {recipe.ingredients.map((ing, i) => (
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
      <p className="text-2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{recipe.instructions || "—"}</p>
    </>
  );
}

function RecipeModal({
  modal,
  closeModal,
  form,
  setForm,
  handleSave,
  loading,
  ingredients,
  editing,
  getIngredientName,
  setModal
}: any) {
  if (!modal) return null;

  const isView = modal === "view";
  const title = modal === "create" ? "Nova receita" : modal === "edit" ? "Editar receita" : "Detalhes da receita";

  const footer = (
    <>
      {modal !== "view" && (
        <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
      )}
      <button
        className="btn btn-primary"
        onClick={modal !== "view" ? handleSave : () => setModal("edit")}
        disabled={loading || (!isView && !form.name.trim())}
      >
        {modal === "view" ? "Editar" : loading ? "A guardar…" : "Guardar"}
      </button>
    </>
  );

  return (
    <Modal open={!!modal} onClose={closeModal} title={title} footer={footer} wide>
      {modal !== "view" ? (
        <RecipeFormContent form={form} setForm={setForm} ingredients={ingredients} isView={isView} handleSave={handleSave} editingId={editing?.id} />
      ) : (
        editing && <RecipeViewContent recipe={editing} getIngredientName={getIngredientName} />
      )}
    </Modal>
  );
}

// --- Main Page ---

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | "view" | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { showToast } = useToast();

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
      image_path: recipe.image_path ?? null,
    });
    setEditing(recipe);
    setModal("edit");
  }

  function openView(recipe: Recipe) {
    setEditing(recipe);
    setModal("view");
  }

  function closeModal() { setModal(null); setEditing(null); }

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
          input: {
            name: form.name.trim(),
            category: form.category,
            portions: form.portions,
            instructions: form.instructions.trim(),
            ingredients: form.ingredients.map(ing => ({
              ingredient_id: ing.ingredient_id,
              quantity: ing.quantity,
              unit: ing.unit,
            })),
            // Campos do RecipeInput sem UI no formulário: enviados explicitamente
            // para o serde não rejeitar por "missing field" (tags é Vec, obrigatório).
            prep_time_minutes: null,
            cook_time_minutes: null,
            tags: [],
            image_base64: null,
          },
        });
        showToast("Receita criada", "ok");
      } else if (editing) {
        await invoke("recipe_update", {
          id: editing.id,
          input: {
            name: form.name.trim(),
            category: form.category,
            portions: form.portions,
            instructions: form.instructions.trim(),
            ingredients: form.ingredients.map(ing => ({
              ingredient_id: ing.ingredient_id,
              quantity: ing.quantity,
              unit: ing.unit,
            })),
            // Campos do RecipeInput sem UI no formulário.
            prep_time_minutes: null,
            cook_time_minutes: null,
            tags: [],
            image_base64: null,
          },
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
      <PageHeader 
        title="Receitas" 
        subtitle={`${recipes.length} receitas`}
        search={<SearchBar value={search} onChange={setSearch} placeholder="Pesquisar receitas…" />}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nova receita
          </button>
        }
      />

      {filtered.length === 0 && (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          }
          title={search ? "Sem resultados" : "Sem receitas"}
          body={search ? "Tenta outra pesquisa." : "Adiciona a primeira receita para começar."}
          action={
            !search ? (
              <button className="btn btn-primary" onClick={openCreate}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Adicionar receita
              </button>
            ) : undefined
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="recipe-grid" role="list" aria-label="Lista de receitas">
          {filtered.map(recipe => (
            <RecipeCard 
              key={recipe.id}
              recipe={recipe}
              getIngredientName={getIngredientName}
              onView={openView}
              onEdit={openEdit}
              onDelete={r => setConfirmDelete(r.id)}
            />
          ))}
        </div>
      )}

      <RecipeModal
        modal={modal}
        closeModal={closeModal}
        form={form}
        setForm={setForm}
        handleSave={handleSave}
        loading={loading}
        ingredients={ingredients}
        editing={editing}
        getIngredientName={getIngredientName}
        setModal={setModal}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar Receita"
        body={`Tens a certeza que queres eliminar a receita "${recipes.find(r => r.id === confirmDelete)?.name}"?`}
        onConfirm={() => { if (confirmDelete !== null) handleDelete(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
        danger
      />
    </div>
  );
}