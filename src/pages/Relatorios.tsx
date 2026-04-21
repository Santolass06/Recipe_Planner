import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { BarChart2, Carrot, BookOpen, TrendingUp, Award } from "lucide-react";
import Topbar from "../components/layout/Topbar";
import { useToast } from "../components/ui/Toast";
import { api } from "../utils/api";
import type { RelatorioResumo } from "../types";

export default function Relatorios() {
  const { addToast } = useToast();
  const [resumo, setResumo] = useState<RelatorioResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.relatorios
      .resumo()
      .then(setResumo)
      .catch(() => addToast("Erro ao carregar relatório", "error"))
      .finally(() => setLoading(false));
  }, []);

  const chartData = resumo
    ? [...resumo.historico_precos_recentes]
        .reverse()
        .map((h, i) => ({
          name: `${h.ingrediente_nome.slice(0, 10)}… (${i + 1})`,
          preco: h.preco,
          ingrediente: h.ingrediente_nome,
          data: new Date(h.data).toLocaleDateString("pt-PT"),
        }))
    : [];

  return (
    <>
      <Topbar placeholder="Pesquisar…" />
      <div className="content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Relatórios</h1>
            <div className="page-sub">Resumo da sua cozinha</div>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : resumo ? (
          <>
            {/* Summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 14,
                marginBottom: 24,
              }}
            >
              <StatCard
                icon={<Carrot size={18} />}
                label="Total de ingredientes"
                value={String(resumo.total_ingredientes)}
              />
              <StatCard
                icon={<BookOpen size={18} />}
                label="Total de receitas"
                value={String(resumo.total_receitas)}
              />
              <StatCard
                icon={<TrendingUp size={18} />}
                label="Ingrediente mais caro"
                value={resumo.ingrediente_mais_caro ?? "—"}
                small
              />
              <StatCard
                icon={<Award size={18} />}
                label="Receita mais cara"
                value={resumo.receita_mais_cara ?? "—"}
                small
              />
            </div>

            {/* Price history chart */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Histórico de preços recente</h2>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    Últimas {resumo.historico_precos_recentes.length} alterações de preço
                  </div>
                </div>
              </div>
              <div className="card-body">
                {chartData.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 0",
                      color: "var(--text-muted)",
                      fontSize: 13.5,
                    }}
                  >
                    <BarChart2
                      size={36}
                      style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }}
                    />
                    Sem histórico de preços disponível.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="data"
                        tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `€${v}`}
                        width={52}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontFamily: "var(--font-sans)",
                          color: "var(--text)",
                        }}
                        formatter={(value: number, _: string, entry) => [
                          `€${(value as number).toFixed(2)}`,
                          (entry.payload as { ingrediente: string })?.ingrediente ?? "",
                        ]}
                        labelFormatter={(label) => `Data: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="preco"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={{ fill: "var(--primary)", r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Recent history table */}
            {resumo.historico_precos_recentes.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-head">
                  <h2 className="card-title">Detalhes</h2>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="ing-table">
                    <thead>
                      <tr>
                        <th>Ingrediente</th>
                        <th className="right">Preço</th>
                        <th className="right">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumo.historico_precos_recentes.map((h, i) => (
                        <tr key={i}>
                          <td>{h.ingrediente_nome}</td>
                          <td className="td-num">€{h.preco.toFixed(2)}</td>
                          <td
                            className="td-num"
                            style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                          >
                            {new Date(h.data).toLocaleDateString("pt-PT")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div
      className="card"
      style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--primary)" }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: small ? 15 : 28,
          fontWeight: 600,
          fontFamily: small ? "var(--font-sans)" : "var(--font-serif)",
          color: "var(--text)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
