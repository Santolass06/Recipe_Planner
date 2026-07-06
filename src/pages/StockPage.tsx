import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import StatusPill from "../components/ui/StatusPill";
import SearchBar from "../components/ui/SearchBar";
import { useI18n } from "../i18n";
import type { StockItem } from "../../crates/core/bindings/StockItem";
import type { Ingredient } from "../../crates/core/bindings/Ingredient";
import type { Supplier } from "../../crates/core/bindings/Supplier";
import type { StockPurchase } from "../../crates/core/bindings/StockPurchase";
import { UNIT_LABELS_FULL as UNIT_LABELS } from "../lib/units";

type T = (key: string, params?: Record<string, string | number>) => string;

const getStatus = (quantity: number, min: number, t: T) => {
  if (quantity <= 0) return { label: t("stock.statusOut"), status: "out" as const };
  if (quantity <= min) return { label: t("stock.statusLow"), status: "low" as const };
  return { label: t("stock.statusOk"), status: "ok" as const };
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

function StockTable({ items, ingredients, onEdit, onDelete, onPurchase, t }: any) {
  const getIngredientName = (id: number) => ingredients.find((i: any) => i.id === id)?.name ?? "—";
  const getIngredientUnit = (id: number) => ingredients.find((i: any) => i.id === id)?.unit ?? "";

  return (
    <div className="card" style={{ overflow: "hidden", padding: 0 }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("common.name")}</th>
              <th style={{ width: 160 }}>{t("stock.colLevel")}</th>
              <th style={{ textAlign: "right" }}>{t("stock.colStock")}</th>
              <th style={{ textAlign: "right" }}>{t("stock.colMin")}</th>
              <th style={{ textAlign: "right" }}>{t("stock.colStatus")}</th>
              <th style={{ textAlign: "right" }}>{t("stock.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const s = getStatus(item.quantity, item.min_quantity, t);
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
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(item); }} title={t("stock.adjust")}>
                        {t("stock.adjust")}
                      </button>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onPurchase(item); }} title={t("stock.registerPurchase")}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5V7M16 7V4M8 7V4M3 18H21M7 18V12M17 18V12M7 12H17"/></svg>
                      </button>
                      <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); onDelete(item); }} title={t("common.delete")}>
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
  open, onClose, editing, form, setForm, loading, handleSave, ingredients, t
}: {
  open: boolean;
  onClose: () => void;
  editing: boolean;
  form: { ingredient_id: number; quantity: number; min_quantity: number };
  setForm: any;
  loading: boolean;
  handleSave: () => void;
  ingredients: Ingredient[];
  t: T;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t("stock.modal.editTitle") : t("stock.modal.newTitle")}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || form.ingredient_id === 0 || form.quantity < 0}>
            {loading ? t("stock.modal.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="stock-ingredient">{t("stock.modal.ingredientLabel")}</label>
        <select id="stock-ingredient" className="select" value={form.ingredient_id} onChange={e => setForm((f: any) => ({ ...f, ingredient_id: parseInt(e.target.value) }))} disabled={editing}>
          <option value={0}>{t("stock.modal.selectIngredient")}</option>
          {ingredients.map((i: any) => (
            <option key={i.id} value={i.id}>{i.name} ({UNIT_LABELS[i.unit] ?? i.unit})</option>
          ))}
        </select>
      </div>
      <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="stock-quantity">{t("stock.modal.currentQty")}</label>
          <input id="stock-quantity" type="number" className="input input-num" min="0" step="0.01" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="stock-min">{t("stock.modal.minQty")}</label>
          <input id="stock-min" type="number" className="input input-num" min="0" step="0.01" value={form.min_quantity} onChange={e => setForm((f: any) => ({ ...f, min_quantity: parseFloat(e.target.value) || 0 }))} />
        </div>
      </div>
    </Modal>
  );
}

function BrandBreakdown({ purchases, t }: { purchases: StockPurchase[]; t: T }) {
  const byBrand = new Map<string, { quantity: number; weightedCost: number; unit: string }>();
  for (const p of purchases) {
    const key = p.brand ?? t("stock.purchaseModal.noBrand");
    const entry = byBrand.get(key) ?? { quantity: 0, weightedCost: 0, unit: p.unit };
    entry.quantity += p.quantity;
    entry.weightedCost += p.quantity * p.price_per_unit;
    byBrand.set(key, entry);
  }
  if (byBrand.size <= 1) return null;

  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <h3 className="title-4" style={{ marginBottom: "var(--space-2)" }}>{t("stock.purchaseModal.brandBreakdownTitle")}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...byBrand.entries()].map(([brand, { quantity, weightedCost, unit }]) => (
          <div key={brand} className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 10px", background: "var(--inset)", borderRadius: 8 }}>
            <span>{brand}</span>
            <span style={{ color: "var(--ink-3)" }}>{quantity} {UNIT_LABELS[unit] ?? unit} · {t("stock.purchaseModal.avgPrice")} {(weightedCost / quantity).toFixed(2)} €</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PurchaseModal({
  open, onClose, form, setForm, loading, handleSave, ingredientName, suppliers, purchases, loadingPurchases, t
}: any) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("stock.purchaseModal.title", { name: ingredientName })}
      wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || form.ingredient_id === 0 || form.quantity <= 0 || form.price_per_unit <= 0}>
            {loading ? t("stock.purchaseModal.registering") : t("stock.purchaseModal.registerBtn")}
          </button>
        </>
      }
    >
      <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "var(--space-2)" }}>
        <div className="field">
          <label className="field-label" htmlFor="purchase-qty">{t("stock.purchaseModal.quantity")}</label>
          <input id="purchase-qty" type="number" className="input input-num" min="0.01" step="0.01" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-unit">{t("stock.purchaseModal.unit")}</label>
            <select id="purchase-unit" className="select" value={form.unit} onChange={e => setForm((f: any) => ({ ...f, unit: e.target.value }))}>
              {Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label as string}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-price">{t("stock.purchaseModal.pricePerUnit")}</label>
            <input id="purchase-price" type="number" className="input input-num" min="0" step="0.01" value={form.price_per_unit} onChange={e => setForm((f: any) => ({ ...f, price_per_unit: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>
        <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-date">{t("stock.purchaseModal.purchaseDate")}</label>
            <input id="purchase-date" type="date" className="input" value={form.purchase_date} onChange={e => setForm((f: any) => ({ ...f, purchase_date: e.target.value }))} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-supplier">{t("stock.purchaseModal.supplier")}</label>
            <select id="purchase-supplier" className="select" value={form.supplier_id ?? ""} onChange={e => {
              const val = e.target.value;
              setForm((f: any) => ({ ...f, supplier_id: val ? parseInt(val) : "" }));
            }}>
              <option value="">{t("stock.purchaseModal.noneSupplier")}</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="purchase-brand">{t("stock.purchaseModal.brand")}</label>
          <input id="purchase-brand" className="input" value={form.brand} onChange={e => setForm((f: any) => ({ ...f, brand: e.target.value }))} placeholder={t("stock.purchaseModal.brandPlaceholder")} />
        </div>
        <div className="field-row" style={{ display: "flex", gap: "var(--space-3)" }}>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" htmlFor="purchase-discount">{t("stock.purchaseModal.discount")}</label>
            <input id="purchase-discount" type="number" className="input input-num" min="0" max="100" step="1" value={form.discount_percent} onChange={e => setForm((f: any) => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <input type="checkbox" checked={form.is_discount} onChange={e => setForm((f: any) => ({ ...f, is_discount: e.target.checked }))} />
              <span>{t("stock.purchaseModal.wasPromo")}</span>
            </label>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="purchase-notes">{t("stock.purchaseModal.notes")}</label>
          <textarea id="purchase-notes" className="textarea" rows={3} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder={t("stock.purchaseModal.notesPlaceholder")} />
        </div>
        <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "var(--inset)", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="text-2">{t("stock.purchaseModal.total")} <strong className="mono">{(form.quantity * form.price_per_unit).toFixed(2)} €</strong></span>
            <span className="text-4 mono">{t("stock.purchaseModal.subtotal")} {(form.quantity * form.price_per_unit).toFixed(2)} €</span>
          </div>
          {form.is_discount && form.discount_percent > 0 && (
            <div className="text-4" style={{ marginTop: "var(--space-2)" }}>
              {t("stock.purchaseModal.withDiscount", { pct: form.discount_percent, amount: (form.quantity * form.price_per_unit * (1 - form.discount_percent / 100)).toFixed(2) })}
            </div>
          )}
        </div>
        {purchases.length > 0 && (
          <div style={{ marginTop: "var(--space-6)" }}>
            <BrandBreakdown purchases={purchases} t={t} />
            <h3 className="title-4" style={{ marginBottom: "var(--space-3)" }}>{t("stock.purchaseModal.historyTitle")}</h3>
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("stock.purchaseModal.colDate")}</th>
                      <th>{t("stock.purchaseModal.colQty")}</th>
                      <th style={{ textAlign: "right" }}>{t("stock.purchaseModal.colPricePerUnit")}</th>
                      <th style={{ textAlign: "right" }}>{t("stock.purchaseModal.colTotal")}</th>
                      <th style={{ textAlign: "right" }}>{t("stock.purchaseModal.colPromo")}</th>
                      <th>{t("stock.purchaseModal.colBrand")}</th>
                      <th>{t("stock.purchaseModal.colSupplier")}</th>
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
                        <td>{p.brand ?? "—"}</td>
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
    brand: string;
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
    brand: "",
    notes: "",
  });
  const [form, setForm] = useState({ ingredient_id: 0, quantity: 0, min_quantity: 0 });
  const [loading, setLoading] = useState(false);
  
  const { showToast } = useToast();
  const { t } = useI18n();

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
      showToast(t("stock.loadError"), "err");
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await invoke<Supplier[]>("suppliers_list");
      setSuppliers(data);
    } catch (e) {
      showToast(t("stock.suppliersLoadError"), "err");
    }
  }, [showToast, t]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const loadPurchases = useCallback(async (ingredientId: number) => {
    setLoadingPurchases(true);
    try {
      const data = await invoke<StockPurchase[]>("stock_purchases_list", { ingredientId });
      setPurchases(data);
    } catch (e) {
      showToast(t("stock.purchasesLoadError"), "err");
    } finally {
      setLoadingPurchases(false);
    }
  }, [showToast, t]);

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
      brand: "",
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
      showToast(t("stock.selectValid"), "warn");
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
      showToast(modal === "create" ? t("stock.created") : t("stock.updated"), "ok");
      closeModal();
      await load();
    } catch (e) {
      showToast(t("stock.saveError"), "err");
    } finally {
      setLoading(false);
    }
  }

  async function performDelete() {
    if (!confirmDelete) return;
    try {
      await invoke("stock_delete", { ingredientId: confirmDelete.ingredient_id });
      showToast(t("stock.deleted"), "ok");
      await load();
    } catch (e) {
      showToast(t("stock.deleteError"), "err");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handlePurchaseSave() {
    if (purchaseForm.ingredient_id === 0 || purchaseForm.quantity <= 0 || purchaseForm.price_per_unit <= 0) {
      showToast(t("stock.fillFields"), "warn");
      return;
    }
    if (purchaseForm.discount_percent < 0 || purchaseForm.discount_percent > 100) {
      showToast(t("stock.discountRange"), "warn");
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
          brand: purchaseForm.brand || null,
          notes: purchaseForm.notes || null,
        },
      });
      showToast(t("stock.purchaseRegistered"), "ok");
      closePurchaseModal();
      await load();
      if (selectedIngredientForPurchases) {
        await loadPurchases(selectedIngredientForPurchases.ingredient_id);
      }
    } catch (e) {
      showToast(t("stock.purchaseError"), "err");
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
        title={t("stock.title")}
        subtitle={t("stock.subtitle", { count: stock.length })}
        search={<SearchBar value={search} onChange={setSearch} placeholder={t("stock.searchPlaceholder")} />}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("stock.addStock")}
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
          title={search ? t("stock.noResults") : t("stock.empty")}
          body={search ? t("stock.noResultsDesc") : t("stock.emptyDesc")}
          action={
            !search && (
              <button className="btn btn-primary" onClick={openCreate}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {t("stock.addStock")}
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
          t={t}
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
          t={t}
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
          t={t}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("stock.confirmDeleteTitle")}
        body={confirmDelete ? t("stock.confirmDeleteBody", { name: getIngredientName(confirmDelete.ingredient_id) }) : ""}
        onConfirm={performDelete}
        onCancel={() => setConfirmDelete(null)}
        danger
      />
    </div>
  );
}