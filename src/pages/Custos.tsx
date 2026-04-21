import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Minus, Plus, Percent, Sparkles, ArrowLeft, Users, Clock, Star, Flame } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import IngImg from "../components/ui/IngImg";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import type { Receita, CustoReceita, IngredienteComPromocao } from "../types";

interface PromoEntry {
  preco: string;
  ativo: boolean;
}

export default function Custos() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [receita, setReceita] = useState<Receita | null>(null);
  const [loading, setLoading] = useState(true);
  const [porcoes, setPorcoes] = useState(1);
  const [margem, setMargem] = useState(60);
  const [custo, setCusto] = useState<CustoReceita | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [promos, setPromos] = useState<Record<number, PromoEntry>>({});

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
      const promocoes: IngredienteComPromocao[] = Object.entries(promos)
        .filter(([, v]) => v.ativo && parseFloat(v.preco) > 0)
        .map(([k, v]) => ({ ingrediente_id: Number(k), preco_promocao: parseFloat(v.preco) }));

      const result = await api.custos.calcular({
        receita_id: Number(id),
        porcoes,
        margem_percentagem: margem,
        promocoes,
      });
      setCusto(result);

      const newPromos: Record<number, PromoEntry> = { ...promos };
      result.breakdown.forEach((item) => {
        if (!(item.ingrediente_id in newPromos)) {
          newPromos[item.ingrediente_id] = { preco: "", ativo: false };
        }
      });
      setPromos(newPromos);
    } catch {
      addToast("Erro ao calcular custos", "error");
    } finally {
      setCalculando(false);
    }
  }, [id, porcoes, margem, promos]);

  useEffect(() => {
    if (!loading) calcular();
  }, [porcoes, margem, loading]);

  function togglePromo(ingId: number) {
    setPromos((p) => {
      const entry = p[ingId] ?? { preco: "", ativo: false };
      return { ...p, [ingId]: { ...entry, ativo: !entry.ativo } };
    });
  }

  function setPromoPreco(ingId: number, preco: string) {
    setPromos((p) => {
      const entry = p[ingId] ?? { preco: "", ativo: false };
      return { ...p, [ingId]: { ...entry, preco } };
    });
  }

  function applyPromos() {
    calcular();
  }

  const activCount = Object.values(promos).filter((p) => p.ativo && parseFloat(p.preco) > 0).length;

  if (loading) return <><Topbar /><div className="content"><div className="spinner" /></div></>;
  if (!receita) return null;

  const precoSugeridoBase = custo ? custo.preco_venda_sugerido : 0;
  const [whole, decimal] = precoSugeridoBase.toFixed(2).split(".");
  const lucroTotal = custo ? (precoSugeridoBase - custo.custo_por_porcao) * porcoes : 0;

  return (
    <>
      <Topbar
        placeholder="Pesquisar promoções, fornecedores…"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/receitas/${id}`)}>
              <ArrowLeft size={13} /> Voltar à receita
            </button>
            <button className="btn btn-primary btn-sm" onClick={applyPromos} disabled={calculando}>
              <Sparkles size={13} /> {calculando ? "A calcular…" : "Aplicar promoções"}
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
                  <Link to={`/receitas/${id}`} style={{ color: "inherit", textDecoration: "none" }}>{receita.nome}</Link>
                  <span className="sep">/</span>
                  <span style={{ color: "var(--text)" }}>Calculadora</span>
                </div>
                <h1 className="recipe-title">{receita.nome}</h1>
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
                  <div className="stat-label"><Users size={11} />Porções</div>
                  <div className="stat-value">{porcoes}</div>
                </div>
                <div className="stat">
                  <div className="stat-label"><Star size={11} />Margem</div>
                  <div className="stat-value">{margem}<span className="stat-unit">%</span></div>
                </div>
                <div className="stat">
                  <div className="stat-label"><Flame size={11} />Custo total</div>
                  <div className="stat-value" style={{ fontSize: 14 }}>
                    {custo ? `€${custo.custo_total.toFixed(2)}` : "—"}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label"><Clock size={11} />Promos activas</div>
                  <div className="stat-value">{activCount}</div>
                </div>
              </div>
            </div>

            {/* Savings banner */}
            {activCount > 0 && custo && (
              <SavingsBanner custo={custo} activCount={activCount} porcoes={porcoes} />
            )}

            {/* Ingredients with promo toggles */}
            {custo && (
              <div className="card section-gap">
                <div className="calc-promo-head">
                  <div className="calc-promo-head-text">
                    <Percent size={14} />
                    <span>Modo promoção — active preços promocionais por ingrediente</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--primary-hover)", fontFamily: "var(--font-mono)" }}>
                    {activCount} activa{activCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="card-head" style={{ borderTop: "1px solid var(--border)" }}>
                  <div>
                    <h2 className="card-title">Ingredientes</h2>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {porcoes} porções · preços promocionais por linha
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
                        <th className="right">Preço normal</th>
                        <th className="right">Preço promo</th>
                        <th className="right">Custo</th>
                        <th className="right">Activar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custo.breakdown.map((item) => {
                        const entry = promos[item.ingrediente_id] ?? { preco: "", ativo: false };
                        const isActive = entry.ativo && parseFloat(entry.preco) > 0;
                        return (
                          <tr key={item.ingrediente_id}>
                            <td>
                              <div className="ing-row-name">
                                <div className="ing-row-swatch"><IngImgPlaceholder nome={item.nome} /></div>
                                <div>
                                  <div className="ing-row-title">{item.nome}</div>
                                  <div className="ing-row-sub">{item.unidade}</div>
                                </div>
                              </div>
                            </td>
                            <td className="td-num">{item.quantidade.toFixed(2)} {item.unidade}</td>
                            <td className="td-num" style={{ color: isActive ? "var(--text-light)" : undefined }}>
                              €{item.preco_usado.toFixed(3)}
                            </td>
                            <td>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <input
                                  className="form-input"
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  placeholder="preço promo"
                                  style={{ width: 110, textAlign: "right", fontSize: 12.5, padding: "5px 8px" }}
                                  value={entry.preco}
                                  onChange={(e) => setPromoPreco(item.ingrediente_id, e.target.value)}
                                />
                              </div>
                            </td>
                            <td className={`td-cost ${item.e_promocao ? "promo-price-new" : ""}`}>
                              €{item.custo_parcial.toFixed(2)}
                            </td>
                            <td>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <div
                                  className={`toggle-switch ${isActive ? "on" : ""}`}
                                  onClick={() => togglePromo(item.ingrediente_id)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cost breakdown comparison */}
            {custo && (
              <div className="card section-gap">
                <div className="card-head">
                  <h2 className="card-title">Comparação de custos</h2>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {activCount} promoção{activCount !== 1 ? "ões" : ""} activa{activCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="card-body">
                  <table className="ing-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th className="right">Com promoções</th>
                        <th className="right">Preço de venda</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Custo total</td>
                        <td className="td-cost">€{custo.custo_total.toFixed(2)}</td>
                        <td className="td-num">€{(precoSugeridoBase * porcoes).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={{ color: "var(--text-muted)" }}>Por porção</td>
                        <td className="td-cost" style={{ color: "var(--primary)", fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600 }}>
                          €{custo.custo_por_porcao.toFixed(2)}
                        </td>
                        <td className="td-num">€{precoSugeridoBase.toFixed(2)}</td>
                      </tr>
                      <tr style={{ borderTop: "2px solid var(--text)" }}>
                        <td style={{ fontWeight: 600, paddingTop: 14 }}>Lucro total</td>
                        <td className="td-cost" style={{ paddingTop: 14, fontWeight: 700, fontSize: 16, color: "var(--sage)" }}>
                          €{lucroTotal.toFixed(2)}
                        </td>
                        <td className="td-num" style={{ paddingTop: 14, color: "var(--text-muted)" }}>
                          {margem}% margem
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            <div className="card margin-card">
              <div className="card-head">
                <h2 className="card-title">Margem alvo</h2>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {activCount > 0 ? "margem efectiva sobe" : "arraste para ajustar"}
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
                {activCount > 0 && custo && (
                  <div style={{ marginTop: 14, padding: 12, background: "var(--sage-soft)", borderRadius: 8, fontSize: 12.5, color: "#3f5a34", lineHeight: 1.6 }}>
                    <strong>Margem efectiva</strong> com promoções activas:&nbsp;
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {((1 - custo.custo_por_porcao / precoSugeridoBase) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
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
                    {activCount > 0 ? "Preço com promoções" : "Preço de venda sugerido"}
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
                    <span className="v">€{custo.custo_por_porcao.toFixed(2)}</span>
                  </div>
                  <div className="breakdown-row profit">
                    <span>Lucro por porção</span>
                    <span className="v">+€{(precoSugeridoBase - custo.custo_por_porcao).toFixed(2)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Lucro total do lote</span>
                    <span className="v">€{lucroTotal.toFixed(2)}</span>
                  </div>
                  <div className="breakdown-row strong">
                    <span>Receita total</span>
                    <span className="v">€{(precoSugeridoBase * porcoes).toFixed(2)}</span>
                  </div>
                </div>
                <div className="compare-bar">
                  <div className="bar">
                    <span style={{ width: `${Math.min(100, (custo.custo_por_porcao / precoSugeridoBase) * 100)}%` }} />
                  </div>
                  <div className="bar alt"><span style={{ width: "100%" }} /></div>
                </div>
                <div style={{ padding: "0 22px 10px", display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-light)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  <span>CUSTO</span><span>LUCRO</span>
                </div>
                <div className="price-actions">
                  <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={applyPromos} disabled={calculando}>
                    <Sparkles size={13} /> {calculando ? "A calcular…" : "Recalcular"}
                  </button>
                  <button className="btn btn-outline" style={{ justifyContent: "center" }} onClick={() => navigate(`/receitas/${id}`)}>
                    <ArrowLeft size={13} /> Voltar à receita
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SavingsBanner({ activCount, porcoes }: { custo: CustoReceita; activCount: number; porcoes: number }) {
  return (
    <div className="savings-banner section-gap">
      <Sparkles size={18} />
      <div>
        <div style={{ fontWeight: 600 }}>
          {activCount} promoção{activCount !== 1 ? "ões" : ""} activa{activCount !== 1 ? "s" : ""}
        </div>
        <div style={{ opacity: 0.85, fontSize: 12.5 }}>
          Calculadora actualizada com os preços promocionais para {porcoes} porções.
        </div>
      </div>
    </div>
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
