import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import StatusPill from "../components/ui/StatusPill";
import SearchBar from "../components/ui/SearchBar";

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

interface Supplier {
  id: number;
  name: string;
  contact?: string;
  notes?: string;
}

interface StockPurchase {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_price: number;
  is_discount: boolean;
  discount_percent: number;
  purchase_date: string;
  supplier_id?: number;
  supplier_name?: string;
  notes?: string;
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
  if (quantity <= 0) return { label: "Esgotado", status: "out" as const };
  if (quantity <= min) return { label: "Baixo", status: "low" as const };
  return { label: "OK", status: "ok" as const };
};

// --- Subcomponents ---

const LEVEL_COLOR: Record<string, string> = {
  ok: "var(--green)",
  low: "var(--amber)",
  out: "var(--red)",
};

function levelPct(quantity: number, min: number) {
  if (min > 0) {
    const pct = (quantity / (min * 2)) * 100;
    return Math.max(0, Math.min(100, pct));
  }
  return quantity > 0 ? 100 : 0;
}

function StockTable({ items, ingredients, onEdit, onDelete, onPurchase }: any) {
  const getIngredientName = (id: number) => ingredients.find((i: any) => i.id === id)?.name ?? "—";
  const getIngredientUnit = (id: number) => ingredients.find((i: any) => i.id === id)?.unit ?? "";

  return (
    <div className="card" style={{ overflow: "hidden", padding: 0 }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th style={{ width: 160 }}>Nível</th>
              <th style={{ textAlign: "right" }}>Stock</th>
              <th style={{ textAlign: "right" }}>Mínimo</th>
              <th style={{ textAlign: "right" }}>Estado</th>
              <th style={{ textAlign: "right" }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const s = getStatus(item.quantity, item.min_quantity);
              const pct = levelPct(item.quantity, item.min_quantity);
              const unit = UNIT_LABELS[getIngredientUnit(item.ingredient_id)] ?? getIngredientUnit(item.ingredient_id);
              return (
                <tr key={item.id}>
                  <td>{getIngredientName(item.ingredient_id)}</td>
                  <td>
                    <div style={{ height: 7, borderRadius: 4, background: "var(--inset)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: LEVEL_COLOR[s.status], borderRadius: 4 }} />
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>{item.quantity} {unit}</td>
                  <td className="mono text-4" style={{ textAlign: "right" }}>{item.min_quantity} {unit}</td>
                  <td style={{ textAlign: "right" }}>
                    <StatusPill status={s.status} label={s.label} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="ingredient-actions" role="group" style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(item); }} title="Ajustar">
                        Ajustar
                      </button>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onPurchase(item); }} title="Registar compra">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5V7M16 7V4M8 7V4M3 18H21M7 18V12M17 18V12M7 12H17"/></svg>
                      </button>
                      <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); onDelete(item); }} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockModal({
  open, onClose, editing, form, setForm, loading, handleSave, ingredients
}: {
  open: boolean;
  onClose: () => void;
  editing: boolean;
  form: { ingredient_id: number; quantity: number; min_quantity: number };
  setForm: any;
  loading: boolean;
  handleSave: () => void;
  ingredients: Ingredient[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar stock" : "Novo stock"}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || form.ingredient_id === 0 || form.quantity < 0}>
            {loading ? "A guardar…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="stock-ingredient">Ingrediente</label>
        <select id="stock-ingredient" className="select" value={form.ingredient_id} onChange={e => setForm((f: any) => ({ ...f, ingredient_id: parseInt(e.target.value) }))} disabled={editing}>
          <option value={0}>Seleciona ingrediente</option>
          {ingredients.map((i: any) => (
            <option key={i.id} value={i.id}>{i.name} ({UNIT_LABELS[i.unit] ?? i.unit})</option>
          ))}
        </select>
      </div>
      <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="stock-quantity">Quantidade actual</label>
          <input id="stock-quantity" type="number" className="input input-num" min="0" step="0.01" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="stock-min">Quantidade mínima</label>
          <input id="stock-min" type="number" className="input input-num" min="0" step="0.01" value={form.min_quantity} onChange={e => setForm((f: any) => ({ ...f, min_quantity: parseFloat(e.target.value) || 0 }))} />
        </div>
      </div>
    </Modal>
  );
}

function PurchaseModal({
  open, onClose, form, setForm, loading, handleSave, ingredientName, suppliers, purchases, loadingPurchases
}: any) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registar compra — ${ingredientName}`}
      wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || form.ingredient_id === 0 || form.quantity <= 0 || form.price_per_unit <= 0}>
            {loading ? "A registar…" : "Registar compra"}
          </button>
        </>
      }
    >
      <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "var(--space-2)" }}>
        <div className="field">
          <label className="field-label" htmlFor="purchase-qty">Quantidade</label>
          <input id="purchase-qty" type="number" className="input input-num" min="0.01" step="0.01" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-unit">Unidade</label>
            <select id="purchase-unit" className="select" value={form.unit} onChange={e => setForm((f: any) => ({ ...f, unit: e.target.value }))}>
              {Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-price">Preço por unidade (€)</label>
            <input id="purchase-price" type="number" className="input input-num" min="0" step="0.01" value={form.price_per_unit} onChange={e => setForm((f: any) => ({ ...f, price_per_unit: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>
        <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-date">Data da compra</label>
            <input id="purchase-date" type="date" className="input" value={form.purchase_date} onChange={e => setForm((f: any) => ({ ...f, purchase_date: e.target.value }))} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-supplier">Fornecedor</label>
            <select id="purchase-supplier" className="select" value={form.supplier_id ?? ""} onChange={e => {
              const val = e.target.value;
              setForm((f: any) => ({ ...f, supplier_id: val ? parseInt(val) : "" }));
            }}>
              <option value="">— Nenhum —</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-discount">Desconto (%)</label>
            <input id="purchase-discount" type="number" className="input input-num" min="0" max="100" step="1" value={form.discount_percent} onChange={e => setForm((f: any) => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <input type="checkbox" checked={form.is_discount} onChange={e => setForm((f: any) => ({ ...f, is_discount: e.target.checked }))} />
              <span>Era promoção?</span>
            </label>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="purchase-notes">Notas</label>
          <textarea id="purchase-notes" className="textarea" rows={3} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="Observações opcionais…" />
        </div>
        <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "var(--inset)", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="text-2">Total: <strong className="mono">{(form.quantity * form.price_per_unit).toFixed(2)} €</strong></span>
            <span className="text-4 mono">Subtotal: {(form.quantity * form.price_per_unit).toFixed(2)} €</span>
          </div>
          {form.is_discount && form.discount_percent > 0 && (
            <div className="text-4" style={{ marginTop: "var(--space-2)" }}>
              Com desconto de {form.discount_percent}%: {(form.quantity * form.price_per_unit * (1 - form.discount_percent / 100)).toFixed(2)} €
            </div>
          )}
        </div>
        {purchases.length > 0 && (
          <div style={{ marginTop: "var(--space-6)" }}>
            <h3 className="title-4" style={{ marginBottom: "var(--space-3)" }}>Histórico de compras</h3>
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Qtd</th>
                      <th style={{ textAlign: "right" }}>Preço/unid</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "right" }}>Promoção</th>
                      <th>Fornecedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p: any) => (
                      <tr key={p.id}>
                        <td className="mono">{p.purchase_date.split("T")[0]}</td>
                        <td className="mono">{p.quantity} {UNIT_LABELS[p.unit] ?? p.unit}</td>
                        <td className="mono" style={{ textAlign: "right" }}>{p.price_per_unit.toFixed(2)} €</td>
                        <td className="mono" style={{ textAlign: "right" }}>{p.total_price.toFixed(2)} €</td>
                        <td style={{ textAlign: "right" }}>
                          {p.is_discount ? <StatusPill status="ok" label={`${p.discount_percent}%`} /> : <span className="text-4">—</span>}
                        </td>
                        <td>{p.supplier_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {loadingPurchases && (
          <div className="flex-center" style={{ padding: "var(--space-6)" }}>
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/></svg>
          </div>
        )}
      </div>
    </Modal>
  );
}

// --- Main Page Component ---

export default function StockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<"create" | null>(null);
  const [selectedIngredientForPurchases, setSelectedIngredientForPurchases] = useState<StockItem | null>(null);
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<{
    ingredient_id: number;
    quantity: number;
    unit: string;
    price_per_unit: number;
    total_price: number;
    is_discount: boolean;
    discount_percent: number;
    purchase_date: string;
    supplier_id: number | string;
    notes: string;
  }>({
    ingredient_id: 0,
    quantity: 0,
    unit: "gram",
    price_per_unit: 0,
    total_price: 0,
    is_discount: false,
    discount_percent: 0,
    purchase_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    notes: "",
  });
  const [form, setForm] = useState({ ingredient_id: 0, quantity: 0, min_quantity: 0 });
  const [loading, setLoading] = useState(false);
  
  const { showToast } = useToast();
  
  const [confirmDelete, setConfirmDelete] = useState<StockItem | null>(null);

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

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await invoke<Supplier[]>("suppliers_list");
      setSuppliers(data);
    } catch (e) {
      showToast("Erro ao carregar fornecedores", "err");
    }
  }, [showToast]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const loadPurchases = useCallback(async (ingredientId: number) => {
    setLoadingPurchases(true);
    try {
      const data = await invoke<StockPurchase[]>("stock_purchases_list", { ingredientId });
      setPurchases(data);
    } catch (e) {
      showToast("Erro ao carregar compras", "err");
    } finally {
      setLoadingPurchases(false);
    }
  }, [showToast]);

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

  const closeModal = () => { setModal(null); setEditing(null); }

  const openPurchaseModal = (item: StockItem) => {
    const ing = ingredients.find(i => i.id === item.ingredient_id);
    setPurchaseForm(f => ({
      ...f,
      ingredient_id: item.ingredient_id,
      unit: ing?.unit ?? "gram",
      quantity: 0,
      price_per_unit: ing?.price_per_unit ?? 0,
      total_price: 0,
      is_discount: false,
      discount_percent: 0,
    }));
    setSelectedIngredientForPurchases(item);
    loadPurchases(item.ingredient_id);
    setPurchaseModal("create");
  };

  const closePurchaseModal = () => {
    setPurchaseModal(null);
    setSelectedIngredientForPurchases(null);
    setPurchases([]);
  };

  async function handleSave() {
    if (form.ingredient_id === 0 || form.quantity < 0) {
      showToast("Seleciona ingrediente e quantidade válida", "warn");
      return;
    }
    setLoading(true);
    try {
      await invoke("stock_upsert", {
        input: {
          ingredient_id: form.ingredient_id,
          quantity: form.quantity,
          min_quantity: form.min_quantity,
        },
      });
      showToast(modal === "create" ? "Stock criado" : "Stock actualizado", "ok");
      closeModal();
      await load();
    } catch (e) {
      showToast("Erro ao guardar", "err");
    } finally {
      setLoading(false);
    }
  }

  async function performDelete() {
    if (!confirmDelete) return;
    try {
      await invoke("stock_delete", { ingredientId: confirmDelete.ingredient_id });
      showToast("Stock eliminado", "ok");
      await load();
    } catch (e) {
      showToast("Erro ao eliminar", "err");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handlePurchaseSave() {
    if (purchaseForm.ingredient_id === 0 || purchaseForm.quantity <= 0 || purchaseForm.price_per_unit <= 0) {
      showToast("Preenche ingrediente, quantidade e preço", "warn");
      return;
    }
    if (purchaseForm.discount_percent < 0 || purchaseForm.discount_percent > 100) {
      showToast("Desconto entre 0 e 100%", "warn");
      return;
    }
    setLoading(true);
    try {
      const total = purchaseForm.quantity * purchaseForm.price_per_unit;
      await invoke("stock_purchase_add", {
        input: {
          ingredient_id: purchaseForm.ingredient_id,
          quantity: purchaseForm.quantity,
          unit: purchaseForm.unit,
          price_per_unit: purchaseForm.price_per_unit,
          total_price: total,
          is_discount: purchaseForm.is_discount,
          discount_percent: purchaseForm.discount_percent,
          // StockPurchaseInput.purchase_date é DateTime<Utc> (chrono) — exige RFC3339.
          // O formulário guarda só "YYYY-MM-DD", por isso acrescentamos a hora UTC.
          purchase_date: `${purchaseForm.purchase_date}T00:00:00Z`,
          supplier_id: purchaseForm.supplier_id ? Number(purchaseForm.supplier_id) : null,
          notes: purchaseForm.notes || null,
        },
      });
      showToast("Compra registada e stock actualizado", "ok");
      closePurchaseModal();
      await load();
      if (selectedIngredientForPurchases) {
        await loadPurchases(selectedIngredientForPurchases.ingredient_id);
      }
    } catch (e) {
      showToast("Erro ao registar compra", "err");
    } finally {
      setLoading(false);
    }
  }

  const getIngredientName = (id: number) => ingredients.find(i => i.id === id)?.name ?? "—";

  const filtered = stock.filter(s =>
    getIngredientName(s.ingredient_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="content">
      <PageHeader
        title="Armazém"
        subtitle={`${stock.length} ingredientes em stock`}
        search={<SearchBar value={search} onChange={setSearch} placeholder="Pesquisar ingredientes…" />}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Adicionar stock
          </button>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
          }
          title={search ? "Sem resultados" : "Sem stock registado"}
          body={search ? "Tenta outra pesquisa." : "Adiciona o primeiro item de stock para começar."}
          action={
            !search && (
              <button className="btn btn-primary" onClick={openCreate}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Adicionar stock
              </button>
            )
          }
        />
      ) : (
        <StockTable 
          items={filtered} 
          ingredients={ingredients} 
          onEdit={openEdit} 
          onDelete={setConfirmDelete} 
          onPurchase={openPurchaseModal} 
        />
      )}

      {modal && (
        <StockModal
          open={!!modal}
          onClose={closeModal}
          editing={!!editing}
          form={form}
          setForm={setForm}
          loading={loading}
          handleSave={handleSave}
          ingredients={ingredients}
        />
      )}

      {purchaseModal && selectedIngredientForPurchases && (
        <PurchaseModal
          open={!!purchaseModal}
          onClose={closePurchaseModal}
          form={purchaseForm}
          setForm={setPurchaseForm}
          loading={loading}
          handleSave={handlePurchaseSave}
          ingredientName={getIngredientName(selectedIngredientForPurchases.ingredient_id)}
          suppliers={suppliers}
          purchases={purchases}
          loadingPurchases={loadingPurchases}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar stock"
        body={confirmDelete ? `Tem a certeza que deseja eliminar o stock de "${getIngredientName(confirmDelete.ingredient_id)}"?` : ""}
        onConfirm={performDelete}
        onCancel={() => setConfirmDelete(null)}
        danger
      />
    </div>
  );
}