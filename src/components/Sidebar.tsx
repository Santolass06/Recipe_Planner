export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
        MISE
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <a href="/" style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Ingredientes
        </a>
        <a href="/" style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Receitas
        </a>
        <a href="/" style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Custos
        </a>
        <a href="/" style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Planeamento
        </a>
      </nav>
    </aside>
  );
}
