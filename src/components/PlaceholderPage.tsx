import { useI18n } from "../i18n";

export default function PlaceholderPage({ name }: { name: string }) {
  const { t } = useI18n();
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return (
    <div className="content">
      <div className="empty" style={{ minHeight: "400px" }}>
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p className="empty-title">{capitalized}</p>
        <p className="empty-desc">{t("common.placeholderDesc")}</p>
      </div>
    </div>
  );
}