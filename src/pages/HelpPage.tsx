import { openExternal } from "../lib/devInvoke";
import PageHeader from "../components/ui/PageHeader";
import { useI18n } from "../i18n";

const SECTION_KEYS = ["ingredients", "recipes", "stock", "shopping", "planning", "costsReports"] as const;

export default function HelpPage() {
  const { t } = useI18n();

  return (
    <div className="content">
      <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} />

      <div className="card" style={{ padding: "var(--space-5)", marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 500, color: "var(--ink)", marginBottom: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ember)" }}>soup_kitchen</span>
          {t("help.welcomeTitle")}
        </h2>
        <p className="text-3" style={{ lineHeight: 1.6 }}>
          {t("help.welcomeDesc")}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        {SECTION_KEYS.map((key) => (
          <div key={key} className="card" style={{ padding: "var(--space-4)" }}>
            <h3 className="mono" style={{ fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-2)", marginBottom: "var(--space-3)" }}>{t(`help.sections.${key}.title`)}</h3>
            <ul style={{ margin: 0, paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <li className="text-3" style={{ lineHeight: 1.5 }}>{t(`help.sections.${key}.item1`)}</li>
              <li className="text-3" style={{ lineHeight: 1.5 }}>{t(`help.sections.${key}.item2`)}</li>
            </ul>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "var(--space-5)" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 500, color: "var(--ink)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className="ms" style={{ fontSize: 20, color: "var(--ember)" }}>link</span>
          {t("help.usefulLinksTitle")}
        </h2>
        <div className="settings-links">
          <a
            href="https://github.com/Santolass06/Recipe_Planner"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); openExternal("https://github.com/Santolass06/Recipe_Planner"); }}
          >
            <span className="ms" style={{ fontSize: 18, marginRight: "var(--space-2)" }}>code</span>
            {t("settings.githubRepo")}
          </a>
          <a
            href="https://tauri.app"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); openExternal("https://tauri.app"); }}
          >
            <span className="ms" style={{ fontSize: 18, marginRight: "var(--space-2)" }}>menu_book</span>
            {t("settings.tauriDocs")}
          </a>
          <a
            href="https://react.dev"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.preventDefault(); openExternal("https://react.dev"); }}
          >
            <span className="ms" style={{ fontSize: 18, marginRight: "var(--space-2)" }}>menu_book</span>
            {t("settings.reactDocs")}
          </a>
        </div>
      </div>
    </div>
  );
}
