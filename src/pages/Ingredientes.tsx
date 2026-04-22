import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Carrot } from "lucide-react";
import { useForm } from "react-hook-form";
import Topbar from "../components/layout/Topbar";
import Modal from "../components/ui/Modal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ImageUpload from "../components/ui/ImageUpload";
import IngImg from "../components/ui/IngImg";
import ImagePlaceholder from "../components/ui/ImagePlaceholder";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import { defaultIngredientImageFor } from "../utils/ingredientDefaults";
import type { Ingrediente, Unidade } from "../types";

const UNIDADES: { value: Unidade; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "l", label: "l" },
  { value: "ml", label: "ml" },
  { value: "unidade", label: "unidade" },
  { value: "colher_sopa", label: "colher de sopa" },
  { value: "colher_cha", label: "colher de chá" },
  { value: "chávena", label: "chávena" },
];

interface FormData {
  nome: string;
  unidade: Unidade;
  preco_atual: string;
}

export default function Ingredientes() {
  const { addToast } = useToast();
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ingrediente | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ingrediente | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageManuallyChosen, setImageManuallyChosen] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>();
  const watchedName = watch("nome", "");

  async function load() {
    try {
      const data = await api.ingredientes.listar();
      setIngredientes(data);
    } catch (e) {
      addToast("Erro ao carregar ingredientes", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!modalOpen || imageManuallyChosen) return;
    setImagePath(defaultIngredientImageFor(watchedName));
  }, [imageManuallyChosen, modalOpen, watchedName]);

  function openCreate() {
    setEditing(null);
    setImagePath(null);
    setImageManuallyChosen(false);
    reset({ nome: "", unidade: "kg", preco_atual: "" });
    setModalOpen(true);
  }

  function openEdit(ing: Ingrediente) {
    setEditing(ing);
    setImagePath(ing.imagem_path);
    setImageManuallyChosen(!!ing.imagem_path);
    reset({ nome: ing.nome, unidade: ing.unidade, preco_atual: String(ing.preco_atual) });
    setModalOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = {
        nome: data.nome.trim(),
        unidade: data.unidade,
        preco_atual: parseFloat(data.preco_atual),
        imagem_path: imagePath,
      };
      if (editing) {
        await api.ingredientes.atualizar(editing.id, payload);
        addToast("Ingrediente actualizado", "success");
      } else {
        await api.ingredientes.criar(payload);
        addToast("Ingrediente criado", "success");
      }
      setModalOpen(false);
      load();
    } catch (e) {
      addToast("Erro ao guardar ingrediente", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.ingredientes.eliminar(deleteTarget.id);
      addToast("Ingrediente eliminado", "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      addToast("Erro ao eliminar ingrediente", "error");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    if (!normalizedSearch) return ingredientes;
    return ingredientes.filter((i) => i.nome.toLowerCase().includes(normalizedSearch));
  }, [ingredientes, search]);

  return (
    <>
      <Topbar
        placeholder="Pesquisar ingredientes…"
        search={search}
        onSearch={setSearch}
        right={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Novo Ingrediente
          </button>
        }
      />

      <div className="content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Ingredientes</h1>
            <div className="page-sub">
              {loading ? "A carregar…" : `${ingredientes.length} ingrediente${ingredientes.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Carrot size={40} /></div>
            <h3>{search ? "Nenhum resultado" : "Sem ingredientes"}</h3>
            <p>{search ? `Nenhum ingrediente corresponde a "${search}"` : "Adicione o primeiro ingrediente para começar."}</p>
            {!search && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openCreate}>
                <Plus size={15} /> Novo Ingrediente
              </button>
            )}
          </div>
        ) : (
          <div className="ingredients-grid">
            {filtered.map((ing) => (
              <IngredienteCard
                key={ing.id}
                ing={ing}
                onEdit={() => openEdit(ing)}
                onDelete={() => setDeleteTarget(ing)}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editing ? "Editar Ingrediente" : "Novo Ingrediente"}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
                {saving ? "A guardar…" : editing ? "Guardar alterações" : "Criar ingrediente"}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Imagem</label>
            <ImageUpload
              value={imagePath}
              onChange={(path) => {
                setImageManuallyChosen(true);
                setImagePath(path);
              }}
              aspectRatio="16/7"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input
              className="form-input"
              placeholder="ex: Farinha de Trigo T65"
              {...register("nome", { required: "O nome é obrigatório" })}
            />
            {errors.nome && <div className="form-error">{errors.nome.message}</div>}
          </div>

          <div className="form-row form-row-2">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Unidade *</label>
              <select className="form-select" {...register("unidade", { required: true })}>
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Preço (€) *</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("preco_atual", {
                  required: "O preço é obrigatório",
                  min: { value: 0, message: "O preço deve ser positivo" },
                })}
              />
              {errors.preco_atual && <div className="form-error">{errors.preco_atual.message}</div>}
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Eliminar Ingrediente"
          message={`Tem a certeza que quer eliminar "${deleteTarget.nome}"? Esta acção não pode ser revertida e poderá afectar receitas existentes.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </>
  );
}

function IngredienteCard({
  ing,
  onEdit,
  onDelete,
}: {
  ing: Ingrediente;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const unidadeLabel = UNIDADES.find((u) => u.value === ing.unidade)?.label ?? ing.unidade;

  return (
    <div className="ing-card">
      <div className="ing-img-wrap">
        {ing.imagem_path ? (
          <IngImg path={ing.imagem_path} alt={ing.nome} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
        ) : (
          <ImagePlaceholder seed={ing.nome} />
        )}
        <div className="ing-tag-badge">{unidadeLabel}</div>
      </div>

      <div className="ing-card-body">
        <p className="ing-card-name">{ing.nome}</p>
        <p className="ing-card-unit">por {unidadeLabel}</p>
        <div className="ing-card-meta">
          <span className="ing-card-price">€{ing.preco_atual.toFixed(2)}</span>
          <span className="ing-card-unit-label">{unidadeLabel}</span>
        </div>
      </div>

      <div className="ing-card-actions">
        <button
          className="ing-action-btn"
          title="Editar"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil size={13} />
        </button>
        <button
          className="ing-action-btn danger"
          title="Eliminar"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
