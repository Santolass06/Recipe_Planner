import { NavLink, useLocation } from "react-router-dom";
import {
  Carrot, BookOpen, Truck, BarChart2,
  ShoppingBag, Settings, HelpCircle, Sun, Moon,
} from "lucide-react";
import { useThemeStore } from "../../store/themeStore";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  count?: number;
}

function NavItem({ to, icon: Icon, label, count }: NavItemProps) {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      className={`nav-item ${active ? "active" : ""}`}
    >
      <Icon size={16} />
      <span>{label}</span>
      {count != null && <span className="nav-count">{count}</span>}
    </NavLink>
  );
}

export default function Sidebar() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">M</div>
        <div className="brand-name">Mise</div>
      </div>

      <div className="nav-group-label">Cozinha</div>
      <NavItem to="/ingredientes" icon={Carrot} label="Ingredientes" />
      <NavItem to="/receitas" icon={BookOpen} label="Receitas" />

      <div className="nav-group-label">Negócio</div>
      <NavItem to="/fornecedores" icon={Truck} label="Fornecedores" />
      <NavItem to="/relatorios" icon={BarChart2} label="Relatórios" />
      <NavItem to="/menu" icon={ShoppingBag} label="Menu" />

      <div className="spacer" />

      <NavItem to="/definicoes" icon={Settings} label="Definições" />
      <NavItem to="/ajuda" icon={HelpCircle} label="Ajuda & Docs" />

      <button
        className="nav-item"
        onClick={toggleTheme}
        title={theme === "light" ? "Modo escuro" : "Modo claro"}
        style={{ width: "100%" }}
      >
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        <span>{theme === "light" ? "Modo escuro" : "Modo claro"}</span>
      </button>

      <div className="user-section">
        <div className="avatar">MM</div>
        <div>
          <div className="user-name">Maison Moreau</div>
          <div className="user-role">HeadChef</div>
        </div>
      </div>
    </aside>
  );
}
