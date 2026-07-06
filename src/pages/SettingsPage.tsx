import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/ui/Toast";
import { invoke, openExternal } from "../lib/devInvoke";
import { useI18n } from "../i18n";
import { applyTheme } from "../theme";

type SettingsMap = Record<string, string>;

interface SettingsCategory {
  key: string;
  labelKey: string;
  icon: React.ReactNode;
}

const CATEGORIES: SettingsCategory[] = [
  { key: "general", labelKey: "settings.general", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )},
  { key: "units", labelKey: "settings.units", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M3 21h18"/>
      <path d="M6 3v18"/><path d="M12 3v18"/><path d="M18 3v18"/>
    </svg>
  )},
  { key: "currency", labelKey: "settings.currency", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { key: "data", labelKey: "settings.data", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 21v-6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v6"/><path d="M3 17V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10"/><path d="M3 3h18"/><path d="M9 21v-4"/>
    </svg>
  )},
  { key: "sync", labelKey: "settings.sync", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )},
  { key: "about", labelKey: "settings.about", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  )},
  { key: "developer", labelKey: "settings.developer", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>
    </svg>
  )},
];

const DEFAULTS = {
  general: {
    language: "pt",
    theme: "system",
    density: "cozy",
    date_format: "DD/MM/YYYY",
  },
  units: {
    weight: "g",
    volume: "ml",
    temperature: "c",
  },
  currency: {
    currency: "EUR",
    symbol_position: "after",
  },
  sync: {
    turso_url: "",
    auth_token: "",
  },
};

const LANGUAGES = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
];

type T = (key: string, params?: Record<string, string | number>) => string;

const getThemes = (t: T) => [
  { value: "light", label: t("theme_light") },
  { value: "dark", label: t("theme_dark") },
  { value: "system", label: t("theme_system") },
];

const getDensities = (t: T) => [
  { value: "compact", label: t("settings.densityCompact") },
  { value: "cozy", label: t("settings.densityCozy") },
  { value: "comfy", label: t("settings.densityComfy") },
];

const DENSITY_ATTR_KEY = "mise-density";

function applyDensity(value: string) {
  if (value && value !== "cozy") {
    document.documentElement.setAttribute("data-density", value);
  } else {
    document.documentElement.removeAttribute("data-density");
  }
}

/** Segmented control matching the `.seg` styles in theme.css (used by the topbar's PT/EN toggle). */
function Seg({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const getWeightUnits = (t: T) => [
  { value: "g", label: t("settings.weightG") },
  { value: "kg", label: t("settings.weightKg") },
  { value: "lb", label: t("settings.weightLb") },
  { value: "oz", label: t("settings.weightOz") },
];

const getVolumeUnits = (t: T) => [
  { value: "ml", label: t("settings.volumeMl") },
  { value: "l", label: t("settings.volumeL") },
  { value: "fl_oz", label: t("settings.volumeFlOz") },
  { value: "cup", label: t("settings.volumeCup") },
];

const getTemperatureUnits = (t: T) => [
  { value: "c", label: t("settings.temperatureC") },
  { value: "f", label: t("settings.temperatureF") },
];

const getCurrencies = (t: T) => [
  { value: "EUR", label: t("settings.currencyEur") },
  { value: "USD", label: t("settings.currencyUsd") },
  { value: "GBP", label: t("settings.currencyGbp") },
  { value: "BRL", label: t("settings.currencyBrl") },
];

const getSymbolPositions = (t: T) => [
  { value: "before", label: t("settings.symbolBefore") },
  { value: "after", label: t("settings.symbolAfter") },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  BRL: "R$",
};

export default function SettingsPage() {
  const { t, setLanguage } = useI18n();
  const visibleCategories = CATEGORIES.filter(c => c.key !== "developer" || import.meta.env.DEV);
  const [activeCategory, setActiveCategory] = useState("general");
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<SettingsMap>("settings_get_all");
      setSettings(data);
    } catch (e) {
      showToast(t("settings.loadError"), "err");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply the persisted density (or the value already saved via settings_set)
  // to <html data-density> once the real settings have loaded, mirroring how
  // theme.ts applies data-theme. This attribute isn't set anywhere else yet,
  // so wire it here rather than in a shared file.
  useEffect(() => {
    if (loading) return;
    const stored = localStorage.getItem(DENSITY_ATTR_KEY);
    applyDensity(stored ?? getSetting("density", "general"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const getSetting = (key: string, category: keyof typeof DEFAULTS): string => {
    const categorySettings = settings[category];
    if (categorySettings) {
      try {
        const parsed = JSON.parse(categorySettings);
        return parsed[key] ?? (DEFAULTS[category] as any)[key] ?? "";
      } catch {
        return (DEFAULTS[category] as any)[key] ?? "";
      }
    }
    return (DEFAULTS[category] as any)[key] ?? "";
  };

  const saveCategorySettings = async (category: keyof typeof DEFAULTS, values: Record<string, string>) => {
    setSaving(true);
    try {
      const existing = settings[category];
      let parsed: Record<string, string> = {};
      if (existing) {
        try { parsed = JSON.parse(existing); } catch { parsed = {}; }
      }
      const newSettings = { ...parsed, ...values };
      await invoke("settings_set", { key: category, value: JSON.stringify(newSettings) });
      setSettings(prev => ({ ...prev, [category]: JSON.stringify(newSettings) }));
      
      if (values.language) {
        setLanguage(values.language as "pt" | "en");
      }
      if (values.theme) {
        localStorage.setItem("mise-theme", values.theme);
        await applyTheme(values.theme);
      }
      if (values.density) {
        localStorage.setItem(DENSITY_ATTR_KEY, values.density);
        applyDensity(values.density);
      }

      showToast(t("settings.saved"), "ok");
    } catch (e) {
      showToast(t("settings.saveError"), "err");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await invoke<any>("export_data");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mise-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("settings.exportSuccess"), "ok");
    } catch (e) {
      showToast(t("settings.exportError"), "err");
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      if (!data.version || !data.ingredients || !data.recipes) {
        showToast(t("settings.invalidFile"), "err");
        return;
      }
      const result = await invoke<any>("import_data", { data });
      showToast(t("settings.importSuccess", { ingredients: result.ingredients_created, recipes: result.recipes_created }), "ok");
      if (result.errors.length > 0) {
        showToast(t("settings.importWarnings", { errors: result.errors.join("; ") }), "warn");
      }
      setImportFile(null);
    } catch (e) {
      showToast(t("settings.importError"), "err");
    }
  };

  const handleReset = async () => {
    try {
      await invoke("settings_reset");
      setSettings({});
      showToast(t("settings.resetSuccess"), "ok");
      setShowResetConfirm(false);
    } catch (e) {
      showToast(t("settings.resetError"), "err");
    }
  };

  const handleDeleteAllData = async () => {
    setSaving(true);
    try {
      await invoke("delete_all_data");
      setSettings({});
      showToast(t("settings.deleteAllDataSuccess"), "ok");
      setShowDeleteDataConfirm(false);
    } catch (e) {
      showToast(t("settings.deleteAllDataError"), "err");
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDemoData = async () => {
    setSaving(true);
    try {
      await invoke("seed_demo_data");
      showToast(t("settings.demoDataSuccess"), "ok");
    } catch (e) {
      showToast(t("settings.demoDataError"), "err");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <p className="text-3">{t("settings.loadingSettings")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="content-header">
        <div>
          <h1 className="content-title">{t("settings.pageTitle")}</h1>
          <p className="content-sub mono">{t("settings.pageSub")}</p>
        </div>
      </div>

      <div className="card settings-layout">
        {/* Sidebar Navigation */}
        <nav className="settings-nav">
          {visibleCategories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`settings-nav-item${activeCategory === cat.key ? " active" : ""}`}
            >
              <span style={{ width: 14, height: 14, display: "flex" }}>
                {cat.icon}
              </span>
              {t(cat.labelKey)}
            </button>
          ))}
        </nav>

        {/* Settings Content */}
        <div className="settings-content">
          {activeCategory === "general" && (
            <SettingsSection title={t("settings.general")} description={t("settings.generalDesc")}>
              <div className="settings-group">
                <label>{t("settings.language")}</label>
                <Seg
                  options={LANGUAGES}
                  value={getSetting("language", "general")}
                  onChange={v => saveCategorySettings("general", { language: v })}
                />
              </div>

              <div className="settings-group">
                <label>{t("settings.theme")}</label>
                <Seg
                  options={getThemes(t)}
                  value={getSetting("theme", "general")}
                  onChange={v => saveCategorySettings("general", { theme: v })}
                />
              </div>

              <div className="settings-group">
                <label>{t("settings.density")}</label>
                <Seg
                  options={getDensities(t)}
                  value={getSetting("density", "general")}
                  onChange={v => saveCategorySettings("general", { density: v })}
                />
              </div>

              <div className="settings-group">
                <label>{t("settings.dateFormat")}</label>
                <select
                  className="select"
                  value={getSetting("date_format", "general")}
                  onChange={e => saveCategorySettings("general", { date_format: e.target.value })}
                >
                  {DATE_FORMATS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "units" && (
            <SettingsSection title={t("settings.units")} description={t("settings.unitsDesc")}>
              <div className="settings-group">
                <label >{t("settings.weightUnit")}</label>
                <select
                  className="select"
                  value={getSetting("weight", "units")}
                  onChange={e => saveCategorySettings("units", { weight: e.target.value })}
                >
                  {getWeightUnits(t).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >{t("settings.volumeUnit")}</label>
                <select
                  className="select"
                  value={getSetting("volume", "units")}
                  onChange={e => saveCategorySettings("units", { volume: e.target.value })}
                >
                  {getVolumeUnits(t).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >{t("settings.temperatureUnit")}</label>
                <select
                  className="select"
                  value={getSetting("temperature", "units")}
                  onChange={e => saveCategorySettings("units", { temperature: e.target.value })}
                >
                  {getTemperatureUnits(t).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "currency" && (
            <SettingsSection title={t("settings.currency")} description={t("settings.currencyDesc")}>
              <div className="settings-group">
                <label >{t("settings.currencyLabel")}</label>
                <select
                  className="select"
                  value={getSetting("currency", "currency")}
                  onChange={e => saveCategorySettings("currency", { currency: e.target.value })}
                >
                  {getCurrencies(t).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >{t("settings.symbolPosition")}</label>
                <select
                  className="select"
                  value={getSetting("symbol_position", "currency")}
                  onChange={e => saveCategorySettings("currency", { symbol_position: e.target.value })}
                >
                  {getSymbolPositions(t).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div style={{ marginTop: "20px", padding: "16px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <p className="text-3" style={{ marginBottom: "0" }}>{t("settings.pricePreview")}</p>
                <p style={{ fontFamily: "var(--mono)", fontSize: "24px", fontWeight: 600, color: "var(--accent)", marginTop: "8px", marginBottom: "0" }}>
                  {getSetting("symbol_position", "currency") === "before"
                    ? `${CURRENCY_SYMBOLS[getSetting("currency", "currency")]}1.234,56`
                    : `1.234,56${CURRENCY_SYMBOLS[getSetting("currency", "currency")]}`}
                </p>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "data" && (
            <SettingsSection title={t("settings.data")} description={t("settings.dataDesc")}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="settings-section-sep">
                  <h3 style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}>{t("settings.exportData")}</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", margin: "0 0 12px" }}>
                    {t("settings.exportDesc")}
                  </p>
                  <button className="btn" onClick={handleExport} disabled={saving}>
                    <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">download</span>
                    {t("settings.exportJsonBtn")}
                  </button>
                </div>

                <div className="settings-section-sep">
                  <h3 style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}>{t("settings.importData")}</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", margin: "0 0 12px" }}>
                    {t("settings.importDesc")}
                  </p>
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
                    <label htmlFor="import-file" className="btn">{t("settings.chooseFile")}</label>
                    <input
                      type="file"
                      id="import-file"
                      accept=".json"
                      style={{ display: "none" }}
                      onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                    />
                    <span style={{ color: "var(--text-3)", fontSize: "13px", flex: 1 }}>
                      {importFile ? importFile.name : t("settings.noFileSelected")}
                    </span>
                    <button
                      className="btn"
                      onClick={handleImport}
                      disabled={saving || !importFile}
                    >
                      <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">upload</span>
                      {t("settings.importJsonBtn")}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px", color: "var(--danger)" }}>{t("settings.resetToDefault")}</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", margin: "0 0 12px" }}>
                    {t("settings.resetDesc")}
                  </p>
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={saving}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    {t("settings.resetSettings")}
                  </button>
                </div>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "sync" && (
            <SettingsSection title={t("settings.sync")} description={t("settings.syncDesc")}>
              <div className="field">
                <label>{t("settings.tursoUrl")}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="libsql://your-db.turso.io"
                  value={getSetting("turso_url", "sync")}
                  onChange={e => saveCategorySettings("sync", { turso_url: e.target.value })}
                />
              </div>

              <div className="field">
                <label>{t("settings.authToken")}</label>
                <input
                  type="password"
                  className="input"
                  placeholder="eyJhbG...NiIs..."
                  value={getSetting("auth_token", "sync")}
                  onChange={e => saveCategorySettings("sync", { auth_token: e.target.value })}
                />
              </div>

              <div className="info-box">
                <strong style={{ fontWeight: 500 }}>{t("settings.syncInDevelopment")}</strong> {t("settings.syncPlaceholder")}
              </div>
            </SettingsSection>
          )}

          {activeCategory === "about" && (
            <SettingsSection title={t("settings.about")} description={t("settings.aboutDesc")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
                  <div className="settings-about-logo">
                    M
                  </div>
                  <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "var(--space-1)" }}>mise</h2>
                  <p style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: "var(--space-2)" }} className="mono">pro-kitchen</p>
                  <p style={{ color: "var(--text-2)", fontSize: "13px", marginBottom: "24px" }}>{t("settings.aboutVersion")}</p>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-6)" }}>
                  <h3 className="text-2" style={{ marginBottom: "var(--space-4)" }}>{t("settings.usefulLinks")}</h3>
                  <div className="settings-links">
                    <a href="https://github.com/Santolass06/Recipe_Planner" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openExternal("https://github.com/Santolass06/Recipe_Planner"); }}>
                      {t("settings.githubRepo")}
                    </a>
                    <a href="https://tauri.app" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openExternal("https://tauri.app"); }}>
                      {t("settings.tauriDocs")}
                    </a>
                    <a href="https://react.dev" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openExternal("https://react.dev"); }}>
                      {t("settings.reactDocs")}
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-6)" }}>
                  <h3 className="text-2" style={{ marginBottom: "var(--space-4)" }}>{t("settings.licenses")}</h3>
                  <p style={{ color: "var(--text-3)", fontSize: "12px", lineHeight: 1.6 }}>
                    {t("settings.licensesDesc")}
                  </p>
                </div>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "developer" && import.meta.env.DEV && (
            <SettingsSection title={t("settings.developer")} description={t("settings.developerDesc")}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                <div>
                  <h3 className="text-2" style={{ marginBottom: "var(--space-3)" }}>{t("settings.appInfoTitle")}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-2) 0", borderBottom: "1px solid var(--border)" }}>
                      <span className="text-3">{t("settings.versionLabel")}</span>
                      <span className="mono">1.0.0 (build 2026.07)</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-2) 0", borderBottom: "1px solid var(--border)" }}>
                      <span className="text-3">{t("settings.technologyLabel")}</span>
                      <span className="mono">Tauri 2 · React 19 · Rust · libSQL</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-2) 0" }}>
                      <span className="text-3">{t("settings.databaseLabel")}</span>
                      <span className="mono">libSQL (SQLite) · WAL</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-6)" }}>
                  <h3 className="text-2" style={{ marginBottom: "var(--space-3)" }}>{t("settings.demoDataTitle")}</h3>
                  <p className="text-3" style={{ marginBottom: "var(--space-4)", lineHeight: 1.6 }}>
                    {t("settings.demoDataDesc")}
                  </p>
                  <button className="btn btn-primary" onClick={handleSeedDemoData} disabled={saving}>
                    {t("settings.generateDemoDataBtn")}
                  </button>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-6)" }}>
                  <h3 className="text-2" style={{ marginBottom: "var(--space-3)", color: "var(--danger)" }}>{t("settings.dangerZoneTitle")}</h3>
                  <p className="text-3" style={{ marginBottom: "var(--space-4)", lineHeight: 1.6 }}>
                    {t("settings.dangerZoneDesc")}
                  </p>
                  <button className="btn btn-danger" onClick={() => setShowDeleteDataConfirm(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "var(--space-2)" }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    {t("settings.deleteAllDataMenuBtn")}
                  </button>
                </div>
              </div>
            </SettingsSection>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t("settings.confirmReset")}</h2>
              <button className="modal-close" onClick={() => setShowResetConfirm(false)} aria-label={t("common.close")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
                {t("settings.confirmResetDesc")}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>{t("common.cancel")}</button>
              <button className="btn btn-danger" onClick={handleReset} disabled={saving}>
                {t("settings.confirmResetBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Data Confirmation Modal */}
      {showDeleteDataConfirm && (
        <div className="modal-backdrop" onClick={() => setShowDeleteDataConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t("settings.deleteAllDataTitle")}</h2>
              <button className="modal-close" onClick={() => setShowDeleteDataConfirm(false)} aria-label={t("common.close")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
                {t("settings.deleteAllDataDesc")}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteDataConfirm(false)}>{t("common.cancel")}</button>
              <button className="btn btn-danger" onClick={handleDeleteAllData} disabled={saving}>
                {t("settings.deleteAllDataBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="settings-section-title">{title}</h2>
      <p className="settings-section-sub">{description}</p>
      <div>
        {children}
      </div>
    </div>
  );
}