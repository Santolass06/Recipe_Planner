import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface StockItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: number;
  min_quantity: number;
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

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

const getStatus = (quantity: number, min: number) => {
  if (quantity <= 0) return { label: "Esgotado", class: "status danger" };
  if (quantity <= min) return { label: "Baixo", class: "status warn" };
  return { label: "OK", class: "status ok" };
};

export default function StockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [form, setForm] = useState({ ingredient_id: 0, quantity: 0, min_quantity: 0 });
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" | "info" } | null>(null);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [stockData, ingredientsData] = await Promise.all([
        invoke<StockItem[]>("stock_list"),
        invoke<Ingredient[]>("ingredients_list"),
      ]);
      setStock(stockData);
      setIngredients(ingredientsData);
    } catch (e) {
      showToast("Erro ao carregar dados", "err");
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ ingredient_id: 0, quantity: 0, min_quantity: 0 });
    setEditing(null);
    setModal("create");
  };

  const openEdit = (item: StockItem) => {
    setForm({ ingredient_id: item.ingredient_id, quantity: item.quantity, min_quantity: item.min_quantity });
    setEditing(item);
    setModal("edit");
  };

  const closeModal = () => { setModal(null); setEditing(null); };

  async function handleSave() {
    if (form.ingredient_id === 0 || form.quantity < 0) {
      showToast("Seleciona ingrediente e quantidade válida", "warn");
      return;
    }
    setLoading(true);
    try {
      if (modal === "create") {
        await invoke("stock_upsert", {
          ingredientId: form.ingredient_id,
          quantity: form.quantity,
          minQuantity: form.min_quantity,
        });
        showToast("Stock criado", "ok");
      } else if (editing) {
        await invoke("stock_upsert", {
          ingredientId: form.ingredient_id,
          quantity: form.quantity,
          minQuantity: form.min_quantity,
        });
        showToast("Stock actualizado", "ok");
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
      await invoke("stock_delete", { ingredientId: id });
      showToast("Stock eliminado", "ok");
      await load();
    } catch (e) {
      showToast("Erro ao eliminar", "err");
    }
  }

  const getIngredientName = (id: number) => ingredients.find(i => i.id === id)?.name ?? "—";
  const getIngredientUnit = (id: number) => ingredients.find(i => i.id === id)?.unit ?? "";

  const filtered = stock.filter(s =>
    getIngredientName(s.ingredient_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="content">
      {/* Header */}
      <div className="content-header">
        <div>
          <h1 className="content-title">Armazém</h1>
          <p className="content-sub mono">{stock.length} ingredientes em stock</p>
        </div>
        <div className="search-bar" role="search" aria-label="Pesquisar stock">
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
          Adicionar stock
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="empty" role="status">
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          <p className="empty-title">{search ? "Sem resultados" : "Sem stock registado"}</p>
          <p className="empty-desc">
            {search ? "Tenta outra pesquisa." : "Adiciona o primeiro item de stock para começar."}
          </p>
          {!search && (
            <button className="btn btn-primary" onClick={openCreate}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Adicionar stock
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "45%" }}>Ingrediente</th>
                  <th className="mono" style={{ width: "15%" }}>Qtd Actual</th>
                  <th className="mono" style={{ width: "15%" }}>Mínimo</th>
                  <th style={{ width: "15%" }}>Estado</th>
                  <th style={{ width: "10%" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const status = getStatus(item.quantity, item.min_quantity);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <span>{getIngredientName(item.ingredient_id)}</span>
                          <span className="text-4 mono">({UNIT_LABELS[getIngredientUnit(item.ingredient_id)] ?? getIngredientUnit(item.ingredient_id)})</span>
                        </div>
                      </td>
                      <td className="mono">{item.quantity}</td>
                      <td className="mono">{item.min_quantity}</td>
                      <td>
                        <span className={status.class}>{status.label}</span>
                      </td>
                      <td>
                        <div className="ingredient-actions" role="group" aria-label={`Ações para ${getIngredientName(item.ingredient_id)}`}>
                          <button
                            className="btn-icon"
                            onClick={() => openEdit(item)}
                            title="Editar"
                            aria-label={`Editar ${getIngredientName(item.ingredient_id)}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            className="btn-icon danger"
                            onClick={() => handleDelete(item.id)}
                            title="Eliminar"
                            aria-label={`Eliminar ${getIngredientName(item.ingredient_id)}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {modal === "create" ? "Novo stock" : "Editar stock"}
              </h2>
              <button className="modal-close" onClick={closeModal} aria-label="Fechar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </header>
            <div className="modal-body">
              <div className="field">
                <label className="field-label" htmlFor="stock-ingredient">Ingrediente</label>
                <select
                  id="stock-ingredient"
                  className="select"
                  value={form.ingredient_id}
                  onChange={e => setForm(f => ({ ...f, ingredient_id: parseInt(e.target.value) }))}
                  disabled={modal === "edit"}
                >
                  <option value={0}>Seleciona ingrediente</option>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({UNIT_LABELS[i.unit] ?? i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-row">
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="stock-quantity">Quantidade actual</label>
                  <input
                    id="stock-quantity"
                    type="number"
                    className="input input-num"
                    min="0"
                    step="0.01"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label" htmlFor="stock-min">Quantidade mínima</label>
                  <input
                    id="stock-min"
                    type="number"
                    className="input input-num"
                    min="0"
                    step="0.01"
                    value={form.min_quantity}
                    onChange={e => setForm(f => ({ ...f, min_quantity: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={loading || form.ingredient_id === 0 || form.quantity < 0}
              >
                {loading ? "A guardar…" : "Guardar"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`} role="alert" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {toast.type === "ok" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>}
          {toast.type === "err" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          {toast.type === "warn" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          {toast.type === "info" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}