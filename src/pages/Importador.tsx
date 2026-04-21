import { useState, useRef } from "react";
import { Upload, FileText, X, AlertTriangle, CheckCircle } from "lucide-react";
import Topbar from "../components/layout/Topbar";

type CSVMode = "ingredientes" | "receitas";

interface ParsedRow {
  [key: string]: string;
}

const FORMATO_INGREDIENTES = ["nome", "unidade", "preco_atual"];
const FORMATO_RECEITAS = ["nome", "categoria", "porcoes_base"];

export default function Importador() {
  const [mode, setMode] = useState<CSVMode>("ingredientes");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const expectedHeaders = mode === "ingredientes" ? FORMATO_INGREDIENTES : FORMATO_RECEITAS;

  function parseCSV(text: string, name: string) {
    setError(null);
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setError("O ficheiro deve ter pelo menos uma linha de cabeçalho e uma linha de dados.");
      setRows([]);
      return;
    }
    const hdrs = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const parsed: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map((v) => v.trim());
      const row: ParsedRow = {};
      hdrs.forEach((h, j) => { row[h] = vals[j] ?? ""; });
      parsed.push(row);
    }
    setHeaders(hdrs);
    setRows(parsed);
    setFileName(name);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target?.result as string, file.name);
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith(".csv")) {
      setError("Apenas ficheiros .csv são suportados.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target?.result as string, file.name);
    reader.readAsText(file);
  }

  function clearFile() {
    setRows([]);
    setHeaders([]);
    setFileName(null);
    setError(null);
  }

  const headersMatch =
    headers.length > 0 &&
    expectedHeaders.every((h) => headers.includes(h));

  return (
    <>
      <Topbar placeholder="Pesquisar…" />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFileInput}
      />
      <div className="content" style={{ maxWidth: 820 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Importador</h1>
            <div className="page-sub">Importa ingredientes ou receitas a partir de um ficheiro CSV</div>
          </div>
        </div>

        {/* Mode selector */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h2 className="card-title">Tipo de importação</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className={`chip ${mode === "ingredientes" ? "active" : ""}`}
                onClick={() => { setMode("ingredientes"); clearFile(); }}
              >
                Ingredientes
              </button>
              <button
                className={`chip ${mode === "receitas" ? "active" : ""}`}
                onClick={() => { setMode("receitas"); clearFile(); }}
              >
                Receitas
              </button>
            </div>
            <div
              className="card"
              style={{
                marginTop: 14,
                padding: "12px 16px",
                background: "var(--primary-tint)",
                borderColor: "var(--primary-soft)",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              <div style={{ fontWeight: 500, color: "var(--text)", marginBottom: 4, fontSize: 12.5 }}>
                Formato esperado para {mode === "ingredientes" ? "ingredientes" : "receitas"}:
              </div>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {expectedHeaders.join(", ")}
              </code>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                {mode === "ingredientes"
                  ? "Exemplo: Farinha de trigo, kg, 1.20"
                  : "Exemplo: Bolo de chocolate, Pastelaria, 8"}
              </div>
            </div>
          </div>
        </div>

        {/* Drop zone */}
        {!fileName && (
          <div
            ref={dropRef}
            className="card"
            style={{
              marginBottom: 16,
              padding: "48px 24px",
              textAlign: "center",
              border: `2px dashed ${dragging ? "var(--primary)" : "var(--border-strong)"}`,
              background: dragging ? "var(--primary-tint)" : "transparent",
              transition: "all 0.15s",
              cursor: "pointer",
            }}
            onClick={openFilePicker}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Upload
              size={32}
              style={{
                margin: "0 auto 12px",
                display: "block",
                color: dragging ? "var(--primary)" : "var(--text-light)",
              }}
            />
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
              Arrasta um ficheiro .csv para aqui
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              ou clica para escolher um ficheiro
            </div>
            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openFilePicker(); }}>
              <FileText size={13} /> Escolher ficheiro
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background: "var(--rose-soft)",
              borderColor: "var(--rose-soft)",
              color: "var(--rose)",
              fontSize: 13,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Preview */}
        {fileName && rows.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <h2 className="card-title">Pré-visualização</h2>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {fileName} · {rows.length} linha{rows.length !== 1 ? "s" : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {headersMatch ? (
                  <span style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5, color: "var(--sage)" }}>
                    <CheckCircle size={13} /> Formato válido
                  </span>
                ) : (
                  <span style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5, color: "var(--rose)" }}>
                    <AlertTriangle size={13} /> Cabeçalhos incorrectos
                  </span>
                )}
                <button className="btn btn-ghost btn-sm" onClick={clearFile}>
                  <X size={13} /> Remover
                </button>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ overflowX: "auto" }}>
                <table className="ing-table">
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th
                          key={h}
                          style={{
                            color: expectedHeaders.includes(h)
                              ? "var(--text)"
                              : "var(--text-muted)",
                          }}
                        >
                          {h}
                          {!expectedHeaders.includes(h) && (
                            <span style={{ marginLeft: 4, fontSize: 10, color: "var(--rose)" }}>
                              ⚠
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {headers.map((h) => (
                          <td key={h} style={{ fontSize: 13 }}>
                            {row[h] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 20 && (
                <div
                  style={{
                    padding: "10px 20px",
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  + {rows.length - 20} linhas adicionais não mostradas
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action */}
        {fileName && rows.length > 0 && (
          <div
            className="card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              background: "var(--bg-alt)",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              A importação de dados estará disponível em breve. Por agora, verifica se o
              formato do ficheiro está correcto.
            </div>
            <button className="btn btn-primary" disabled style={{ flexShrink: 0, opacity: 0.5, cursor: "not-allowed" }}>
              Importar {rows.length} linha{rows.length !== 1 ? "s" : ""} (em breve)
            </button>
          </div>
        )}
      </div>
    </>
  );
}
