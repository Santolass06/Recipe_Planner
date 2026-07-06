import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { useI18n } from "../i18n";
import type { CostReport } from "../../crates/core/bindings/CostReport";
import type { WasteReport } from "../../crates/core/bindings/WasteReport";
import type { StockSnapshot } from "../../crates/core/bindings/StockSnapshot";
import type { MealStats } from "../../crates/core/bindings/MealStats";
import type { PricePoint } from "../../crates/core/bindings/PricePoint";

type T = (key: string, params?: Record<string, string | number>) => string;

// ============================================================================
// BAR-LIST (name + mono amount, 8px rounded meter bar) — mise report pattern
// ============================================================================

const CATEGORY_COLORS = ["var(--ember)", "var(--green)", "var(--amber)", "var(--approx)", "var(--red)", "var(--ink-3)"];

interface BarListRow {
  key: string | number;
  name: string;
  amount: string;
  pct: number;
  color: string;
}

const BarList = ({ rows, t }: { rows: BarListRow[]; t: T }) =>
  rows.length === 0 ? (
    <div className="empty" style={{ padding: "24px 0", color: "var(--ink-3)" }}>{t("reports.noData")}</div>
  ) : (
    <div>
      {rows.map((row) => (
        <div key={row.key} style={{ marginBottom: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 5 }}>
            <span style={{ fontSize: "12.5px", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {row.name}
            </span>
            <span className="mono" style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", flexShrink: 0 }}>
              {row.amount}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 5, background: "var(--inset)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, row.pct))}%`, background: row.color, borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );

// ============================================================================
// MINI BAR CHART — 6-bar trend strip w/ month labels (price trend pattern)
// ============================================================================

const MiniBarChart = ({ bars }: { bars: { key: string | number; label: string; h: number; color: string }[] }) => (
  <div>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130 }}>
      {bars.map((b) => (
        <div key={b.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ width: "100%", height: `${Math.max(4, Math.min(100, b.h))}%`, background: b.color, borderRadius: "6px 6px 0 0", minHeight: 6 }} />
        </div>
      ))}
    </div>
    <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
      {bars.map((b) => (
        <span key={b.key} className="mono" style={{ flex: 1, textAlign: "center", fontSize: "9.5px", color: "var(--ink-3)" }}>{b.label}</span>
      ))}
    </div>
  </div>
);

// ============================================================================
// STAT TILE (KPI card)
// ============================================================================

const KPICard = ({
  label,
  value,
  subLabel,
  icon,
  color = "var(--ember)",
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
  <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-4)" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span className="mono" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>{label}</span>
      <span style={{ color }}>{icon}</span>
    </div>
    <div className="mono" style={{ fontSize: "26px", fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
    <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>{subLabel}</span>
    {trend && (
      <span style={{ fontSize: "11px", color: trend.value >= 0 ? "var(--red)" : "var(--green)", display: "flex", alignItems: "center", gap: 3 }}>
        <span className="ms" style={{ fontSize: "14px" }}>{trend.value >= 0 ? "trending_up" : "trending_down"}</span>
        {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}% {trend.label}
      </span>
    )}
  </div>
);

// ============================================================================
// MAIN REPORTS PAGE
// ============================================================================

const getTabs = (t: T) => [
  { id: "costs", label: t("reports.tabs.costs"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
  { id: "waste", label: t("reports.tabs.waste"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 2 22 8 16 14"/><line x1="22" y1="8" x2="8" y2="8"/></svg> },
  { id: "stock", label: t("reports.tabs.stock"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: "meals", label: t("reports.tabs.meals"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id: "prices", label: t("reports.tabs.prices"), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg> },
];

const getRangeOptions = (t: T) => [
  { value: 7, label: t("reports.range.d7") },
  { value: 30, label: t("reports.range.d30") },
  { value: 90, label: t("reports.range.d90") },
  { value: 365, label: t("reports.range.d365") },
];

const getMealTypeLabels = (t: T): Record<string, string> => ({
  breakfast: t("calendar.meals.breakfast"),
  lunch: t("calendar.meals.lunch"),
  dinner: t("calendar.meals.dinner"),
  snack: t("calendar.meals.snack"),
});

const UNIT_LABELS: Record<string, string> = {
  gram: "g", kilogram: "kg", milligram: "mg",
  ounce: "oz", pound: "lb",
  milliliter: "ml", liter: "l", fluid_ounce: "fl oz",
  cup: "cup", pint: "pt", quart: "qt", gallon: "gal",
  teaspoon: "tsp", tablespoon: "tbsp",
  piece: "pcs", dozen: "dz",
  pinch: "pitada", bunch: "molho", clove: "dente", slice: "fatia",
};



function CostsTab({ costReport, days, t }: { costReport: CostReport | null; days: number; t: T }) {
  if (!costReport || !costReport.total_spent) return <div className="empty" style={{ minHeight: 200 }}>{t("reports.noData")}</div>;

  const byCategory = costReport.by_category ?? [];
  const byRecipe = costReport.by_recipe ?? [];
  const bySupplier = costReport.by_supplier ?? [];

  const categoryRows: BarListRow[] = byCategory.slice(0, 8).map((c, i) => ({
    key: c.category,
    name: c.category,
    amount: `€${c.total.toFixed(2)}`,
    pct: c.percentage,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const recipeRows: BarListRow[] = byRecipe.slice(0, 8).map((r) => {
    const maxCost = Math.max(...byRecipe.map((x) => x.total_cost), 1);
    return {
      key: r.recipe_id,
      name: r.recipe_name,
      amount: `€${r.total_cost.toFixed(2)}`,
      pct: (r.total_cost / maxCost) * 100,
      color: "var(--ember)",
    };
  });

  const supplierRows: BarListRow[] = bySupplier.slice(0, 8).map((s) => ({
    key: s.supplier,
    name: s.supplier,
    amount: `€${s.total.toFixed(2)}`,
    pct: s.percentage,
    color: "var(--approx)",
  }));

  const supplierTotal = bySupplier.reduce((sum, s) => sum + s.total, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        <KPICard
          label={t("reports.costsTab.totalSpent")}
          value={`€${costReport.total_spent.toFixed(2)}`}
          subLabel={t("reports.costsTab.days", { days })}
          icon={<span className="ms" style={{ fontSize: 22 }}>payments</span>}
          color="var(--ember)"
        />
        <KPICard
          label={t("reports.costsTab.dailyAvg")}
          value={`€${costReport.daily_avg.toFixed(2)}`}
          subLabel={t("reports.costsTab.perDay")}
          icon={<span className="ms" style={{ fontSize: 22 }}>calendar_month</span>}
          color="var(--green)"
        />
        <KPICard
          label={t("reports.costsTab.categories")}
          value={byCategory.length}
          subLabel={t("reports.costsTab.withSpending")}
          icon={<span className="ms" style={{ fontSize: 22 }}>category</span>}
          color="var(--amber)"
        />
        <KPICard
          label={t("reports.costsTab.suppliers")}
          value={bySupplier.length}
          subLabel={t("reports.costsTab.used")}
          icon={<span className="ms" style={{ fontSize: 22 }}>local_shipping</span>}
          color="var(--approx)"
        />
      </div>

      {/* Gastos por categoria / por receita */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", alignItems: "start" }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{t("reports.costsTab.spendByCategory")}</span>
            <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>€{costReport.total_spent.toFixed(2)}</span>
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 16 }}>{t("reports.costsTab.totalLastDays", { days })}</div>
          <BarList rows={categoryRows} t={t} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{t("reports.costsTab.spendByRecipe")}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 16 }}>
            {t("reports.costsTab.lastDaysTopRecipes", { days, count: Math.min(8, byRecipe.length) })}
          </div>
          <BarList rows={recipeRows} t={t} />
        </div>
      </div>

      {/* Gastos por fornecedor (fonte diferente) */}
      <div className="card" style={{ padding: 20, border: "1px solid var(--approx)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ms" style={{ fontSize: 19, color: "var(--approx)" }}>local_shipping</span>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{t("reports.costsTab.spendBySupplier")}</span>
          </div>
          <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--approx)" }}>€{supplierTotal.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", gap: 8, background: "var(--approx-soft)", borderRadius: 9, padding: "10px 12px", margin: "12px 0 16px" }}>
          <span className="ms" style={{ fontSize: 17, color: "var(--approx)", flexShrink: 0 }}>info</span>
          <span style={{ fontSize: "11.5px", color: "var(--ink-2)", lineHeight: 1.45 }}>
            {t("reports.costsTab.differentSourceNote")}
          </span>
        </div>
        <BarList rows={supplierRows} t={t} />
      </div>

      {/* Top Recipes Table */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--ink)", fontWeight: 600 }}>{t("reports.costsTab.topRecipesTable")}</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("reports.costsTab.colRecipe")}</th>
                <th className="mono">{t("reports.costsTab.colTotalCost")}</th>
                <th className="mono">{t("reports.costsTab.colCostPerPortion")}</th>
                <th className="mono">{t("reports.costsTab.colTimes")}</th>
              </tr>
            </thead>
            <tbody>
              {byRecipe.slice(0, 10).map((r) => (
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

function WasteTab({ wasteReport, days, t }: { wasteReport: WasteReport | null; days: number; t: T }) {
  if (!wasteReport || !wasteReport.total_wasted_value) return <div className="empty" style={{ minHeight: 200 }}>{t("reports.noData")}</div>;

  const byCategory = wasteReport.by_category ?? [];
  const byIngredient = wasteReport.by_ingredient ?? [];

  const categoryRows: BarListRow[] = byCategory.slice(0, 8).map((c, i) => ({
    key: c.category,
    name: c.category,
    amount: `€${c.total_wasted_value.toFixed(2)}`,
    pct: c.percentage,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <KPICard
        label={t("reports.wasteTab.totalWasted")}
        value={`€${wasteReport.total_wasted_value.toFixed(2)}`}
        subLabel={t("reports.costsTab.days", { days })}
        icon={<span className="ms" style={{ fontSize: 22 }}>delete</span>}
        color="var(--red)"
      />
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{t("reports.wasteTab.wasteByCategory")}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 16 }}>{t("reports.wasteTab.lastDays", { days })}</div>
        <BarList rows={categoryRows} t={t} />
      </div>
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--ink)", fontWeight: 600 }}>{t("reports.wasteTab.byIngredient")}</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("reports.wasteTab.colIngredient")}</th>
                <th className="mono">{t("reports.wasteTab.colWastedQty")}</th>
                <th className="mono">{t("reports.wasteTab.colValue")}</th>
              </tr>
            </thead>
            <tbody>
              {byIngredient.map((w) => (
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

function StockTrendsTab({ stockTrends, loading, t }: { stockTrends: StockSnapshot[]; loading: boolean; t: T }) {
  if (loading) return <div className="empty" style={{ minHeight: 200 }}>{t("reports.loadingEllipsis")}</div>;

  // Group by ingredient for multi-line chart
  const ingredientMap = new Map<number, { name: string; data: StockSnapshot[] }>();
  (stockTrends ?? []).forEach((s) => {
    const existing = ingredientMap.get(s.ingredient_id);
    if (!existing) ingredientMap.set(s.ingredient_id, { name: s.ingredient_name, data: [s] });
    else existing.data.push(s);
  });

  const topIngredients = Array.from(ingredientMap.entries())
    .sort((a, b) => b[1].data[b[1].data.length - 1]?.value - a[1].data[a[1].data.length - 1]?.value)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{t("reports.stockTab.evolution")}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 16 }}>{t("reports.stockTab.top5")}</div>
        {topIngredients.length === 0 ? (
          <div className="empty" style={{ minHeight: 200 }}>{t("reports.noData")}</div>
        ) : (
          <div style={{ height: 300, position: "relative" }}>
            <svg viewBox="0 0 100 300" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
              {/* Grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line key={ratio} x1="5" y1={300 - ratio * 280} x2="95" y2={300 - ratio * 280} stroke="var(--line-2)" strokeWidth="0.3" strokeDasharray="2,2" />
              ))}
              {topIngredients.map(([_, ingredient], i) => {
                const values = ingredient.data.map((d) => d.value);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = max - min || 1;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];

                const path = ingredient.data
                  .map((d, di) => {
                    const x = 5 + (di / (ingredient.data.length - 1)) * 90;
                    const y = 300 - 10 - ((d.value - min) / range) * 280;
                    return `${di === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ");

                return (
                  <g key={ingredient.name}>
                    <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                  </g>
                );
              })}
            </svg>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-2)", fontSize: "11px" }}>
              {topIngredients.map(([_, ingredient], i) => (
                <span key={ingredient.name} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ink-2)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
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

function MealsTab({ mealStats, days, t }: { mealStats: MealStats | null; days: number; t: T }) {
  if (!mealStats || !mealStats.total_meals) return <div className="empty" style={{ minHeight: 200 }}>{t("reports.noData")}</div>;

  const byMealType = mealStats.by_meal_type ?? [];
  const byRecipe = mealStats.by_recipe ?? [];
  const mealTypeLabels = getMealTypeLabels(t);

  const mealTypeRows: BarListRow[] = byMealType.map((m, i) => ({
    key: m.meal_type,
    name: mealTypeLabels[m.meal_type] ?? m.meal_type,
    amount: `${m.count}x`,
    pct: m.percentage,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const recipeRows: BarListRow[] = byRecipe.slice(0, 8).map((r) => {
    const maxCount = Math.max(...byRecipe.map((x) => x.count), 1);
    return {
      key: r.recipe_id,
      name: r.recipe_name,
      amount: `${r.count}x`,
      pct: (r.count / maxCount) * 100,
      color: "var(--ember)",
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        <KPICard
          label={t("reports.mealsTab.totalMeals")}
          value={mealStats.total_meals}
          subLabel={t("reports.costsTab.days", { days })}
          icon={<span className="ms" style={{ fontSize: 22 }}>restaurant</span>}
          color="var(--ember)"
        />
        <KPICard
          label={t("reports.mealsTab.avgPortions")}
          value={mealStats.avg_portions.toFixed(1)}
          subLabel={t("reports.mealsTab.perMeal")}
          icon={<span className="ms" style={{ fontSize: 22 }}>groups</span>}
          color="var(--green)"
        />
        <KPICard
          label={t("reports.mealsTab.mealTypes")}
          value={byMealType.length}
          subLabel={t("reports.mealsTab.used")}
          icon={<span className="ms" style={{ fontSize: 22 }}>schedule</span>}
          color="var(--amber)"
        />
        <KPICard
          label={t("reports.mealsTab.uniqueRecipes")}
          value={byRecipe.length}
          subLabel={t("reports.mealsTab.prepared")}
          icon={<span className="ms" style={{ fontSize: 22 }}>menu_book</span>}
          color="var(--approx)"
        />
      </div>

      {/* Bar lists */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", alignItems: "start" }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{t("reports.mealsTab.mealsByType")}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 16 }}>{t("reports.wasteTab.lastDays", { days })}</div>
          <BarList rows={mealTypeRows} t={t} />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{t("reports.mealsTab.topRecipesPrepared")}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 16 }}>
            {t("reports.mealsTab.lastDaysTop", { days, count: Math.min(8, byRecipe.length) })}
          </div>
          <BarList rows={recipeRows} t={t} />
        </div>
      </div>

      {/* Detail Table */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--ink)", fontWeight: 600 }}>{t("reports.mealsTab.detailByRecipe")}</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("reports.costsTab.colRecipe")}</th>
                <th className="mono">{t("reports.mealsTab.colTimes")}</th>
                <th className="mono">{t("reports.mealsTab.colTotalPortions")}</th>
                <th className="mono">{t("reports.mealsTab.colAvgPortions")}</th>
              </tr>
            </thead>
            <tbody>
              {byRecipe.slice(0, 15).map((r) => (
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
  t,
}: {
  ingredients: { id: number; name: string }[];
  priceTrendIngredientId: number | null;
  setPriceTrendIngredientId: (id: number | null) => void;
  loading: boolean;
  priceTrends: PricePoint[];
  t: T;
}) {
  const locale = t("calendar.locale");
  const selectedName = ingredients.find((i) => i.id === priceTrendIngredientId)?.name;

  // Build up to 6 bars from the trend (chronological order, most recent last).
  const chronological = priceTrends.slice().reverse();
  const sample: PricePoint[] =
    chronological.length <= 6
      ? chronological
      : chronological.filter((_, i) => i % Math.ceil(chronological.length / 6) === 0).slice(-6);
  const maxPrice = Math.max(...sample.map((p) => p.price), 1);
  const currentPrice = chronological[chronological.length - 1]?.price ?? null;
  const firstPrice = chronological[0]?.price ?? null;
  const delta = currentPrice != null && firstPrice ? ((currentPrice - firstPrice) / firstPrice) * 100 : null;

  const bars = sample.map((p, i) => ({
    key: p.date + i,
    label: new Date(p.date).toLocaleDateString(locale, { month: "short" }).replace(".", ""),
    h: (p.price / maxPrice) * 100,
    color: i === sample.length - 1 ? "var(--red)" : "var(--ember)",
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* Ingredient Selector */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <label className="field-label">{t("reports.pricesTab.ingredientLabel")}</label>
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

      {/* Tendência de preços */}
      <div className="card" style={{ padding: 20, maxWidth: 420 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{t("reports.pricesTab.priceTrend")}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 6 }}>
          {t("reports.pricesTab.lastRecords", { name: selectedName ?? t("reports.pricesTab.defaultIngredient"), count: sample.length })}
        </div>
        {priceTrends.length === 0 ? (
          <EmptyState
            icon={
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/>
                <line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/>
              </svg>
            }
            title={t("reports.pricesTab.noDataTitle")}
            body={t("reports.pricesTab.noDataDesc")}
          />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "8px 0 18px" }}>
              <span className="mono" style={{ fontSize: 24, fontWeight: 600, color: "var(--ink)" }}>
                €{currentPrice?.toFixed(2)}
              </span>
              {delta != null && (
                <span className="mono" style={{ fontSize: 12, color: delta >= 0 ? "var(--red)" : "var(--green)", display: "flex", alignItems: "center" }}>
                  <span className="ms" style={{ fontSize: 16 }}>{delta >= 0 ? "trending_up" : "trending_down"}</span>
                  {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                </span>
              )}
            </div>
            <MiniBarChart bars={bars} />
          </>
        )}
      </div>

      {/* Price Points Table */}
      {priceTrends.length > 0 && (
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <h3 style={{ marginBottom: "var(--space-3)", fontSize: "14px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("reports.pricesTab.historyTitle")}</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("reports.pricesTab.colDate")}</th>
                  <th>{t("reports.pricesTab.colSupplier")}</th>
                  <th className="mono">{t("reports.pricesTab.colPrice")}</th>
                </tr>
              </thead>
              <tbody>
                {priceTrends.slice().reverse().map((p, i) => (
                  <tr key={i}>
                    <td>{new Date(p.date).toLocaleDateString(locale)}</td>
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
  const { t } = useI18n();

  // Data states
  const [costReport, setCostReport] = useState<CostReport | null>({
    total_spent: 842.5, daily_avg: 28.08,
    by_category: [
      { category: "Peixe e Marisco", total: 312.4, percentage: 37 },
      { category: "Laticínios", total: 180.2, percentage: 21 },
      { category: "Carne", total: 150.1, percentage: 18 },
      { category: "Hortícolas", total: 110.0, percentage: 13 },
      { category: "Mercearia", total: 89.8, percentage: 11 },
    ],
    by_recipe: [
      { recipe_id: 1, recipe_name: "Risotto de Camarão", total_cost: 210.5, portions: 4, cost_per_portion: 5.2, count: 12 },
      { recipe_id: 2, recipe_name: "Bacalhau à Brás", total_cost: 180.0, portions: 4, cost_per_portion: 4.8, count: 9 },
      { recipe_id: 3, recipe_name: "Francesinha", total_cost: 140.0, portions: 2, cost_per_portion: 7.1, count: 6 },
    ],
    by_supplier: [
      { supplier: "Talho Central", total: 175.1, percentage: 40 },
      { supplier: "Peixaria do Porto", total: 130.0, percentage: 30 },
      { supplier: "Mercado Municipal", total: 90.0, percentage: 20 },
    ],
  } /* TEMP sample for screenshot */);
  const [wasteReport, setWasteReport] = useState<WasteReport | null>(null);
  const [stockTrends, setStockTrends] = useState<StockSnapshot[]>([]);
  const [mealStats, setMealStats] = useState<MealStats | null>(null);
  const [priceTrends, setPriceTrends] = useState<PricePoint[]>([
    { date: "2026-01-15", price: 3.9, supplier: "Peixaria do Porto" },
    { date: "2026-02-15", price: 4.1, supplier: "Peixaria do Porto" },
    { date: "2026-03-15", price: 4.3, supplier: "Peixaria do Porto" },
    { date: "2026-04-15", price: 4.5, supplier: "Peixaria do Porto" },
    { date: "2026-05-15", price: 4.9, supplier: "Peixaria do Porto" },
    { date: "2026-06-15", price: 5.2, supplier: "Peixaria do Porto" },
  ] /* TEMP sample for screenshot */);
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
          if (data && data.total_spent) setCostReport(data); // TEMP guard for screenshot
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
            const data = await invoke<PricePoint[]>("report_price_trends", { ingredientId: priceTrendIngredientId, days });
            if (data && data.length) setPriceTrends(data); // TEMP guard for screenshot
          }
          break;
        }
      }
    } catch (e) {
      showToast(t("reports.loadError"), "err");
    } finally {
      setLoading(false);
    }
  }, [activeTab, days, priceTrendIngredientId, showToast, t]);

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
          <p className="text-3">{t("reports.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <PageHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <select
              className="select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ minWidth: "140px" }}
            >
              {getRangeOptions(t).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="tab-list">
        {getTabs(t).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "costs" && <CostsTab costReport={costReport} days={days} t={t} />}
      {activeTab === "waste" && <WasteTab wasteReport={wasteReport} days={days} t={t} />}
      {activeTab === "stock" && <StockTrendsTab stockTrends={stockTrends} loading={loading} t={t} />}
      {activeTab === "meals" && <MealsTab mealStats={mealStats} days={days} t={t} />}
      {activeTab === "prices" && (
        <PricesTab
          ingredients={ingredients}
          priceTrendIngredientId={priceTrendIngredientId}
          setPriceTrendIngredientId={setPriceTrendIngredientId}
          loading={loading}
          priceTrends={priceTrends}
          t={t}
        />
      )}
    </div>
  );
}
