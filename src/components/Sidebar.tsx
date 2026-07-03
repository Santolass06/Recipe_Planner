import { NavLink } from "react-router-dom";
import { useI18n } from "../i18n";

type NavItemProps = { icon: string; label: string; to: string; end?: boolean };

function NavItem({ icon, label, to, end }: NavItemProps) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
      {({ isActive }) => (
        <>
          <span className={"ms nav-icon" + (isActive ? " filled" : "")} style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>
          <span style={{ flex: 1 }}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { t } = useI18n();

  const groups: { label: string; items: NavItemProps[] }[] = [
    { label: t("nav.kitchen"), items: [
      { to: "/", end: true, icon: "dashboard", label: t("nav.dashboard") },
    ] },
    { label: t("nav.inventory"), items: [
      { to: "/ingredientes", icon: "nutrition", label: t("nav.ingredients") },
      { to: "/armazem", icon: "inventory_2", label: t("nav.stock") },
      { to: "/fornecedores", icon: "local_shipping", label: t("nav.suppliers") },
    ] },
    { label: t("nav.production"), items: [
      { to: "/receitas", icon: "menu_book", label: t("nav.recipes") },
      { to: "/custos", icon: "calculate", label: t("nav.costs") },
    ] },
    { label: t("nav.planningGroup"), items: [
      { to: "/planeamento", icon: "calendar_view_week", label: t("nav.planning") },
      { to: "/calendario", icon: "calendar_month", label: t("nav.calendar") },
      { to: "/compras", icon: "shopping_cart", label: t("nav.shopping") },
    ] },
    { label: t("nav.analytics"), items: [
      { to: "/relatorios", icon: "monitoring", label: t("nav.reports") },
    ] },
    { label: t("nav.tools"), items: [
      { to: "/scanner", icon: "receipt_long", label: t("nav.scanner") },
      { to: "/definicoes", icon: "settings", label: t("nav.settings") },
      { to: "/ajuda", icon: "help", label: t("nav.help") },
    ] },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-mark" aria-hidden="true">m</div>
        <div>
          <div className="brand-name">mise</div>
          <div className="brand-tag">en place</div>
        </div>
      </div>
      <nav className="sidebar-scroll" aria-label="Navegação principal">
        {groups.map((g) => (
          <div key={g.label} className="nav-group">
            <p className="nav-group-label" style={{ margin: "0 0 6px 4px" }}>{g.label}</p>
            {g.items.map((it) => (
              <NavItem key={it.to} {...it} />
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-profile">
        <div className="profile-avatar">A</div>
        <div style={{ flex: 1, lineHeight: 1.2 }}>
          <p className="profile-name">André M.</p>
          <p className="profile-role">Chef de cozinha</p>
        </div>
        <span className="ms" style={{ fontSize: 18, color: "var(--rail-ink-2)" }} aria-hidden="true">unfold_more</span>
      </div>
    </aside>
  );
}
