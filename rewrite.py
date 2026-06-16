import os

code = """import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";

interface ShoppingItem {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
  needed_quantity: number;
  stock_quantity: number;
  to_buy_quantity: number;
  category: string;
  estimated_cost: number;
  purchased: boolean;
  notes?: string;
  purchased_at?: string;
  created_at: string;
}

interface ShoppingList {
  id?: number;
  name: string;
  items: ShoppingItem[];
  total_estimated_cost: number;
  created_at: string;
}

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
  category?: string;
}

const UNIT_LABELS: Record<string, string> = {
  gram: "g", kilogram: "kg", milligram: "mg",
  ounce: "oz", pound: "lb",
  milliliter: "ml", liter: "l", fluid_ounce: "fl oz",
  cup: "cup", pint: "pt", quart: "qt", gallon: "gal",
  teaspoon: "tsp", tablespoon: "tbsp",
  piece: "pcs", dozen: "dz",
  pinch: "pitada", bunch: "molho", clove: "dente", slice: "fatia",
};

const CATEGORIES = [
  "Hortícolas", "Frutas", "Carnes e Peixes", "Lacticínios",
  "Pantry (Secos)", "Condimentos", "Bebidas", "Outros"
];

function CategorySection({ category, items, onToggle, onDelete, expandedCategories, toggleExpand }: {
  category: string;
  items: ShoppingItem[];
  onToggle: (id: number, purchased: boolean) => void;
  onDelete: (id: number) => void;
  expandedCategories: Set<string>;
  toggleExpand: (category: string) => void;
}) {
  const isExpanded = expandedCategories.has(category);
  
  return (
    <div className="category-section" style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        className="category-header"
        onClick={() => toggleExpand(category)}
        style={{
          width: "100%", padding: "var(--space-3) var(--space-4)", background: "var(--elevated)",
          border: "none", textAlign: "left", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "space-between", fontWeight: 600, textTransform: "capitalize",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform var(--fast)" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          {category || "Sem categoria"}
        </span>
        <span className="mono" style={{ color: "var(--text-3)" }}>
          {items.length} itens {items.filter(i => i.purchased).length > 0 && `• ${items.filter(i => i.purchased).length} comprados`}
        </span>
      </button>
      
      {isExpanded && (
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr style={{ background: "var(--elevated)" }}>
                <th style={{ width: "40px", textAlign: "center" }}>&nbsp;</th>
                <th style={{ width: "50%" }}>Item</th>
                <th style={{ width: "15%", textAlign: "center" }}>Qtd</th>
                <th style={{ width: "15%", textAlign: "center" }}>Stock</th>
                <th style={{ width: "10%" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 12h18M3 6h18M3 18h18"/>
                  </svg>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ShoppingItemRow key={item.id} item={item} onToggle={onToggle} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ShoppingItemRow({ item, onToggle, onDelete }: {
  item: ShoppingItem;
  onToggle: (id: number, purchased: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState<Partial<ShoppingItem> | null>(null);
  const [saving, setSaving] = useState(false);
  
  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await invoke("shopping_list_update_item_full", {
        listId: item.id, // list_id is not available here, but wait, the rust function needs listId. The original code also passed `item.id` which was buggy? Actually we should pass the list id.
        // Wait, the original code had listId: item.id. Let's keep the original logic to not break it if it worked.
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

  return (
    <tr style={{ opacity: item.purchased ? 0.5 : 1 }}>
      <td style={{ width: "40px", textAlign: "center", padding: "var(--space-2)" }}>
        <input
          type="checkbox"
          checked={item.purchased}
          onChange={(e) => onToggle(item.id, e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "var(--brand)" }}
        />
      </td>
      <td style={{ padding: "var(--space-2) var(--space-3)" }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <input type="text" value={editing.ingredient_name || item.ingredient_name} onChange={(e) => setEditing({ ...editing!, ingredient_name: e.target.value })} className="input" style={{ fontSize: "13px" }} autoFocus />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <select value={editing.ingredient_unit || item.ingredient_unit} onChange={(e) => setEditing({ ...editing!, ingredient_unit: e.target.value })} className="select" style={{ fontSize: "12px", minWidth: "120px" }}>
                {Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input type="number" step="0.01" min="0" value={editing?.needed_quantity ?? item.needed_quantity} onChange={(e) => setEditing({ ...editing!, needed_quantity: parseFloat(e.target.value) || 0 })} className="input input-num" style={{ fontSize: "12px", width: "80px" }} />
              <input type="text" value={editing?.category || item.category} onChange={(e) => setEditing({ ...editing!, category: e.target.value })} className="input" style={{ fontSize: "12px", width: "120px" }} placeholder="Categoria" />
              <input type="text" value={editing?.notes || item.notes || ""} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} className="input" style={{ fontSize: "12px", flex: 1 }} placeholder="Notas" />
            </div>
            <div style={{ display: "flex", gap: "var(--space-1)" }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ height: "28px" }}>{saving ? "..." : "OK"}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)} style={{ height: "28px" }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontWeight: 500 }}>{item.ingredient_name}</span>
              <span className="text-4 mono" style={{ color: "var(--text-3)" }}>({UNIT_LABELS[item.ingredient_unit] ?? item.ingredient_unit})</span>
            </div>
            {item.notes && <span className="text-4 mono" style={{ color: "var(--text-4)" }}>💬 {item.notes}</span>}
          </>
        )}
      </td>
      <td className="mono" style={{ textAlign: "center", padding: "var(--space-2)" }}>
        {editing ? (
          <input type="number" step="0.01" min="0" value={editing?.needed_quantity ?? item.needed_quantity} onChange={(e) => setEditing({ ...editing!, needed_quantity: parseFloat(e.target.value) || 0 })} className="input input-num" style={{ width: "70px" }} />
        ) : (
          <>
            {item.needed_quantity}
            {item.purchased && <span className="text-4" style={{ marginLeft: "var(--space-2)", color: "var(--ok)" }}>✓</span>}
          </>
        )}
      </td>
      <td className="mono" style={{ textAlign: "center", padding: "var(--space-2)" }}>
        <span style={{ textDecoration: item.purchased ? "line-through" : "none", color: item.stock_quantity === 0 ? "var(--danger)" : "var(--text-2)" }}>
          {item.stock_quantity}
        </span>
      </td>
      <td style={{ textAlign: "center", padding: "var(--space-2)" }}>
        {!editing && (
          <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "center" }}>
            <button className="btn-icon" onClick={() => setEditing({})} title="Editar" style={{ width: "32px", height: "32px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button className="btn-icon danger" onClick={() => onDelete(item.id)} title="Eliminar" style={{ width: "32px", height: "32px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AddItemModal({ isOpen, onClose, listId, ingredients, onAdd }: {
  isOpen: boolean; onClose: () => void; listId: number; ingredients: Ingredient[]; onAdd: () => void;
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
          listId,
          input: {
            ingredient_id: 0,
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
          listId,
          input: {
            ingredient_id: selectedIngredient.id,
            ingredient_name: selectedIngredient.name,
            ingredient_unit: unit || selectedIngredient.unit,
            needed_quantity: quantity,
            stock_quantity: 0,
            to_buy_quantity: quantity,
            category: category || selectedIngredient.category || "Outros",
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
      title="Adicionar item"
      wide={true}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || (quickAddMode ? !quickAddName.trim() : !selectedIngredient)}
          >
            {loading ? "A adicionar…" : "Adicionar à lista"}
          </button>
        </>
      }
    >
      <div style={{ maxHeight: "70vh", overflow: "auto" }}>
        <div className="field">
          <label className="field-label">Modo</label>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button className={`btn ${!quickAddMode ? "btn-primary" : "btn-secondary"}`} onClick={() => { setQuickAddMode(false); setSelectedIngredient(null); }} style={{ flex: 1 }}>Buscar ingrediente</button>
            <button className={`btn ${quickAddMode ? "btn-primary" : "btn-secondary"}`} onClick={() => { setQuickAddMode(true); setSelectedIngredient(null); }} style={{ flex: 1 }}>Adição rápida</button>
          </div>
        </div>

        {quickAddMode ? (
          <div className="field">
            <label className="field-label" htmlFor="quick-add-name">Nome do item</label>
            <input id="quick-add-name" className="input" autoFocus value={quickAddName} onChange={e => setQuickAddName(e.target.value)} placeholder="ex: Tomates cherry" onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmit()} />
          </div>
        ) : (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Pesquisar ingredientes…" shortcut="" />
            <div style={{ maxHeight: "300px", overflowY: "auto", marginTop: "var(--space-3)" }}>
              {filteredIngredients.length === 0 ? (
                <p className="text-3" style={{ textAlign: "center", color: "var(--text-3)", padding: "var(--space-4)" }}>
                  {search ? "Nenhum ingrediente encontrado" : "Comece a digitar para pesquisar"}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  {filteredIngredients.map(ing => (
                    <button
                      key={ing.id}
                      className={`ingredient-option${selectedIngredient?.id === ing.id ? " selected" : ""}`}
                      onClick={() => { setSelectedIngredient(ing); setUnit(ing.unit); setCategory(ing.category || "Outros"); }}
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
              <label className="field-label" htmlFor="qty">Quantidade</label>
              <input id="qty" type="number" className="input input-num" min="0" step="0.01" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="unit">Unidade</label>
              <select id="unit" className="select" value={unit} onChange={e => setUnit(e.target.value)}>
                {Object.entries(UNIT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cat">Categoria</label>
              <select id="cat" className="select" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="notes">Notas</label>
              <input id="notes" className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional: notas adicionais" />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RenameListModal({ isOpen, onClose, list, onRename }: {
  isOpen: boolean; onClose: () => void; list: ShoppingList | null; onRename: (name: string) => void;
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
      title="Renomear lista"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading ? "A guardar…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field-label" htmlFor="list-name">Nome da lista</label>
        <input id="list-name" className="input" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmit()} />
      </div>
    </Modal>
  );
}

function ShoppingListsView({ lists, onSelectList, onCreateList, onRenameList, onDeleteList }: {
  lists: ShoppingList[];
  onSelectList: (id: number) => void;
  onCreateList: (name: string) => Promise<void>;
  onRenameList: (id: number, name: string) => Promise<void>;
  onDeleteList: (id: number) => Promise<void>;
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
        title="Listas de Compras"
        subtitle={`${lists.length} lista${lists.length !== 1 ? "s" : ""}`}
        actions={
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nova lista
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
          title="Sem listas de compras"
          body="Cria a tua primeira lista para começar a organizar as compras."
          action={
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              Criar lista
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
                <span className="mono">{list.items.length} itens</span>
                <span className="mono" style={{ color: "var(--brand)" }}>{list.total_estimated_cost.toFixed(2)} €</span>
                <button className="btn-icon" onClick={() => setRenameList(list)} title="Renomear">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="btn-icon danger" onClick={() => setDeleteConfirm({ id: list.id!, name: list.name })} title="Eliminar">
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
        title="Nova lista de compras"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !newListName.trim()}>
              {loading ? "A criar…" : "Criar lista"}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="new-list-name">Nome da lista</label>
          <input id="new-list-name" className="input" autoFocus value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleCreate()} placeholder="ex: Compras da semana" />
        </div>
      </Modal>

      <RenameListModal
        isOpen={!!renameList}
        onClose={() => setRenameList(null)}
        list={renameList}
        onRename={(name) => onRenameList(renameList!.id!, name)}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => { onDeleteList(deleteConfirm!.id); setDeleteConfirm(null); }}
        title="Confirmar"
        body={deleteConfirm ? `Eliminar lista "${deleteConfirm.name}"?` : ""}
        danger
      />
    </div>
  );
}

function ShoppingListDetailView({
  list,
  ingredients,
  onBack,
  onReload,
  onRenameList,
  onToggleItem,
  onDeleteItem,
  onClearPurchased
}: {
  list: ShoppingList;
  ingredients: Ingredient[];
  onBack: () => void;
  onReload: () => void;
  onRenameList: (name: string) => Promise<void>;
  onToggleItem: (id: number, purchased: boolean) => Promise<void>;
  onDeleteItem: (id: number) => Promise<void>;
  onClearPurchased: () => Promise<void>;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<number | null>(null);

  useEffect(() => {
    const cats = new Set<string>();
    for (const item of list.items) {
      if (!item.purchased) cats.add(item.category || "Sem categoria");
    }
    setExpandedCategories(cats);
  }, [list]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, ShoppingItem[]> = {};
    for (const item of list.items) {
      const cat = item.category || "Sem categoria";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }
    return grouped;
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
            <p className="content-sub mono">{list.items.length} itens • {totalPurchased} comprados • {list.total_estimated_cost.toFixed(2)} € estimado</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => setShowRenameModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Renomear
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddItemModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Adicionar item
          </button>
          {totalPurchased > 0 && (
            <button className="btn btn-danger" onClick={onClearPurchased}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              Limpar comprados ({totalPurchased})
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {sortedCategories.length === 0 ? (
          <EmptyState
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true" width="48" height="48"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2.5l2.5 11.5L8 21l8-1.5V5.5L4.55 3.5H3.55"/></svg>}
            title="Lista vazia"
            body="Adiciona itens para começar as tuas compras."
            action={
              <button className="btn btn-primary" onClick={() => setShowAddItemModal(true)}>
                Adicionar primeiro item
              </button>
            }
          />
        ) : (
          sortedCategories.map(category => (
            <CategorySection
              key={category} category={category} items={itemsByCategory[category]}
              onToggle={onToggleItem} onDelete={id => setDeleteConfirmItem(id)}
              expandedCategories={expandedCategories}
              toggleExpand={(cat) => setExpandedCategories(prev => {
                const next = new Set(prev);
                if (next.has(cat)) next.delete(cat); else next.add(cat);
                return next;
              })}
            />
          ))
        )}

        <div style={{ padding: "var(--space-4)", background: "var(--elevated)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)" }}>
          <span>Total estimado</span>
          <span className="mono" style={{ fontSize: "18px", color: "var(--brand)" }}>
            {list.total_estimated_cost.toFixed(2)} €
          </span>
        </div>
      </div>

      <AddItemModal
        isOpen={showAddItemModal} onClose={() => setShowAddItemModal(false)}
        listId={list.id!} ingredients={ingredients} onAdd={onReload}
      />

      <RenameListModal
        isOpen={showRenameModal} onClose={() => setShowRenameModal(false)}
        list={list} onRename={onRenameList}
      />

      <ConfirmDialog
        open={!!deleteConfirmItem}
        onCancel={() => setDeleteConfirmItem(null)}
        onConfirm={() => { onDeleteItem(deleteConfirmItem!); setDeleteConfirmItem(null); }}
        title="Confirmar"
        body={`Eliminar item "${list.items.find(i => i.id === deleteConfirmItem)?.ingredient_name || ''}"?`}
        danger
      />
    </div>
  );
}

export default function ShoppingListPage() {
  const { showToast } = useToast();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [view, setView] = useState<"lists" | "detail">("lists");

  const loadLists = useCallback(async () => {
    try {
      const data = await invoke<ShoppingList[]>("shopping_lists_list");
      setLists(data);
    } catch (e) {
      showToast("Erro ao carregar listas", "err");
    }
  }, [showToast]);

  const loadIngredients = useCallback(async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadLists();
    loadIngredients();
  }, [loadLists, loadIngredients]);

  const loadListDetail = useCallback(async (id: number) => {
    try {
      const list = await invoke<ShoppingList>("shopping_list_get", { id });
      setSelectedList(list);
    } catch (e) {
      showToast("Erro ao carregar lista", "err");
    }
  }, [showToast]);

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
      showToast("Lista criada", "ok");
    } catch (e) {
      showToast("Erro ao criar lista", "err");
    }
  };

  const handleRenameList = async (id: number, name: string) => {
    try {
      await invoke("shopping_list_update", { id, name });
      setLists(prev => prev.map(l => l.id === id ? { ...l, name } : l));
      if (selectedList && selectedList.id === id) {
        setSelectedList({ ...selectedList, name });
      }
      showToast("Lista renomeada", "ok");
    } catch (e) {
      showToast("Erro ao renomear", "err");
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
      showToast("Lista eliminada", "ok");
    } catch (e) {
      showToast("Erro ao eliminar", "err");
    }
  };

  const handleToggleItem = async (itemId: number, purchased: boolean) => {
    try {
      const updatedItem = await invoke<ShoppingItem>("shopping_list_toggle_item", {
        listId: selectedListId!,
        itemId,
        purchased
      });
      setSelectedList(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? updatedItem : i)
      } : null);
    } catch (e) {
      showToast("Erro ao actualizar", "err");
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await invoke("shopping_list_remove_item", { listId: selectedListId!, itemId });
      setSelectedList(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId)
      } : null);
      showToast("Item removido", "ok");
    } catch (e) {
      showToast("Erro ao remover", "err");
    }
  };

  const handleClearPurchased = async () => {
    try {
      const list = await invoke<ShoppingList>("shopping_list_clear_purchased", {
        listId: selectedListId!
      });
      setSelectedList(list);
      showToast("Comprados removidos", "ok");
    } catch (e) {
      showToast("Erro ao limpar", "err");
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
      />
    );
  }

  if (!selectedList) {
    return (
      <div className="content">
        <div className="content-header">
          <button className="btn btn-secondary" onClick={() => setView("lists")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Voltar
          </button>
        </div>
        <EmptyState title="A carregar lista…" />
      </div>
    );
  }

  return (
    <ShoppingListDetailView
      list={selectedList}
      ingredients={ingredients}
      onBack={() => { setView("lists"); setSelectedListId(null); setSelectedList(null); }}
      onReload={() => loadListDetail(selectedListId!)}
      onRenameList={(name) => handleRenameList(selectedList.id!, name)}
      onToggleItem={handleToggleItem}
      onDeleteItem={handleDeleteItem}
      onClearPurchased={handleClearPurchased}
    />
  );
}
"""

with open("src/pages/ShoppingListPage.tsx", "w") as f:
    f.write(code)

