import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Modal from "./ui/Modal";
import { PageHeaderProvider, usePageHeaderContext } from "./PageHeaderContext";
import { useI18n } from "../i18n";
import { applyTheme, currentTheme } from "../theme";

type T = (key: string, params?: Record<string, string | number>) => string;

const getShortcuts = (t: T) => [
  { keys: "Ctrl+K / Cmd+K", action: t("layout.shortcuts.focusSearch") },
  { keys: "?", action: t("layout.shortcuts.showHelp") },
  { keys: "Esc", action: t("layout.shortcuts.closeModals") },
  { keys: t("layout.keys.gThenI"), action: t("layout.shortcuts.goIngredients") },
  { keys: t("layout.keys.gThenR"), action: t("layout.shortcuts.goRecipes") },
  { keys: t("layout.keys.gThenA"), action: t("layout.shortcuts.goStock") },
  { keys: t("layout.keys.gThenC"), action: t("layout.shortcuts.goShopping") },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatClock(d: Date) {
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `${time} ${date}`;
}

function Topbar() {
  const { title, subtitle, actions } = usePageHeaderContext();
  const { language, setLanguage, t } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const onFocusSearch = () => searchRef.current?.focus();
    window.addEventListener("mise:focus-search", onFocusSearch);
    return () => window.removeEventListener("mise:focus-search", onFocusSearch);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = async () => {
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem("mise-theme", next);
    await applyTheme(next);
    setTheme(next);
  };

  return (
    <header className="topbar">
      <div style={{ flexShrink: 0 }}>
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 16 }} />
      <div className="topbar-search">
        <span className="ms" style={{ fontSize: 18, color: "var(--ink-3)" }} aria-hidden="true">search</span>
        <input ref={searchRef} placeholder={t("layout.searchPlaceholder")} />
        <span className="kbd-hint">⌘K</span>
      </div>
      <div className="mono topbar-clock" aria-label={t("layout.dateTimeAria")}>{formatClock(now)}</div>
      <div className="seg">
        <button className={language === "pt" ? "active" : ""} onClick={() => setLanguage("pt")}>PT</button>
        <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
      </div>
      <button className="icon-btn" title={t("layout.themeTooltip")} onClick={toggleTheme}>
        <span className="ms" style={{ fontSize: 19 }} aria-hidden="true">{theme === "light" ? "dark_mode" : "light_mode"}</span>
      </button>
      {actions}
    </header>
  );
}

function LayoutInner() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  useEffect(() => {
    let gTimeout: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "?") {
        setShowHelp(true);
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        window.dispatchEvent(new CustomEvent("mise:focus-search"));
        e.preventDefault();
      } else if (e.key === "Escape") {
        setShowHelp(false);
      } else if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
        setGPressed(true);
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => setGPressed(false), 1000);
      } else if (gPressed) {
        const key = e.key.toLowerCase();
        if (key === "i") navigate("/ingredientes");
        else if (key === "r") navigate("/receitas");
        else if (key === "a") navigate("/armazem");
        else if (key === "c") navigate("/compras");

        setGPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimeout);
    };
  }, [navigate, gPressed]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="main-scroll scr">
          <Outlet />
        </div>
      </main>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title={t("layout.shortcutsTitle")}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {getShortcuts(t).map(s => (
            <div key={s.keys} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-2">{s.action}</span>
              <kbd className="kbd" style={{ fontSize: "12px", padding: "4px 8px" }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default function Layout() {
  return (
    <PageHeaderProvider>
      <LayoutInner />
    </PageHeaderProvider>
  );
}
