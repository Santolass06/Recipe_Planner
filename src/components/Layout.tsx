import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Modal from "./ui/Modal";

const SHORTCUTS = [
  { keys: "Ctrl+K / Cmd+K", action: "Focar barra de pesquisa" },
  { keys: "?", action: "Mostrar esta ajuda" },
  { keys: "Esc", action: "Fechar modais" },
  { keys: "G depois I", action: "Ir para Ingredientes" },
  { keys: "G depois R", action: "Ir para Receitas" },
  { keys: "G depois A", action: "Ir para Armazém" },
  { keys: "G depois C", action: "Ir para Compras" },
];

export default function Layout() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [gPressed, setGPressed] = useState(false);

  useEffect(() => {
    let gTimeout: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
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
        // Let modals handle their own escape listener, but we can close help here
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
        <Outlet />
      </main>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="Atalhos de teclado">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {SHORTCUTS.map(s => (
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