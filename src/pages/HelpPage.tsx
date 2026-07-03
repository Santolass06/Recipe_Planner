import { invoke } from "../lib/devInvoke";
import PageHeader from "../components/ui/PageHeader";

// WebKitGTK bloqueia <a href> externos — abrir via plugin opener
// (capability opener:default já inclui allow-default-urls para https/http).
async function openExternal(url: string) {
  try {
    await invoke("plugin:opener|open_url", { url });
  } catch (e) {
    console.error("Erro ao abrir link:", e);
  }
}

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Ingredientes",
    items: [
      "Cria ingredientes com unidade e preço por unidade.",
      "Marca favoritos com a estrela para acesso rápido.",
    ],
  },
  {
    title: "Receitas",
    items: [
      "Adiciona ingredientes com quantidades e unidades para calcular custos.",
      "Usa \"Clonar\" para duplicar receitas e variar porções.",
    ],
  },
  {
    title: "Armazém",
    items: [
      "Define quantidade actual e mínima por ingrediente.",
      "Regista compras para actualizar stock automaticamente.",
    ],
  },
  {
    title: "Compras",
    items: [
      "Cria listas manuais ou gera a partir de receitas e planeamento.",
      "Marca itens como comprados e limpa-os quando conveniente.",
    ],
  },
  {
    title: "Planeamento",
    items: [
      "Cria planos semanais e adiciona entradas por dia e refeição.",
      "Gera lista de compras a partir do plano.",
    ],
  },
  {
    title: "Custos e Relatórios",
    items: [
      "Analisa custo por porção e margem pretendida.",
      "Consulta tendências de stock, desperdício e preços de fornecedores.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="content">
      <PageHeader title="Ajuda" subtitle="Guia rápido da aplicação" />

      <div className="card" style={{ padding: "var(--space-5)", marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 500, color: "var(--ink)", marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ember)" }}>soup_kitchen</span>
          Bem-vindo ao mise
        </h2>
        <p className="text-3" style={{ lineHeight: 1.6 }}>
          O mise é um gestor profissional de cozinha: receitas, ingredientes, custos,
          stock, listas de compras, planeamento semanal, relatórios e fornecedores.
          Todos os dados são guardados localmente (libSQL).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        {SECTIONS.map((s) => (
          <div key={s.title} className="card" style={{ padding: "var(--space-4)" }}>
            <h3 className="mono" style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-2)", marginBottom: "var(--space-3)" }}>{s.title}</h3>
            <ul style={{ margin: 0, paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {s.items.map((it, i) => (
                <li key={i} className="text-3" style={{ lineHeight: 1.5 }}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "var(--space-5)" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 500, color: "var(--ink)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ember)" }}>link</span>
          Links úteis
        </h2>
        <div className="settings-links">
          <a
            href="https://github.com/Santolass06/Recipe_Planner"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); openExternal("https://github.com/Santolass06/Recipe_Planner"); }}
          >
            <span className="ms" style={{ fontSize: 18, marginRight: "var(--space-2)" }}>code</span>
            Repositório no GitHub
          </a>
          <a
            href="https://tauri.app"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); openExternal("https://tauri.app"); }}
          >
            <span className="ms" style={{ fontSize: 18, marginRight: "var(--space-2)" }}>menu_book</span>
            Documentação Tauri
          </a>
          <a
            href="https://react.dev"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); openExternal("https://react.dev"); }}
          >
            <span className="ms" style={{ fontSize: 18, marginRight: "var(--space-2)" }}>menu_book</span>
            Documentação React
          </a>
        </div>
      </div>
    </div>
  );
}
