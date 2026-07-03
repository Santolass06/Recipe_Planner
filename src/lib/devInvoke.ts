import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Dev-only fallback for `invoke`. Real Tauri builds (or any environment where
 * the Tauri IPC bridge is present) always go straight to the real bridge.
 * Outside Tauri (`npm run vite` in a plain browser, used to preview the UI
 * during redesign work) every command instead resolves to seed/empty data so
 * pages render instead of throwing on the missing `window.__TAURI_INTERNALS__`.
 */

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const now = new Date().toISOString();

function ingredient(id: number, name: string, unit: string, price: number, category_id: number, favorite = false) {
  return { id, name, unit, price_per_unit: price, category_id, favorite, created_at: now, updated_at: now };
}

const ingredients = [
  ingredient(1, "Alho", "piece", 6.9, 1, true),
  ingredient(2, "Cebola", "kilogram", 0.95, 1, true),
  ingredient(3, "Tomate maduro", "kilogram", 1.8, 1, false),
  ingredient(4, "Batata", "kilogram", 0.8, 1, false),
  ingredient(5, "Azeite virgem extra", "liter", 8.5, 2, true),
  ingredient(6, "Farinha T55", "kilogram", 0.7, 2, false),
  ingredient(7, "Sal fino", "kilogram", 0.45, 2, false),
  ingredient(8, "Manteiga", "kilogram", 8.7, 3, true),
  ingredient(9, "Natas 35%", "liter", 3.05, 3, false),
  ingredient(10, "Ovos M", "piece", 0.22, 3, true),
  ingredient(11, "Parmesão", "kilogram", 17.0, 3, false),
  ingredient(12, "Bacalhau demolhado", "kilogram", 10.4, 4, true),
  ingredient(13, "Camarão descascado", "kilogram", 23.9, 4, false),
  ingredient(14, "Vinho branco", "liter", 4.2, 5, false),
  ingredient(15, "Salsa fresca", "gram", 1.2, 6, false),
  ingredient(16, "Arroz arbóreo", "kilogram", 2.7, 2, false),
];

const stock = [
  { id: 1, ingredient_id: 1, ingredient_name: "Alho", ingredient_unit: "piece", quantity: 0.4, min_quantity: 0.3, price_per_unit: 6.9, updated_at: now },
  { id: 2, ingredient_id: 2, ingredient_name: "Cebola", ingredient_unit: "kilogram", quantity: 8, min_quantity: 3, price_per_unit: 0.95, updated_at: now },
  { id: 3, ingredient_id: 3, ingredient_name: "Tomate maduro", ingredient_unit: "kilogram", quantity: 2, min_quantity: 2, price_per_unit: 1.8, updated_at: now },
  { id: 4, ingredient_id: 6, ingredient_name: "Farinha T55", ingredient_unit: "kilogram", quantity: 6, min_quantity: 8, price_per_unit: 0.7, updated_at: now },
  { id: 5, ingredient_id: 8, ingredient_name: "Manteiga", ingredient_unit: "kilogram", quantity: 0.25, min_quantity: 1, price_per_unit: 8.7, updated_at: now },
  { id: 6, ingredient_id: 9, ingredient_name: "Natas 35%", ingredient_unit: "liter", quantity: 1, min_quantity: 2, price_per_unit: 3.05, updated_at: now },
  { id: 7, ingredient_id: 13, ingredient_name: "Camarão descascado", ingredient_unit: "kilogram", quantity: 0, min_quantity: 0.5, price_per_unit: 23.9, updated_at: now },
  { id: 8, ingredient_id: 14, ingredient_name: "Vinho branco", ingredient_unit: "liter", quantity: 1, min_quantity: 3, price_per_unit: 4.2, updated_at: now },
];

function recipe(id: number, name: string, category: string, portions: number, prep: number, cook: number, tags: string[], favorite = false) {
  return {
    id, name, category, portions, instructions: "", favorite,
    prep_time_minutes: prep, cook_time_minutes: cook,
    tags: JSON.stringify(tags), image_path: null, created_at: now, updated_at: now,
  };
}

const recipes = [
  recipe(1, "Risotto de camarão", "Pratos principais", 4, 25, 20, ["Marisco", "Cremoso", "Sazonal"], true),
  recipe(2, "Bacalhau à Brás", "Pratos principais", 6, 20, 20, ["Peixe"]),
  recipe(3, "Massa alho e azeite", "Massas", 4, 10, 10, ["Vegetariano"]),
  recipe(4, "Sopa de legumes", "Sopas", 8, 15, 20, ["Vegan"]),
  recipe(5, "Pastéis de nata", "Sobremesas", 24, 30, 30, ["Doce"]),
  recipe(6, "Pão caseiro", "Padaria", 12, 30, 150, ["Fermento"]),
];

const suppliers = [
  { id: 1, name: "Talho Central", contact: "Sr. Fonseca · 912 004 118", notes: "Carnes & charcutaria", created_at: now, updated_at: now },
  { id: 2, name: "Peixaria Doca", contact: "Marta · 964 220 771", notes: "Peixe & marisco", created_at: now, updated_at: now },
  { id: 3, name: "Hortas do Vale", contact: "João · 933 118 900", notes: "Frutas & legumes", created_at: now, updated_at: now },
  { id: 4, name: "Distribuição Sá", contact: "geral@sa.pt · 220 118 004", notes: "Mercearia & laticínios", created_at: now, updated_at: now },
];

const dashboardStats = {
  low_stock_count: 5, expiring_soon_count: 3, meals_this_week: 6,
  total_stock_value: 3284, total_recipes: recipes.length, total_ingredients: ingredients.length,
  pending_shopping_items: 12,
};

const activity = [
  { id: 1, activity_type: "shopping_purchased", description: "Recibo importado · Talho Central (14 itens)", entity_id: null, entity_type: null, timestamp: now },
  { id: 2, activity_type: "recipe_created", description: "Custo atualizado · Risotto de camarão", entity_id: 1, entity_type: "recipe", timestamp: now },
  { id: 3, activity_type: "stock_updated", description: "Stock ajustado · Farinha T55 −2 kg", entity_id: 6, entity_type: "ingredient", timestamp: now },
  { id: 4, activity_type: "recipe_created", description: "Nova receita · Sopa de legumes", entity_id: 4, entity_type: "recipe", timestamp: now },
];

const upcomingMeals = [
  { id: 1, meal_plan_id: 1, recipe_id: 2, recipe_name: "Bacalhau à Brás", day_of_week: "monday", meal_type: "lunch", portions: 12, planned_date: now },
  { id: 2, meal_plan_id: 1, recipe_id: 1, recipe_name: "Risotto de camarão", day_of_week: "tuesday", meal_type: "dinner", portions: 10, planned_date: now },
  { id: 3, meal_plan_id: 1, recipe_id: 3, recipe_name: "Massa alho e azeite", day_of_week: "wednesday", meal_type: "dinner", portions: 14, planned_date: now },
];

const settingsMap = { language: "pt", theme: "light", density: "cozy" };

const priceQuotes = [
  { id: 1, ingredient_id: 13, ingredient_name: "Camarão descascado", ingredient_unit: "kilogram", supplier: "Peixaria Doca", price_per_unit: 23.9, valid_from: null, valid_to: null, is_promo: false, created_at: now },
  { id: 2, ingredient_id: 12, ingredient_name: "Bacalhau demolhado", ingredient_unit: "kilogram", supplier: "Peixaria Doca", price_per_unit: 10.4, valid_from: null, valid_to: null, is_promo: false, created_at: now },
  { id: 3, ingredient_id: 8, ingredient_name: "Manteiga", ingredient_unit: "kilogram", supplier: "Distribuição Sá", price_per_unit: 8.7, valid_from: null, valid_to: null, is_promo: false, created_at: now },
];

/** command name -> canned response (or function of args) */
const fixtures: Record<string, unknown | ((args: unknown) => unknown)> = {
  dashboard_stats: dashboardStats,
  dashboard_recent_activity: activity,
  dashboard_upcoming_meals: upcomingMeals,
  dashboard_low_stock: stock.filter((s) => s.quantity <= s.min_quantity),
  ingredients_list: ingredients,
  stock_list: stock,
  recipes_list: recipes,
  suppliers_list: suppliers,
  shopping_lists_list: [],
  meal_plans_list: [],
  price_quotes_all: priceQuotes,
  settings_get_all: settingsMap,
};

const noopCommandPrefixes = [
  "_create", "_update", "_delete", "_upsert", "_add", "_remove", "_toggle",
  "_set", "_reset", "_clear", "_seed", "_import", "_export", "_upload", "open_url",
];

function fallbackFor(cmd: string): unknown {
  if (cmd in fixtures) {
    const f = fixtures[cmd];
    return typeof f === "function" ? (f as (a: unknown) => unknown)(undefined) : structuredClone(f);
  }
  if (cmd.endsWith("_list") || cmd.endsWith("_all")) return [];
  if (noopCommandPrefixes.some((suffix) => cmd.includes(suffix))) return undefined;
  if (cmd.startsWith("report_")) return {};
  return undefined;
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) return tauriInvoke<T>(cmd, args);
  if (import.meta.env.DEV) {
    console.debug(`[devInvoke] ${cmd}`, args ?? "");
    return fallbackFor(cmd) as T;
  }
  return tauriInvoke<T>(cmd, args);
}
