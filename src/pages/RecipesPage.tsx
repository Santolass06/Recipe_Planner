import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { invoke } from "../lib/devInvoke";
import ImageUpload from "../components/ImageUpload";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import { useI18n } from "../i18n";
import type { RecipeWithIngredients as Recipe } from "../../crates/core/bindings/RecipeWithIngredients";
import type { Ingredient } from "../../crates/core/bindings/Ingredient";
import type { ShoppingList } from "../../crates/core/bindings/ShoppingList";
import type { ProductionResult } from "../../crates/core/bindings/ProductionResult";
import type { StockShortfall } from "../../crates/core/bindings/StockShortfall";
import type { StockItem } from "../../crates/core/bindings/StockItem";
import type { RecipeImportPreview } from "../../crates/core/bindings/RecipeImportPreview";
import { UNIT_LABELS_FULL as UNIT_LABELS, UNIT_LABELS_SHORT as UNIT_SHORT, convertUnit } from "../lib/units";
import { errKey } from "../lib/errors";

export type T = (key: string, params?: Record<string, string | number>) => string;

export const getUnitGroups = (t: T) => [
  { label: t("ingredients.unitGroups.weight"), units: ["gram", "kilogram", "milligram", "ounce", "pound", "pinch", "bunch", "clove", "slice"] },
  { label: t("ingredients.unitGroups.volume"), units: ["milliliter", "liter", "fluid_ounce", "cup", "pint", "quart", "gallon"] },
  { label: t("ingredients.unitGroups.culinary"), units: ["teaspoon", "tablespoon"] },
  { label: t("ingredients.unitGroups.count"), units: ["piece", "dozen"] },
];

export const CATEGORIES = [
  "Entrada", "Prato principal", "Sobremesa", "Acompanhamento",
  "Sopa", "Salada", "Molho", "Pão", "Bebida", "Outro",
];

export const EMPTY_FORM = {
  name: "",
  category: "Prato principal",
  portions: 4,
  instructions: "",
  ingredients: [] as { ingredient_id: number; quantity: number; unit: string; import_hint?: string }[],
  image_path: null as string | null,
  prep_time_minutes: null as number | null,
  cook_time_minutes: null as number | null,
};

const CARD_TONES = ["var(--ember)", "var(--approx)", "var(--green)", "var(--amber)"];

export function eur(n: number) {
  if (!isFinite(n)) return "€0,00";
  return "€" + n.toFixed(2).replace(".", ",");
}

export function fmtQty(n: number) {
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

export function computeCostLines(recipe: Recipe, servings: number, ingredients: Ingredient[], t: T): CostLine[] {
  const factor = servings / (recipe.portions || 1);
  return (recipe.ingredients ?? []).map(ing => {
    const stock = ingredients.find(i => i.id === ing.ingredient_id);
    const scaledQty = ing.quantity * factor;
    // The weighted average of recent purchases, which is what the backend costs
    // recipes at. Using the catalogue price here made this screen and the costs
    // page answer the same question with different numbers. `??` guards the
    // browser preview, whose mocks predate the field.
    const price = stock?.effective_price_per_unit ?? stock?.price_per_unit ?? 0;
    // price is €/stock.unit, so the quantity must be converted into stock.unit
    // before multiplying — mirrors Unit::convert_to in crates/core/src/domain.rs.
    const converted = stock ? convertUnit(scaledQty, ing.unit, stock.unit) : null;
    const cost = price * (converted ?? scaledQty);
    const approx = !stock || converted === null;
    const title = !stock
      ? t("recipes.ingredientNotFound")
      : converted === null
        ? t("recipes.priceConversionNote", { stockUnit: UNIT_SHORT[stock.unit] ?? stock.unit, ingUnit: UNIT_SHORT[ing.unit] ?? ing.unit })
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
  t,
}: {
  recipe: Recipe;
  active: boolean;
  tone: string;
  costPerPortion: number;
  hasApprox: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: T;
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
          {recipe.category} · {recipe.portions} {t("recipes.perPortionAbbrev")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{eur(costPerPortion)}</span>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)" }}>/{t("recipes.perPortionAbbrev")}</span>
          {hasApprox && (
            <span className="mono" style={{ fontSize: 11, color: "var(--approx)", borderBottom: "1px dotted var(--approx)" }} title={t("recipes.approxCostTitle")}>≈</span>
          )}
        </div>
      </div>
      <div className="recipe-list-actions" style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <button
          className="btn-icon"
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title={t("common.edit")}
          aria-label={t("ingredients.editAria", { name: recipe.name })}
          type="button"
        >
          <span className="ms" style={{ fontSize: 14 }}>edit</span>
        </button>
        <button
          className="btn-icon danger"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title={t("common.delete")}
          aria-label={t("ingredients.deleteAria", { name: recipe.name })}
          type="button"
        >
          <span className="ms" style={{ fontSize: 14 }}>delete</span>
        </button>
      </div>
    </div>
  );
}

function ServingsStepper({ value, min, max, onChange, t }: { value: number; min: number; max: number; onChange: (v: number) => void; t: T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--inset)", border: "1px solid var(--line)", borderRadius: 9, padding: 3 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={t("recipes.decreasePortions")}
        style={{ width: 26, height: 26, border: "none", background: "var(--surface)", borderRadius: 6, cursor: "pointer", color: "var(--ink)", fontSize: 16, display: "grid", placeItems: "center", opacity: value <= min ? 0.4 : 1 }}
      >−</button>
      <span className="mono" style={{ minWidth: 58, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{value} {t("recipes.perPortionAbbrev")}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={t("recipes.increasePortions")}
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
  onCook,
  t,
}: {
  recipe: Recipe;
  servings: number;
  setServings: (v: number) => void;
  ingredients: Ingredient[];
  onEdit: () => void;
  onDelete: () => void;
  onCook: () => void;
  t: T;
}) {
  const costLines = useMemo(() => computeCostLines(recipe, servings, ingredients, t), [recipe, servings, ingredients, t]);
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
            {t("recipes.dishPhoto")}
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
              {t("recipes.ingredientsCount", { count: (recipe.ingredients ?? []).length })}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={onCook} type="button">
            <span className="ms" style={{ fontSize: 15 }}>skillet</span> {t("recipes.cook.action")}
          </button>
          <button className="btn btn-secondary" onClick={onEdit} type="button">
            <span className="ms" style={{ fontSize: 15 }}>edit</span> {t("common.edit")}
          </button>
          <button className="btn btn-secondary" onClick={onDelete} type="button" style={{ color: "var(--red)" }}>
            <span className="ms" style={{ fontSize: 15 }}>delete</span> {t("common.delete")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 140px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "13px 15px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ink-3)" }}>timer</span>
          <div>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("recipes.prepTime")}</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{recipe.prep_time_minutes != null ? `${recipe.prep_time_minutes} min` : "—"}</div>
          </div>
        </div>
        <div style={{ flex: "1 1 140px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "13px 15px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ink-3)" }}>skillet</span>
          <div>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("recipes.cookTime")}</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{recipe.cook_time_minutes != null ? `${recipe.cook_time_minutes} min` : "—"}</div>
          </div>
        </div>
        <div style={{ flex: "1 1 140px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 11, padding: "13px 15px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ink-3)" }}>euro</span>
          <div>
            <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("recipes.perPortion")}</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--ember)" }}>{eur(perPortion)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 22, marginTop: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t("recipes.ingredientsSection")}</span>
            <ServingsStepper value={servings} min={1} max={999} onChange={setServings} t={t} />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            {costLines.length === 0 && (
              <div style={{ padding: "16px", fontSize: 13, color: "var(--ink-3)" }}>{t("recipes.noIngredients")}</div>
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
          <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>{t("recipes.preparationSection")}</div>
          {steps.length === 0 && <p className="text-3">{t("recipes.noInstructions")}</p>}
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <span className="mono" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", background: "var(--inset)", color: "var(--ember)", fontSize: 12, fontWeight: 600, display: "grid", placeItems: "center" }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5, paddingTop: 2 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RecipeFormContent({ form, setForm, ingredients, onIngredientCreated, isView, handleSave, editingId, t }: any) {
  const unitGroups = getUnitGroups(t);
  const { showToast } = useToast();
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);

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

  function startCreatingIngredient(index: number, hint?: string) {
    setCreatingIdx(index);
    setNewIngredientName(hint ?? "");
  }

  // Someone importing a recipe by URL (especially Family, no supplier
  // catalogue) may not have every ingredient yet, and used to have no way
  // to add one without leaving the modal and losing the whole import. This
  // creates it with the recipe line's own unit and a placeholder price
  // (editable later in Ingredientes) so the import never has to be
  // abandoned over a missing ingredient.
  async function createIngredientForRow(index: number) {
    const name = newIngredientName.trim();
    if (!name) return;
    setCreatingBusy(true);
    try {
      const created = await invoke<Ingredient>("ingredient_create", {
        input: { name, unit: form.ingredients[index].unit, price_per_unit: 0, category_id: null, event_id: null },
      });
      onIngredientCreated?.(created);
      setForm((f: any) => ({
        ...f,
        ingredients: f.ingredients.map((ing: any, i: number) =>
          i === index ? { ...ing, ingredient_id: created.id, import_hint: undefined } : ing
        ),
      }));
      setCreatingIdx(null);
      setNewIngredientName("");
      showToast(t("recipes.form.ingredientCreated", { name: created.name }), "ok");
    } catch (e) {
      showToast(typeof e === "string" && e ? e : t(errKey(e, "recipes.form.createIngredientError")), "err");
    } finally {
      setCreatingBusy(false);
    }
  }

  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor="recipe-name">{t("common.name")}</label>
        <input
          id="recipe-name"
          className="input"
          autoFocus
          value={form.name}
          onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleSave(); }}
          placeholder={t("recipes.form.namePlaceholder")}
          disabled={isView}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="recipe-category">{t("recipes.form.category")}</label>
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
        <label className="field-label">{t("recipes.form.image")}</label>
        <ImageUpload
          entityType="recipe"
          entityId={editingId ?? 0}
          onImageChange={img => setForm((f: any) => ({ ...f, image_path: img?.path ?? null }))}
        />
      </div>

      <div className="field-row">
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="recipe-portions">{t("recipes.form.portions")}</label>
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
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="recipe-prep-time">{t("recipes.prepTime")}</label>
          <input
            id="recipe-prep-time"
            type="number"
            className="input input-num"
            min="0"
            value={form.prep_time_minutes ?? ""}
            onChange={e => setForm((f: any) => ({ ...f, prep_time_minutes: e.target.value === "" ? null : parseInt(e.target.value) || 0 }))}
            disabled={isView}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="recipe-cook-time">{t("recipes.cookTime")}</label>
          <input
            id="recipe-cook-time"
            type="number"
            className="input input-num"
            min="0"
            value={form.cook_time_minutes ?? ""}
            onChange={e => setForm((f: any) => ({ ...f, cook_time_minutes: e.target.value === "" ? null : parseInt(e.target.value) || 0 }))}
            disabled={isView}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="recipe-instructions">{t("recipes.form.instructions")}</label>
        <textarea
          id="recipe-instructions"
          className="textarea"
          value={form.instructions}
          onChange={e => setForm((f: any) => ({ ...f, instructions: e.target.value }))}
          placeholder={t("recipes.form.instructionsPlaceholder")}
          rows={4}
          disabled={isView}
        />
      </div>

      <div className="field">
        <div className="field-row">
          <label className="field-label">{t("recipes.form.ingredientsLabel")}</label>
          {!isView && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredientRow}>
              <span className="ms" style={{ fontSize: 14 }}>add</span>
              {t("recipes.form.addIngredient")}
            </button>
          )}
        </div>
        {form.ingredients.length === 0 && (
          <p className="text-4 mono" style={{ marginTop: "var(--space-2)" }}>{t("recipes.form.noIngredientsAdded")}</p>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>{t("recipes.form.colIngredient")}</th>
                <th style={{ width: "20%" }}>{t("recipes.form.colQuantity")}</th>
                <th style={{ width: "25%" }}>{t("recipes.form.colUnit")}</th>
                <th style={{ width: "15%" }}></th>
              </tr>
            </thead>
            <tbody>
              {form.ingredients.map((ing: any, idx: number) => (
                <tr key={idx}>
                  <td>
                    {creatingIdx === idx ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          className="input"
                          autoFocus
                          value={newIngredientName}
                          onChange={e => setNewIngredientName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") createIngredientForRow(idx); }}
                          placeholder={t("recipes.form.newIngredientPlaceholder")}
                          disabled={creatingBusy}
                        />
                        <button
                          type="button" className="btn btn-primary btn-sm"
                          onClick={() => createIngredientForRow(idx)}
                          disabled={creatingBusy || !newIngredientName.trim()}
                        >
                          {t("common.create")}
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setCreatingIdx(null)} disabled={creatingBusy}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <>
                        <select
                          className="select"
                          value={ing.ingredient_id}
                          onChange={e => {
                            const v = e.target.value;
                            if (v === "new") startCreatingIngredient(idx, ing.import_hint);
                            else updateIngredientRow(idx, "ingredient_id", parseInt(v));
                          }}
                          disabled={isView}
                        >
                          <option value={0}>{t("recipes.form.selectIngredient")}</option>
                          <option value="new">{t("recipes.form.createNewIngredient")}</option>
                          {ingredients.map((i: any) => (
                            <option key={i.id} value={i.id}>{i.name} ({UNIT_LABELS[i.unit] ?? i.unit})</option>
                          ))}
                        </select>
                        {!isView && ing.ingredient_id === 0 && ing.import_hint && (
                          <p className="text-4 mono" style={{ marginTop: 4, color: "var(--approx)" }}>
                            {t("recipes.form.importHint", { text: ing.import_hint })}
                          </p>
                        )}
                      </>
                    )}
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
                      {unitGroups.map(g => (
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
                        aria-label={t("recipes.form.removeIngredient")}
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
  onIngredientCreated,
  editing,
  t,
}: any) {
  if (!modal) return null;

  const isView = false;
  const title = modal === "create" ? t("recipes.modal.newTitle") : t("recipes.modal.editTitle");

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={closeModal}>{t("common.cancel")}</button>
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={loading || !form.name.trim()}
      >
        {loading ? t("recipes.modal.saving") : t("common.save")}
      </button>
    </>
  );

  return (
    <Modal open={!!modal} onClose={closeModal} title={title} footer={footer} wide>
      <RecipeFormContent form={form} setForm={setForm} ingredients={ingredients} onIngredientCreated={onIngredientCreated} isView={isView} handleSave={handleSave} editingId={editing?.id} t={t} />
    </Modal>
  );
}

// --- Main Page ---

export default function RecipesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [servings, setServings] = useState(4);
  const [importOpen, setImportOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listPicks, setListPicks] = useState<number[]>([]);
  const [listMultiplier, setListMultiplier] = useState("1");
  const [listBusy, setListBusy] = useState(false);
  const [cookOpen, setCookOpen] = useState(false);
  const [cookMultiplier, setCookMultiplier] = useState("1");
  const [cookYields, setCookYields] = useState(false);
  const [cookBusy, setCookBusy] = useState(false);
  const [shortfalls, setShortfalls] = useState<StockShortfall[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  const { showToast } = useToast();
  const { t } = useI18n();

  const load = useCallback(async () => {
    try {
      const [recipesData, ingredientsData, stockData] = await Promise.all([
        invoke<Recipe[]>("recipes_list"),
        invoke<Ingredient[]>("ingredients_list"),
        invoke<StockItem[]>("stock_list"),
      ]);
      setRecipes(recipesData);
      setIngredients(ingredientsData);
      setStock(stockData);
    } catch (e) {
      showToast(t(errKey(e, "recipes.loadError")), "err");
    }
  }, [showToast, t]);

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

  // Dashboard's "Nova receita" quick action navigates here with this flag
  // instead of a dedicated route, since recipe creation is a modal, not a
  // page — a `/receitas/nova` route never existed to send it to.
  useEffect(() => {
    if ((location.state as { openCreate?: boolean } | null)?.openCreate) {
      openCreate();
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    const idParam = searchParams.get("id");
    const stateId = (location.state as { selectId?: number } | null)?.selectId;
    const targetId = idParam ? parseInt(idParam, 10) : stateId;
    if (targetId && recipes.some(r => r.id === targetId)) {
      setSelectedId(targetId);
      const targetRecipe = recipes.find(r => r.id === targetId);
      if (targetRecipe) setServings(targetRecipe.portions);
      // Clear the URL param/state once applied — otherwise every future
      // `recipes` refetch (e.g. saving a different recipe) re-runs this
      // effect, finds the stale id still in the URL, and snaps the
      // selection back to it, fighting whatever the user picked since.
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, location.state, recipes]);

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
      prep_time_minutes: recipe.prep_time_minutes ?? null,
      cook_time_minutes: recipe.cook_time_minutes ?? null,
    });
    setEditing(recipe);
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditing(null); }

  async function handleSave() {
    if (!form.name.trim()) return;
    if (form.ingredients.some(ing => ing.ingredient_id === 0 || ing.quantity <= 0)) {
      showToast(t("recipes.fillIngredientsWarn"), "warn");
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
            prep_time_minutes: form.prep_time_minutes,
            cook_time_minutes: form.cook_time_minutes,
            // tags: sem UI no formulário; enviado explicitamente porque o serde
            // rejeita "missing field" (Vec é obrigatório).
            tags: [],
            image_base64: null,
          },
        });
        showToast(t("recipes.created"), "ok");
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
            prep_time_minutes: form.prep_time_minutes,
            cook_time_minutes: form.cook_time_minutes,
            tags: [],
            image_base64: null,
          },
        });
        showToast(t("recipes.updated"), "ok");
      }
      closeModal();
      await load();
    } catch (e) {
      showToast(t(errKey(e, "recipes.saveError")), "err");
    } finally {
      setLoading(false);
    }
  }

  function openImport() {
    setImportUrl("");
    setImportOpen(true);
  }

  function closeImport() {
    setImportOpen(false);
    setImportUrl("");
  }

  async function handleImport() {
    if (!importUrl.trim()) return;
    setImportBusy(true);
    try {
      const preview = await invoke<RecipeImportPreview>("recipe_import_from_url", { url: importUrl.trim() });
      setForm({
        ...EMPTY_FORM,
        name: preview.name,
        portions: preview.portions ?? EMPTY_FORM.portions,
        instructions: preview.instructions,
        prep_time_minutes: preview.prep_time_minutes ?? null,
        cook_time_minutes: preview.cook_time_minutes ?? null,
        ingredients: preview.ingredients.map(ing => ({
          ingredient_id: ing.matched_ingredient_id ?? 0,
          quantity: ing.quantity,
          unit: ing.unit,
          import_hint: ing.matched_ingredient_id == null ? ing.name_guess : undefined,
        })),
      });
      setEditing(null);
      setModal("create");
      closeImport();
      showToast(t("recipes.import.success"), "ok");
    } catch (e) {
      showToast(typeof e === "string" && e ? e : t("recipes.import.error"), "err");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await invoke("recipe_delete", { id });
      setConfirmDelete(null);
      if (selectedId === id) setSelectedId(null);
      showToast(t("recipes.deleted"), "ok");
      await load();
    } catch (e) {
      showToast(t(errKey(e, "recipes.deleteError")), "err");
    }
  }

  async function handleCook() {
    if (!selected) return;
    setCookBusy(true);
    try {
      const result = await invoke<ProductionResult>("recipe_produce", {
        input: {
          recipe_id: selected.id,
          multiplier: Number(cookMultiplier),
          yields_product: cookYields,
          reason: null,
        },
      });
      setCookOpen(false);
      // Short stock is reported, never fatal — the movements were written either
      // way, so the toast says what was off rather than pretending it failed.
      setShortfalls(result.shortfalls);
      showToast(
        result.shortfalls.length > 0
          ? t("recipes.cook.doneWithShortfalls", { count: result.shortfalls.length })
          : t("recipes.cook.done", { name: selected.name }),
        result.shortfalls.length > 0 ? "warn" : "ok",
      );
      load();
    } catch (e) {
      showToast(typeof e === "string" && e ? e : t(errKey(e, "recipes.cook.error")), "err");
    } finally {
      setCookBusy(false);
    }
  }

  async function handleGenerateList() {
    setListBusy(true);
    try {
      const list = await invoke<ShoppingList>("shopping_list_create_from_recipes", {
        input: {
          recipe_ids: listPicks,
          portions_multiplier: Number(listMultiplier),
          name: null,
        },
      });
      setListOpen(false);
      showToast(
        list.items.length === 0
          ? t("recipes.shoppingList.nothingMissing")
          : t("recipes.shoppingList.created", { name: list.name, count: list.items.length }),
        "ok",
      );
    } catch (e) {
      showToast(t(errKey(e, "recipes.shoppingList.error")), "err");
    } finally {
      setListBusy(false);
    }
  }

  const cookBalance = useMemo(() => {
    if (!selected || !(Number(cookMultiplier) > 0)) return { coverage: 0, missing: [] as StockShortfall[] };
    const mult = Number(cookMultiplier);
    const lines = selected.ingredients ?? [];
    const missing: StockShortfall[] = [];
    let comparable = 0;
    let covered = 0;
    for (const line of lines) {
      const heldItem = stock.find(s => s.ingredient_id === line.ingredient_id);
      const held = heldItem?.quantity ?? 0;
      const stockUnit = heldItem?.ingredient_unit ?? line.unit;
      const converted = convertUnit(line.quantity * mult, line.unit, stockUnit);
      if (converted === null) continue;
      comparable++;
      if (converted <= held) covered++;
      else missing.push({
        ingredient_id: line.ingredient_id,
        ingredient_name: line.ingredient_name,
        needed: line.quantity * mult,
        available: held,
        unit: line.unit,
      });
    }
    return { coverage: comparable ? covered / comparable : 1, missing };
  }, [selected, cookMultiplier, stock]);

  return (
    <div className="content" style={{ padding: 0, height: "100%", maxWidth: "none" }}>
      <PageHeader
        title={t("recipes.title")}
        subtitle={t("recipes.subtitle", { count: recipes.length })}
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => { setListPicks(selectedId ? [selectedId] : []); setListMultiplier("1"); setListOpen(true); }}
              disabled={recipes.length === 0}
            >
              <span className="ms" style={{ fontSize: 16 }}>shopping_cart</span>
              {t("recipes.toShoppingList")}
            </button>
            <button className="btn btn-secondary" onClick={openImport}>
              <span className="ms" style={{ fontSize: 16 }}>link</span>
              {t("recipes.importFromUrl")}
            </button>
            <button className="btn btn-primary" onClick={openCreate}>
              <span className="ms" style={{ fontSize: 16 }}>add</span>
              {t("recipes.newRecipe")}
            </button>
          </>
        }
      />

      {recipes.length === 0 ? (
        <div style={{ padding: "26px 30px 60px" }}>
          <EmptyState
            icon={<span className="ms" style={{ fontSize: 40 }}>restaurant</span>}
            title={t("recipes.empty")}
            body={t("recipes.emptyDesc")}
            action={
              <button className="btn btn-primary" onClick={openCreate}>
                <span className="ms" style={{ fontSize: 16 }}>add</span>
                {t("recipes.addRecipe")}
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
            aria-label={t("recipes.listAriaLabel")}
          >
            <div style={{ marginBottom: 4 }}>
              <SearchBar value={search} onChange={setSearch} placeholder={t("recipes.searchPlaceholder")} />
            </div>
            {filtered.length === 0 && (
              <p className="text-3" style={{ padding: "12px 4px" }}>{t("recipes.noSearchResults")}</p>
            )}
            {filtered.map((recipe, i) => {
              const costLines = computeCostLines(recipe, recipe.portions, ingredients, t);
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
                  t={t}
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
                onCook={() => { setCookMultiplier("1"); setCookYields(false); setCookOpen(true); }}
                t={t}
              />
            ) : (
              <EmptyState title={t("recipes.selectRecipe")} body={t("recipes.selectRecipeDesc")} />
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
        onIngredientCreated={(ing: Ingredient) => setIngredients(prev => [...prev, ing])}
        editing={editing}
        t={t}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("recipes.confirmDeleteTitle")}
        body={t("recipes.confirmDeleteBody", { name: recipes.find(r => r.id === confirmDelete)?.name ?? "" })}
        onConfirm={() => { if (confirmDelete !== null) handleDelete(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
        danger
      />

      <Modal
        open={cookOpen}
        onClose={() => setCookOpen(false)}
        title={t("recipes.cook.title", { name: selected?.name ?? "" })}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCookOpen(false)}>{t("common.cancel")}</button>
            <button
              className="btn btn-primary"
              onClick={handleCook}
              disabled={cookBusy || !(Number(cookMultiplier) > 0)}
            >
              {cookBusy ? t("recipes.cook.loading") : t("recipes.cook.submit")}
            </button>
          </>
        }
      >
        <p className="text-4" style={{ marginBottom: "var(--space-3)" }}>{t("recipes.cook.desc")}</p>

        <div className="field">
          <label className="field-label" htmlFor="cook-multiplier">{t("recipes.cook.multiplier")}</label>
          <input
            id="cook-multiplier"
            className="input"
            type="number"
            min="0.25"
            step="0.25"
            value={cookMultiplier}
            onChange={e => setCookMultiplier(e.target.value)}
            disabled={cookBusy}
            style={{ maxWidth: 140 }}
          />
          <p className="text-4 mono" style={{ marginTop: "var(--space-1)" }}>
            {t("recipes.cook.multiplierHint", { count: Math.round((selected?.portions ?? 0) * (Number(cookMultiplier) || 0)) })}
          </p>
        </div>

        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={cookYields}
              disabled={cookBusy}
              onChange={e => setCookYields(e.target.checked)}
            />
            <span>{t("recipes.cook.yieldsProduct")}</span>
          </label>
          <p className="text-4 mono" style={{ marginTop: "var(--space-1)" }}>{t("recipes.cook.yieldsProductHint")}</p>
        </div>

        {selected && Number(cookMultiplier) > 0 && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <div className="text-4 mono" style={{ marginBottom: 6 }}>
              {t("suggestions.coverage", { pct: Math.round(cookBalance.coverage * 100) })}
            </div>
            <div style={{ height: 4, background: "var(--inset)", borderRadius: 3, marginBottom: cookBalance.missing.length > 0 ? 8 : 0 }}>
              <div style={{ height: "100%", width: `${Math.round(cookBalance.coverage * 100)}%`, background: cookBalance.coverage === 1 ? "var(--green, var(--ember))" : "var(--amber)", borderRadius: 3 }} />
            </div>
            {cookBalance.missing.length > 0 && (
              <div className="text-4 mono">
                {t("suggestions.missing")}: {cookBalance.missing.map(m => m.ingredient_name).join(", ")}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={shortfalls.length > 0}
        onClose={() => setShortfalls([])}
        title={t("recipes.cook.shortfallTitle")}
        footer={<button className="btn btn-primary" onClick={() => setShortfalls([])}>{t("common.confirm")}</button>}
      >
        <p className="text-4" style={{ marginBottom: "var(--space-3)" }}>{t("recipes.cook.shortfallDesc")}</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {shortfalls.map(s => (
            <li key={s.ingredient_id} style={{ marginBottom: 6 }}>
              <strong>{s.ingredient_name}</strong>{" — "}
              {t("recipes.cook.shortfallLine", {
                needed: s.needed.toLocaleString("pt-PT"),
                available: s.available.toLocaleString("pt-PT"),
              })}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={listOpen}
        onClose={() => setListOpen(false)}
        title={t("recipes.shoppingList.title")}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setListOpen(false)}>{t("common.cancel")}</button>
            <button
              className="btn btn-primary"
              onClick={handleGenerateList}
              disabled={listBusy || listPicks.length === 0 || !(Number(listMultiplier) > 0)}
            >
              {listBusy ? t("recipes.shoppingList.loading") : t("recipes.shoppingList.submit")}
            </button>
          </>
        }
      >
        <p className="text-4" style={{ marginBottom: "var(--space-3)" }}>{t("recipes.shoppingList.desc")}</p>

        <div className="field">
          <label className="field-label" htmlFor="list-multiplier">{t("recipes.shoppingList.multiplier")}</label>
          <input
            id="list-multiplier"
            className="input"
            type="number"
            min="0.25"
            step="0.25"
            value={listMultiplier}
            onChange={e => setListMultiplier(e.target.value)}
            disabled={listBusy}
            style={{ maxWidth: 140 }}
          />
          <p className="text-4 mono" style={{ marginTop: "var(--space-1)" }}>{t("recipes.shoppingList.multiplierHint")}</p>
        </div>

        <div className="field">
          <label className="field-label">{t("recipes.shoppingList.pick", { count: listPicks.length })}</label>
          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
            {recipes.map(recipe => (
              <label
                key={recipe.id}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "8px 12px", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={listPicks.includes(recipe.id)}
                  disabled={listBusy}
                  onChange={e => setListPicks(prev =>
                    e.target.checked ? [...prev, recipe.id] : prev.filter(id => id !== recipe.id)
                  )}
                />
                <span>{recipe.name}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={closeImport}
        title={t("recipes.import.title")}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeImport}>{t("common.cancel")}</button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importBusy || !importUrl.trim()}
            >
              {importBusy ? t("recipes.import.loading") : t("recipes.import.submit")}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="recipe-import-url">{t("recipes.import.urlLabel")}</label>
          <input
            id="recipe-import-url"
            className="input"
            autoFocus
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleImport(); }}
            placeholder={t("recipes.import.urlPlaceholder")}
            disabled={importBusy}
          />
        </div>
        <p className="text-4 mono" style={{ marginTop: "var(--space-2)" }}>{t("recipes.import.unmatchedNote")}</p>
      </Modal>
    </div>
  );
}
