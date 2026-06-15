import { useEffect } from "react";
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
          // O navegador já trata ESC para fechar modais nativos
          // Mas podemos emitir evento customizado se necessário
          break;
        case "help":
          alert(shortcutHelp.map((s) => `${s.keys.padEnd(8)} → ${s.action}`).join("\n"));
          break;
        case "nav_ingredients":
          navigate("/ingredientes");
          break;
        case "nav_recipes":
          navigate("/receitas");
          break;
        case "nav_stock":
          navigate("/armazem");
          break;
        case "nav_costs":
          navigate("/custos");
          break;
        case "nav_shopping":
          navigate("/compras");
          break;
        case "nav_suggester":
          navigate("/sugestor");
          break;
        case "nav_settings":
          navigate("/definicoes");
          break;
        default:
          break;
      }
    });

    return () => {
      unsubs.then((fn) => fn());
    };
  }, [navigate]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}