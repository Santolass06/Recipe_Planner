import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import IngredientAvatar from "../components/IngredientAvatar";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import StatusPill from "../components/ui/StatusPill";

interface Supplier {
  id: number;
  name: string;
  contact?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface SupplierInput {
  name: string;
  contact?: string;
  notes?: string;
}

interface PriceQuote {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
  supplier: string;
  price_per_unit: number;
  valid_from: string;
  valid_to: string | null;
  is_promo: boolean;
  created_at: string;
}

interface SupplierWithQuotes extends Supplier {
  quotes: PriceQuote[];
}

const EMPTY_SUPPLIER_FORM: SupplierInput = { name: "", contact: "", notes: "" };
const EMPTY_QUOTE_FORM = {
  ingredient_id: 0,
  supplier: "",
  price_per_unit: 0,
  valid_from: undefined as string | undefined,
  valid_to: undefined as string | undefined,
  is_promo: false,
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-PT");
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithQuotes[]>([]);
  const [ingredients, setIngredients] = useState<{ id: number; name: string; unit: string }[]>([]);
  const [search, setSearch] = useState("");
  const [supplierModal, setSupplierModal] = useState<"create" | "edit" | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithQuotes | null>(null);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [quoteModal, setQuoteModal] = useState<"create" | "edit" | null>(null);
  const [editingQuote, setEditingQuote] = useState<PriceQuote | null>(null);
  const [quoteForm, setQuoteForm] = useState(EMPTY_QUOTE_FORM);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "supplier" | "quote"; id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const loadSuppliers = useCallback(async () => {
    try {
      const [suppliersData, quotesData, ingredientsData] = await Promise.all([
        invoke<Supplier[]>("suppliers_list"),
        invoke<PriceQuote[]>("price_quotes_all"),
        invoke<{ id: number; name: string; unit: string }[]>("ingredients_list"),
      ]);
      setIngredients(ingredientsData);

      const quotesBySupplier = new Map<string, PriceQuote[]>();
      for (const quote of quotesData) {
        const existing = quotesBySupplier.get(quote.supplier) || [];
        existing.push(quote);
        quotesBySupplier.set(quote.supplier, existing);
      }

      const suppliersWithQuotes: SupplierWithQuotes[] = suppliersData.map(s => ({
        ...s,
        quotes: quotesBySupplier.get(s.name) || [],
      }));

      setSuppliers(suppliersWithQuotes);
    } catch (e) {
      showToast("Erro ao carregar fornecedores", "err");
    }
  }, [showToast]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  function openCreateSupplier() {
    setSupplierForm(EMPTY_SUPPLIER_FORM);
    setEditingSupplier(null);
    setSupplierModal("create");
  }

  function openEditSupplier(sup: SupplierWithQuotes) {
    setSupplierForm({ name: sup.name, contact: sup.contact || "", notes: sup.notes || "" });
    setEditingSupplier(sup);
    setSupplierModal("edit");
  }

  function closeSupplierModal() { setSupplierModal(null); setEditingSupplier(null); }

  async function handleSupplierSave() {
    if (!supplierForm.name.trim()) return;
    setLoading(true);
    try {
      const contact = supplierForm.contact?.trim() || null;
      const notes = supplierForm.notes?.trim() || null;
      if (supplierModal === "create") {
        await invoke("supplier_create", {
          name: supplierForm.name.trim(),
          contact,
          notes,
        });
        showToast("Fornecedor criado", "ok");
      } else if (editingSupplier) {
        await invoke("supplier_update", {
          id: editingSupplier.id,
          name: supplierForm.name.trim(),
          contact,
          notes,
        });
        showToast("Fornecedor actualizado", "ok");
      }
      closeSupplierModal();
      await loadSuppliers();
    } catch (e) {
      showToast("Erro ao guardar fornecedor", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleSupplierDelete(id: number, _name: string) {
    try {
      await invoke("supplier_delete", { id });
      setConfirmDelete(null);
      showToast("Fornecedor eliminado", "ok");
      await loadSuppliers();
    } catch (e) {
      showToast("Erro ao eliminar fornecedor", "err");
    }
  }

  function openCreateQuote(supplierId: number) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    setQuoteForm({ ...EMPTY_QUOTE_FORM, supplier: supplier.name });
    setEditingQuote(null);
    setQuoteModal("create");
  }

  function openEditQuote(quote: PriceQuote) {
    setQuoteForm({
      ingredient_id: quote.ingredient_id,
      supplier: quote.supplier,
      price_per_unit: quote.price_per_unit,
      valid_from: quote.valid_from ? new Date(quote.valid_from).toISOString().split("T")[0] : undefined,
      valid_to: quote.valid_to ? new Date(quote.valid_to).toISOString().split("T")[0] : undefined,
      is_promo: quote.is_promo,
    });
    setEditingQuote(quote);
    setQuoteModal("edit");
  }

  function closeQuoteModal() { setQuoteModal(null); setEditingQuote(null); }

  async function handleQuoteSave() {
    if (!quoteForm.ingredient_id || !quoteForm.supplier.trim() || quoteForm.price_per_unit <= 0) return;
    setLoading(true);
    try {
      const payload = {
        ingredient_id: quoteForm.ingredient_id,
        supplier: quoteForm.supplier.trim(),
        price_per_unit: quoteForm.price_per_unit,
        valid_from: quoteForm.valid_from ? new Date(quoteForm.valid_from + "T00:00:00Z") : null,
        valid_to: quoteForm.valid_to ? new Date(quoteForm.valid_to + "T23:59:59Z") : null,
        is_promo: quoteForm.is_promo,
      };
      if (quoteModal === "create") {
        await invoke("price_quote_create", payload);
        showToast("Cotação criada", "ok");
      } else if (editingQuote) {
        await invoke("price_quote_update", { id: editingQuote.id, ...payload });
        showToast("Cotação actualizada", "ok");
      }
      closeQuoteModal();
      await loadSuppliers();
    } catch (e) {
      showToast("Erro ao guardar cotação", "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuoteDelete(id: number, _ingredientName: string) {
    try {
      await invoke("price_quote_delete", { id });
      setConfirmDelete(null);
      showToast("Cotação eliminada", "ok");
      await loadSuppliers();
    } catch (e) {
      showToast("Erro ao eliminar cotação", "err");
    }
  }

  const filtered = useMemo(() => suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact?.toLowerCase().includes(search.toLowerCase()) ||
    s.notes?.toLowerCase().includes(search.toLowerCase())
  ), [suppliers, search]);

  return (
    <div className="content">
      <PageHeader 
        title="Fornecedores" 
        subtitle={`${suppliers.length} fornecedores`} 
        search={
          <SearchBar 
            value={search} 
            onChange={setSearch} 
            placeholder="Pesquisar fornecedores…" 
          />
        }
        actions={
          <button className="btn btn-primary" onClick={openCreateSupplier}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo fornecedor
          </button>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState 
          title={search ? "Sem resultados" : "Sem fornecedores"}
          body={search ? "Tenta outra pesquisa." : "Adiciona o primeiro fornecedor para começar."}
          action={!search ? (
            <button className="btn btn-primary" onClick={openCreateSupplier}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Adicionar fornecedor
            </button>
          ) : undefined}
        />
      ) : (
        <>
          <SupplierTable 
            suppliers={filtered} 
            onEdit={openEditSupplier} 
            onCreateQuote={openCreateQuote} 
            onDelete={(sup: SupplierWithQuotes) => setConfirmDelete({ type: "supplier", id: sup.id, name: sup.name })} 
          />
          <SupplierMobileCards 
            suppliers={filtered} 
            onEdit={openEditSupplier} 
            onCreateQuote={openCreateQuote} 
            onDelete={(sup: SupplierWithQuotes) => setConfirmDelete({ type: "supplier", id: sup.id, name: sup.name })}
            onEditQuote={openEditQuote}
            onDeleteQuote={(quote: PriceQuote) => setConfirmDelete({ type: "quote", id: quote.id, name: quote.ingredient_name })}
          />
        </>
      )}

      <Modal
        open={supplierModal !== null}
        onClose={closeSupplierModal}
        title={supplierModal === "create" ? "Novo fornecedor" : "Editar fornecedor"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeSupplierModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSupplierSave} disabled={loading || !supplierForm.name.trim()}>
              {loading ? "A guardar…" : "Guardar"}
            </button>
          </>
        }
      >
        <SupplierFormFields 
          form={supplierForm} 
          setForm={setSupplierForm} 
          onSave={handleSupplierSave} 
        />
      </Modal>

      <Modal
        open={quoteModal !== null}
        onClose={closeQuoteModal}
        title={quoteModal === "create" ? "Nova cotação" : "Editar cotação"}
        wide
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeQuoteModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleQuoteSave} disabled={loading || !quoteForm.ingredient_id || !quoteForm.supplier.trim() || quoteForm.price_per_unit <= 0}>
              {loading ? "A guardar…" : "Guardar"}
            </button>
          </>
        }
      >
        <QuoteFormFields 
          form={quoteForm} 
          setForm={setQuoteForm} 
          ingredients={ingredients} 
          suppliers={suppliers} 
        />
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Confirmar eliminação"
        body={`Tens a certeza que queres eliminar ${confirmDelete?.name}? Esta acção não pode ser desfeita.`}
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === "supplier") handleSupplierDelete(confirmDelete.id, confirmDelete.name);
          else handleQuoteDelete(confirmDelete.id, confirmDelete.name);
        }}
      />
    </div>
  );
}

// Subcomponents

function SupplierTable({ suppliers, onEdit, onCreateQuote, onDelete }: {
  suppliers: SupplierWithQuotes[];
  onEdit: (sup: SupplierWithQuotes) => void;
  onCreateQuote: (supplierId: number) => void;
  onDelete: (sup: SupplierWithQuotes) => void;
}) {
  return (
    <div className="table-container" role="region" aria-label="Lista de fornecedores" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Fornecedor</th>
            <th scope="col">Contacto</th>
            <th scope="col">Notas</th>
            <th scope="col">Cotações</th>
            <th scope="col"><span className="visually-hidden">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map(sup => (
            <tr key={sup.id}>
              <td>
                <div className="supplier-name-cell">
                  <IngredientAvatar name={sup.name} size={32} />
                  <span>{sup.name}</span>
                </div>
              </td>
              <td className="mono">{sup.contact || "—"}</td>
              <td className="text-3">{sup.notes || "—"}</td>
              <td>
                <span className="badge">{sup.quotes.length}</span>
              </td>
              <td>
                <div className="table-actions" role="group" aria-label={`Ações para ${sup.name}`}>
                  <button className="btn-icon" onClick={() => onEdit(sup)} title="Editar" aria-label={`Editar ${sup.name}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button className="btn-icon" onClick={() => onCreateQuote(sup.id)} title="Adicionar cotação" aria-label={`Adicionar cotação para ${sup.name}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                  <button className="btn-icon danger" onClick={() => onDelete(sup)} title="Eliminar" aria-label={`Eliminar ${sup.name}`}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SupplierMobileCards({ suppliers, onEdit, onCreateQuote, onDelete, onEditQuote, onDeleteQuote }: {
  suppliers: SupplierWithQuotes[];
  onEdit: (sup: SupplierWithQuotes) => void;
  onCreateQuote: (supplierId: number) => void;
  onDelete: (sup: SupplierWithQuotes) => void;
  onEditQuote: (quote: PriceQuote) => void;
  onDeleteQuote: (quote: PriceQuote) => void;
}) {
  return (
    <div className="mobile-cards" role="list" aria-label="Fornecedores">
      {suppliers.map(sup => (
        <article key={sup.id} className="mobile-card" role="listitem">
          <div className="mobile-card-header">
            <div className="supplier-name-cell">
              <IngredientAvatar name={sup.name} size={40} />
              <span>{sup.name}</span>
            </div>
            <span className="badge">{sup.quotes.length} cotações</span>
          </div>
          {sup.contact && <p className="mobile-card-field mono"><strong>Contacto:</strong> {sup.contact}</p>}
          {sup.notes && <p className="mobile-card-field text-3"><strong>Notas:</strong> {sup.notes}</p>}
          <div className="mobile-card-actions" role="group" aria-label={`Ações para ${sup.name}`}>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(sup)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onCreateQuote(sup.id)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nova cotação
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(sup)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Eliminar
            </button>
          </div>
          
          {sup.quotes.length > 0 && (
            <div className="quotes-sub-list">
              <p className="quotes-sub-title">Cotações</p>
              {sup.quotes.map(quote => (
                <div key={quote.id} className="quote-item">
                  <div className="quote-main">
                    <IngredientAvatar name={quote.ingredient_name} size={28} />
                    <div className="quote-info" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span className="quote-name">{quote.ingredient_name}</span>
                      <span className="quote-meta mono text-3">{quote.ingredient_unit} • {quote.price_per_unit.toFixed(2)} €</span>
                      {quote.is_promo && <StatusPill status="info" label="Promo" />}
                    </div>
                  </div>
                  <div className="quote-dates text-3 mono">
                    Válida: {formatDate(quote.valid_from)} — {formatDate(quote.valid_to)}
                  </div>
                  <div className="quote-actions">
                    <button className="btn-icon" onClick={() => onEditQuote(quote)} title="Editar" aria-label={`Editar cotação ${quote.ingredient_name}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className="btn-icon danger" onClick={() => onDeleteQuote(quote)} title="Eliminar" aria-label={`Eliminar cotação ${quote.ingredient_name}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function SupplierFormFields({ form, setForm, onSave }: {
  form: SupplierInput;
  setForm: React.Dispatch<React.SetStateAction<SupplierInput>>;
  onSave: () => void;
}) {
  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor="supplier-name">Nome *</label>
        <input
          id="supplier-name"
          className="input"
          autoFocus
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && onSave()}
          placeholder="ex: Metro Cash & Carry"
          aria-describedby="name-hint"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="supplier-contact">Contacto</label>
        <input
          id="supplier-contact"
          className="input"
          value={form.contact || ""}
          onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
          placeholder="ex: João Silva — joao@metro.pt — 912 345 678"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="supplier-notes">Notas</label>
        <textarea
          id="supplier-notes"
          className="textarea"
          value={form.notes || ""}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Notas sobre o fornecedor (prazos, condições, etc.)"
          rows={3}
        />
      </div>
    </>
  );
}

function QuoteFormFields({ form, setForm, ingredients, suppliers }: {
  form: typeof EMPTY_QUOTE_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_QUOTE_FORM>>;
  ingredients: { id: number; name: string; unit: string }[];
  suppliers: SupplierWithQuotes[];
}) {
  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor="quote-ingredient">Ingrediente *</label>
        <select
          id="quote-ingredient"
          className="select"
          value={form.ingredient_id}
          onChange={e => setForm(f => ({ ...f, ingredient_id: parseInt(e.target.value) || 0 }))}
          required
        >
          <option value="0">— Seleccionar ingrediente —</option>
          {ingredients.map(ing => (
            <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="quote-supplier">Fornecedor *</label>
        <select
          id="quote-supplier"
          className="select"
          value={form.supplier}
          onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
          required
        >
          <option value="">— Seleccionar fornecedor —</option>
          {suppliers.map(sup => (
            <option key={sup.id} value={sup.name}>{sup.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div className="field">
          <label className="field-label" htmlFor="quote-price">Preço por unidade (€) *</label>
          <input
            id="quote-price"
            type="number"
            step="0.01"
            min="0"
            className="input input-num"
            value={form.price_per_unit}
            onChange={e => setForm(f => ({ ...f, price_per_unit: parseFloat(e.target.value) || 0 }))}
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="quote-promo">Promoção</label>
          <label className="checkbox-wrapper">
            <input
              id="quote-promo"
              type="checkbox"
              checked={form.is_promo}
              onChange={e => setForm(f => ({ ...f, is_promo: e.target.checked }))}
            />
            <span>Esta cotação é promocional</span>
          </label>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div className="field">
          <label className="field-label" htmlFor="quote-valid-from">Válida a partir de *</label>
          <input
            id="quote-valid-from"
            type="date"
            className="input"
            value={form.valid_from || ""}
            onChange={e => setForm(f => ({ ...f, valid_from: e.target.value || undefined }))}
            required
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="quote-valid-to">Válida até</label>
          <input
            id="quote-valid-to"
            type="date"
            className="input"
            value={form.valid_to || ""}
            onChange={e => setForm(f => ({ ...f, valid_to: e.target.value || undefined }))}
          />
        </div>
      </div>
    </>
  );
}
