import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import StatusPill from "../components/ui/StatusPill";
import { useI18n } from "../i18n";
import type { DashboardStats } from "../../crates/core/bindings/DashboardStats";
import type { ActivityItem } from "../../crates/core/bindings/ActivityItem";
import type { MealPlanEntryWithRecipe } from "../../crates/core/bindings/MealPlanEntryWithRecipe";
import type { StockItemWithIngredient } from "../../crates/core/bindings/StockItemWithIngredient";
import { UNIT_LABELS_SHORT as UNIT_LABELS } from "../lib/units";

type T = (key: string, params?: Record<string, string | number>) => string;

const getDowShort = (t: T) => [
  t("dashboard.dow.sun"), t("dashboard.dow.mon"), t("dashboard.dow.tue"),
  t("dashboard.dow.wed"), t("dashboard.dow.thu"), t("dashboard.dow.fri"), t("dashboard.dow.sat"),
];

const MEAL_COLOR: Record<string, string> = {
  breakfast: "var(--amber)", lunch: "var(--green)", dinner: "var(--ember)", snack: "var(--approx)"
};

const formatEur = (n: number) =>
  `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatRelativeTime = (dateStr: string, t: T) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("dashboard.time.now");
  if (diffMins < 60) return t("dashboard.time.minsAgo", { mins: diffMins });
  if (diffHours < 24) return t("dashboard.time.hoursAgo", { hours: diffHours });
  if (diffDays < 7) return t(diffDays > 1 ? "dashboard.time.daysAgo" : "dashboard.time.dayAgo", { days: diffDays });
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
};

const getActivityMeta = (type: string): { icon: string; color: string } => {
  switch (type) {
    case "recipe_created": return { icon: "add_circle", color: "var(--ink-2)" };
    case "stock_updated": return { icon: "inventory_2", color: "var(--amber)" };
    case "meal_planned": return { icon: "calendar_view_week", color: "var(--green)" };
    case "shopping_purchased": return { icon: "receipt_long", color: "var(--green)" };
    default: return { icon: "history", color: "var(--ink-3)" };
  }
};

function KpiCard({
  icon, color, label, value, sub, subIcon, onClick
}: {
  icon: string; color: string; label: string; value: string | number;
  sub: string; subIcon: string; onClick?: () => void;
}) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{ padding: "17px 19px", cursor: onClick ? "pointer" : "default" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ms" style={{ fontSize: 18, color }}>{icon}</span>
        <span className="mono" style={{ fontSize: 10, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 29, fontWeight: 600, color: "var(--ink)", marginTop: 12, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: "11.5px", color: "var(--ink-2)", marginTop: 7, display: "flex", alignItems: "center", gap: 5 }}>
        <span className="ms" style={{ fontSize: 14, color }}>{subIcon}</span>{sub}
      </div>
    </div>
  );
}

function KpiRow({ stats, navigateToStock, navigateToShopping, t }: {
  stats: DashboardStats | null; navigateToStock: () => void; navigateToShopping: () => void; t: T;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
      <KpiCard
        icon="euro" color="var(--ember)" label={t("dashboard.kpi.stockValue")}
        value={formatEur(stats?.total_stock_value ?? 0)}
        subIcon="inventory_2" sub={t("dashboard.kpi.stockValueSub", { count: stats?.total_ingredients ?? 0 })}
        onClick={navigateToStock}
      />
      <KpiCard
        icon="warning" color="var(--amber)" label={t("dashboard.kpi.lowStock")}
        value={stats?.low_stock_count ?? 0}
        subIcon="shopping_cart" sub={t("dashboard.kpi.lowStockSub")}
        onClick={navigateToStock}
      />
      <KpiCard
        icon="schedule" color="var(--red)" label={t("dashboard.kpi.expiring")}
        value={stats?.expiring_soon_count ?? 0}
        subIcon="error" sub={t("dashboard.kpi.expiringSub")}
        onClick={navigateToStock}
      />
      <KpiCard
        icon="receipt_long" color="var(--green)" label={t("dashboard.kpi.pendingPurchases")}
        value={stats?.pending_shopping_items ?? 0}
        subIcon="shopping_cart" sub={t("dashboard.kpi.pendingPurchasesSub")}
        onClick={navigateToShopping}
      />
    </div>
  );
}

function AlertsPanel({ lowStock, navigateToStock, navigateToShopping, t }: { lowStock: StockItemWithIngredient[]; navigateToStock: () => void; navigateToShopping: () => void; t: T }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={navigateToStock}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ms" style={{ fontSize: 19, color: "var(--amber)" }}>warning</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t("dashboard.alerts.title")}</span>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{lowStock.length}</span>
      </div>
      {lowStock.length === 0 ? (
        <EmptyState
          icon={<span className="ms" style={{ fontSize: 32, color: "var(--green)" }}>check_circle</span>}
          title={t("dashboard.alerts.stockOk")}
          body={t("dashboard.alerts.stockOkDesc")}
        />
      ) : (
        <div>
          {lowStock.slice(0, 6).map(item => {
            const isOut = item.quantity <= 0;
            const unit = UNIT_LABELS[item.ingredient_unit] ?? item.ingredient_unit;
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 19px", borderBottom: "1px solid var(--line-2)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOut ? "var(--red)" : "var(--amber)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{item.ingredient_name}</div>
                  <div className="mono" style={{ fontSize: "10.5px", color: "var(--ink-3)", marginTop: 1 }}>
                    {item.quantity} {unit} {t("dashboard.alerts.inStock")} · {t("dashboard.alerts.min")} {item.min_quantity} {unit}
                  </div>
                </div>
                <StatusPill status={isOut ? "out" : "low"} label={isOut ? t("dashboard.alerts.outOfStock") : t("dashboard.alerts.low")} />
                <button
                  onClick={(e) => { e.stopPropagation(); navigateToShopping(); }}
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 28, padding: "0 10px", fontSize: "11.5px", fontWeight: 600, color: "var(--ink-2)", cursor: "pointer", fontFamily: "var(--sans)" }}
                >
                  {t("dashboard.alerts.addToList")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekPanel({ upcomingMeals, mealsThisWeek, navigateToMealPlanner, navigateToCalendar, t }: {
  upcomingMeals: MealPlanEntryWithRecipe[]; mealsThisWeek: number; navigateToMealPlanner: () => void; navigateToCalendar: () => void; t: T;
}) {
  const dowShort = getDowShort(t);
  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = localKey(d);
    const meals = upcomingMeals.filter(m => {
      const md = m.planned_date ? new Date(m.planned_date) : null;
      return md && !isNaN(md.getTime()) && localKey(md) === key;
    });
    return { dow: dowShort[d.getDay()], dayNum: String(d.getDate()), isToday: i === 0, meals };
  });

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer" }} onClick={navigateToCalendar}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ms" style={{ fontSize: 19, color: "var(--ember)" }}>calendar_view_week</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t("dashboard.week.title")}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("dashboard.week.planned", { count: mealsThisWeek })}</span>
          <button onClick={(e) => { e.stopPropagation(); navigateToMealPlanner(); }} className="mono" style={{ fontSize: 11, color: "var(--ember)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {t("dashboard.week.plan")}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "var(--line-2)", padding: 1 }}>
        {days.map((d, i) => (
          <div key={i} style={{ background: "var(--surface)", padding: "11px 9px", minHeight: 118, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "var(--ink-3)", letterSpacing: ".5px" }}>{d.dow}</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: d.isToday ? "var(--ember)" : "var(--ink)" }}>{d.dayNum}</div>
            </div>
            {d.meals.slice(0, 2).map(m => (
              <div key={m.id} style={{ background: "var(--inset)", borderLeft: `2px solid ${MEAL_COLOR[m.meal_type] ?? "var(--ink-3)"}`, borderRadius: 4, padding: "5px 6px", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); navigateToMealPlanner(); }}>
                <div style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--ink)", lineHeight: 1.15 }}>{m.recipe_name}</div>
                <div className="mono" style={{ fontSize: "8.5px", color: "var(--ink-3)" }}>{m.portions} {t("dashboard.week.portions")}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingShoppingPanel({ pendingCount, navigateToShopping, t }: { pendingCount: number; navigateToShopping: () => void; t: T }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer" }} onClick={navigateToShopping}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ms" style={{ fontSize: 19, color: "var(--ember)" }}>shopping_cart</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t("dashboard.pendingShopping.title")}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 19px" }}>
        <div className="mono" style={{ fontSize: 34, fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}>{pendingCount}</div>
        <div style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>{t("dashboard.pendingShopping.itemsToBuy")}</div>
      </div>
      <div style={{ padding: "13px 19px", borderTop: "1px solid var(--line-2)" }}>
        <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={(e) => { e.stopPropagation(); navigateToShopping(); }}>{t("dashboard.pendingShopping.viewFullList")}</button>
      </div>
    </div>
  );
}

function RecentActivityPanel({ activity, t }: { activity: ActivityItem[]; t: T }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ms" style={{ fontSize: 19, color: "var(--ink-2)" }}>history</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t("dashboard.recentActivity.title")}</span>
      </div>
      {activity.length === 0 ? (
        <EmptyState
          icon={<span className="ms" style={{ fontSize: 32, color: "var(--ink-3)" }}>history</span>}
          title={t("dashboard.recentActivity.empty")}
          body={t("dashboard.recentActivity.emptyDesc")}
        />
      ) : (
        <div style={{ padding: "6px 19px 14px", maxHeight: 300, overflowY: "auto" }}>
          {activity.slice(0, 6).map(item => {
            const meta = getActivityMeta(item.activity_type);
            return (
              <div key={item.id} style={{ display: "flex", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--line-2)" }}>
                <span className="ms" style={{ fontSize: 17, color: meta.color, marginTop: 1 }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12.5px", color: "var(--ink)", lineHeight: 1.3 }}>{item.description}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>{formatRelativeTime(item.timestamp, t)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickActionsPanel({ navigateToMealPlanner, navigateToShopping, navigateToStock, navigateToRecipes, t }: {
  navigateToMealPlanner: () => void; navigateToShopping: () => void; navigateToStock: () => void; navigateToRecipes: () => void; t: T;
}) {
  const actions = [
    { icon: "calendar_view_week", label: t("dashboard.quickActions.weeklyPlan"), onClick: navigateToMealPlanner },
    { icon: "shopping_cart", label: t("dashboard.quickActions.newShoppingList"), onClick: navigateToShopping },
    { icon: "inventory_2", label: t("dashboard.quickActions.checkStock"), onClick: navigateToStock },
    { icon: "menu_book", label: t("dashboard.quickActions.newRecipe"), onClick: navigateToRecipes },
  ];
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ms" style={{ fontSize: 19, color: "var(--ember)" }}>bolt</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t("dashboard.quickActions.title")}</span>
      </div>
      <div>
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              padding: "12px 19px", background: "none", border: "none", borderBottom: i < actions.length - 1 ? "1px solid var(--line-2)" : "none",
              cursor: "pointer", fontFamily: "var(--sans)"
            }}
          >
            <span className="ms" style={{ fontSize: 18, color: "var(--ember)" }}>{a.icon}</span>
            <span style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--ink)" }}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcomingMeals, setUpcomingMeals] = useState<MealPlanEntryWithRecipe[]>([]);
  const [lowStock, setLowStock] = useState<StockItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, activityData, mealsData, lowStockData] = await Promise.all([
        invoke<DashboardStats>("dashboard_stats"),
        invoke<ActivityItem[]>("dashboard_recent_activity", { limit: 10 }),
        invoke<MealPlanEntryWithRecipe[]>("dashboard_upcoming_meals", { days: 7 }),
        invoke<StockItemWithIngredient[]>("dashboard_low_stock", { threshold: 0 }),
      ]);
      setStats(statsData);
      setActivity(activityData);
      setUpcomingMeals(mealsData);
      setLowStock(lowStockData);
    } catch (e) {
      showToast(t("dashboard.error"), "err");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const navigateToStock = useCallback(() => navigate("/armazem"), [navigate]);
  const navigateToMealPlanner = useCallback(() => navigate("/planeamento"), [navigate]);
  const navigateToCalendar = useCallback(() => navigate("/calendario"), [navigate]);
  const navigateToShopping = useCallback(() => navigate("/compras"), [navigate]);
  const navigateToRecipes = useCallback(() => navigate("/receitas/nova"), [navigate]);

  if (loading) {
    return (
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <p className="text-3">{t("dashboard.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={
          <button className="btn btn-primary" onClick={navigateToRecipes}>
            <span className="ms" style={{ fontSize: 14 }}>add</span>
            {t("dashboard.newRecipe")}
          </button>
        }
      />

      <KpiRow stats={stats} navigateToStock={navigateToStock} navigateToShopping={navigateToShopping} t={t} />

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: 16, marginBottom: 16 }}>
        <AlertsPanel lowStock={lowStock} navigateToStock={navigateToStock} navigateToShopping={navigateToShopping} t={t} />
        <WeekPanel upcomingMeals={upcomingMeals} mealsThisWeek={stats?.meals_this_week ?? 0} navigateToMealPlanner={navigateToMealPlanner} navigateToCalendar={navigateToCalendar} t={t} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PendingShoppingPanel pendingCount={stats?.pending_shopping_items ?? 0} navigateToShopping={navigateToShopping} t={t} />
        <RecentActivityPanel activity={activity} t={t} />
        <QuickActionsPanel
          navigateToMealPlanner={navigateToMealPlanner}
          navigateToShopping={navigateToShopping}
          navigateToStock={navigateToStock}
          navigateToRecipes={navigateToRecipes}
          t={t}
        />
      </div>
    </div>
  );
}
