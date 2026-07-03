import { useState, useEffect, useCallback } from "react";
import { invoke } from "../lib/devInvoke";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import StatusPill from "../components/ui/StatusPill";

interface DashboardStats {
  low_stock_count: number;
  expiring_soon_count: number;
  meals_this_week: number;
  total_stock_value: number;
  total_recipes: number;
  total_ingredients: number;
  pending_shopping_items: number;
}

interface ActivityItem {
  id: number;
  activity_type: string;
  description: string;
  entity_id: number | null;
  entity_type: string | null;
  timestamp: string;
}

interface MealPlanEntryWithRecipe {
  id: number;
  meal_plan_id: number;
  recipe_id: number;
  recipe_name: string;
  day_of_week: string;
  meal_type: string;
  portions: number;
  planned_date: string;
}

interface StockItemWithIngredient {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: number;
  min_quantity: number;
  price_per_unit: number;
  updated_at: string;
}

const DOW_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MEAL_COLOR: Record<string, string> = {
  breakfast: "var(--amber)", lunch: "var(--green)", dinner: "var(--ember)", snack: "var(--approx)"
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

const formatEur = (n: number) =>
  `€${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
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

function KpiRow({ stats, navigateToStock, navigateToShopping }: {
  stats: DashboardStats | null; navigateToStock: () => void; navigateToShopping: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
      <KpiCard
        icon="euro" color="var(--ember)" label="Valor em Stock"
        value={formatEur(stats?.total_stock_value ?? 0)}
        subIcon="inventory_2" sub={`${stats?.total_ingredients ?? 0} ingredientes`}
      />
      <KpiCard
        icon="warning" color="var(--amber)" label="Stock Baixo"
        value={stats?.low_stock_count ?? 0}
        subIcon="shopping_cart" sub="itens abaixo do mínimo"
        onClick={navigateToStock}
      />
      <KpiCard
        icon="schedule" color="var(--red)" label="A Expirar (7d)"
        value={stats?.expiring_soon_count ?? 0}
        subIcon="error" sub="itens a vencer em breve"
        onClick={navigateToStock}
      />
      <KpiCard
        icon="receipt_long" color="var(--green)" label="Compras Pendentes"
        value={stats?.pending_shopping_items ?? 0}
        subIcon="shopping_cart" sub="itens em falta"
        onClick={navigateToShopping}
      />
    </div>
  );
}

function AlertsPanel({ lowStock, navigateToShopping }: { lowStock: StockItemWithIngredient[]; navigateToShopping: () => void }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ms" style={{ fontSize: 19, color: "var(--amber)" }}>warning</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Alertas</span>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{lowStock.length}</span>
      </div>
      {lowStock.length === 0 ? (
        <EmptyState
          icon={<span className="ms" style={{ fontSize: 32, color: "var(--green)" }}>check_circle</span>}
          title="Stock OK"
          body="Todos os ingredientes estão acima do mínimo"
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
                    {item.quantity} {unit} em stock · min {item.min_quantity} {unit}
                  </div>
                </div>
                <StatusPill status={isOut ? "out" : "low"} label={isOut ? "Esgotado" : "Baixo"} />
                <button
                  onClick={navigateToShopping}
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 28, padding: "0 10px", fontSize: "11.5px", fontWeight: 600, color: "var(--ink-2)", cursor: "pointer", fontFamily: "var(--sans)" }}
                >
                  + Lista
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekPanel({ upcomingMeals, mealsThisWeek, navigateToMealPlanner }: {
  upcomingMeals: MealPlanEntryWithRecipe[]; mealsThisWeek: number; navigateToMealPlanner: () => void;
}) {
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
    return { dow: DOW_SHORT[d.getDay()], dayNum: String(d.getDate()), isToday: i === 0, meals };
  });

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ms" style={{ fontSize: 19, color: "var(--ember)" }}>calendar_view_week</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Próximos 7 dias</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{mealsThisWeek} planeadas</span>
          <button onClick={navigateToMealPlanner} className="mono" style={{ fontSize: 11, color: "var(--ember)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Plano →
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
              <div key={m.id} style={{ background: "var(--inset)", borderLeft: `2px solid ${MEAL_COLOR[m.meal_type] ?? "var(--ink-3)"}`, borderRadius: 4, padding: "5px 6px", cursor: "pointer" }} onClick={navigateToMealPlanner}>
                <div style={{ fontSize: "10.5px", fontWeight: 600, color: "var(--ink)", lineHeight: 1.15 }}>{m.recipe_name}</div>
                <div className="mono" style={{ fontSize: "8.5px", color: "var(--ink-3)" }}>{m.portions} por.</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingShoppingPanel({ pendingCount, navigateToShopping }: { pendingCount: number; navigateToShopping: () => void }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ms" style={{ fontSize: 19, color: "var(--ember)" }}>shopping_cart</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Compras Pendentes</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 19px" }}>
        <div className="mono" style={{ fontSize: 34, fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}>{pendingCount}</div>
        <div style={{ fontSize: "12.5px", color: "var(--ink-2)" }}>itens por comprar</div>
      </div>
      <div style={{ padding: "13px 19px", borderTop: "1px solid var(--line-2)" }}>
        <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={navigateToShopping}>Ver lista completa</button>
      </div>
    </div>
  );
}

function RecentActivityPanel({ activity }: { activity: ActivityItem[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ms" style={{ fontSize: 19, color: "var(--ink-2)" }}>history</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Atividade Recente</span>
      </div>
      {activity.length === 0 ? (
        <EmptyState
          icon={<span className="ms" style={{ fontSize: 32, color: "var(--ink-3)" }}>history</span>}
          title="Sem actividade recente"
          body="As tuas ações aparecerão aqui"
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
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>{formatRelativeTime(item.timestamp)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickActionsPanel({ navigateToMealPlanner, navigateToShopping, navigateToStock, navigateToRecipes }: {
  navigateToMealPlanner: () => void; navigateToShopping: () => void; navigateToStock: () => void; navigateToRecipes: () => void;
}) {
  const actions = [
    { icon: "calendar_view_week", label: "Criar Planeamento Semanal", onClick: navigateToMealPlanner },
    { icon: "shopping_cart", label: "Nova Lista de Compras", onClick: navigateToShopping },
    { icon: "inventory_2", label: "Verificar Stock", onClick: navigateToStock },
    { icon: "menu_book", label: "Nova Receita", onClick: navigateToRecipes },
  ];
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "15px 19px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ms" style={{ fontSize: 19, color: "var(--ember)" }}>bolt</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Ações Rápidas</span>
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
      showToast("Erro ao carregar dashboard", "err");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const navigateToStock = useCallback(() => navigate("/armazem"), [navigate]);
  const navigateToMealPlanner = useCallback(() => navigate("/planeamento"), [navigate]);
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
          <p className="text-3">A carregar dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da tua cozinha"
        actions={
          <button className="btn btn-primary" onClick={navigateToRecipes}>
            <span className="ms" style={{ fontSize: 14 }}>add</span>
            Nova Receita
          </button>
        }
      />

      <KpiRow stats={stats} navigateToStock={navigateToStock} navigateToShopping={navigateToShopping} />

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: 16, marginBottom: 16 }}>
        <AlertsPanel lowStock={lowStock} navigateToShopping={navigateToShopping} />
        <WeekPanel upcomingMeals={upcomingMeals} mealsThisWeek={stats?.meals_this_week ?? 0} navigateToMealPlanner={navigateToMealPlanner} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <PendingShoppingPanel pendingCount={stats?.pending_shopping_items ?? 0} navigateToShopping={navigateToShopping} />
        <RecentActivityPanel activity={activity} />
        <QuickActionsPanel
          navigateToMealPlanner={navigateToMealPlanner}
          navigateToShopping={navigateToShopping}
          navigateToStock={navigateToStock}
          navigateToRecipes={navigateToRecipes}
        />
      </div>
    </div>
  );
}
