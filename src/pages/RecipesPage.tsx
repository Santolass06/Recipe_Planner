import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "../lib/devInvoke";
import ImageUpload from "../components/ImageUpload";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";

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

const UNIT_SHORT: Record<string, string> = {
  gram: "g", kilogram: "kg", milligram: "mg", ounce: "oz", pound: "lb",
  pinch: "pitada", bunch: "molho", clove: "dente", slice: "fatia",
  milliliter: "ml", liter: "l", fluid_ounce: "fl oz", cup: "cup",
  pint: "pt", quart: "qt", gallon: "gal", teaspoon: "tsp", tablespoon: "tbsp",
  piece: "un", dozen: "dz", centimeter: "cm", celsius: "°C", fahrenheit: "°F",
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

const CARD_TONES = ["var(--ember)", "var(--approx)", "var(--green)", "var(--amber)"];

function eur(n: number) {
  if (!isFinite(n)) return "€0,00";
  return "€" + n.toFixed(2).replace(".", ",");
}

function fmtQty(n: number) {
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(r) ? r : r.toFixed(r < 10 ? 2 : 1)).toString().replace(".", ",");
}

// --- Cost helpers (client-side estimate from ingredient price_per_unit) ---

interface CostLine {
  name: string;
  qty: number;
  unit: string;
  cost: number;
  approx: boolean;
  title?: string;
}

function computeCostLines(recipe: Recipe, servings: number, ingredients: Ingredient[]): CostLine[] {
  const factor = servings / (recipe.portions || 1);
  return (recipe.ingredients ?? []).map(ing => {
    const stock = ingredients.find(i => i.id === ing.ingredient_id);
    const scaledQty = ing.quantity * factor;
    const price = stock?.price_per_unit ?? 0;
    const cost = price * scaledQty;
    const approx = !stock || stock.unit !== ing.unit;
    const title = !stock
      ? "Ingrediente não encontrado no inventário — custo indisponível"
      : stock.unit !== ing.unit
        ? `Preço registado em ${UNIT_SHORT[stock.unit] ?? stock.unit}; conversão para ${UNIT_SHORT[ing.unit] ?? ing.unit} é aproximada`
        : undefined;
    return {
      name: stock?.name ?? ing.ingredient_name ?? "—",
      qty: scaledQty,
      unit: ing.unit,
      cost,
      approx,
      title,
    };
  });
}

// --- Sub-components ---

function RecipeListCard({
  recipe,
  active,
  tone,
  costPerPortion,
  hasApprox,
  onSelect,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  active: boolean;
  tone: string;
  costPerPortion: number;
  hasApprox: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="recipe-list-card"
      role="listitem"
      onClick={onSelect}
      style={{
        background: "var(--surface)",
        border: `1px solid ${active ? "var(--ember)" : "var(--line)"}`,
        borderRadius: "12px",
        padding: "13px",
        cursor: "pointer",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 52, height: 52, borderRadius: 9, flexShrink: 0,
          background: "repeating-linear-gradient(45deg, var(--inset), var(--inset) 5px, var(--surface-2) 5px, var(--surface-2) 10px)",
          display: "grid", placeItems: "center",
        }}
      >
        <span className="ms" style={{ fontSize: 22, color: tone }}>restaurant</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {recipe.name}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 2 }}>
          {recipe.category} · {recipe.portions} porç.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{eur(costPerPortion)}</span>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)" }}>/porç.</span>
          {hasApprox && (
            <span className="mono" style={{ fontSize: 11, color: "var(--approx)", borderBottom: "1px dotted var(--approx)" }} title="Inclui custos aproximados">≈</span>
          )}
        </div>
      </div>
      <div className="recipe-list-actions" style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <button
          className="btn-icon"
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title="Editar"
          aria-label={`Editar ${recipe.name}`}
          type="button"
        >
          <span className="ms" style={{ fontSize: 14 }}>edit</span>
        </button>
        <button
          className="btn-icon danger"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Eliminar"
          aria-label={`Eliminar ${recipe.name}`}
          type="button"
        >
          <span className="ms" style={{ fontSize: 14 }}>delete</span>
        </button>
      </div>
    </div>
  );
}

function ServingsStepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--inset)", border: "1px solid var(--line)", borderRadius: 9, padding: 3 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Diminuir porções"
        style={{ width: 26, height: 26, border: "none", background: "var(--surface)", borderRadius: 6, cursor: "pointer", color: "var(--ink)", fontSize: 16, display: "grid", placeItems: "center", opacity: value <= min ? 0.4 : 1 }}
      >−</button>
      <span className="mono" style={{ minWidth: 58, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{value} porç.</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Aumentar porções"
        style={{ width: 26, height: 26, border: "none", background: "var(--surface)", borderRadius: 6, cursor: "pointer", color: "var(--ink)", fontSize: 16, display: "grid", placeItems: "center", opacity: value >= max ? 0.4 : 1 }}
      >+</button>
    </div>
  );
}

function RecipeDetail({
  recipe,
  servings,
  setServings,
  ingredients,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  servings: number;
  setServings: (v: number) => void;
  ingredients: Ingredient[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const costLines = useMemo(() => computeCostLines(recipe, servings, ingredients), [recipe, servings, ingredients]);
  const total = costLines.reduce((s, l) => s + l.cost, 0);
  const perPortion = total / (servings || 1);
  const steps = (recipe.instructions ?? "").split(/\n+/).map(s => s.trim()).filter(Boolean);

  return (
    <div>
      <div
        style={{
          height: 170, borderRadius: 14,
          background: recipe.image_path
            ? `center/cover no-repeat url(${recipe.image_path})`
            : "repeating-linear-gradient(45deg, var(--inset), var(--inset) 8px, var(--surface-2) 8px, var(--surface-2) 16px)",
          display: "flex", alignItems: "flex-end", padding: 16, position: "relative",
        }}
      >
        {!recipe.image_path && (
          <span className="mono" style={{ position: "absolute", top: 14, left: 16, fontSize: 10, color: "var(--ink-3)", background: "var(--surface)", padding: "3px 8px", borderRadius: 6 }}>
            FOTO DO PRATO
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginTop: 18 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 29, fontWeight: 600, color: "var(--ink)", lineHeight: 1.05, margin: 0 }}>
            {recipe.name}
          </h2>
          <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ember)", background: "var(--ember-soft)", padding: "3px 9px", borderRadius: 7 }}>
              {recipe.category}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)", background: "var(--inset)", padding: "3px 9px", borderRadius: 7 }}>
              {(recipe.ingredients ?? []).length} ingredientes
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onEdit} type="button">
            <span className="ms" style={{ fontSize: 15 }}>edit</span> Editar
          </button>
          <button className="btn btn-secondary" onClick={onDelete} type="button" style={{ color: "var(--red)" }}>
            <span className="ms" style={{ fontSize: 15 }}>delete</span> Eliminar
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "13px 15px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ink-3)" }}>timer</span>
          <div>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Preparação</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>—</div>
          </div>
        </div>
        <div style={{ flex: "1 1 140px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "13px 15px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ink-3)" }}>skillet</span>
          <div>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Cozedura</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>—</div>
          </div>
        </div>
        <div style={{ flex: "1 1 140px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "13px 15px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ink-3)" }}>euro</span>
          <div>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Por porção</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--ember)" }}>{eur(perPortion)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 22, marginTop: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>Ingredientes</span>
            <ServingsStepper value={servings} min={1} max={999} onChange={setServings} />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            {costLines.length === 0 && (
              <div style={{ padding: "16px", fontSize: 13, color: "var(--ink-3)" }}>Sem ingredientes.</div>
            )}
            {costLines.map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: i < costLines.length - 1 ? "1px solid var(--line-2)" : "none" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ember)", opacity: 0.5, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{fmtQty(l.qty)} {UNIT_SHORT[l.unit] ?? l.unit}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12, fontWeight: 600, minWidth: 56, textAlign: "right",
                    color: l.approx ? "var(--approx)" : "var(--ink)",
                    borderBottom: l.approx ? "1px dotted var(--approx)" : "none",
                  }}
                  title={l.title}
                >
                  {l.approx ? "≈ " : ""}{eur(l.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>Preparação</div>
          {steps.length === 0 && <p className="text-3">Sem instruções.</p>}
          {steps.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <span className="mono" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", background: "var(--inset)", color: "var(--ember)", fontSize: 12, fontWeight: 600, display: "grid", placeItems: "center" }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5, paddingTop: 2 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
              <span className="ms" style={{ fontSize: 14 }}>add</span>
              Adicionar
            </button>
          )}
        </div>
        {form.ingredients.length === 0 && (
          <p className="text-4 mono" style={{ marginTop: "var(--space-2)" }}>Nenhum ingrediente adicionado</p>
        )}
        <div className="table-wrap">
          <table className="table">
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
                        <span className="ms" style={{ fontSize: 14 }}>close</span>
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

function RecipeModal({
  modal,
  closeModal,
  form,
  setForm,
  handleSave,
  loading,
  ingredients,
  editing,
}: any) {
  if (!modal) return null;

  const isView = false;
  const title = modal === "create" ? "Nova receita" : "Editar receita";

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={loading || !form.name.trim()}
      >
        {loading ? "A guardar…" : "Guardar"}
      </button>
    </>
  );

  return (
    <Modal open={!!modal} onClose={closeModal} title={title} footer={footer} wide>
      <RecipeFormContent form={form} setForm={setForm} ingredients={ingredients} isView={isView} handleSave={handleSave} editingId={editing?.id} />
    </Modal>
  );
}

// --- Main Page ---

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [servings, setServings] = useState(4);

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

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  // Keep a valid selection as data loads/filters change.
  useEffect(() => {
    if (filtered.length === 0) { setSelectedId(null); return; }
    if (!filtered.some(r => r.id === selectedId)) {
      setSelectedId(filtered[0].id);
      setServings(filtered[0].portions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map(r => r.id).join(","), recipes]);

  const selected = recipes.find(r => r.id === selectedId) ?? null;

  function selectRecipe(recipe: Recipe) {
    setSelectedId(recipe.id);
    setServings(recipe.portions);
  }

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
      instructions: recipe.instructions ?? "",
      ingredients: (recipe.ingredients ?? []).map(ing => ({
        ingredient_id: ing.ingredient_id,
        quantity: ing.quantity,
        unit: ing.unit,
      })),
      image_path: recipe.image_path ?? null,
    });
    setEditing(recipe);
    setModal("edit");
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
      if (selectedId === id) setSelectedId(null);
      showToast("Receita eliminada", "ok");
      await load();
    } catch (e) {
      showToast("Erro ao eliminar", "err");
    }
  }

  return (
    <div className="content" style={{ padding: 0, height: "100%", maxWidth: "none" }}>
      <PageHeader
        title="Receitas"
        subtitle={`${recipes.length} receitas`}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <span className="ms" style={{ fontSize: 16 }}>add</span>
            Nova receita
          </button>
        }
      />

      {recipes.length === 0 ? (
        <div style={{ padding: "26px 30px 60px" }}>
          <EmptyState
            icon={<span className="ms" style={{ fontSize: 40 }}>restaurant</span>}
            title="Sem receitas"
            body="Adiciona a primeira receita para começar."
            action={
              <button className="btn btn-primary" onClick={openCreate}>
                <span className="ms" style={{ fontSize: 16 }}>add</span>
                Adicionar receita
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "312px 1fr", height: "100%" }}>
          <div
            style={{
              borderRight: "1px solid var(--line)", overflowY: "auto", padding: "18px 16px",
              display: "flex", flexDirection: "column", gap: 9, background: "var(--surface)",
            }}
            role="list"
            aria-label="Lista de receitas"
          >
            <div style={{ marginBottom: 4 }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Pesquisar receitas…" />
            </div>
            {filtered.length === 0 && (
              <p className="text-3" style={{ padding: "12px 4px" }}>Sem resultados para esta pesquisa.</p>
            )}
            {filtered.map((recipe, i) => {
              const costLines = computeCostLines(recipe, recipe.portions, ingredients);
              const total = costLines.reduce((s, l) => s + l.cost, 0);
              const perPortion = total / (recipe.portions || 1);
              const hasApprox = costLines.some(l => l.approx);
              return (
                <RecipeListCard
                  key={recipe.id}
                  recipe={recipe}
                  active={recipe.id === selectedId}
                  tone={CARD_TONES[i % CARD_TONES.length]}
                  costPerPortion={perPortion}
                  hasApprox={hasApprox}
                  onSelect={() => selectRecipe(recipe)}
                  onEdit={() => openEdit(recipe)}
                  onDelete={() => setConfirmDelete(recipe.id)}
                />
              );
            })}
          </div>

          <div style={{ overflowY: "auto", padding: "24px 30px 60px" }}>
            {selected ? (
              <RecipeDetail
                recipe={selected}
                servings={servings}
                setServings={setServings}
                ingredients={ingredients}
                onEdit={() => openEdit(selected)}
                onDelete={() => setConfirmDelete(selected.id)}
              />
            ) : (
              <EmptyState title="Seleciona uma receita" body="Escolhe uma receita na lista à esquerda para ver os detalhes." />
            )}
          </div>
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
