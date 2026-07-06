import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "../lib/devInvoke";

import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import { useI18n } from "../i18n";
import type { ShoppingItem } from "../../crates/core/bindings/ShoppingItem";
import type { ShoppingList } from "../../crates/core/bindings/ShoppingList";
import type { Ingredient } from "../../crates/core/bindings/Ingredient";
import type { Supplier } from "../../crates/core/bindings/Supplier";
import type { ShoppingListMarkPurchasedInput } from "../../crates/core/bindings/ShoppingListMarkPurchasedInput";
import { UNIT_LABELS_SHORT as UNIT_LABELS } from "../lib/units";

type T = (key: string, params?: Record<string, string | number>) => string;

const CATEGORIES = [
  "Hortícolas", "Frutas", "Carnes e Peixes", "Lacticínios",
  "Pantry (Secos)", "Condimentos", "Bebidas", "Outros"
];

function CategorySection({ category, items, listId, onToggle, onRequestPurchase, onDelete, expandedCategories, toggleExpand, t }: {
  category: string;
  items: ShoppingItem[];
  listId: number;
  onToggle: (id: number, purchased: boolean) => void;
  onRequestPurchase: (item: ShoppingItem) => void;
  onDelete: (id: number) => void;
  expandedCategories: Set<string>;
  toggleExpand: (category: string) => void;
  t: T;
}) {
  const isExpanded = expandedCategories.has(category);
  const purchasedCount = items.filter(i => i.purchased).length;

  return (
    <div style={{ borderBottom: "1px solid var(--line-2)" }}>
      <button
        onClick={() => toggleExpand(category)}
        style={{
          width: "100%", padding: "12px 18px", background: "var(--inset)",
          border: "none", textAlign: "left", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "space-between", fontWeight: 600, textTransform: "capitalize",
          color: "var(--ink)", fontSize: "13px", fontFamily: "var(--sans)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--ink-3)", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform var(--fast)" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {category || t("shoppingList.noCategory")}
        </span>
        <span className="mono" style={{ fontSize: "11px", color: "var(--ink-3)" }}>
          {t("shoppingList.categoryItemsLabel", { count: items.length })} {purchasedCount > 0 && t("shoppingList.categoryPurchasedLabel", { count: purchasedCount })}
        </span>
      </button>

      {isExpanded && (
        <div>
          {items.map((item) => (
            <ShoppingItemRow key={item.id} item={item} listId={listId} onToggle={onToggle} onRequestPurchase={onRequestPurchase} onDelete={onDelete} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShoppingItemRow({ item, listId, onToggle, onRequestPurchase, onDelete, t }: {
  item: ShoppingItem;
  listId: number;
  onToggle: (id: number, purchased: boolean) => void;
  onRequestPurchase: (item: ShoppingItem) => void;
  onDelete: (id: number) => void;
  t: T;
}) {
  const [editing, setEditing] = useState<Partial<ShoppingItem> | null>(null);
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await invoke("shopping_list_update_item_full", {
        listId: listId,
        itemId: item.id,
        input: { ...item, ...editing }
      });
      setEditing(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { background: "var(--inset)", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--ink)", fontFamily: "var(--sans)", padding: "6px 9px", outline: "none" as const };

  if (editing) {
    return (
      <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <input type="text" value={editing.ingredient_name || item.ingredient_name} onChange={(e) => setEditing({ ...editing!, ingredient_name: e.target.value })} style={{ ...inputStyle, fontSize: "13px" }} autoFocus />
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <select value={editing.ingredient_unit || item.ingredient_unit} onChange={(e) => setEditing({ ...editing!, ingredient_unit: e.target.value as ShoppingItem["ingredient_unit"] })} style={{ fontSize: "12px", minWidth: "120px" }}>
              {Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <input type="number" step="0.01" min="0" value={editing?.needed_quantity ?? item.needed_quantity} onChange={(e) => setEditing({ ...editing!, needed_quantity: parseFloat(e.target.value) || 0 })} className="mono" style={{ ...inputStyle, fontSize: "12px", width: "80px" }} />
            <input type="text" value={editing?.category || item.category} onChange={(e) => setEditing({ ...editing!, category: e.target.value })} style={{ ...inputStyle, fontSize: "12px", width: "120px" }} placeholder={t("shoppingList.categoryPlaceholder")} />
            <input type="text" value={editing?.notes || item.notes || ""} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} style={{ ...inputStyle, fontSize: "12px", flex: 1 }} placeholder={t("shoppingList.notesPlaceholder")} />
          </div>
          <div style={{ display: "flex", gap: "var(--space-1)" }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ height: "28px" }}>{saving ? "..." : "OK"}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)} style={{ height: "28px" }}>{t("common.cancel")}</button>
          </div>
        </div>
      </div>
    );
  }

  const unitLabel = UNIT_LABELS[item.ingredient_unit] ?? item.ingredient_unit;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "14px", padding: "13px 18px",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      <button
        type="button"
        onClick={() => item.purchased ? onToggle(item.id, false) : onRequestPurchase(item)}
        aria-pressed={item.purchased}
        title={item.purchased ? t("shoppingList.markUnpurchased") : t("shoppingList.markPurchased")}
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, padding: 0, cursor: "pointer",
          display: "grid", placeItems: "center",
          border: item.purchased ? "1.5px solid var(--green)" : "1.5px solid var(--line)",
          background: item.purchased ? "var(--green)" : "transparent",
        }}
      >
        {item.purchased && <span className="ms" style={{ fontSize: 15, color: "#fff" }}>check</span>}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "13.5px", fontWeight: 500,
          color: item.purchased ? "var(--ink-3)" : "var(--ink)",
          textDecoration: item.purchased ? "line-through" : "none",
        }}>
          {item.ingredient_name}
        </div>
        <div className="mono" style={{ fontSize: "10.5px", color: "var(--ink-3)", marginTop: "2px" }}>
          {(item.category || t("shoppingList.noCategory"))}
          {item.notes ? ` · ${item.notes}` : ""}
          {item.stock_quantity > 0 && ` ${t("shoppingList.stockSuffix", { qty: item.stock_quantity })}`}
        </div>
      </div>

      <span className="mono" style={{ fontSize: "12px", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
        {item.needed_quantity} {unitLabel}
      </span>

      <span className="mono" style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", minWidth: "64px", textAlign: "right" }}>
        {item.estimated_cost.toFixed(2)} €
      </span>

      <div style={{ display: "flex", gap: "var(--space-1)" }}>
        <button className="btn-icon" onClick={() => setEditing({})} title={t("common.edit")} style={{ width: "28px", height: "28px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button className="btn-icon danger" onClick={() => onDelete(item.id)} title={t("common.delete")} style={{ width: "28px", height: "28px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  );
}

function AddItemModal({ isOpen, onClose, listId, ingredients, onAdd, t }: {
  isOpen: boolean; onClose: () => void; listId: number; ingredients: Ingredient[]; onAdd: () => void; t: T;
}) {
  const [search, setSearch] = useState("");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");

  const filteredIngredients = ingredients.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (quickAddMode) {
      if (!quickAddName.trim()) return;
      setLoading(true);
      try {
        await invoke("shopping_list_add_item", {
          listId: listId,
          input: {
            ingredient_id: null,
            ingredient_name: quickAddName.trim(),
            ingredient_unit: unit || "piece",
            needed_quantity: quantity,
            stock_quantity: 0,
            to_buy_quantity: quantity,
            category: category || "Outros",
            estimated_cost: 0,
            purchased: false,
            notes: notes || undefined,
          }
        });
        onClose();
        onAdd();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    } else if (selectedIngredient) {
      setLoading(true);
      try {
        await invoke("shopping_list_add_item", {
          listId: listId,
          input: {
            ingredient_id: selectedIngredient.id,
            ingredient_name: selectedIngredient.name,
            ingredient_unit: unit || selectedIngredient.unit,
            needed_quantity: quantity,
            stock_quantity: 0,
            to_buy_quantity: quantity,
            category: category || "Outros",
            estimated_cost: quantity * selectedIngredient.price_per_unit,
            purchased: false,
            notes: notes || undefined,
          }
        });
        onClose();
        onAdd();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t("shoppingList.addItemModalTitle")}
      wide={true}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || (quickAddMode ? !quickAddName.trim() : !selectedIngredient)}
          >
            {loading ? t("shoppingList.addingToList") : t("shoppingList.addToList")}
          </button>
        </>
      }
    >
      <div style={{ maxHeight: "70vh", overflow: "auto" }}>
        <div className="field">
          <label className="field-label">{t("shoppingList.modeLabel")}</label>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button className={`btn ${!quickAddMode ? "btn-primary" : "btn-secondary"}`} onClick={() => { setQuickAddMode(false); setSelectedIngredient(null); }} style={{ flex: 1 }}>{t("shoppingList.searchIngredientMode")}</button>
            <button className={`btn ${quickAddMode ? "btn-primary" : "btn-secondary"}`} onClick={() => { setQuickAddMode(true); setSelectedIngredient(null); }} style={{ flex: 1 }}>{t("shoppingList.quickAddMode")}</button>
          </div>
        </div>

        {quickAddMode ? (
          <div className="field">
            <label className="field-label" htmlFor="quick-add-name">{t("shoppingList.itemNameLabel")}</label>
            <input id="quick-add-name" className="input" autoFocus value={quickAddName} onChange={e => setQuickAddName(e.target.value)} placeholder={t("shoppingList.itemNamePlaceholder")} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmit()} />
          </div>
        ) : (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder={t("stock.searchPlaceholder")} shortcut="" />
            <div style={{ maxHeight: "300px", overflowY: "auto", marginTop: "var(--space-3)" }}>
              {filteredIngredients.length === 0 ? (
                <p className="text-3" style={{ textAlign: "center", color: "var(--text-3)", padding: "var(--space-4)" }}>
                  {search ? t("shoppingList.noIngredientFound") : t("shoppingList.startTyping")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  {filteredIngredients.map(ing => (
                    <button
                      key={ing.id}
                      className={`ingredient-option${selectedIngredient?.id === ing.id ? " selected" : ""}`}
                      onClick={() => { setSelectedIngredient(ing); setUnit(ing.unit); setCategory("Outros"); }}
                      style={{
                        display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)",
                        border: `1px solid ${selectedIngredient?.id === ing.id ? "var(--brand)" : "var(--border)"}`, borderRadius: "var(--radius)",
                        background: selectedIngredient?.id === ing.id ? "var(--brand-muted)" : "var(--surface)",
                        cursor: "pointer", textAlign: "left", width: "100%", transition: "background var(--fast), border-color var(--fast)"
                      }}
                    >
                      <span style={{ flex: 1, fontWeight: 500 }}>{ing.name}</span>
                      <span className="text-4 mono" style={{ color: "var(--text-3)" }}>{UNIT_LABELS[ing.unit] ?? ing.unit}</span>
                      <span className="mono" style={{ color: "var(--brand)" }}>{ing.price_per_unit.toFixed(2)} €</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!quickAddMode && selectedIngredient && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <div className="field">
              <label className="field-label" htmlFor="qty">{t("shoppingList.quantityLabel")}</label>
              <input id="qty" type="number" className="input input-num" min="0" step="0.01" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="unit">{t("shoppingList.unitLabel")}</label>
              <select id="unit" className="select" value={unit} onChange={e => setUnit(e.target.value)}>
                {Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cat">{t("shoppingList.categoryLabel")}</label>
              <select id="cat" className="select" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="notes">{t("shoppingList.notesLabel")}</label>
              <input id="notes" className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("shoppingList.notesOptionalPlaceholder")} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PurchaseConfirmModal({ item, suppliers, onClose, onConfirm, t }: {
  item: ShoppingItem | null;
  suppliers: Supplier[];
  onClose: () => void;
  onConfirm: (payload: Omit<ShoppingListMarkPurchasedInput, "list_id" | "item_id">) => Promise<void>;
  t: T;
}) {
  const [quantity, setQuantity] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [brand, setBrand] = useState("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    const qty = item.to_buy_quantity > 0 ? item.to_buy_quantity : item.needed_quantity;
    setQuantity(qty);
    setPricePerUnit(qty > 0 ? item.estimated_cost / qty : 0);
    setBrand("");
    setSupplierId("");
  }, [item]);

  if (!item) return null;

  const unitLabel = UNIT_LABELS[item.ingredient_unit] ?? item.ingredient_unit;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onConfirm({
        quantity,
        price_per_unit: pricePerUnit,
        brand: brand.trim() || null,
        supplier_id: supplierId === "" ? null : supplierId,
        notes: null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`${t("shoppingList.purchaseModalTitle")} · ${item.ingredient_name}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("shoppingList.addingToList") : t("shoppingList.confirmPurchase")}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="purchase-qty">{t("shoppingList.purchaseQuantityLabel")}</label>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <input id="purchase-qty" type="number" className="input input-num" min="0" step="0.01" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} autoFocus />
          <span className="mono" style={{ color: "var(--ink-3)", fontSize: 12 }}>{unitLabel}</span>
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="purchase-price">{t("shoppingList.purchasePriceLabel")}</label>
        <input id="purchase-price" type="number" className="input input-num" min="0" step="0.01" value={pricePerUnit} onChange={e => setPricePerUnit(parseFloat(e.target.value) || 0)} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="purchase-brand">{t("shoppingList.purchaseBrandLabel")}</label>
        <input id="purchase-brand" className="input" value={brand} onChange={e => setBrand(e.target.value)} placeholder={t("shoppingList.purchaseBrandPlaceholder")} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="purchase-supplier">{t("shoppingList.purchaseSupplierLabel")}</label>
        <select id="purchase-supplier" className="select" value={supplierId} onChange={e => setSupplierId(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">{t("shoppingList.purchaseNoSupplier")}</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="mono" style={{ fontSize: 13, color: "var(--ink-2)", textAlign: "right", marginTop: "var(--space-2)" }}>
        {t("shoppingList.purchaseTotalLabel")}: {(quantity * pricePerUnit).toFixed(2)} €
      </div>
    </Modal>
  );
}

function RenameListModal({ isOpen, onClose, list, onRename, t }: {
  isOpen: boolean; onClose: () => void; list: ShoppingList | null; onRename: (name: string) => void; t: T;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && list) setName(list.name);
  }, [isOpen, list]);

  const handleSubmit = async () => {
    if (!list || !name.trim() || name === list.name) { onClose(); return; }
    setLoading(true);
    try {
      await invoke("shopping_list_update", { id: list.id!, name: name.trim() });
      onRename(name.trim());
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={t("shoppingList.renameModalTitle")}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading ? t("stock.modal.saving") : t("common.save")}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="list-name">{t("shoppingList.listNameLabel")}</label>
        <input id="list-name" className="input" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmit()} />
      </div>
    </Modal>
  );
}

function ShoppingListsView({ lists, onSelectList, onCreateList, onRenameList, onDeleteList, t }: {
  lists: ShoppingList[];
  onSelectList: (id: number) => void;
  onCreateList: (name: string) => Promise<void>;
  onRenameList: (id: number, name: string) => Promise<void>;
  onDeleteList: (id: number) => Promise<void>;
  t: T;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [loading, setLoading] = useState(false);
  const [renameList, setRenameList] = useState<ShoppingList | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    setLoading(true);
    try {
      await onCreateList(newListName.trim());
      setNewListName("");
      setShowCreateModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content">
      <PageHeader
        title={t("shoppingList.title")}
        subtitle={t(lists.length === 1 ? "shoppingList.subtitleSingular" : "shoppingList.subtitlePlural", { count: lists.length })}
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("shoppingList.newList")}
          </button>
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true" width="48" height="48">
              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2.5l2.5 11.5L8 21l8-1.5V5.5L4.55 3.5H3.55"/>
            </svg>
          }
          title={t("shoppingList.empty")}
          body={t("shoppingList.emptyDesc")}
          action={
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              {t("shoppingList.createList")}
            </button>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {lists.map(list => (
            <div key={list.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "var(--space-4)" }}>
              <button
                onClick={() => onSelectList(list.id!)}
                style={{ flex: 1, textAlign: "left", background: "none", border: "none", color: "var(--text-1)", fontSize: "16px", fontWeight: 500, cursor: "pointer" }}
              >
                {list.name}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text-3)" }}>
                <span className="mono">{t("shoppingList.itemsCount", { count: list.items.length })}</span>
                <span className="mono" style={{ color: "var(--brand)" }}>{list.total_estimated_cost.toFixed(2)} €</span>
                <button className="btn-icon" onClick={() => setRenameList(list)} title={t("shoppingList.rename")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="btn-icon danger" onClick={() => setDeleteConfirm({ id: list.id!, name: list.name })} title={t("common.delete")}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t("shoppingList.newListModalTitle")}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !newListName.trim()}>
              {loading ? t("shoppingList.creating") : t("shoppingList.createList")}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="new-list-name">{t("shoppingList.listNameLabel")}</label>
          <input id="new-list-name" className="input" autoFocus value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleCreate()} placeholder={t("shoppingList.listNamePlaceholder")} />
        </div>
      </Modal>

      <RenameListModal
        isOpen={!!renameList}
        onClose={() => setRenameList(null)}
        list={renameList}
        onRename={(name) => onRenameList(renameList!.id!, name)}
        t={t}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => { onDeleteList(deleteConfirm!.id); setDeleteConfirm(null); }}
        title={t("shoppingList.confirmTitle")}
        body={deleteConfirm ? t("shoppingList.confirmDeleteListBody", { name: deleteConfirm.name }) : ""}
        danger
      />
    </div>
  );
}

function ShoppingListDetailView({
  list,
  ingredients,
  suppliers,
  onBack,
  onReload,
  onRenameList,
  onToggleItem,
  onMarkPurchased,
  onDeleteItem,
  onClearPurchased,
  t,
}: {
  list: ShoppingList;
  ingredients: Ingredient[];
  suppliers: Supplier[];
  onBack: () => void;
  onReload: () => void;
  onRenameList: (name: string) => Promise<void>;
  onToggleItem: (id: number, purchased: boolean) => Promise<void>;
  onMarkPurchased: (itemId: number, payload: Omit<ShoppingListMarkPurchasedInput, "list_id" | "item_id">) => Promise<void>;
  onDeleteItem: (id: number) => Promise<void>;
  onClearPurchased: () => Promise<void>;
  t: T;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<number | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null);

  useEffect(() => {
    const cats = new Set<string>();
    for (const item of list.items) {
      if (!item.purchased) cats.add(item.category || t("shoppingList.noCategory"));
    }
    setExpandedCategories(cats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, ShoppingItem[]> = {};
    for (const item of list.items) {
      const cat = item.category || t("shoppingList.noCategory");
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const totalPurchased = list.items.filter(i => i.purchased).length;
  const sortedCategories = Object.keys(itemsByCategory).sort();

  return (
    <div className="content">
      <div className="content-header">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <button className="btn btn-secondary" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div>
            <h1 className="content-title">{list.name}</h1>
            <p className="content-sub mono">{t("shoppingList.summary", { items: list.items.length, purchased: totalPurchased, total: list.total_estimated_cost.toFixed(2) })}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => setShowRenameModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            {t("shoppingList.rename")}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddItemModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t("shoppingList.addItem")}
          </button>
          {totalPurchased > 0 && (
            <button className="btn btn-danger" onClick={onClearPurchased}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              {t("shoppingList.clearPurchased", { count: totalPurchased })}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
        <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "13px", padding: "15px 18px" }}>
          <div className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-3)" }}>{t("shoppingList.missing")}</div>
          <div className="mono" style={{ fontSize: "26px", fontWeight: 600, color: "var(--ember)", marginTop: "6px" }}>{list.items.length - totalPurchased}</div>
        </div>
        <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "13px", padding: "15px 18px" }}>
          <div className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-3)" }}>{t("shoppingList.inCart")}</div>
          <div className="mono" style={{ fontSize: "26px", fontWeight: 600, color: "var(--green)", marginTop: "6px" }}>{totalPurchased}</div>
        </div>
        <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "13px", padding: "15px 18px" }}>
          <div className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".6px", color: "var(--ink-3)" }}>{t("shoppingList.progress")}</div>
          <div className="mono" style={{ fontSize: "26px", fontWeight: 600, color: "var(--ink)", marginTop: "6px" }}>{totalPurchased}/{list.items.length}</div>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        {sortedCategories.length === 0 ? (
          <EmptyState
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true" width="48" height="48"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2.5l2.5 11.5L8 21l8-1.5V5.5L4.55 3.5H3.55"/></svg>}
            title={t("shoppingList.emptyListTitle")}
            body={t("shoppingList.emptyListDesc")}
            action={
              <button className="btn btn-primary" onClick={() => setShowAddItemModal(true)}>
                {t("shoppingList.addFirstItem")}
              </button>
            }
          />
        ) : (
          sortedCategories.map(category => (
            <CategorySection
              key={category} category={category} items={itemsByCategory[category]}
              listId={list.id!}
              onToggle={onToggleItem} onRequestPurchase={setPurchaseItem} onDelete={id => setDeleteConfirmItem(id)}
              expandedCategories={expandedCategories}
              toggleExpand={(cat) => setExpandedCategories(prev => {
                const next = new Set(prev);
                if (next.has(cat)) next.delete(cat); else next.add(cat);
                return next;
              })}
              t={t}
            />
          ))
        )}

        <div style={{ padding: "var(--space-4)", background: "var(--elevated)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)" }}>
          <span>{t("shoppingList.totalEstimated")}</span>
          <span className="mono" style={{ fontSize: "18px", color: "var(--brand)" }}>
            {list.total_estimated_cost.toFixed(2)} €
          </span>
        </div>
      </div>

      <AddItemModal
        isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)}
        listId={list.id!} ingredients={ingredients} onAdd={onReload} t={t}
      />

      <RenameListModal
        isOpen={showRenameModal} onClose={() => setShowRenameModal(false)}
        list={list} onRename={onRenameList} t={t}
      />

      <PurchaseConfirmModal
        item={purchaseItem}
        suppliers={suppliers}
        onClose={() => setPurchaseItem(null)}
        onConfirm={(payload) => onMarkPurchased(purchaseItem!.id, payload)}
        t={t}
      />

      <ConfirmDialog
        open={!!deleteConfirmItem}
        onCancel={() => setDeleteConfirmItem(null)}
        onConfirm={() => { onDeleteItem(deleteConfirmItem!); setDeleteConfirmItem(null); }}
        title={t("shoppingList.confirmTitle")}
        body={t("shoppingList.confirmDeleteItemBody", { name: list.items.find(i => i.id === deleteConfirmItem)?.ingredient_name || '' })}
        danger
      />
    </div>
  );
}

export default function ShoppingListPage() {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [view, setView] = useState<"lists" | "detail">("lists");

  const loadLists = useCallback(async () => {
    try {
      const data = await invoke<ShoppingList[]>("shopping_lists_list");
      setLists(data);
    } catch (e) {
      showToast(t("shoppingList.loadListsError"), "err");
    }
  }, [showToast, t]);

  const loadIngredients = useCallback(async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await invoke<Supplier[]>("suppliers_list");
      setSuppliers(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadLists();
    loadIngredients();
    loadSuppliers();
  }, [loadLists, loadIngredients, loadSuppliers]);

  const loadListDetail = useCallback(async (id: number) => {
    try {
      const list = await invoke<ShoppingList>("shopping_list_get", { id });
      setSelectedList(list);
    } catch (e) {
      showToast(t("shoppingList.loadListError"), "err");
    }
  }, [showToast, t]);

  const handleSelectList = (id: number) => {
    setSelectedListId(id);
    setView("detail");
    loadListDetail(id);
  };

  const handleCreateList = async (name: string) => {
    try {
      const list = await invoke<ShoppingList>("shopping_list_create", { name, items: [] });
      setLists(prev => [list, ...prev]);
      setSelectedListId(list.id!);
      setView("detail");
      loadListDetail(list.id!);
      showToast(t("shoppingList.listCreated"), "ok");
    } catch (e) {
      showToast(t("shoppingList.listCreateError"), "err");
    }
  };

  const handleRenameList = async (id: number, name: string) => {
    try {
      await invoke("shopping_list_update", { id, name });
      setLists(prev => prev.map(l => l.id === id ? { ...l, name } : l));
      if (selectedList && selectedList.id === id) {
        setSelectedList({ ...selectedList, name });
      }
      showToast(t("shoppingList.listRenamed"), "ok");
    } catch (e) {
      showToast(t("shoppingList.listRenameError"), "err");
    }
  };

  const handleDeleteList = async (id: number) => {
    try {
      await invoke("shopping_list_delete", { id });
      setLists(prev => prev.filter(l => l.id !== id));
      if (selectedListId === id) {
        setSelectedListId(null);
        setSelectedList(null);
        setView("lists");
      }
      showToast(t("shoppingList.listDeleted"), "ok");
    } catch (e) {
      showToast(t("shoppingList.listDeleteError"), "err");
    }
  };

  const handleToggleItem = async (itemId: number, purchased: boolean) => {
    try {
      const updatedItem = await invoke<ShoppingItem>("shopping_list_toggle_item", {
        listId: selectedListId!,
        itemId: itemId,
        purchased
      });
      setSelectedList(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updatedItem : i)
      } : null);
    } catch (e) {
      showToast(t("shoppingList.itemUpdateError"), "err");
    }
  };

  const handleMarkPurchased = async (itemId: number, payload: Omit<ShoppingListMarkPurchasedInput, "list_id" | "item_id">) => {
    try {
      const updatedItem = await invoke<ShoppingItem>("shopping_list_mark_purchased", {
        input: { list_id: selectedListId!, item_id: itemId, ...payload }
      });
      setSelectedList(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updatedItem : i)
      } : null);
      showToast(t("shoppingList.purchaseRecorded"), "ok");
    } catch (e) {
      showToast(t("shoppingList.purchaseError"), "err");
      throw e;
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await invoke("shopping_list_remove_item", { listId: selectedListId!, itemId: itemId });
      setSelectedList(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId)
      } : null);
      showToast(t("shoppingList.itemRemoved"), "ok");
    } catch (e) {
      showToast(t("shoppingList.itemRemoveError"), "err");
    }
  };

  const handleClearPurchased = async () => {
    try {
      const list = await invoke<ShoppingList>("shopping_list_clear_purchased", {
        listId: selectedListId!
      });
      setSelectedList(list);
      showToast(t("shoppingList.purchasedCleared"), "ok");
    } catch (e) {
      showToast(t("shoppingList.clearError"), "err");
    }
  };

  if (view === "lists") {
    return (
      <ShoppingListsView
        lists={lists}
        onSelectList={handleSelectList}
        onCreateList={handleCreateList}
        onRenameList={handleRenameList}
        onDeleteList={handleDeleteList}
        t={t}
      />
    );
  }

  if (!selectedList) {
    return (
      <div className="content">
        <div className="content-header">
          <button className="btn btn-secondary" onClick={() => setView("lists")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            {t("shoppingList.back")}
          </button>
        </div>
        <EmptyState title={t("shoppingList.loadingList")} />
      </div>
    );
  }

  return (
    <ShoppingListDetailView
      list={selectedList}
      ingredients={ingredients}
      suppliers={suppliers}
      onBack={() => { setView("lists"); setSelectedListId(null); setSelectedList(null); }}
      onReload={() => loadListDetail(selectedListId!)}
      onRenameList={(name) => handleRenameList(selectedList.id!, name)}
      onToggleItem={handleToggleItem}
      onMarkPurchased={handleMarkPurchased}
      onDeleteItem={handleDeleteItem}
      onClearPurchased={handleClearPurchased}
      t={t}
    />
  );
}
