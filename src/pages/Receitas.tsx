import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BookOpen, Users } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import IngImg from "../components/ui/IngImg";
import ImagePlaceholder from "../components/ui/ImagePlaceholder";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import type { Receita } from "../types";

export default function Receitas() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("Todas");

  useEffect(() => {
    api.receitas
      .listar()
      .then(setReceitas)
      .catch(() => addToast("Erro ao carregar receitas", "error"))
      .finally(() => setLoading(false));
  }, []);

  const { categorias, categoriaCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const receita of receitas) {
      if (!receita.categoria) continue;
      counts.set(receita.categoria, (counts.get(receita.categoria) ?? 0) + 1);
    }
    return {
      categorias: ["Todas", ...counts.keys()],
      categoriaCounts: counts,
    };
  }, [receitas]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return receitas.filter((r) => {
      const matchSearch = r.nome.toLowerCase().includes(normalizedSearch);
      const matchCat = categoria === "Todas" || r.categoria === categoria;
      return matchSearch && matchCat;
    });
  }, [categoria, receitas, search]);

  return (
    <>
      <Topbar
        placeholder="Pesquisar receitas…"
        search={search}
        onSearch={setSearch}
        right={
          <button className="btn btn-primary" onClick={() => navigate("/receitas/nova")}>
            <Plus size={15} /> Nova Receita
          </button>
        }
      />

      <div className="content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Receitas</h1>
            <div className="page-sub">
              {loading ? "A carregar…" : `${receitas.length} receita${receitas.length !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>

        {categorias.length > 1 && (
          <div className="filter-bar">
            {categorias.map((cat) => (
              <button
                key={cat}
                className={`chip ${categoria === cat ? "active" : ""}`}
                onClick={() => setCategoria(cat)}
              >
                {cat}
                {cat !== "Todas" && (
                  <span className="chip-count">
                    {categoriaCounts.get(cat) ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><BookOpen size={40} /></div>
            <h3>{search ? "Nenhum resultado" : "Sem receitas"}</h3>
            <p>
              {search
                ? `Nenhuma receita corresponde a "${search}"`
                : "Crie a primeira receita para começar."}
            </p>
            {!search && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => navigate("/receitas/nova")}
              >
                <Plus size={15} /> Nova Receita
              </button>
            )}
          </div>
        ) : (
          <div className="recipes-grid">
            {filtered.map((r) => (
              <ReceitaCard key={r.id} receita={r} onClick={() => navigate(`/receitas/${r.id}`)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ReceitaCard({ receita, onClick }: { receita: Receita; onClick: () => void }) {
  return (
    <div className="recipe-card" onClick={onClick}>
      <div className="recipe-card-img">
        {receita.imagem_path ? (
          <IngImg path={receita.imagem_path} alt={receita.nome} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
        ) : (
          <ImagePlaceholder seed={receita.nome} />
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
        <span style={{ color: "var(--primary)", fontWeight: 500, fontSize: 12 }}>Ver receita →</span>
      </div>
    </div>
  );
}
