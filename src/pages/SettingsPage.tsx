import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/ui/Toast";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n";

type SettingsMap = Record<string, string>;

interface SettingsCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: SettingsCategory[] = [
  { key: "general", label: "Geral", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )},
  { key: "units", label: "Unidades", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M3 21h18"/>
      <path d="M6 3v18"/><path d="M12 3v18"/><path d="M18 3v18"/>
    </svg>
  )},
  { key: "currency", label: "Moeda", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { key: "data", label: "Dados", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 21v-6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v6"/><path d="M3 17V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10"/><path d="M3 3h18"/><path d="M9 21v-4"/>
    </svg>
  )},
  { key: "sync", label: "Sincronização", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )},
  { key: "about", label: "Sobre", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  )},
];

const DEFAULTS = {
  general: {
    language: "pt",
    theme: "system",
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

const THEMES = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const WEIGHT_UNITS = [
  { value: "g", label: "Grama (g)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "lb", label: "Libra (lb)" },
  { value: "oz", label: "Onça (oz)" },
];

const VOLUME_UNITS = [
  { value: "ml", label: "Mililitro (ml)" },
  { value: "l", label: "Litro (l)" },
  { value: "fl_oz", label: "Fluid Ounce (fl oz)" },
  { value: "cup", label: "Chávena (cup)" },
];

const TEMPERATURE_UNITS = [
  { value: "c", label: "Celsius (°C)" },
  { value: "f", label: "Fahrenheit (°F)" },
];

const CURRENCIES = [
  { value: "EUR", label: "Euro (€)" },
  { value: "USD", label: "Dólar ($)" },
  { value: "GBP", label: "Libra (£)" },
  { value: "BRL", label: "Real (R$)" },
];

const SYMBOL_POSITIONS = [
  { value: "before", label: "Antes (€100)" },
  { value: "after", label: "Depois (100€)" },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  BRL: "R$",
};

export default function SettingsPage() {
  const { setLanguage } = useI18n();
  const [activeCategory, setActiveCategory] = useState("general");
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<SettingsMap>("settings_get_all");
      setSettings(data);
    } catch (e) {
      showToast("Erro ao carregar definições", "err");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
        if (values.theme === "light") {
          document.documentElement.setAttribute("data-theme", "light");
        } else if (values.theme === "system") {
          if (window.matchMedia("(prefers-color-scheme: light)").matches) {
            document.documentElement.setAttribute("data-theme", "light");
          } else {
            document.documentElement.removeAttribute("data-theme");
          }
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
      }
      
      showToast("Definições guardadas", "ok");
    } catch (e) {
      showToast("Erro ao guardar definições", "err");
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
      showToast("Dados exportados com sucesso", "ok");
    } catch (e) {
      showToast("Erro ao exportar dados", "err");
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      if (!data.version || !data.ingredients || !data.recipes) {
        showToast("Ficheiro inválido: estrutura incorreta", "err");
        return;
      }
      const result = await invoke<any>("import_data", { data });
      showToast(`Importados: ${result.ingredients_created} ingredientes, ${result.recipes_created} receitas`, "ok");
      if (result.errors.length > 0) {
        showToast(`Avisos: ${result.errors.join("; ")}`, "warn");
      }
      setImportFile(null);
    } catch (e) {
      showToast("Erro ao importar dados", "err");
    }
  };

  const handleReset = async () => {
    try {
      await invoke("settings_reset");
      setSettings({});
      showToast("Definições repostas para padrão", "ok");
      setShowResetConfirm(false);
    } catch (e) {
      showToast("Erro ao repor definições", "err");
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
          <p className="text-3">A carregar definições...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="content-header">
        <div>
          <h1 className="content-title">Definições</h1>
          <p className="content-sub mono">Personaliza a aplicação ao teu gosto</p>
        </div>
      </div>

      <div className="card settings-layout">
        {/* Sidebar Navigation */}
        <nav className="settings-nav">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`settings-nav-item${activeCategory === cat.key ? " active" : ""}`}
            >
              <span style={{ width: 14, height: 14, display: "flex" }}>
                {cat.icon}
              </span>
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Settings Content */}
        <div className="settings-content">
          {activeCategory === "general" && (
            <SettingsSection title="Geral" description="Idioma, tema e formato de data">
              <div className="settings-group">
                <label >Idioma</label>
                <select
                  className="select"
                  value={getSetting("language", "general")}
                  onChange={e => saveCategorySettings("general", { language: e.target.value })}
                >
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >Tema</label>
                <select
                  className="select"
                  value={getSetting("theme", "general")}
                  onChange={e => saveCategorySettings("general", { theme: e.target.value })}
                >
                  {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >Formato de data</label>
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
            <SettingsSection title="Unidades" description="Unidades padrão para peso, volume e temperatura">
              <div className="settings-group">
                <label >Peso padrão</label>
                <select
                  className="select"
                  value={getSetting("weight", "units")}
                  onChange={e => saveCategorySettings("units", { weight: e.target.value })}
                >
                  {WEIGHT_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >Volume padrão</label>
                <select
                  className="select"
                  value={getSetting("volume", "units")}
                  onChange={e => saveCategorySettings("units", { volume: e.target.value })}
                >
                  {VOLUME_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >Temperatura</label>
                <select
                  className="select"
                  value={getSetting("temperature", "units")}
                  onChange={e => saveCategorySettings("units", { temperature: e.target.value })}
                >
                  {TEMPERATURE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "currency" && (
            <SettingsSection title="Moeda" description="Moeda padrão e posição do símbolo">
              <div className="settings-group">
                <label >Moeda</label>
                <select
                  className="select"
                  value={getSetting("currency", "currency")}
                  onChange={e => saveCategorySettings("currency", { currency: e.target.value })}
                >
                  {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="settings-group">
                <label >Posição do símbolo</label>
                <select
                  className="select"
                  value={getSetting("symbol_position", "currency")}
                  onChange={e => saveCategorySettings("currency", { symbol_position: e.target.value })}
                >
                  {SYMBOL_POSITIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div style={{ marginTop: "20px", padding: "16px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                <p className="text-3" style={{ marginBottom: "0" }}>Pré-visualização:</p>
                <p style={{ fontFamily: "var(--mono)", fontSize: "24px", fontWeight: 600, color: "var(--accent)", marginTop: "8px", marginBottom: "0" }}>
                  {getSetting("symbol_position", "currency") === "before"
                    ? `${CURRENCY_SYMBOLS[getSetting("currency", "currency")]}1.234,56`
                    : `1.234,56${CURRENCY_SYMBOLS[getSetting("currency", "currency")]}`}
                </p>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "data" && (
            <SettingsSection title="Dados" description="Exportar, importar e repor dados da aplicação">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="settings-section-sep">
                  <h3 style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}>Exportar dados</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", margin: "0 0 12px" }}>
                    Baixa um ficheiro JSON com todos os teus ingredientes, receitas e definições.
                  </p>
                  <button className="btn" onClick={handleExport} disabled={saving}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Exportar JSON
                  </button>
                </div>

                <div className="settings-section-sep">
                  <h3 style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}>Importar dados</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", margin: "0 0 12px" }}>
                    Carrega um ficheiro JSON exportado anteriormente. Os dados existentes não serão apagados.
                  </p>
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
                    <label htmlFor="import-file" className="btn">Escolher ficheiro</label>
                    <input
                      type="file"
                      id="import-file"
                      accept=".json"
                      style={{ display: "none" }}
                      onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                    />
                    <span style={{ color: "var(--text-3)", fontSize: "13px", flex: 1 }}>
                      {importFile ? importFile.name : "Nenhum ficheiro selecionado."}
                    </span>
                    <button
                      className="btn"
                      onClick={handleImport}
                      disabled={saving || !importFile}
                    >
                      Importar JSON
                    </button>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px", color: "var(--danger)" }}>Repor para padrão</h3>
                  <p style={{ fontSize: "12px", color: "var(--text-3)", margin: "0 0 12px" }}>
                    Apaga todas as definições personalizadas e restaura os valores de fábrica. Esta ação não afecta ingredientes, receitas ou stock.
                  </p>
                  <button
                    className="btn btn-danger"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={saving}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Repor definições
                  </button>
                </div>
              </div>
            </SettingsSection>
          )}

          {activeCategory === "sync" && (
            <SettingsSection title="Sincronização" description="Configuração de sincronização na nuvem (Turso/libSQL)">
              <div className="settings-group">
                <label >Turso Database URL</label>
                <input
                  type="text"
                  className="input"
                  placeholder="libsql://your-db.turso.io"
                  value={getSetting("turso_url", "sync")}
                  onChange={e => saveCategorySettings("sync", { turso_url: e.target.value })}
                />
              </div>

              <div className="settings-group">
                <label >Auth Token</label>
                <input
                  type="password"
                  className="input"
                  placeholder="eyJhbG...NiIs..."
                  value={getSetting("auth_token", "sync")}
                  onChange={e => saveCategorySettings("sync", { auth_token: e.target.value })}
                />
              </div>

              <div className="info-box">
                <strong style={{ fontWeight: 500 }}>Em desenvolvimento:</strong> A sincronização automática ainda não está implementada.
                As credenciais serão guardadas localmente para uso futuro.
              </div>
            </SettingsSection>
          )}

          {activeCategory === "about" && (
            <SettingsSection title="Sobre" description="Informações da aplicação e links úteis">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
                  <div className="settings-about-logo">
                    M
                  </div>
                  <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "var(--space-1)" }}>mise</h2>
                  <p style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: "var(--space-2)" }} className="mono">pro-kitchen</p>
                  <p style={{ color: "var(--text-2)", fontSize: "13px", marginBottom: "24px" }}>Versão 1.0.0 (build 2026.06)</p>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-6)" }}>
                  <h3 className="text-2" style={{ marginBottom: "var(--space-4)" }}>Links úteis</h3>
                  <div className="settings-links">
                    <a href="https://github.com/nousresearch/hermes-agent" target="_blank" rel="noopener noreferrer">
                      Repositório no GitHub
                    </a>
                    <a href="https://tauri.app" target="_blank" rel="noopener noreferrer">
                      Documentação Tauri
                    </a>
                    <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
                      Documentação React
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-6)" }}>
                  <h3 className="text-2" style={{ marginBottom: "var(--space-4)" }}>Licenças</h3>
                  <p style={{ color: "var(--text-3)", fontSize: "12px", lineHeight: 1.6 }}>
                    Esta aplicação é construída com tecnologias de código aberto:
                    Tauri, React, Rust, libSQL, e muitas outras bibliotecas incríveis.
                    Consulte o ficheiro LICENSE no repositório para detalhes.
                  </p>
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
              <h2 className="modal-title">Confirmar reposição</h2>
              <button className="modal-close" onClick={() => setShowResetConfirm(false)} aria-label="Fechar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
                Tem a certeza que quer repor todas as definições para os valores padrão?
                Esta ação não pode ser desfeita, mas não afecta os teus ingredientes, receitas ou stock.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleReset} disabled={saving}>
                Repor tudo
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