import { useEffect, useState, useRef } from "react";
import { AlertTriangle, Package, Pencil } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import type { StockItem } from "../types";

export default function Armazem() {
  const { addToast } = useToast();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState("");
  // Track rows where Escape was pressed so blur doesn't trigger a save
  const escapedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    api.stock
      .listar()
      .then(setItems)
      .catch(() => addToast("Erro ao carregar armazém", "error"))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(id: number, current: number) {
    escapedRef.current.delete(id);
    setEditing((e) => ({ ...e, [id]: String(current) }));
  }

  function cancelEdit(id: number) {
    escapedRef.current.add(id);
    setEditing((e) => { const n = { ...e }; delete n[id]; return n; });
  }

  async function saveEdit(id: number) {
    if (saving[id] || escapedRef.current.has(id)) return;
    const raw = editing[id];
    if (raw === undefined) return;
    const val = parseFloat(raw);
    if (isNaN(val) || val < 0) {
      addToast("Quantidade inválida", "error");
      cancelEdit(id);
      return;
    }
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const updated = await api.stock.atualizar({ ingrediente_id: id, quantidade_disponivel: val });
      setItems((prev) => prev.map((item) => item.ingrediente_id === id ? updated : item));
      cancelEdit(id);
      addToast("Stock actualizado", "success");
    } catch {
      addToast("Erro ao actualizar stock", "error");
    } finally {
      setSaving((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, id: number) {
    if (e.key === "Enter") { e.preventDefault(); saveEdit(id); }
    if (e.key === "Escape") cancelEdit(id);
  }

  const filtered = items.filter((i) =>
    i.nome.toLowerCase().includes(search.toLowerCase())
  );

  const emStockBaixo = items.filter((i) => i.quantidade_disponivel === 0).length;

  return (
    <>
      <Topbar
        placeholder="Pesquisar ingredientes…"
        search={search}
        onSearch={setSearch}
      />
      <div className="content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Armazém</h1>
            <div className="page-sub">
              {loading
                ? "A carregar…"
                : `${items.length} ingrediente${items.length !== 1 ? "s" : ""}${emStockBaixo > 0 ? ` · ${emStockBaixo} sem stock` : ""}`}
            </div>
          </div>
        </div>

        {emStockBaixo > 0 && !loading && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              padding: "12px 18px",
              display: "flex",
              gap: 10,
              alignItems: "center",
              background: "var(--rose-soft)",
              borderColor: "var(--rose-soft)",
              color: "var(--rose)",
              fontSize: 13,
            }}
          >
            <AlertTriangle size={15} />
            <span>
              {emStockBaixo} ingrediente{emStockBaixo !== 1 ? "s" : ""} com stock a zero
            </span>
          </div>
        )}

        {loading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={40} /></div>
            <h3>{search ? "Nenhum resultado" : "Armazém vazio"}</h3>
            <p>
              {search
                ? `Nenhum ingrediente corresponde a "${search}"`
                : "Adicione ingredientes para começar a gerir o stock."}
            </p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <table className="ing-table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th className="right">Unidade</th>
                    <th className="right">Quantidade disponível</th>
                    <th className="right">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isEditing = item.ingrediente_id in editing;
                    const isSaving = saving[item.ingrediente_id];
                    const isEmpty = item.quantidade_disponivel === 0;

                    return (
                      <tr key={item.ingrediente_id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isEmpty && (
                              <span title="Sem stock" style={{ display: "flex" }}>
                                <AlertTriangle size={13} style={{ color: "var(--rose)", flexShrink: 0 }} />
                              </span>
                            )}
                            <span style={{ fontWeight: isEmpty ? 400 : 500 }}>{item.nome}</span>
                          </div>
                        </td>
                        <td className="td-num">{item.unidade}</td>
                        <td className="td-num">
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                              <input
                                className="form-input"
                                style={{ width: 100, textAlign: "right", padding: "4px 8px", fontSize: 13 }}
                                type="number"
                                min="0"
                                step="0.01"
                                value={editing[item.ingrediente_id]}
                                onChange={(e) =>
                                  setEditing((prev) => ({ ...prev, [item.ingrediente_id]: e.target.value }))
                                }
                                onKeyDown={(e) => handleKeyDown(e, item.ingrediente_id)}
                                onBlur={() => saveEdit(item.ingrediente_id)}
                                autoFocus
                                disabled={isSaving}
                              />
                              {isSaving && (
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>…</span>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                cursor: "pointer",
                                padding: "4px 8px",
                                borderRadius: 6,
                                color: isEmpty ? "var(--rose)" : "inherit",
                                fontWeight: isEmpty ? 600 : 400,
                              }}
                              title="Clique para editar"
                              onClick={() => startEdit(item.ingrediente_id, item.quantidade_disponivel)}
                            >
                              {item.quantidade_disponivel.toFixed(2)}
                              <Pencil size={11} style={{ opacity: 0.35, flexShrink: 0 }} />
                            </span>
                          )}
                        </td>
                        <td
                          className="td-num"
                          style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                        >
                          {new Date(item.updated_at).toLocaleDateString("pt-PT")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
