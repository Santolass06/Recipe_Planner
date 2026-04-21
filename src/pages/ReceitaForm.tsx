import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Plus, Trash2, Save } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import ImageUpload from "../components/ui/ImageUpload";
import TagInput from "../components/ui/TagInput";
import SelectIngrediente from "../components/ui/SelectIngrediente";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import type { Ingrediente } from "../types";

interface FormData {
  nome: string;
  categoria: string;
  porcoes_base: string;
  instrucoes: string;
}

interface IngRow {
  ingrediente_id: number;
  quantidade: string;
}

export default function ReceitaForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [ingRows, setIngRows] = useState<IngRow[]>([{ ingrediente_id: 0, quantidade: "" }]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { nome: "", categoria: "", porcoes_base: "4", instrucoes: "" },
  });

  useEffect(() => {
    api.ingredientes.listar().then(setIngredientes);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([
      api.receitas.obter(Number(id)),
    ]).then(([receita]) => {
      if (!receita) { navigate("/receitas"); return; }
      reset({
        nome: receita.nome,
        categoria: receita.categoria ?? "",
        porcoes_base: String(receita.porcoes_base),
        instrucoes: receita.instrucoes ?? "",
      });
      setTags(receita.tags);
      setImagePath(receita.imagem_path);
    }).catch(() => addToast("Erro ao carregar receita", "error"))
      .finally(() => setLoading(false));
  }, [id]);

  function addRow() {
    setIngRows((r) => [...r, { ingrediente_id: 0, quantidade: "" }]);
  }

  function removeRow(idx: number) {
    setIngRows((r) => r.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, field: keyof IngRow, value: string | number) {
    setIngRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  async function onSubmit(data: FormData) {
    const validRows = ingRows.filter((r) => r.ingrediente_id > 0 && parseFloat(r.quantidade) > 0);

    setSaving(true);
    try {
      const payload = {
        nome: data.nome.trim(),
        categoria: data.categoria.trim() || null,
        tags,
        porcoes_base: parseInt(data.porcoes_base),
        instrucoes: data.instrucoes.trim() || null,
        imagem_path: imagePath,
        ingredientes: validRows.map((r) => ({
          ingrediente_id: Number(r.ingrediente_id),
          quantidade: parseFloat(r.quantidade),
        })),
      };

      if (isEdit) {
        await api.receitas.atualizar(Number(id), payload);
        addToast("Receita actualizada", "success");
        navigate(`/receitas/${id}`);
      } else {
        const created = await api.receitas.criar(payload);
        addToast("Receita criada", "success");
        navigate(`/receitas/${created.id}`);
      }
    } catch (e) {
      addToast("Erro ao guardar receita", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <><Topbar /><div className="content"><div className="spinner" /></div></>;

  return (
    <>
      <Topbar
        placeholder="Pesquisar…"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(isEdit ? `/receitas/${id}` : "/receitas")}>
              Cancelar
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSubmit(onSubmit)} disabled={saving}>
              <Save size={13} /> {saving ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar receita"}
            </button>
          </div>
        }
      />

      <div className="content" style={{ maxWidth: 760 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">{isEdit ? "Editar Receita" : "Nova Receita"}</h1>
            <div className="page-sub">
              {isEdit ? "Altere os detalhes da receita abaixo" : "Preencha os detalhes da nova receita"}
            </div>
          </div>
        </div>

        {/* Image */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><h2 className="card-title">Imagem</h2></div>
          <div className="card-body">
            <ImageUpload value={imagePath} onChange={setImagePath} aspectRatio="21/8" />
          </div>
        </div>

        {/* Basic info */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><h2 className="card-title">Informações gerais</h2></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input
                className="form-input"
                placeholder="ex: Financiers de Pistácio"
                {...register("nome", { required: "O nome é obrigatório" })}
              />
              {errors.nome && <div className="form-error">{errors.nome.message}</div>}
            </div>

            <div className="form-row form-row-2" style={{ marginBottom: 18 }}>
              <div>
                <label className="form-label">Categoria</label>
                <input
                  className="form-input"
                  placeholder="ex: Pastelaria, Pão…"
                  {...register("categoria")}
                />
              </div>
              <div>
                <label className="form-label">Porções base *</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  placeholder="4"
                  {...register("porcoes_base", {
                    required: "Obrigatório",
                    min: { value: 1, message: "Mínimo 1" },
                  })}
                />
                {errors.porcoes_base && <div className="form-error">{errors.porcoes_base.message}</div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tags</label>
              <TagInput value={tags} onChange={setTags} placeholder="Bestseller, Sazonal… (Enter para confirmar)" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Instruções</label>
              <textarea
                className="form-textarea"
                placeholder="Descreva os passos de preparação…"
                rows={4}
                {...register("instrucoes")}
              />
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <h2 className="card-title">Ingredientes</h2>
            <button className="btn btn-outline btn-sm" onClick={addRow}>
              <Plus size={13} /> Adicionar linha
            </button>
          </div>
          <div className="card-body">
            {ingRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13.5 }}>
                Nenhum ingrediente adicionado. Clique em "Adicionar linha" para começar.
              </div>
            ) : (
              <>
                <div className="form-ing-row" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>Ingrediente</span>
                  <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>Quantidade</span>
                  <span />
                </div>
                {ingRows.map((row, idx) => (
                  <div key={idx} className="form-ing-row">
                    <SelectIngrediente
                      ingredientes={ingredientes}
                      value={row.ingrediente_id}
                      onChange={(id) => updateRow(idx, "ingrediente_id", id)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={row.quantidade}
                      onChange={(e) => updateRow(idx, "quantidade", e.target.value)}
                    />
                    <button
                      className="ing-action-btn danger"
                      onClick={() => removeRow(idx)}
                      title="Remover linha"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => navigate(isEdit ? `/receitas/${id}` : "/receitas")}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
            <Save size={14} /> {saving ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar receita"}
          </button>
        </div>
      </div>
    </>
  );
}
