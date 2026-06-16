import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";

// ============================================================================
// TYPES
// ============================================================================

interface CostReport {
  total_spent: number;
  by_category: CategoryCost[];
  by_recipe: RecipeCost[];
  by_supplier: SupplierCost[];
  daily_avg: number;
}

interface CategoryCost {
  category: string;
  total: number;
  percentage: number;
}

interface RecipeCost {
  recipe_id: number;
  recipe_name: string;
  total_cost: number;
  portions: number;
  cost_per_portion: number;
  count: number;
}

interface SupplierCost {
  supplier: string;
  total: number;
  percentage: number;
}

interface WasteReport {
  total_wasted_value: number;
  by_ingredient: IngredientWaste[];
  by_category: CategoryWaste[];
}

interface IngredientWaste {
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  wasted_quantity: number;
  wasted_value: number;
}

interface CategoryWaste {
  category: string;
  total_wasted_value: number;
  percentage: number;
}

interface StockSnapshot {
  date: string;
  ingredient_id: number;
  ingredient_name: string;
  quantity: number;
  value: number;
}

interface MealStats {
  total_meals: number;
  avg_portions: number;
  by_meal_type: MealTypeStat[];
  by_recipe: RecipeMealStat[];
}

interface MealTypeStat {
  meal_type: string;
  count: number;
  total_portions: number;
  percentage: number;
}

interface RecipeMealStat {
  recipe_id: number;
  recipe_name: string;
  count: number;
  total_portions: number;
  avg_portions: number;
}

interface PricePoint {
  date: string;
  price: number;
  supplier: string;
}

// ============================================================================
// CHART COMPONENTS (Simple SVG)
// ============================================================================

const BarChart = ({
  data,
  keys,
  colors,
  width = "100%",
  height = 200,
  maxValue,
  labelKey,
  valueKey,
}: {
  data: any[];
  keys: string[];
  colors: string[];
  width?: string | number;
  height?: number;
  maxValue?: number;
  labelKey: string;
  valueKey: string;
}) => {
  const max = maxValue ?? Math.max(...data.map((d) => d[valueKey]), 1);
  const barWidth = 100 / data.length / keys.length;
  const gap = barWidth * 0.15;

  return (
    <div className="chart-container" style={{ width, height: `${height}px`, position: "relative" }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1="5"
            y1={height - ratio * (height - 20)}
            x2="95"
            y2={height - ratio * (height - 20)}
            stroke="var(--border-subtle)"
            strokeWidth="0.3"
            strokeDasharray="2,2"
          />
        ))}
        {data.map((item, i) => {
          const xCenter = 5 + (i + 0.5) * (90 / data.length);
          return keys.map((key, ki) => {
            const value = item[key] ?? 0;
            const barHeight = (value / max) * (height - 30);
            const x = xCenter - (barWidth * keys.length) / 2 + ki * barWidth + gap;
            return (
              <rect
                key={key}
                x={x}
                y={height - 15 - barHeight}
                width={barWidth - gap * 2}
                height={barHeight}
                fill={colors[ki % colors.length]}
                rx={1}
              />
            );
          });
        })}
      </svg>
      {/* Legend + Labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: "11px" }}>
        {data.map((item, i) => (
          <div key={i} style={{ textAlign: "center", width: `${100 / data.length}%`, color: "var(--text-3)" }}>
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {item[labelKey]?.substring(0, 12)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LineChart = ({
  data,
  width = "100%",
  height = 200,
  color = "var(--brand)",
  valueKey = "value",
}: {
  data: { [key: string]: any }[];
  width?: string | number;
  height?: number;
  color?: string;
  valueKey?: string;
  dateKey?: string;
}) => {
  if (data.length === 0) return <div style={{ height: `${height}px`, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>Sem dados</div>;

  const values = data.map((d) => d[valueKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const path = data
    .map((d, i) => {
      const x = 5 + (i / (data.length - 1)) * 90;
      const y = height - 15 - ((d[valueKey] - min) / range) * (height - 30);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="chart-container" style={{ width, height: `${height}px`, position: "relative" }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        {/* Grid */}
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1="5"
            y1={height - ratio * (height - 20)}
            x2="95"
            y2={height - ratio * (height - 20)}
            stroke="var(--border-subtle)"
            strokeWidth="0.3"
          />
        ))}
        {/* Area */}
        <path
          d={path + ` L${95} ${height - 15} L5 ${height - 15} Z`}
          fill={`${color}15`}
        />
        {/* Line */}
        <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {data.map((d, i) => {
          const x = 5 + (i / (data.length - 1)) * 90;
          const y = height - 15 - ((d[valueKey] - min) / range) * (height - 30);
          return (
            <circle key={i} cx={x} cy={y} r="2.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
          );
        })}
      </svg>
    </div>
  );
};

const PieChart = ({
  data,
  colors = ["var(--brand)", "var(--ok)", "var(--warn)", "var(--info)", "var(--danger)", "var(--text-3)"],
  width = 200,
  height = 200,
  labelKey = "category",
  valueKey = "total",
}: {
  data: { [key: string]: any }[];
  colors?: string[];
  width?: number;
  height?: number;
  labelKey?: string;
  valueKey?: string;
}) => {
  const total = data.reduce((sum, d) => sum + (d[valueKey] || 0), 0);
  if (total === 0) return <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>Sem dados</div>;

  let currentAngle = -90;
  const radius = Math.min(width, height) / 2 - 10;
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {data.map((item, i) => {
          const value = item[valueKey] || 0;
          const angle = (value / total) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;

          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const x1 = centerX + radius * Math.cos(startRad);
          const y1 = centerY + radius * Math.sin(startRad);
          const x2 = centerX + radius * Math.cos(endRad);
          const y2 = centerY + radius * Math.sin(endRad);
          const largeArc = angle > 180 ? 1 : 0;

          const pathD = [
            `M ${centerX} ${centerY}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            "Z",
          ].join(" ");

          return <path key={i} d={pathD} fill={colors[i % colors.length]} stroke="var(--surface)" strokeWidth="1.5" />;
        })}
        {/* Center hole for donut look */}
        <circle cx={centerX} cy={centerY} r={radius * 0.45} fill="var(--surface)" />
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-3) var(--space-4)", fontSize: "12px" }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", color: "var(--text-2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ whiteSpace: "nowrap" }}>
              {item[labelKey]}: {((item[valueKey] / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// KPI CARD
// ============================================================================

const KPICard = ({
  label,
  value,
  subLabel,
  icon,
  color = "var(--brand)",
  bgColor = "var(--surface)",
  borderColor = "var(--border)",
  trend,
}: {
  label: string;
  value: string | number;
  subLabel: string;
  icon: React.ReactNode;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  trend?: { value: number; label: string };
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)",
      padding: "var(--space-4)",
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-lg)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-3)" }}>{label}</span>
      <span style={{ color }}>{icon}</span>
    </div>
    <div style={{ fontSize: "28px", fontWeight: 700, color, lineHeight: 1, fontFamily: "var(--mono)" }}>{value}</div>
    <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{subLabel}</span>
    {trend && (
      <span style={{ fontSize: "11px", color: trend.value >= 0 ? "var(--ok)" : "var(--danger)" }}>
        {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}% {trend.label}
      </span>
    )}
  </div>
);

// ============================================================================
// MAIN REPORTS PAGE
// ============================================================================

const TABS = [
  { id: "costs", label: "Custos", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
  { id: "waste", label: "Desperdício", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 2 22 8 16 14"/><line x1="22" y1="8" x2="8" y2="8"/></svg> },
  { id: "stock", label: "Stock Trends", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: "meals", label: "Refeições", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id: "prices", label: "Preços", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg> },
];

const RANGE_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 365, label: "1 ano" },
];

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Pequeno-almoço",
  lunch: "Almoço",
  dinner: "Jantar",
  snack: "Lanche",
};

const UNIT_LABELS: Record<string, string> = {
  gram: "g", kilogram: "kg", milligram: "mg",
  ounce: "oz", pound: "lb",
  milliliter: "ml", liter: "l", fluid_ounce: "fl oz",
  cup: "cup", pint: "pt", quart: "qt", gallon: "gal",
  teaspoon: "tsp", tablespoon: "tbsp",
  piece: "pcs", dozen: "dz",
  pinch: "pitada", bunch: "molho", clove: "dente", slice: "fatia",
};



function CostsTab({ costReport, days }: { costReport: CostReport | null; days: number }) {
  if (!costReport) return <div className="empty" style={{ minHeight: 200 }}>Carregando...</div>;

  const categoryChartData = costReport.by_category.slice(0, 8).map((c) => ({ category: c.category, total: c.total }));
  const supplierChartData = costReport.by_supplier.slice(0, 8).map((s) => ({ supplier: s.supplier, total: s.total }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        <KPICard
          label="Total Gasto"
          value={`€${costReport.total_spent.toFixed(2)}`}
          subLabel={`${days} dias`}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
          color="var(--brand)"
        />
        <KPICard
          label="Média Diária"
          value={`€${costReport.daily_avg.toFixed(2)}`}
          subLabel="por dia"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          color="var(--ok)"
        />
        <KPICard
          label="Categorias"
          value={costReport.by_category.length}
          subLabel="com gastos"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
          color="var(--info)"
        />
        <KPICard
          label="Fornecedores"
          value={costReport.by_supplier.length}
          subLabel="utilizados"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
          color="var(--warn)"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Por Categoria</h3>
          <BarChart data={categoryChartData} keys={["total"]} colors={["var(--brand)"]} labelKey="category" valueKey="total" height={250} />
        </div>
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Por Fornecedor</h3>
          <PieChart data={supplierChartData} labelKey="supplier" valueKey="total" width={300} height={250} />
        </div>
      </div>

      {/* Top Recipes Table */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Top Receitas por Custo</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Receita</th>
                <th className="mono">Custo Total</th>
                <th className="mono">Custo/Porção</th>
                <th className="mono">Vezes</th>
              </tr>
            </thead>
            <tbody>
              {costReport.by_recipe.slice(0, 10).map((r) => (
                <tr key={r.recipe_id}>
                  <td>{r.recipe_name}</td>
                  <td className="mono">€{r.total_cost.toFixed(2)}</td>
                  <td className="mono">€{r.cost_per_portion.toFixed(2)}</td>
                  <td className="mono">{r.count}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function WasteTab({ wasteReport, days }: { wasteReport: WasteReport | null; days: number }) {
  if (!wasteReport) return <div className="empty" style={{ minHeight: 200 }}>Carregando...</div>;

  if (wasteReport.total_wasted_value === 0) {
    return (
      <div className="card" style={{ padding: "var(--space-8)", textAlign: "center" }}>
        <EmptyState
          icon={
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.5" style={{ marginBottom: "var(--space-4)", opacity: 0.5 }}>
              <polyline points="16 2 22 8 16 14"/><line x1="22" y1="8" x2="8" y2="8"/>
            </svg>
          }
          title="Sem dados de desperdício"
          body="Não existe rastreamento de desperdício automático. Para usar esta funcionalidade, seria necessário registar perdas de stock manualmente ou ter histórico de stock."
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <KPICard
        label="Valor Total Desperdiçado"
        value={`€${wasteReport.total_wasted_value.toFixed(2)}`}
        subLabel={`${days} dias`}
        icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8"><polyline points="16 2 22 8 16 14"/><line x1="22" y1="8" x2="8" y2="8"/></svg>}
        color="var(--danger)"
      />
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Por Ingrediente</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th className="mono">Qtd. Desperdiçada</th>
                <th className="mono">Valor</th>
              </tr>
            </thead>
            <tbody>
              {wasteReport.by_ingredient.map((w) => (
                <tr key={w.ingredient_id}>
                  <td>{w.ingredient_name}</td>
                  <td className="mono">{w.wasted_quantity} {UNIT_LABELS[w.unit] ?? w.unit}</td>
                  <td className="mono">€{w.wasted_value.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StockTrendsTab({ stockTrends, loading }: { stockTrends: StockSnapshot[]; loading: boolean }) {
  if (loading) return <div className="empty" style={{ minHeight: 200 }}>Carregando...</div>;

  // Group by ingredient for multi-line chart
  const ingredientMap = new Map<number, { name: string; data: StockSnapshot[] }>();
  stockTrends.forEach((s) => {
    const existing = ingredientMap.get(s.ingredient_id);
    if (!existing) ingredientMap.set(s.ingredient_id, { name: s.ingredient_name, data: [s] });
    else existing.data.push(s);
  });

  const topIngredients = Array.from(ingredientMap.entries())
    .sort((a, b) => b[1].data[b[1].data.length - 1]?.value - a[1].data[a[1].data.length - 1]?.value)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Evolução do Valor do Stock</h3>
        {topIngredients.length === 0 ? (
          <div className="empty" style={{ minHeight: 200 }}>Sem dados de stock</div>
        ) : (
          <div style={{ height: 300, position: "relative" }}>
            <svg viewBox="0 0 100 300" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
              {/* Grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line key={ratio} x1="5" y1={300 - ratio * 280} x2="95" y2={300 - ratio * 280} stroke="var(--border-subtle)" strokeWidth="0.3" strokeDasharray="2,2" />
              ))}
              {topIngredients.map(([_, ingredient], i) => {
                const values = ingredient.data.map((d) => d.value);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = max - min || 1;
                const color = ["var(--brand)", "var(--ok)", "var(--warn)", "var(--info)", "var(--danger)"][i % 5];

                const path = ingredient.data
                  .map((d, di) => {
                    const x = 5 + (di / (ingredient.data.length - 1)) * 90;
                    const y = 300 - 10 - ((d.value - min) / range) * 280;
                    return `${di === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ");

                return (
                  <g key={ingredient.name}>
                    <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-2)", fontSize: "11px" }}>
              {topIngredients.map(([_, ingredient], i) => (
                <span key={ingredient.name} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-2)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: ["var(--brand)", "var(--ok)", "var(--warn)", "var(--info)", "var(--danger)"][i % 5] }} />
                  {ingredient.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MealsTab({ mealStats, days }: { mealStats: MealStats | null; days: number }) {
  if (!mealStats) return <div className="empty" style={{ minHeight: 200 }}>Carregando...</div>;

  const mealTypeChartData = mealStats.by_meal_type.map((m) => ({
    type: MEAL_TYPE_LABELS[m.meal_type] ?? m.meal_type,
    count: m.count,
    portions: m.total_portions,
  }));

  const recipeChartData = mealStats.by_recipe.slice(0, 8).map((r) => ({ name: r.recipe_name, count: r.count }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        <KPICard
          label="Total Refeições"
          value={mealStats.total_meals}
          subLabel={`${days} dias`}
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
          color="var(--brand)"
        />
        <KPICard
          label="Média Porções"
          value={mealStats.avg_portions.toFixed(1)}
          subLabel="por refeição"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
          color="var(--ok)"
        />
        <KPICard
          label="Tipos de Refeição"
          value={mealStats.by_meal_type.length}
          subLabel="utilizados"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
          color="var(--info)"
        />
        <KPICard
          label="Receitas Únicas"
          value={mealStats.by_recipe.length}
          subLabel="preparadas"
          icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
          color="var(--warn)"
        />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Por Tipo de Refeição</h3>
          <PieChart data={mealTypeChartData} labelKey="type" valueKey="count" width={300} height={250} />
        </div>
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Top Receitas</h3>
          <BarChart data={recipeChartData} keys={["count"]} colors={["var(--brand)"]} labelKey="name" valueKey="count" height={250} />
        </div>
      </div>

      {/* Detail Table */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Detalhe por Receita</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Receita</th>
                <th className="mono">Vezes</th>
                <th className="mono">Total Porções</th>
                <th className="mono">Média Porções</th>
              </tr>
            </thead>
            <tbody>
              {mealStats.by_recipe.slice(0, 15).map((r) => (
                <tr key={r.recipe_id}>
                  <td>{r.recipe_name}</td>
                  <td className="mono">{r.count}x</td>
                  <td className="mono">{r.total_portions}</td>
                  <td className="mono">{r.avg_portions.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PricesTab({
  ingredients,
  priceTrendIngredientId,
  setPriceTrendIngredientId,
  loading,
  priceTrends,
}: {
  ingredients: { id: number; name: string }[];
  priceTrendIngredientId: number | null;
  setPriceTrendIngredientId: (id: number | null) => void;
  loading: boolean;
  priceTrends: PricePoint[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* Ingredient Selector */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <label className="field-label">Ingrediente</label>
        <select
          className="select"
          value={priceTrendIngredientId ?? ""}
          onChange={(e) => setPriceTrendIngredientId(Number(e.target.value) || null)}
          disabled={ingredients.length === 0 || loading}
        >
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>{ing.name}</option>
          ))}
        </select>
      </div>

      {/* Price Trend Chart */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Evolução de Preço {ingredients.find((i) => i.id === priceTrendIngredientId) ? `— ${ingredients.find((i) => i.id === priceTrendIngredientId)!.name}` : ""}
        </h3>
        {priceTrends.length === 0 ? (
          <EmptyState
            icon={
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/>
                <line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/>
              </svg>
            }
            title="Sem histórico de preços"
            body="Adicione cotações de preços para ver a evolução"
          />
        ) : (
          <LineChart data={priceTrends} valueKey="price" dateKey="date" height={300} color="var(--brand)" />
        )}
      </div>

      {/* Price Points Table */}
      {priceTrends.length > 0 && (
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Histórico de Cotações</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Fornecedor</th>
                  <th className="mono">Preço</th>
                </tr>
              </thead>
              <tbody>
                {priceTrends.slice().reverse().map((p, i) => (
                  <tr key={i}>
                    <td>{new Date(p.date).toLocaleDateString("pt-PT")}</td>
                    <td>{p.supplier}</td>
                    <td className="mono">€{p.price.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("costs");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();

  // Data states
  const [costReport, setCostReport] = useState<CostReport | null>(null);
  const [wasteReport, setWasteReport] = useState<WasteReport | null>(null);
  const [stockTrends, setStockTrends] = useState<StockSnapshot[]>([]);
  const [mealStats, setMealStats] = useState<MealStats | null>(null);
  const [priceTrends, setPriceTrends] = useState<PricePoint[]>([]);
  const [ingredients, setIngredients] = useState<{ id: number; name: string }[]>([]);
  const [priceTrendIngredientId, setPriceTrendIngredientId] = useState<number | null>(null);

  // Load ingredients for price trends dropdown
  useEffect(() => {
    invoke<{ id: number; name: string }[]>("ingredients_list")
      .then(setIngredients)
      .catch(() => setIngredients([]));
  }, []);

  // Load data based on active tab
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case "costs": {
          const data = await invoke<CostReport>("report_cost", { days });
          setCostReport(data);
          break;
        }
        case "waste": {
          const data = await invoke<WasteReport>("report_waste", { days });
          setWasteReport(data);
          break;
        }
        case "stock": {
          const data = await invoke<StockSnapshot[]>("report_stock_trends", { days });
          setStockTrends(data);
          break;
        }
        case "meals": {
          const data = await invoke<MealStats>("report_meal_stats", { days });
          setMealStats(data);
          break;
        }
        case "prices": {
          if (priceTrendIngredientId) {
            const data = await invoke<PricePoint[]>("report_price_trends", { ingredient_id: priceTrendIngredientId, days });
            setPriceTrends(data);
          }
          break;
        }
      }
    } catch (e) {
      showToast("Erro ao carregar relatório", "err");
    } finally {
      setLoading(false);
    }
  }, [activeTab, days, priceTrendIngredientId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When ingredient changes for price trends, reload
  useEffect(() => {
    if (activeTab === "prices" && ingredients.length > 0 && !priceTrendIngredientId) {
      setPriceTrendIngredientId(ingredients[0].id);
    }
  }, [activeTab, ingredients, priceTrendIngredientId]);

  if (loading && activeTab !== "prices") {
    return (
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <p className="text-3">A carregar relatório...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <PageHeader
        title="Relatórios"
        subtitle="Análise de custos, desperdício, stock, refeições e preços"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <select
              className="select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ minWidth: "140px" }}
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        }
      />
      
      <div className="tab-list">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "costs" && <CostsTab costReport={costReport} days={days} />}
      {activeTab === "waste" && <WasteTab wasteReport={wasteReport} days={days} />}
      {activeTab === "stock" && <StockTrendsTab stockTrends={stockTrends} loading={loading} />}
      {activeTab === "meals" && <MealsTab mealStats={mealStats} days={days} />}
      {activeTab === "prices" && (
        <PricesTab
          ingredients={ingredients}
          priceTrendIngredientId={priceTrendIngredientId}
          setPriceTrendIngredientId={setPriceTrendIngredientId}
          loading={loading}
          priceTrends={priceTrends}
        />
      )}
    </div>
  );
}
