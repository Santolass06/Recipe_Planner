import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import IngredientAvatar from "../components/IngredientAvatar";
import ImageUpload from "../components/ImageUpload";
import { useI18n } from "../i18n";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

type T = (key: string, params?: Record<string, string | number>) => string;

const getUnitGroups = (t: T) => [
  { label: t("ingredients.unitGroups.weight"), units: ["gram", "kilogram", "milligram", "ounce", "pound", "pinch", "bunch", "clove", "slice"] },
  { label: t("ingredients.unitGroups.volume"), units: ["milliliter", "liter", "fluid_ounce", "cup", "pint", "quart", "gallon"] },
  { label: t("ingredients.unitGroups.culinary"), units: ["teaspoon", "tablespoon"] },
  { label: t("ingredients.unitGroups.count"), units: ["piece", "dozen"] },
  { label: t("ingredients.unitGroups.other"), units: ["centimeter", "celsius", "fahrenheit"] },
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

const UNIT_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(UNIT_LABELS).map(([k, v]) => [k, v.split(" — ")[0]])
);

const EMPTY_FORM = { name: "", unit: "gram", price_per_unit: 0 };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { t } = useI18n();

  const load = useCallback(async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch (e) {
      showToast(t("ingredients.loadError"), "err");
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setModal("create");
  }

  function openEdit(ing: Ingredient) {
    setForm({ name: ing.name, unit: ing.unit, price_per_unit: ing.price_per_unit });
    setEditing(ing);
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditing(null); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      if (modal === "create") {
        await invoke("ingredient_create", {
          input: {
            name: form.name.trim(),
            unit: form.unit,
            price_per_unit: form.price_per_unit,
          },
        });
        showToast(t("ingredients.created"), "ok");
      } else if (editing) {
        await invoke("ingredient_update", {
          id: editing.id,
          input: {
            name: form.name.trim(),
            unit: form.unit,
            price_per_unit: form.price_per_unit,
          },
        });
        showToast(t("ingredients.updated"), "ok");
      }
      closeModal();
      await load();
    } catch (e) {
      showToast(t("ingredients.saveError"), "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await invoke("ingredient_delete", { id });
      setConfirmDelete(null);
      showToast(t("ingredients.deleted"), "ok");
      await load();
    } catch (e) {
      showToast(t("ingredients.deleteError"), "err");
    }
  }

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );
  const unitGroups = getUnitGroups(t);

  return (
    <div className="content">
      <PageHeader
        title={t("ingredients.title")}
        subtitle={t(ingredients.length === 1 ? "ingredients.subtitleSingular" : "ingredients.subtitlePlural", { count: ingredients.length })}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">add</span>
            {t("ingredients.newIngredient")}
          </button>
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-4)" }}>
        <div className="search-bar" role="search" aria-label={t("ingredients.searchPlaceholder")} style={{ maxWidth: 320 }}>
          <span className="ms" style={{ fontSize: 18, color: "var(--ink-3)" }} aria-hidden="true">search</span>
          <input
            placeholder={t("ingredients.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label={t("common.search")}
          />
        </div>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
          {t(filtered.length === 1 ? "ingredients.countSingular" : "ingredients.countPlural", { count: filtered.length })}
        </span>
      </div>

      {filtered.length === 0 && (
        <div className="empty" role="status">
          <span className="ms" style={{ fontSize: 44, color: "var(--ink-3)" }} aria-hidden="true">search_off</span>
          <p className="empty-title">{search ? t("ingredients.noResults") : t("ingredients.empty")}</p>
          <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
            {search ? t("ingredients.noResultsDesc") : t("ingredients.emptyDesc")}
          </p>
          {!search && (
            <button className="btn-primary" onClick={openCreate} style={{ marginTop: 8 }}>
              <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">add</span>
              {t("ingredients.addIngredient")}
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>{t("common.name")}</th>
                  <th>{t("ingredients.colUnit")}</th>
                  <th style={{ textAlign: "right" }}>{t("common.price")}</th>
                  <th style={{ width: 100, textAlign: "right" }}>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => (
                  <tr key={ing.id}>
                    <td><IngredientAvatar name={ing.name} /></td>
                    <td style={{ fontWeight: 500 }}>{ing.name}</td>
                    <td className="mono" style={{ color: "var(--ink-2)" }}>{UNIT_SHORT[ing.unit] ?? ing.unit}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{ing.price_per_unit.toFixed(2)} €</td>
                    <td>
                      {confirmDelete === ing.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }} role="alert">
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDelete(ing.id)}
                            aria-label={t("ingredients.confirmDeleteAria")}
                            title={t("common.confirm")}
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">check</span>
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => setConfirmDelete(null)}
                            aria-label={t("common.cancel")}
                            title={t("common.cancel")}
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">close</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }} role="group" aria-label={t("ingredients.actionsAriaLabel")}>
                          <button
                            className="btn-icon"
                            onClick={() => openEdit(ing)}
                            title={t("common.edit")}
                            aria-label={t("ingredients.editAria", { name: ing.name })}
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">edit</span>
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => setConfirmDelete(ing.id)}
                            title={t("common.delete")}
                            aria-label={t("ingredients.deleteAria", { name: ing.name })}
                          >
                            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h2 id="modal-title" className="modal-title" style={{ margin: 0 }}>
                {modal === "create" ? t("ingredients.modal.newTitle") : t("ingredients.modal.editTitle")}
              </h2>
              <button className="btn-icon" onClick={closeModal} aria-label={t("common.close")}>
                <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">close</span>
              </button>
            </header>
            <div>
              <div className="field">
                <label htmlFor="name">{t("common.name")}</label>
                <input
                  id="name"
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSave()}
                  placeholder={t("ingredients.modal.namePlaceholder")}
                />
              </div>

              <div className="field">
                <label htmlFor="unit">{t("ingredients.colUnit")}</label>
                <select
                  id="unit"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                >
                  {unitGroups.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.units.map(u => (
                        <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="price">{t("ingredients.modal.pricePerUnit")}</label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_per_unit}
                  onChange={e => setForm(f => ({
                    ...f,
                    price_per_unit: parseFloat(e.target.value) || 0
                  }))}
                  placeholder="0.00"
                />
              </div>

              <div className="field">
                <label>{t("ingredients.modal.image")}</label>
                <ImageUpload
                  entityType="ingredient"
                  entityId={editing?.id ?? 0}
                />
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>{t("common.cancel")}</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={loading || !form.name.trim()}
              >
                {loading ? t("ingredients.modal.saving") : t("common.save")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
