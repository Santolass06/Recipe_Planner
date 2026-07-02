import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useI18n } from "../i18n";

type NavItemProps = { icon: ReactNode; label: string; to: string; end?: boolean };

function NavItem({ icon, label, to, end }: NavItemProps) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      "nav-item" + (isActive ? " active" : "")
    }>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

const I = {
  home:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  leaf:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 22 16 8M16 3s0 7-8 13"/></svg>,
  book:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  calc:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>,
  box:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  cart:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  plan:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  chart:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  truck:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  camera:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  gear:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  help:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

export default function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-name">Mise</span>
        <span className="brand-tag">pro</span>
      </div>
      <nav className="sidebar-scroll" aria-label="Navegação principal">
        <div className="nav-group">
          <p className="nav-group-label">{t("nav.kitchen")}</p>
          <NavItem to="/" end icon={I.home}   label={t("nav.dashboard")} />
          <NavItem to="/ingredientes" icon={I.leaf}   label={t("nav.ingredients")} />
          <NavItem to="/receitas"     icon={I.book}   label={t("nav.recipes")} />
          <NavItem to="/custos"       icon={I.calc}   label={t("nav.costs")} />
          <NavItem to="/armazem"      icon={I.box}    label={t("nav.stock")} />
          <NavItem to="/compras"      icon={I.cart}   label={t("nav.shopping")} />
          <NavItem to="/planeamento"  icon={I.plan}   label={t("nav.planning")} />
        </div>
        <div className="nav-group">
          <p className="nav-group-label">{t("nav.business")}</p>
          <NavItem to="/relatorios"   icon={I.chart}  label={t("nav.reports")} />
          <NavItem to="/fornecedores" icon={I.truck}  label={t("nav.suppliers")} />
          <NavItem to="/scanner"      icon={I.camera} label={t("nav.scanner")} />
        </div>
        <div className="nav-group">
          <p className="nav-group-label">{t("nav.system")}</p>
          <NavItem to="/definicoes"   icon={I.gear}   label={t("nav.settings")} />
          <NavItem to="/ajuda"        icon={I.help}   label={t("nav.help")} />
        </div>
      </nav>
      <div className="sidebar-profile">
        <div className="profile-avatar">MM</div>
        <div>
          <p className="profile-name">Maison Moreau</p>
          <p className="profile-role">HeadChef</p>
        </div>
      </div>
    </aside>
  );
}