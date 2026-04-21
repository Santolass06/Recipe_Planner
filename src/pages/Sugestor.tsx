import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Users, Clock, Lock } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import IngImg from "../components/ui/IngImg";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import type { Receita } from "../types";

const SUGESTOES_ESTATICAS = [
  { titulo: "Pão de fermentação natural", categoria: "Para aprender", tempo: "3h", dificuldade: "Médio" },
  { titulo: "Risotto de cogumelos", categoria: "Receitas rápidas", tempo: "30min", dificuldade: "Fácil" },
  { titulo: "Vinagrete clássico", categoria: "Para iniciantes", tempo: "5min", dificuldade: "Fácil" },
  { titulo: "Caldo de legumes", categoria: "Para iniciantes", tempo: "45min", dificuldade: "Fácil" },
  { titulo: "Pasta fresca", categoria: "Para aprender", tempo: "1h", dificuldade: "Médio" },
  { titulo: "Molho béchamel", categoria: "Para iniciantes", tempo: "15min", dificuldade: "Fácil" },
];

const CATEGORIAS = ["Todas", "Para aprender", "Receitas rápidas", "Para iniciantes"];

export default function Sugestor() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [possiveis, setPossiveis] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFiltro, setCatFiltro] = useState("Todas");

  useEffect(() => {
    api.sugestor
      .receitasPossiveis()
      .then(setPossiveis)
      .catch(() => addToast("Erro ao carregar sugestões", "error"))
      .finally(() => setLoading(false));
  }, []);

  const sugestoesFiltradas =
    catFiltro === "Todas"
      ? SUGESTOES_ESTATICAS
      : SUGESTOES_ESTATICAS.filter((s) => s.categoria === catFiltro);

  return (
    <>
      <Topbar placeholder="Pesquisar sugestões…" />
      <div className="content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Sugestor</h1>
            <div className="page-sub">O que posso fazer agora, e inspiração para aprender mais</div>
          </div>
        </div>

        {/* Section 1: What can I make? */}
        <div style={{ marginBottom: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
              color: "var(--primary)",
            }}
          >
            <Sparkles size={16} />
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text)",
                margin: 0,
              }}
            >
              O que posso fazer?
            </h2>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 16,
            }}
          >
            Receitas para as quais tens todos os ingredientes em stock
          </div>

          {loading ? (
            <div className="spinner" />
          ) : possiveis.length === 0 ? (
            <div
              className="card"
              style={{
                padding: "36px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <Sparkles
                size={36}
                style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }}
              />
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                Sem receitas possíveis de momento
              </div>
              <div style={{ fontSize: 13 }}>
                Adiciona ingredientes ao armazém para ver o que podes preparar
              </div>
            </div>
          ) : (
            <div className="recipes-grid">
              {possiveis.map((r) => (
                <PossibleCard key={r.id} receita={r} onClick={() => navigate(`/receitas/${r.id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Curated suggestions */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text)",
                margin: 0,
              }}
            >
              Sugestões
            </h2>
          </div>

          <div className="filter-bar" style={{ marginBottom: 16 }}>
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                className={`chip ${catFiltro === cat ? "active" : ""}`}
                onClick={() => setCatFiltro(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="recipes-grid">
            {sugestoesFiltradas.map((s, i) => (
              <SugestaoCard key={i} {...s} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function PossibleCard({ receita, onClick }: { receita: Receita; onClick: () => void }) {
  return (
    <div className="recipe-card" onClick={onClick} style={{ cursor: "pointer" }}>
      <div className="recipe-card-img">
        {receita.imagem_path ? (
          <IngImg
            path={receita.imagem_path}
            alt={receita.nome}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <RecipePlaceholder nome={receita.nome} />
        )}
      </div>
      <div className="recipe-card-body">
        {receita.categoria && (
          <div className="recipe-card-category">{receita.categoria}</div>
        )}
        <h3 className="recipe-card-name">{receita.nome}</h3>
        {receita.tags.length > 0 && (
          <div className="recipe-card-tags">
            {receita.tags.slice(0, 3).map((t) => (
              <span key={t} className="recipe-card-tag">{t}</span>
            ))}
          </div>
        )}
      </div>
      <div className="recipe-card-footer">
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Users size={13} />
          {receita.porcoes_base} {receita.porcoes_base === 1 ? "porção" : "porções"}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "var(--sage)",
            fontWeight: 500,
            fontSize: 12,
          }}
        >
          <Sparkles size={11} /> Possível
        </span>
      </div>
    </div>
  );
}

function SugestaoCard({
  titulo,
  categoria,
  tempo,
  dificuldade,
}: {
  titulo: string;
  categoria: string;
  tempo: string;
  dificuldade: string;
}) {
  return (
    <div
      className="recipe-card"
      style={{ cursor: "default", opacity: 0.8 }}
    >
      <div
        className="recipe-card-img"
        style={{
          background: "var(--bg-alt)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock size={22} style={{ color: "var(--text-light)" }} />
      </div>
      <div className="recipe-card-body">
        <div className="recipe-card-category">{categoria}</div>
        <h3 className="recipe-card-name">{titulo}</h3>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <span className="recipe-card-tag">
            <Clock size={10} /> {tempo}
          </span>
          <span className="recipe-card-tag">{dificuldade}</span>
        </div>
      </div>
      <div className="recipe-card-footer">
        <span
          style={{
            fontSize: 11,
            color: "var(--text-light)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Em breve
        </span>
      </div>
    </div>
  );
}

const STRIPES = [
  "stripe-amber", "stripe-rose", "stripe-sage", "stripe-sand",
  "stripe-cocoa", "stripe-stone", "stripe-butter", "stripe-terra",
];

function RecipePlaceholder({ nome }: { nome: string }) {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) | 0;
  return <div className={STRIPES[Math.abs(h) % STRIPES.length]} style={{ width: "100%", height: "100%" }} />;
}
