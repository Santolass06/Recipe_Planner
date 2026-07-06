import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "../lib/devInvoke";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import SearchBar from "../components/ui/SearchBar";
import { useI18n } from "../i18n";
import type { Event } from "../../crates/core/bindings/Event";

type T = (key: string, params?: Record<string, string | number>) => string;

const EMPTY_FORM = { name: "", event_date: "", notes: "" };

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function EventFormFields({ form, setForm, onSave, t }: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onSave: () => void;
  t: T;
}) {
  return (
    <>
      <div className="field">
        <label className="field-label" htmlFor="event-name">{t("events.form.nameLabel")}</label>
        <input
          id="event-name"
          className="input"
          autoFocus
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && onSave()}
          placeholder={t("events.form.namePlaceholder")}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="event-date">{t("events.form.dateLabel")}</label>
        <input
          id="event-date"
          type="date"
          className="input"
          value={form.event_date}
          onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="event-notes">{t("events.form.notesLabel")}</label>
        <textarea
          id="event-notes"
          className="textarea"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder={t("events.form.notesPlaceholder")}
          rows={3}
        />
      </div>
    </>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await invoke<Event[]>("events_list");
      setEvents(data);
    } catch (e) {
      showToast(t("events.loadError"), "err");
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => events.filter(ev =>
    ev.name.toLowerCase().includes(search.toLowerCase())
  ), [events, search]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setModal("create");
  }

  function openEdit(ev: Event) {
    setForm({ name: ev.name, event_date: ev.event_date ?? "", notes: ev.notes ?? "" });
    setEditing(ev);
    setModal("edit");
  }

  function closeModal() { setModal(null); setEditing(null); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const input = {
        name: form.name.trim(),
        event_date: form.event_date || null,
        notes: form.notes.trim() || null,
      };
      if (modal === "create") {
        await invoke("event_create", { input });
        showToast(t("events.created"), "ok");
      } else if (editing) {
        await invoke("event_update", { id: editing.id, input });
        showToast(t("events.updated"), "ok");
      }
      closeModal();
      await load();
    } catch (e) {
      showToast(t("events.saveError"), "err");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(ev: Event) {
    try {
      await invoke("event_delete", { id: ev.id });
      setConfirmDelete(null);
      showToast(t("events.deleted"), "ok");
      await load();
    } catch (e) {
      showToast(t("events.deleteError"), "err");
    }
  }

  return (
    <div className="content">
      <PageHeader
        title={t("events.title")}
        subtitle={t("events.subtitle", { count: events.length })}
        search={<SearchBar value={search} onChange={setSearch} placeholder={t("events.searchPlaceholder")} />}
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <span className="ms" style={{ fontSize: 16 }}>add</span>
            {t("events.newEvent")}
          </button>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<span className="ms" style={{ fontSize: 40 }}>celebration</span>}
          title={search ? t("events.noResults") : t("events.empty")}
          body={search ? t("events.noResultsDesc") : t("events.emptyDesc")}
          action={!search ? (
            <button className="btn btn-primary" onClick={openCreate}>
              <span className="ms" style={{ fontSize: 16 }}>add</span>
              {t("events.addEvent")}
            </button>
          ) : undefined}
        />
      ) : (
        <div role="list" aria-label={t("events.ariaLabel")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map(ev => (
            <article
              key={ev.id}
              className="item-card"
              role="listitem"
              style={{ alignItems: "flex-start", padding: 20, cursor: "pointer" }}
              onClick={() => navigate(`/eventos/${ev.id}`)}
            >
              <div style={{ width: 44, height: 44, borderRadius: 11, background: "var(--inset)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <span className="ms" style={{ fontSize: 23, color: "var(--ember)" }}>celebration</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{ev.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                  {formatDate(ev.event_date) ?? t("events.noDate")}
                </div>
                {ev.notes && (
                  <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.notes}
                  </div>
                )}
              </div>
              <div
                className="item-actions"
                style={{ position: "absolute", top: 14, right: 16 }}
                role="group"
                aria-label={t("events.actionsAria", { name: ev.name })}
                onClick={e => e.stopPropagation()}
              >
                <button className="btn-icon" onClick={() => openEdit(ev)} title={t("common.edit")} aria-label={t("events.editAria", { name: ev.name })}>
                  <span className="ms" style={{ fontSize: 14 }}>edit</span>
                </button>
                <button className="btn-icon danger" onClick={() => setConfirmDelete(ev)} title={t("common.delete")} aria-label={t("events.deleteAria", { name: ev.name })}>
                  <span className="ms" style={{ fontSize: 14 }}>delete</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === "create" ? t("events.modal.newTitle") : t("events.modal.editTitle")}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>{t("common.cancel")}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading || !form.name.trim()}>
              {loading ? t("events.modal.saving") : t("common.save")}
            </button>
          </>
        }
      >
        <EventFormFields form={form} setForm={setForm} onSave={handleSave} t={t} />
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("events.confirmDeleteTitle")}
        body={confirmDelete ? t("events.confirmDeleteBody", { name: confirmDelete.name }) : ""}
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}
