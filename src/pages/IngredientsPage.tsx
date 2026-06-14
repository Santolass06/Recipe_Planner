import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import IngredientAvatar from "../components/IngredientAvatar";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

const UNIT_GROUPS = [
  { label: "Peso",      units: ["gram","kilogram","milligram","ounce","pound","pinch","bunch","clove","slice"] },
  { label: "Volume",    units: ["milliliter","liter","fluid_ounce","cup","pint","quart","gallon"] },
  { label: "Culinário", units: ["teaspoon","tablespoon"] },
  { label: "Contagem",  units: ["piece","dozen"] },
  { label: "Outros",    units: ["centimeter","celsius","fahrenheit"] },
];

const UNIT_LABELS: Record<string, string> = {
  gram:"g — Grama", kilogram:"kg — Quilograma", milligram:"mg — Miligrama",
  ounce:"oz — Onça", pound:"lb — Libra", pinch:"pitada — Pitada",
  bunch:"molho — Molho", clove:"dente — Dente", slice:"fatia — Fatia",
  milliliter:"ml — Mililitro", liter:"l — Litro",
  fluid_ounce:"fl oz — Fluid Ounce", cup:"cup — Chávena",
  pint:"pt — Pint", quart:"qt — Quart", gallon:"gal — Galão",
  teaspoon:"tsp — Colher de chá", tablespoon:"tbsp — Colher de sopa",
  piece:"pcs — Peça", dozen:"dz — Dúzia",
  centimeter:"cm — Centímetro", celsius:"°C — Celsius",
  fahrenheit:"°F — Fahrenheit",
};

const EMPTY_FORM = { name: "", unit: "gram", price_per_unit: 0 };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch (e) {
      showToast("Erro ao carregar ingredientes", "err");
    }
  }

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

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
          name: form.name.trim(),
          unit: form.unit,
          pricePerUnit: form.price_per_unit,
        });
        showToast("Ingrediente criado", "ok");
      } else if (editing) {
        await invoke("ingredient_update", {
          id: editing.id,
          name: form.name.trim(),
          unit: form.unit,
          pricePerUnit: form.price_per_unit,
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
    <div>
      {/* header */}
      <div className="content-header">
        <div>
          <h1 className="content-title">Ingredientes</h1>
          <p className="content-sub">{ingredients.length} ingredientes</p>
        </div>
        <div className="spacer" />
        <div className="search-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Pesquisar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo ingrediente
        </button>
      </div>

      {/* lista vazia */}
      {filtered.length === 0 && (
        <div className="empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
            style={{ color: "var(--text-3)" }}>
            <path d="M2 22 16 8M16 3s0 7-8 13"/>
          </svg>
          <p style={{ margin: 0, fontWeight: 500 }}>
            {search ? "Sem resultados" : "Sem ingredientes"}
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            {search ? "Tenta outra pesquisa." : "Adiciona o primeiro ingrediente."}
          </p>
          {!search && (
            <button className="btn-primary" onClick={openCreate}>
              + Novo ingrediente
            </button>
          )}
        </div>
      )}

      {/* grelha */}
      {filtered.length > 0 && (
        <div className="ingredient-grid">
          {filtered.map(ing => (
            <div key={ing.id} className="ingredient-card">
              <IngredientAvatar name={ing.name} />
              <div className="ingredient-info">
                <p className="ingredient-name">{ing.name}</p>
                <p className="ingredient-meta">
                  {UNIT_LABELS[ing.unit] ?? ing.unit}
                </p>
              </div>
              <p className="ingredient-price">
                {ing.price_per_unit.toFixed(2)} €
              </p>

              {confirmDelete === ing.id ? (
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"var(--text-2)" }}>
                    Tens a certeza?
                  </span>
                  <button
                    className="btn-icon danger"
                    onClick={() => handleDelete(ing.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => setConfirmDelete(null)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="ingredient-actions">
                  <button
                    className="btn-icon"
                    onClick={() => openEdit(ing)}
                    title="Editar"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => setConfirmDelete(ing.id)}
                    title="Eliminar"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* modal */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              {modal === "create" ? "Novo ingrediente" : "Editar ingrediente"}
            </h2>

            <div className="field">
              <label>Nome</label>
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                placeholder="ex: Arroz arbório"
              />
            </div>

            <div className="field">
              <label>Unidade</label>
              <select
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
              <label>Preço por unidade (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price_per_unit}
                onChange={e => setForm(f => ({
                  ...f,
                  price_per_unit: parseFloat(e.target.value) || 0
                }))}
              />
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={loading || !form.name.trim()}
              >
                {loading ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 20, right: 20,
          background: toast.type === "ok" ? "var(--bg-status-ok)" : "var(--bg-status-out)",
          border: `1px solid ${toast.type === "ok" ? "var(--ok)" : "var(--out)"}`,
          color: toast.type === "ok" ? "var(--ok)" : "var(--out)",
          borderRadius: "var(--radius)", padding: "10px 16px",
          fontSize: 13, zIndex: 200,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
