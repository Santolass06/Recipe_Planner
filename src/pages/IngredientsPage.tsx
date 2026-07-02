import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../components/ui/Toast";
import IngredientAvatar from "../components/IngredientAvatar";
import ImageUpload from "../components/ImageUpload";

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

  const load = useCallback(async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch (e) {
      showToast("Erro ao carregar ingredientes", "err");
    }
  }, [showToast]);

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
        showToast("Ingrediente criado", "ok");
      } else if (editing) {
        await invoke("ingredient_update", {
          id: editing.id,
          input: {
            name: form.name.trim(),
            unit: form.unit,
            price_per_unit: form.price_per_unit,
          },
        });
        showToast("Ingrediente actualizado", "ok");
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
      await invoke("ingredient_delete", { id });
      setConfirmDelete(null);
      showToast("Ingrediente eliminado", "ok");
      await load();
    } catch (e) {
      showToast("Erro ao eliminar", "err");
    }
  }

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="content">
      {/* Header */}
      <div className="content-header">
        <div>
          <h1 className="content-title">Ingredientes</h1>
          <p className="content-sub mono">{ingredients.length} ingredientes</p>
        </div>
        <div className="search-bar" role="search" aria-label="Pesquisar ingredientes">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Pesquisar ingredientes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Pesquisar"
          />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo ingrediente
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="empty" role="status">
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <path d="M2 22 16 8M16 3s0 7-8 13"/>
          </svg>
          <p className="empty-title">{search ? "Sem resultados" : "Sem ingredientes"}</p>
          <p className="empty-desc">
            {search ? "Tenta outra pesquisa." : "Adiciona o primeiro ingrediente para começar."}
          </p>
          {!search && (
            <button className="btn btn-primary" onClick={openCreate}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Adicionar ingrediente
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 && (
        <div className="ingredient-grid" role="list" aria-label="Lista de ingredientes">
          {filtered.map(ing => (
            <article key={ing.id} className="ingredient-card" role="listitem">
              <IngredientAvatar name={ing.name} />
              <div className="ingredient-info">
                <p className="ingredient-name">{ing.name}</p>
                <p className="ingredient-meta mono">{UNIT_LABELS[ing.unit] ?? ing.unit}</p>
              </div>
              <p className="ingredient-price mono">{ing.price_per_unit.toFixed(2)} €</p>

              {confirmDelete === ing.id ? (
                <div className="confirm-inline" role="alert" aria-live="polite">
                  <span>Eliminar “{ing.name}”?</span>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(ing.id)}
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
              ) : (
                <div className="ingredient-actions" role="group" aria-label="Ações do ingrediente">
                  <button
                    className="btn-icon"
                    onClick={() => openEdit(ing)}
                    title="Editar"
                    aria-label={`Editar ${ing.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => setConfirmDelete(ing.id)}
                    title="Eliminar"
                    aria-label={`Eliminar ${ing.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {modal === "create" ? "Novo ingrediente" : "Editar ingrediente"}
              </h2>
              <button className="modal-close" onClick={closeModal} aria-label="Fechar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </header>
            <div className="modal-body">
              <div className="field">
                <label className="field-label" htmlFor="name">Nome</label>
                <input
                  id="name"
                  className="input"
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSave()}
                  placeholder="ex: Arroz arbório"
                  aria-describedby="name-hint"
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="unit">Unidade</label>
                <select
                  id="unit"
                  className="select"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                >
                  {UNIT_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.units.map(u => (
                        <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="price">Preço por unidade (€)</label>
                <input
                  id="price"
                  type="number"
                  className="input input-num"
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
                <label className="field-label">Imagem do ingrediente</label>
                <ImageUpload
                  entityType="ingredient"
                  entityId={editing?.id ?? 0}
                />
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={loading || !form.name.trim()}
              >
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}