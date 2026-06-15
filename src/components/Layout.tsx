import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./Sidebar";

const shortcutHelp = [
  { keys: "⌘K", action: "Abrir paleta de comandos" },
  { keys: "N", action: "Nova receita" },
  { keys: "Esc", action: "Fechar modal / Limpar" },
  { keys: "?", action: "Mostrar esta ajuda" },
  { keys: "G I", action: "Ir para Ingredientes" },
  { keys: "G R", action: "Ir para Receitas" },
  { keys: "G S", action: "Ir para Armazém" },
  { keys: "G C", action: "Ir para Custos" },
  { keys: "G B", action: "Ir para Compras" },
  { keys: "G U", action: "Ir para Sugestor" },
  { keys: "G P", action: "Ir para Definições" },
];

export default function Layout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubs = listen("global-shortcut", (event) => {
      const action = event.payload as string;

      switch (action) {
        case "command_palette":
          // TODO: abrir paleta de comandos
          break;
        case "new_recipe":
          navigate("/receitas/nova");
          break;
        case "escape":
          // Close sidebar on escape
          setSidebarOpen(false);
          break;
        case "help":
          alert(shortcutHelp.map((s) => `${s.keys.padEnd(8)} → ${s.action}`).join("\n"));
          break;
        case "nav_ingredients":
          navigate("/ingredientes");
          setSidebarOpen(false);
          break;
        case "nav_recipes":
          navigate("/receitas");
          setSidebarOpen(false);
          break;
        case "nav_stock":
          navigate("/armazem");
          setSidebarOpen(false);
          break;
        case "nav_costs":
          navigate("/custos");
          setSidebarOpen(false);
          break;
        case "nav_shopping":
          navigate("/compras");
          setSidebarOpen(false);
          break;
        case "nav_suggester":
          navigate("/sugestor");
          setSidebarOpen(false);
          break;
        case "nav_settings":
          navigate("/definicoes");
          setSidebarOpen(false);
          break;
        default:
          break;
      }
    });

    return () => {
      unsubs.then((fn) => fn());
    };
  }, [navigate]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [window.location.pathname]);

  return (
    <div className="app">
      {/* Mobile sidebar overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <Sidebar isOpen={sidebarOpen} />

      <header className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}