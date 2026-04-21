import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Pencil, Trash2, Calculator, Minus, Plus, Clock,
  Flame, Users, Star, Sparkles, ArrowRight,
} from "lucide-react";
import Topbar from "../components/layout/Topbar";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import IngImg from "../components/ui/IngImg";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import type { Receita, CustoReceita } from "../types";

export default function ReceitaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [receita, setReceita] = useState<Receita | null>(null);
  const [loading, setLoading] = useState(true);
  const [porcoes, setPorcoes] = useState(1);
  const [margem, setMargem] = useState(60);
  const [custo, setCusto] = useState<CustoReceita | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.receitas
      .obter(Number(id))
      .then((r) => {
        if (!r) { navigate("/receitas"); return; }
        setReceita(r);
        setPorcoes(r.porcoes_base);
      })
      .catch(() => addToast("Erro ao carregar receita", "error"))
      .finally(() => setLoading(false));
  }, [id]);

  const calcular = useCallback(async () => {
    if (!id) return;
    setCalculando(true);
    try {
      const result = await api.custos.calcular({
        receita_id: Number(id),
        porcoes,
        margem_percentagem: margem,
        promocoes: [],
      });
      setCusto(result);
    } catch {
      setCusto(null);
    } finally {
      setCalculando(false);
    }
  }, [id, porcoes, margem]);

  useEffect(() => { if (!loading) calcular(); }, [porcoes, margem, loading]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await api.receitas.eliminar(Number(id));
      addToast("Receita eliminada", "success");
      navigate("/receitas");
    } catch {
      addToast("Erro ao eliminar receita", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <><Topbar /><div className="content"><div className="spinner" /></div></>;
  if (!receita) return null;

  const precoSugerido = custo ? custo.preco_venda_sugerido : 0;
  const custoPorcao = custo ? custo.custo_por_porcao : 0;
  const costBarPct = precoSugerido > 0 ? Math.min(100, (custoPorcao / precoSugerido) * 100) : 0;
  const [whole, decimal] = precoSugerido.toFixed(2).split(".");

  return (
    <>
      <Topbar
        placeholder="Pesquisar receitas…"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/receitas")}>
              ← Receitas
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/receitas/${id}/editar`)}>
              <Pencil size={13} /> Editar
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/custos/${id}`)}
            >
              <Calculator size={13} /> Calculadora
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)} style={{ color: "var(--rose)" }}>
              <Trash2 size={13} />
            </button>
          </div>
        }
      />

      <div className="content">
        <div className="recipe-wrap">
          {/* Left column */}
          <div>
            {/* Hero */}
            <div className="hero">
              <div className="hero-img">
                {receita.imagem_path ? (
                  <IngImg path={receita.imagem_path} alt={receita.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <HeroPlaceholder nome={receita.nome} />
                )}
              </div>
              <div className="hero-meta">
                <div className="breadcrumb">
                  <Link to="/receitas" style={{ color: "inherit", textDecoration: "none" }}>Receitas</Link>
                  <span className="sep">/</span>
                  {receita.categoria && (
                    <>
                      <span>{receita.categoria}</span>
                      <span className="sep">/</span>
                    </>
                  )}
                  <span style={{ color: "var(--text)" }}>{receita.nome}</span>
                </div>
                <h1 className="recipe-title">{receita.nome}</h1>
                {receita.instrucoes && (
                  <p className="recipe-sub">{receita.instrucoes.slice(0, 200)}{receita.instrucoes.length > 200 ? "…" : ""}</p>
                )}
                {receita.tags.length > 0 && (
                  <div className="recipe-tags">
                    {receita.tags.map((t, i) => (
                      <span key={t} className={`recipe-tag ${i === 0 ? "primary" : ""}`}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="stats-row">
                <div className="stat">
                  <div className="stat-label"><Users size={11} />Base</div>
                  <div className="stat-value">{receita.porcoes_base}<span className="stat-unit">porções</span></div>
                </div>
                <div className="stat">
                  <div className="stat-label"><Star size={11} />Categoria</div>
                  <div className="stat-value" style={{ fontSize: 15 }}>{receita.categoria ?? "—"}</div>
                </div>
                <div className="stat">
                  <div className="stat-label"><Clock size={11} />Criada</div>
                  <div className="stat-value" style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>
                    {new Date(receita.created_at).toLocaleDateString("pt-PT")}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label"><Flame size={11} />Tags</div>
                  <div className="stat-value" style={{ fontSize: 14 }}>{receita.tags.length || "—"}</div>
                </div>
              </div>
            </div>

            {/* Ingredients card */}
            {custo && custo.breakdown.length === 0 && (
              <div className="card section-gap" style={{ padding: "18px 22px", display: "flex", gap: 12, alignItems: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span>Os ingredientes desta receita já não existem. Edite a receita para actualizar a lista de ingredientes.</span>
              </div>
            )}
            {custo && custo.breakdown.length > 0 && (
              <div className="card section-gap">
                <div className="card-head">
                  <div>
                    <h2 className="card-title">Ingredientes</h2>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {porcoes} {porcoes === 1 ? "porção" : "porções"} · custo total {calculando ? "…" : `€${custo.custo_total.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="portion-row">
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Porções</span>
                    <div className="stepper">
                      <button onClick={() => setPorcoes(Math.max(1, porcoes - 1))}><Minus size={13} /></button>
                      <div className="step-count">{porcoes}</div>
                      <button onClick={() => setPorcoes(porcoes + 1)}><Plus size={13} /></button>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <table className="ing-table">
                    <thead>
                      <tr>
                        <th>Ingrediente</th>
                        <th className="right">Quantidade</th>
                        <th className="right">Preço unit.</th>
                        <th className="right">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custo.breakdown.map((item) => (
                        <tr key={item.ingrediente_id}>
                          <td>
                            <div className="ing-row-name">
                              <div className="ing-row-swatch">
                                <IngImgPlaceholder nome={item.nome} />
                              </div>
                              <div>
                                <div className="ing-row-title">{item.nome}</div>
                                <div className="ing-row-sub">{item.unidade}</div>
                              </div>
                            </div>
                          </td>
                          <td className="td-num">{item.quantidade.toFixed(2)} {item.unidade}</td>
                          <td className="td-num">€{item.preco_usado.toFixed(3)}</td>
                          <td className="td-cost">€{item.custo_parcial.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right column: margin + price */}
          <div>
            <div className="card margin-card">
              <div className="card-head">
                <h2 className="card-title">Margem de lucro</h2>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  arraste para ajustar
                </span>
              </div>
              <div className="card-body">
                <div className="slider-head">
                  <span className="margin-label">Margem alvo</span>
                  <span className="margin-value">{margem}%</span>
                </div>
                <input
                  type="range"
                  className="range-slider"
                  min={10}
                  max={85}
                  step={1}
                  value={margem}
                  onChange={(e) => setMargem(parseInt(e.target.value))}
                />
                <div className="slider-scale">
                  <span>10%</span><span>30%</span><span>55%</span><span>80%</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  {[50, 60, 70].map((m) => (
                    <button
                      key={m}
                      className="chip"
                      style={margem === m ? { background: "var(--primary-soft)", color: "var(--primary-hover)", borderColor: "var(--primary-soft)" } : {}}
                      onClick={() => setMargem(m)}
                    >
                      {m}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {custo && (
              <div className="price-card">
                <div className="suggested-zone">
                  <div className="suggested-label">
                    <Sparkles size={11} />
                    Preço de venda sugerido
                  </div>
                  <div className="suggested-price">
                    <span className="currency">€</span>
                    <span>{whole}</span>
                    <span className="cents">.{decimal}</span>
                  </div>
                  <div className="suggested-per">por porção · {margem}% margem</div>
                </div>
                <div className="breakdown-zone">
                  <div className="breakdown-row">
                    <span>Custo por porção</span>
                    <span className="v">€{custoPorcao.toFixed(2)}</span>
                  </div>
                  <div className="breakdown-row profit">
                    <span>Lucro por porção</span>
                    <span className="v">+€{Math.max(0, precoSugerido - custoPorcao).toFixed(2)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Lucro total ({porcoes} porções)</span>
                    <span className="v">€{(Math.max(0, precoSugerido - custoPorcao) * porcoes).toFixed(2)}</span>
                  </div>
                  <div className="breakdown-row strong">
                    <span>Receita total</span>
                    <span className="v">€{(precoSugerido * porcoes).toFixed(2)}</span>
                  </div>
                </div>
                <div className="compare-bar">
                  <div className="bar">
                    <span style={{ width: `${costBarPct}%` }} />
                  </div>
                  <div className="bar alt"><span style={{ width: "100%" }} /></div>
                </div>
                <div style={{ padding: "0 22px 10px", display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-light)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  <span>CUSTO</span><span>LUCRO</span>
                </div>
                <div className="price-actions">
                  <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={() => navigate(`/custos/${id}`)}>
                    Calculadora de custos <ArrowRight size={14} />
                  </button>
                  <button className="btn btn-outline" style={{ justifyContent: "center" }} onClick={() => navigate(`/receitas/${id}/editar`)}>
                    <Pencil size={13} /> Editar receita
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar Receita"
          message={`Tem a certeza que quer eliminar "${receita.nome}"? Esta acção não pode ser revertida.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
          loading={deleting}
        />
      )}
    </>
  );
}

const STRIPES = ["stripe-amber","stripe-rose","stripe-sage","stripe-sand","stripe-cocoa","stripe-stone","stripe-butter","stripe-terra"];

function stripeFor(nome: string) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) | 0;
  return STRIPES[Math.abs(h) % STRIPES.length];
}

function HeroPlaceholder({ nome }: { nome: string }) {
  return <div className={stripeFor(nome)} style={{ width: "100%", height: "100%" }} />;
}

function IngImgPlaceholder({ nome }: { nome: string }) {
  return <div className={stripeFor(nome)} style={{ width: "100%", height: "100%" }} />;
}
