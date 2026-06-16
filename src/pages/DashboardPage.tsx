import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

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

const DAY_SHORT: Record<string, string> = {
  monday: "Seg", tuesday: "Ter", wednesday: "Qua",
  thursday: "Qui", friday: "Sex", saturday: "Sáb", sunday: "Dom"
};

const MEAL_SHORT: Record<string, string> = {
  breakfast: "P.alm.", lunch: "Alm.", dinner: "Jnt.", snack: "Lanche"
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

const StatCard = ({ 
  label, value, subLabel, icon, color, bgColor, borderColor, onClick, children 
}: {
  label: string;
  value: string | number;
  subLabel: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", flexDirection: "column", gap: "var(--space-2)",
      padding: "var(--space-4)", background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-lg)", cursor: onClick ? "pointer" : "default", textAlign: "left",
      transition: "transform var(--fast), box-shadow var(--fast)"
    }}
    onMouseEnter={onClick ? (e: React.MouseEvent<HTMLButtonElement>) => { 
      e.currentTarget.style.transform = "translateY(-2px)"; 
      e.currentTarget.style.boxShadow = "var(--shadow-lg)"; 
    } : undefined}
    onMouseLeave={onClick ? (e: React.MouseEvent<HTMLButtonElement>) => { 
      e.currentTarget.style.transform = "none"; 
      e.currentTarget.style.boxShadow = "none"; 
    } : undefined}
    disabled={!onClick}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span className="text-3" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ color }}>{icon}</span>
    </div>
    <div className="mono" style={{ fontSize: "32px", fontWeight: 700, color, lineHeight: 1 }}>
      {children ?? value}
    </div>
    <span className="text-4" style={{ fontSize: "12px" }}>{subLabel}</span>
  </button>
);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit" });
};

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

const getActivityIcon = (type: string) => {
  switch (type) {
    case "recipe_created":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      );
    case "stock_updated":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
      );
    case "meal_planned":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      );
    case "shopping_purchased":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
          <path d="M2.05 2.05h2.5l2.5 11.5L8 21l8-1.5V5.5L4.55 3.5H3.55"/>
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      );
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "recipe_created": return "var(--brand)";
    case "stock_updated": return "var(--info)";
    case "meal_planned": return "var(--ok)";
    case "shopping_purchased": return "var(--warn)";
    default: return "var(--text-3)";
  }
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcomingMeals, setUpcomingMeals] = useState<MealPlanEntryWithRecipe[]>([]);
  const [lowStock, setLowStock] = useState<StockItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" | "warn" | "info" } | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err" | "warn" | "info" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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
          <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" aria-hidden="true">
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
      {/* Header */}
      <div className="content-header">
        <div>
          <h1 className="content-title">Dashboard</h1>
          <p className="content-sub mono">Visão geral da tua cozinha</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-secondary" onClick={navigateToRecipes}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Receita
          </button>
          <button className="btn btn-primary" onClick={navigateToMealPlanner}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Planeamento
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
          gap: "var(--space-4)" 
        }}>
          <StatCard
            label="Stock Baixo"
            value={stats?.low_stock_count ?? 0}
            subLabel="ingredientes"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="1.8" aria-hidden="true">
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
            }
            color="var(--warn)"
            bgColor="var(--warn-bg)"
            borderColor="var(--warn-border)"
            onClick={navigateToStock}
          />
          <StatCard
            label="A Expirar (&lt;7d)"
            value={stats?.expiring_soon_count ?? 0}
            subLabel="itens"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
            }
            color="var(--danger)"
            bgColor="var(--danger-bg)"
            borderColor="var(--danger-border)"
            onClick={navigateToStock}
          />
          <StatCard
            label="Refeiçẽs / 7 dias"
            value={stats?.meals_this_week ?? 0}
            subLabel="planeadas"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            }
            color="var(--ok)"
            bgColor="var(--ok-bg)"
            borderColor="var(--ok-border)"
            onClick={navigateToMealPlanner}
          />
          <StatCard
            label="Valor do Stock"
            value=""
            subLabel="total"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
            }
            color="var(--brand)"
            bgColor="var(--surface)"
            borderColor="var(--border)"
            children={<span className="mono" style={{ fontSize: "28px", fontWeight: 700, color: "var(--brand)" }}>€{(stats?.total_stock_value ?? 0).toFixed(2)}</span>}
          />
          <StatCard
            label="Receitas"
            value={stats?.total_recipes ?? 0}
            subLabel="cadastradas"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            }
            color="var(--text-1)"
            bgColor="var(--surface)"
            borderColor="var(--border)"
          />
          <StatCard
            label="Compras Pendentes"
            value={stats?.pending_shopping_items ?? 0}
            subLabel="itens"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.8" aria-hidden="true">
                <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2.5l2.5 11.5L8 21l8-1.5V5.5L4.55 3.5H3.55"/>
              </svg>
            }
            color="var(--text-1)"
            bgColor="var(--surface)"
            borderColor="var(--border)"
          />
        </div>
      </div>

      {/* Main Grid: Low Stock + Upcoming Meals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--space-5)", marginBottom: "var(--space-5)" }}>
        {/* Low Stock Items */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="content-header" style={{ marginBottom: 0, paddingBottom: "var(--space-3)" }}>
            <h2 className="content-title" style={{ fontSize: "16px" }}>Stock Baixo</h2>
            <button className="btn btn-ghost btn-sm" onClick={navigateToStock}>Ver tudo</button>
          </div>
          {lowStock.length === 0 ? (
            <div className="empty" style={{ minHeight: 160, padding: "var(--space-6)" }}>
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              <p className="empty-title">Stock OK</p>
              <p className="empty-desc">Todos os ingredientes estão acima do mínimo</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: "320px" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "50%" }}>Ingrediente</th>
                    <th className="mono" style={{ width: "20%" }}>Actual</th>
                    <th className="mono" style={{ width: "20%" }}>Mínimo</th>
                    <th style={{ width: "10%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.slice(0, 8).map(item => {
                    const isOut = item.quantity <= 0;
                    const isLow = item.quantity > 0 && item.quantity <= item.min_quantity;
                    return (
                      <tr key={item.id} style={{ cursor: "pointer" }} onClick={navigateToStock}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                            <span style={{ fontWeight: isOut || isLow ? 600 : 400 }}>{item.ingredient_name}</span>
                            <span className="text-4 mono" style={{ fontSize: "11px" }}>{UNIT_LABELS[item.ingredient_unit] ?? item.ingredient_unit}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ color: isOut ? "var(--danger)" : isLow ? "var(--warn)" : "var(--text-1)" }}>
                          {item.quantity}
                        </td>
                        <td className="mono">{item.min_quantity}</td>
                        <td>
                          <span className={isOut ? "status danger" : isLow ? "status warn" : "status ok"}>
                            {isOut ? "Esgotado" : isLow ? "Baixo" : "OK"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming Meals */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="content-header" style={{ marginBottom: 0, paddingBottom: "var(--space-3)" }}>
            <h2 className="content-title" style={{ fontSize: "16px" }}>Próximas Refeições (7 dias)</h2>
            <button className="btn btn-ghost btn-sm" onClick={navigateToMealPlanner}>Ver planeamento</button>
          </div>
          {upcomingMeals.length === 0 ? (
            <div className="empty" style={{ minHeight: 160, padding: "var(--space-6)" }}>
              <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p className="empty-title">Sem refeições planeadas</p>
              <p className="empty-desc">Cria um plano de refeições para a semana</p>
              <button className="btn btn-primary" onClick={navigateToMealPlanner}>Criar Plano</button>
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: "320px" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "15%" }}>Dia</th>
                    <th style={{ width: "15%" }}>Refeição</th>
                    <th style={{ width: "55%" }}>Receita</th>
                    <th className="mono" style={{ width: "15%" }}>Porções</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingMeals.slice(0, 8).map(meal => (
                    <tr key={meal.id} style={{ cursor: "pointer" }} onClick={navigateToMealPlanner}>
                      <td>
                        <span className="mono text-4" style={{ fontSize: "11px" }}>
                          {DAY_SHORT[meal.day_of_week]} {formatDate(meal.planned_date).split(" ")[1]}
                        </span>
                      </td>
                      <td>
                        <span className="text-4" style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--brand)" }}>
                          {MEAL_SHORT[meal.meal_type]}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{meal.recipe_name}</td>
                      <td className="mono">{meal.portions}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="content-header" style={{ marginBottom: 0, paddingBottom: "var(--space-3)" }}>
          <h2 className="content-title" style={{ fontSize: "16px" }}>Actividade Recente</h2>
        </div>
        {activity.length === 0 ? (
          <div className="empty" style={{ minHeight: 120, padding: "var(--space-6)" }}>
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="empty-title">Sem actividade recente</p>
            <p className="empty-desc">As tuas acções aparecerão aqui</p>
          </div>
        ) : (
          <div style={{ padding: "var(--space-2) var(--space-4) var(--space-4)", maxHeight: "300px", overflowY: "auto" }}>
            {activity.map(item => (
              <div key={item.id} style={{ 
                display: "flex", alignItems: "flex-start", gap: "var(--space-3)", 
                padding: "var(--space-2) 0", borderBottom: "1px solid var(--border-subtle)" 
              }}>
                <div style={{ 
                  width: 36, height: 36, borderRadius: "var(--radius)", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${getActivityColor(item.activity_type)}15`,
                  color: getActivityColor(item.activity_type),
                  flexShrink: 0,
                }}>
                  {getActivityIcon(item.activity_type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13.5px", color: "var(--text-1)", marginBottom: 2 }}>{item.description}</p>
                  <p className="text-4 mono" style={{ fontSize: "11px" }}>{formatRelativeTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ padding: "var(--space-4)" }}>
        <h2 className="text-2" style={{ marginBottom: "var(--space-4)" }}>Ações Rápidas</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)" }}>
          <button className="btn btn-primary btn-lg" onClick={navigateToMealPlanner} style={{ height: "56px", flexDirection: "column", gap: "var(--space-1)", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span style={{ fontSize: "13px" }}>Criar Planeamento Semanal</span>
          </button>
          <button className="btn btn-secondary btn-lg" onClick={navigateToShopping} style={{ height: "56px", flexDirection: "column", gap: "var(--space-1)", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2.5l2.5 11.5L8 21l8-1.5V5.5L4.55 3.5H3.55"/>
            </svg>
            <span style={{ fontSize: "13px" }}>Nova Lista de Compras</span>
          </button>
          <button className="btn btn-secondary btn-lg" onClick={navigateToStock} style={{ height: "56px", flexDirection: "column", gap: "var(--space-1)", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            <span style={{ fontSize: "13px" }}>Verificar Stock</span>
          </button>
          <button className="btn btn-ghost btn-lg" onClick={navigateToRecipes} style={{ height: "56px", flexDirection: "column", gap: "var(--space-1)", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span style={{ fontSize: "13px" }}>Nova Receita</span>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`} role="alert" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {toast.type === "ok" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>}
          {toast.type === "err" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
          {toast.type === "warn" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          {toast.type === "info" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}