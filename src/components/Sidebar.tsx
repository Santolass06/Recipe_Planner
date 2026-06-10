import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 16 }}>
        MISE
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <NavLink to="/ingredientes" className={({ isActive }) =>
          "nav-item" + (isActive ? " active" : "")
        } style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Ingredientes
        </NavLink>
        <NavLink to="/receitas" className={({ isActive }) =>
          "nav-item" + (isActive ? " active" : "")
        } style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Receitas
        </NavLink>
        <NavLink to="/custos" className={({ isActive }) =>
          "nav-item" + (isActive ? " active" : "")
        } style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Custos
        </NavLink>
        <NavLink to="/sugestor" className={({ isActive }) =>
          "nav-item" + (isActive ? " active" : "")
        } style={{ padding: "6px 8px", borderRadius: 4, fontSize: 12 }}>
          Planeamento
        </NavLink>
      </nav>
    </aside>
  );
}
