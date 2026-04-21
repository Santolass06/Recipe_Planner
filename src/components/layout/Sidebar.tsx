import { NavLink, useLocation } from "react-router-dom";
import {
  Carrot, BookOpen, Truck, BarChart2,
  ShoppingBag, Settings, HelpCircle,
} from "lucide-react";

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
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">M</div>
        <div>
          <div className="brand-name">Mise</div>
          <div className="brand-sub">Recipe Planner</div>
        </div>
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

      <div className="user-section">
        <div className="avatar">MM</div>
        <div>
          <div className="user-name">Maison Moreau</div>
          <div className="user-role">Proprietário</div>
        </div>
      </div>
    </aside>
  );
}
