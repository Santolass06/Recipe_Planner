import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Trash2 } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { useThemeStore } from "../store/themeStore";
import { api } from "../utils/api";

export default function Definicoes() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { theme, toggleTheme } = useThemeStore();

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      const receitas = await api.receitas.listar();
      for (const r of receitas) {
        await api.receitas.eliminar(r.id);
      }
      const ingredientes = await api.ingredientes.listar();
      for (const ing of ingredientes) {
        await api.ingredientes.eliminar(ing.id);
      }
      addToast("Aplicação reiniciada com sucesso", "success");
      navigate("/ingredientes");
    } catch {
      addToast("Erro ao reiniciar a aplicação", "error");
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  return (
    <>
      <Topbar placeholder="Pesquisar…" />
      <div className="content">
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h1 className="page-title" style={{ marginBottom: 24 }}>Definições</h1>

          {/* App info */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h2 className="card-title">Sobre a aplicação</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5 }}>
                <Row label="Nome" value="Mise — Recipe Planner" />
                <Row label="Versão" value="1.0.0" />
                <Row label="Plataforma" value="Tauri v2 + React" />
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h2 className="card-title">Aparência</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>Tema</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {theme === "light" ? "Modo claro activo" : "Modo escuro activo"}
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={toggleTheme}>
                  {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
                  {theme === "light" ? "Modo escuro" : "Modo claro"}
                </button>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="card" style={{ borderColor: "var(--rose-soft)" }}>
            <div className="card-head">
              <h2 className="card-title" style={{ color: "var(--rose)" }}>Zona de Perigo</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>
                    Reiniciar aplicação
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Elimina todas as receitas e ingredientes. Esta acção não pode ser revertida.
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{ background: "var(--rose-soft)", color: "var(--rose)", border: "1px solid var(--rose-soft)", flexShrink: 0 }}
                  onClick={() => setConfirmReset(true)}
                >
                  <Trash2 size={13} /> Reiniciar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Reiniciar aplicação"
          message="Tem a certeza que quer eliminar todos os dados? Todas as receitas e ingredientes serão permanentemente eliminados. Esta acção não pode ser revertida."
          onConfirm={handleReset}
          onCancel={() => setConfirmReset(false)}
          loading={resetting}
        />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
      <span>{label}</span>
      <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{value}</span>
    </div>
  );
}
