//! Tauri commands and app state
//!
//! This crate provides all Tauri command handlers using mise-core directly.
//! No repository traits, no async-trait — just direct libSQL calls.

use mise_core::*;
use libsql::Database;
use tauri::Manager;
use tauri::path::BaseDirectory;
use chrono::{DateTime, Utc};

/// Whether the desktop environment prefers a dark color scheme.
///
/// WebKitGTK's `prefers-color-scheme` CSS media feature and GTK3's
/// `gtk-application-prefer-dark-theme` setting don't follow modern
/// GNOME's dark-mode preference (`org.gnome.desktop.interface
/// color-scheme`, used by GNOME 42+) — both default to light regardless
/// of the actual desktop setting, unless something explicitly reads and
/// applies it. This shells out to `gsettings` (present on any GNOME-based
/// desktop) instead of relying on those unreliable defaults.
#[cfg(target_os = "linux")]
fn system_prefers_dark() -> bool {
    std::process::Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "color-scheme"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("dark"))
        .unwrap_or(false)
}

#[cfg(not(target_os = "linux"))]
fn system_prefers_dark() -> bool {
    false
}

/// Sync GTK's own dark-theme preference so native dialogs (e.g. the file
/// picker used by the receipt scanner) render in the same theme as the
/// desktop and the app itself, instead of always opening in light mode.
#[cfg(target_os = "linux")]
fn apply_native_theme() {
    if system_prefers_dark() {
        if let Some(settings) = gtk::Settings::default() {
            gtk::prelude::GtkSettingsExt::set_gtk_application_prefer_dark_theme(&settings, true);
        }
    }
}

#[cfg(not(target_os = "linux"))]
fn apply_native_theme() {}

/// Database connection wrapper for Tauri state
pub struct AppDb {
    pub db: Database,
}

impl AppDb {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    // Ingredients
    pub async fn ingredients_list(&self) -> Result<Vec<Ingredient>, String> {
        mise_core::db::ingredients_list(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn create_ingredient(&self, input: IngredientInput) -> Result<Ingredient, String> {
        mise_core::db::create_ingredient(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn update_ingredient(&self, id: i64, input: IngredientInput) -> Result<Ingredient, String> {
        mise_core::db::update_ingredient(&self.db, id, input).await.map_err(|e| e.to_string())
    }

    pub async fn delete_ingredient(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_ingredient(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn toggle_ingredient_favorite(&self, id: i64) -> Result<Ingredient, String> {
        mise_core::db::toggle_ingredient_favorite(&self.db, id).await.map_err(|e| e.to_string())
    }

    // Recipes
    pub async fn recipes_list(&self) -> Result<Vec<RecipeWithIngredients>, String> {
        mise_core::db::recipes_list(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn recipes_paginated(&self, page: u32, per_page: u32) -> Result<Paginated<Recipe>, String> {
        mise_core::db::recipes_paginated(&self.db, page, per_page).await.map_err(|e| e.to_string())
    }

    pub async fn get_recipe(&self, id: i64) -> Result<Recipe, String> {
        mise_core::db::get_recipe(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn create_recipe(&self, input: RecipeInput) -> Result<RecipeWithIngredients, String> {
        mise_core::db::create_recipe(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn update_recipe(&self, id: i64, input: RecipeInput) -> Result<RecipeWithIngredients, String> {
        mise_core::db::update_recipe(&self.db, id, input).await.map_err(|e| e.to_string())
    }

    pub async fn delete_recipe(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_recipe(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn toggle_recipe_favorite(&self, id: i64) -> Result<Recipe, String> {
        mise_core::db::toggle_recipe_favorite(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn clone_recipe(&self, id: i64) -> Result<RecipeWithIngredients, String> {
        mise_core::db::clone_recipe(&self.db, id).await.map_err(|e| e.to_string())
    }

    // Stock
    pub async fn stock_list(&self) -> Result<Vec<StockItem>, String> {
        mise_core::db::stock_list(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn get_stock(&self, ingredient_id: i64) -> Result<StockItem, String> {
        mise_core::db::get_stock(&self.db, ingredient_id).await.map_err(|e| e.to_string())
    }

    pub async fn upsert_stock(&self, input: StockInput) -> Result<StockItem, String> {
        mise_core::db::upsert_stock(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn update_stock_quantity(&self, ingredient_id: i64, quantity: f64) -> Result<StockItem, String> {
        mise_core::db::update_stock_quantity(&self.db, ingredient_id, quantity).await.map_err(|e| e.to_string())
    }

    pub async fn delete_stock(&self, ingredient_id: i64) -> Result<(), String> {
        mise_core::db::delete_stock(&self.db, ingredient_id).await.map_err(|e| e.to_string())
    }

    // Shopping
    pub async fn shopping_lists_list(&self) -> Result<Vec<ShoppingList>, String> {
        mise_core::db::shopping_lists_list(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn get_shopping_list(&self, id: i64) -> Result<ShoppingList, String> {
        mise_core::db::get_shopping_list(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn create_shopping_list(&self, name: String, items: Vec<ShoppingItem>) -> Result<ShoppingList, String> {
        mise_core::db::create_shopping_list(&self.db, name, items).await.map_err(|e| e.to_string())
    }

    pub async fn create_shopping_list_from_recipes(&self, recipe_ids: Vec<i64>, portions_multiplier: u32) -> Result<ShoppingList, String> {
        mise_core::db::create_shopping_list_from_recipes(&self.db, recipe_ids, portions_multiplier).await.map_err(|e| e.to_string())
    }

    pub async fn update_shopping_list_item(&self, list_id: i64, item_id: i64, purchased: bool) -> Result<ShoppingList, String> {
        mise_core::db::update_shopping_list_item(&self.db, list_id, item_id, purchased).await.map_err(|e| e.to_string())
    }

    pub async fn delete_shopping_list(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_shopping_list(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn update_shopping_list(&self, id: i64, name: String) -> Result<ShoppingList, String> {
        mise_core::db::update_shopping_list(&self.db, id, name).await.map_err(|e| e.to_string())
    }

    pub async fn shopping_list_add_item(&self, list_id: i64, input: ShoppingItemInput) -> Result<ShoppingItem, String> {
        mise_core::db::shopping_list_add_item(&self.db, list_id, input).await.map_err(|e| e.to_string())
    }

    pub async fn shopping_list_update_item(&self, list_id: i64, item_id: i64, input: ShoppingItemInput) -> Result<ShoppingItem, String> {
        mise_core::db::shopping_list_update_item(&self.db, list_id, item_id, input).await.map_err(|e| e.to_string())
    }

    pub async fn shopping_list_toggle_item(&self, list_id: i64, item_id: i64, purchased: bool) -> Result<ShoppingItem, String> {
        mise_core::db::shopping_list_toggle_item(&self.db, list_id, item_id, purchased).await.map_err(|e| e.to_string())
    }

    pub async fn shopping_list_remove_item(&self, list_id: i64, item_id: i64) -> Result<(), String> {
        mise_core::db::shopping_list_remove_item(&self.db, list_id, item_id).await.map_err(|e| e.to_string())
    }

    pub async fn shopping_list_reorder_items(&self, list_id: i64, item_ids: Vec<i64>) -> Result<Vec<ShoppingItem>, String> {
        mise_core::db::shopping_list_reorder_items(&self.db, list_id, item_ids).await.map_err(|e| e.to_string())
    }

    pub async fn shopping_list_group_by_category(&self, list_id: i64) -> Result<std::collections::HashMap<String, Vec<ShoppingItem>>, String> {
        mise_core::db::shopping_list_group_by_category(&self.db, list_id).await.map_err(|e| e.to_string())
    }

    pub async fn shopping_list_clear_purchased(&self, list_id: i64) -> Result<ShoppingList, String> {
        mise_core::db::shopping_list_clear_purchased(&self.db, list_id).await.map_err(|e| e.to_string())
    }

    // Suggester
    pub async fn suggest_recipes(&self) -> Result<Vec<SuggestedRecipe>, String> {
        mise_core::db::suggest_recipes(&self.db).await.map_err(|e| e.to_string())
    }

    // Cost
    pub async fn calculate_cost(&self, recipe_id: i64) -> Result<CostBreakdown, String> {
        mise_core::db::calculate_cost(&self.db, recipe_id).await.map_err(|e| e.to_string())
    }

    pub async fn analyze_cost(&self, recipe_id: i64, margin_percent: f64) -> Result<CostBreakdown, String> {
        mise_core::db::analyze_cost(&self.db, recipe_id, margin_percent).await.map_err(|e| e.to_string())
    }

    // Settings
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        mise_core::db::get_setting(&self.db, key).await.map_err(|e| e.to_string())
    }

    pub async fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        mise_core::db::set_setting(&self.db, key, value).await.map_err(|e| e.to_string())
    }

    pub async fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>, String> {
        mise_core::db::get_all_settings(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn reset_settings(&self) -> Result<(), String> {
        mise_core::db::reset_to_defaults(&self.db).await.map_err(|e| e.to_string())
    }

    #[cfg(debug_assertions)]
    pub async fn delete_all_data(&self) -> Result<(), String> {
        mise_core::db::delete_all_data(&self.db).await.map_err(|e| e.to_string())
    }

    #[cfg(debug_assertions)]
    pub async fn seed_demo_data(&self) -> Result<(), String> {
        mise_core::db::seed_demo_data(&self.db).await.map_err(|e| e.to_string())
    }

    // Categories
    pub async fn categories_list(&self, kind: Option<&str>) -> Result<Vec<Category>, String> {
        mise_core::db::categories_list(&self.db, kind).await.map_err(|e| e.to_string())
    }

    pub async fn create_category(&self, input: CategoryInput) -> Result<Category, String> {
        mise_core::db::create_category(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn update_category(&self, id: i64, input: CategoryInput) -> Result<Category, String> {
        mise_core::db::update_category(&self.db, id, input).await.map_err(|e| e.to_string())
    }

    pub async fn delete_category(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_category(&self.db, id).await.map_err(|e| e.to_string())
    }

    // Suppliers
    pub async fn suppliers_list(&self) -> Result<Vec<Supplier>, String> {
        mise_core::db::suppliers_list(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn supplier_get(&self, id: i64) -> Result<Supplier, String> {
        mise_core::db::supplier_get(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn create_supplier(&self, input: SupplierInput) -> Result<Supplier, String> {
        mise_core::db::create_supplier(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn update_supplier(&self, id: i64, input: SupplierInput) -> Result<Supplier, String> {
        mise_core::db::update_supplier(&self.db, id, input).await.map_err(|e| e.to_string())
    }

    pub async fn delete_supplier(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_supplier(&self.db, id).await.map_err(|e| e.to_string())
    }

    // Price quotes
    pub async fn price_quotes_list(&self, ingredient_id: i64) -> Result<Vec<PriceQuote>, String> {
        mise_core::db::price_quotes_list(&self.db, ingredient_id).await.map_err(|e| e.to_string())
    }

    pub async fn price_quotes_all(&self) -> Result<Vec<PriceQuoteWithIngredient>, String> {
        mise_core::db::price_quotes_all(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn price_quotes_stats(&self) -> Result<Vec<PriceQuoteStats>, String> {
        mise_core::db::price_quotes_stats(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn create_price_quote(&self, input: PriceQuoteInput) -> Result<PriceQuote, String> {
        mise_core::db::create_price_quote(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn update_price_quote(&self, id: i64, input: PriceQuoteInput) -> Result<PriceQuote, String> {
        mise_core::db::update_price_quote(&self.db, id, input).await.map_err(|e| e.to_string())
    }

    pub async fn delete_price_quote(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_price_quote(&self.db, id).await.map_err(|e| e.to_string())
    }

    // Import/Export
    pub async fn export_data(&self) -> Result<ImportData, String> {
        mise_core::db::export_data(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn import_data(&self, data: ImportData) -> Result<ImportResult, String> {
        mise_core::db::import_data(&self.db, data).await.map_err(|e| e.to_string())
    }

    // Meal Planner
    pub async fn meal_plans_list(&self) -> Result<Vec<MealPlan>, String> {
        mise_core::db::list_meal_plans(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn meal_plan_get(&self, id: i64) -> Result<MealPlanWithEntries, String> {
        mise_core::db::get_meal_plan(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn meal_plan_create(&self, input: MealPlanInput) -> Result<MealPlan, String> {
        mise_core::db::create_meal_plan(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn meal_plan_update(&self, id: i64, input: MealPlanInput) -> Result<MealPlan, String> {
        mise_core::db::update_meal_plan(&self.db, id, input).await.map_err(|e| e.to_string())
    }

    pub async fn meal_plan_delete(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_meal_plan(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn meal_entry_add(&self, meal_plan_id: i64, input: MealEntryInput) -> Result<MealPlanEntry, String> {
        mise_core::db::add_meal_entry(&self.db, meal_plan_id, input).await.map_err(|e| e.to_string())
    }

    pub async fn meal_entry_update(&self, id: i64, input: MealEntryInput) -> Result<MealPlanEntry, String> {
        mise_core::db::update_meal_entry(&self.db, id, input).await.map_err(|e| e.to_string())
    }

    pub async fn meal_entry_delete(&self, id: i64) -> Result<(), String> {
        mise_core::db::delete_meal_entry(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn meal_plan_generate_shopping_list(&self, plan_id: i64, portions_multiplier: u32) -> Result<MealPlanShoppingList, String> {
        mise_core::db::generate_shopping_list_from_meal_plan(&self.db, plan_id, portions_multiplier).await.map_err(|e| e.to_string())
    }

    // Dashboard
    pub async fn dashboard_stats(&self) -> Result<DashboardStats, String> {
        mise_core::db::get_dashboard_stats(&self.db).await.map_err(|e| e.to_string())
    }

    pub async fn dashboard_recent_activity(&self, limit: u32) -> Result<Vec<ActivityItem>, String> {
        mise_core::db::get_recent_activity(&self.db, limit).await.map_err(|e| e.to_string())
    }

    pub async fn dashboard_upcoming_meals(&self, days: u32) -> Result<Vec<MealPlanEntryWithRecipe>, String> {
        mise_core::db::get_upcoming_meals(&self.db, days).await.map_err(|e| e.to_string())
    }

    pub async fn dashboard_low_stock(&self, threshold: f64) -> Result<Vec<StockItemWithIngredient>, String> {
        mise_core::db::get_low_stock_ingredients(&self.db, threshold).await.map_err(|e| e.to_string())
    }

    // Calendar
    pub async fn meal_plan_entries_by_date_range(
        &self,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> Result<Vec<MealPlanEntryWithRecipe>, String> {
        mise_core::db::get_meal_plan_entries_by_date_range(&self.db, start_date, end_date)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn meal_plan_entries_by_month(
        &self,
        year: i32,
        month: u32,
    ) -> Result<Vec<MealPlanEntryWithRecipe>, String> {
        mise_core::db::get_meal_plan_entries_by_month(&self.db, year, month)
            .await
            .map_err(|e| e.to_string())
    }

    // Reports
    pub async fn get_cost_report(&self, days: u32) -> Result<CostReport, String> {
        mise_core::db::get_cost_report(&self.db, days).await.map_err(|e| e.to_string())
    }

    pub async fn get_waste_report(&self, days: u32) -> Result<WasteReport, String> {
        mise_core::db::get_waste_report(&self.db, days).await.map_err(|e| e.to_string())
    }

    pub async fn get_stock_trends(&self, days: u32) -> Result<Vec<StockSnapshot>, String> {
        mise_core::db::get_stock_trends(&self.db, days).await.map_err(|e| e.to_string())
    }

    pub async fn get_meal_stats(&self, days: u32) -> Result<MealStats, String> {
        mise_core::db::get_meal_stats(&self.db, days).await.map_err(|e| e.to_string())
    }

    pub async fn get_price_trends(&self, ingredient_id: i64, days: u32) -> Result<Vec<PricePoint>, String> {
        mise_core::db::get_price_trends(&self.db, ingredient_id, days).await.map_err(|e| e.to_string())
    }

    // ===== IMAGES =====
    pub async fn image_upload(&self, input: ImageUploadInput) -> Result<Image, String> {
        mise_core::db::image_upload(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn image_delete(&self, id: i64) -> Result<(), String> {
        mise_core::db::image_delete(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn image_set_primary(&self, id: i64) -> Result<Image, String> {
        mise_core::db::image_set_primary(&self.db, id).await.map_err(|e| e.to_string())
    }

    pub async fn image_get(&self, entity_type: ImageEntityType, entity_id: i64) -> Result<Vec<Image>, String> {
        mise_core::db::image_get(&self.db, entity_type, entity_id).await.map_err(|e| e.to_string())
    }

    pub async fn image_search_proxy(&self, query: String, per_page: Option<u32>) -> Result<Vec<ProxyImageResult>, String> {
        mise_core::db::image_search_proxy(query, per_page).await.map_err(|e| e.to_string())
    }

    // ===== STOCK PURCHASES =====
    pub async fn stock_purchase_add(&self, input: StockPurchaseInput) -> Result<StockPurchase, String> {
        mise_core::db::stock_purchase_add(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn stock_purchases_list(&self, ingredient_id: i64) -> Result<Vec<StockPurchase>, String> {
        mise_core::db::stock_purchases_list(&self.db, ingredient_id).await.map_err(|e| e.to_string())
    }

    pub async fn stock_purchase_delete(&self, id: i64) -> Result<(), String> {
        mise_core::db::stock_purchase_delete(&self.db, id).await.map_err(|e| e.to_string())
    }

    // ===== RECEIPT OCR =====
    pub async fn receipt_scan(&self, input: ReceiptScanInput) -> Result<ReceiptParseResult, String> {
        mise_core::db::receipt_scan(&self.db, input).await.map_err(|e| e.to_string())
    }

    pub async fn receipt_parse(&self, raw_text: String) -> Result<Vec<ParsedReceiptItem>, String> {
        mise_core::db::receipt_parse(&self.db, raw_text).await.map_err(|e| e.to_string())
    }

    pub async fn receipt_confirm(&self, input: ReceiptConfirmInput) -> Result<Vec<StockPurchase>, String> {
        mise_core::db::receipt_confirm(&self.db, input).await.map_err(|e| e.to_string())
    }
}

pub mod commands {
    use super::*;

    /// Returns "dark" or "light" based on the desktop's actual color
    /// scheme preference (see `system_prefers_dark`), for the frontend's
    /// "system" theme option — more reliable than the CSS
    /// `prefers-color-scheme` media query under WebKitGTK.
    #[tauri::command]
    pub async fn get_system_theme() -> Result<String, String> {
        Ok(if system_prefers_dark() { "dark".to_string() } else { "light".to_string() })
    }

    // Ingredients
    #[tauri::command]
    pub async fn ingredients_list(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<Ingredient>, String> {
        db.ingredients_list().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn ingredient_create(
        db: tauri::State<'_, crate::AppDb>,
        input: IngredientInput,
    ) -> Result<Ingredient, String> {
        db.create_ingredient(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn ingredient_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        input: IngredientInput,
    ) -> Result<Ingredient, String> {
        db.update_ingredient(id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn ingredient_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.delete_ingredient(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn ingredient_toggle_favorite(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<Ingredient, String> {
        db.toggle_ingredient_favorite(id).await.map_err(|e| e.to_string())
    }

    // Recipes
    #[tauri::command]
    pub async fn recipes_list(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<RecipeWithIngredients>, String> {
        db.recipes_list().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn recipes_paginated(
        db: tauri::State<'_, crate::AppDb>,
        page: u32,
        per_page: u32,
    ) -> Result<Paginated<Recipe>, String> {
        db.recipes_paginated(page, per_page).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn recipe_get(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<Recipe, String> {
        db.get_recipe(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn recipe_create(
        db: tauri::State<'_, crate::AppDb>,
        input: RecipeInput,
    ) -> Result<RecipeWithIngredients, String> {
        db.create_recipe(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn recipe_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        input: RecipeInput,
    ) -> Result<RecipeWithIngredients, String> {
        db.update_recipe(id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn recipe_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.delete_recipe(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn recipe_toggle_favorite(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<Recipe, String> {
        db.toggle_recipe_favorite(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn recipe_clone(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<RecipeWithIngredients, String> {
        db.clone_recipe(id).await.map_err(|e| e.to_string())
    }

    // Stock
    #[tauri::command]
    pub async fn stock_list(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<StockItem>, String> {
        db.stock_list().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn stock_get(
        db: tauri::State<'_, crate::AppDb>,
        ingredient_id: i64,
    ) -> Result<StockItem, String> {
        db.get_stock(ingredient_id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn stock_upsert(
        db: tauri::State<'_, crate::AppDb>,
        input: StockInput,
    ) -> Result<StockItem, String> {
        db.upsert_stock(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn stock_update_quantity(
        db: tauri::State<'_, crate::AppDb>,
        ingredient_id: i64,
        quantity: f64,
    ) -> Result<StockItem, String> {
        db.update_stock_quantity(ingredient_id, quantity).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn stock_delete(
        db: tauri::State<'_, crate::AppDb>,
        ingredient_id: i64,
    ) -> Result<(), String> {
        db.delete_stock(ingredient_id).await.map_err(|e| e.to_string())
    }

    // Shopping
    #[tauri::command]
    pub async fn shopping_lists_list(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<ShoppingList>, String> {
        db.shopping_lists_list().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_get(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<ShoppingList, String> {
        db.get_shopping_list(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_create(
        db: tauri::State<'_, crate::AppDb>,
        name: String,
        items: Vec<ShoppingItem>,
    ) -> Result<ShoppingList, String> {
        db.create_shopping_list(name, items).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_create_from_recipes(
        db: tauri::State<'_, crate::AppDb>,
        recipe_ids: Vec<i64>,
        portions_multiplier: u32,
    ) -> Result<ShoppingList, String> {
        db.create_shopping_list_from_recipes(recipe_ids, portions_multiplier)
            .await
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_update_item(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
        item_id: i64,
        purchased: bool,
    ) -> Result<ShoppingList, String> {
        db.update_shopping_list_item(list_id, item_id, purchased)
            .await
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.delete_shopping_list(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        name: String,
    ) -> Result<ShoppingList, String> {
        db.update_shopping_list(id, name).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_add_item(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
        input: ShoppingItemInput,
    ) -> Result<ShoppingItem, String> {
        db.shopping_list_add_item(list_id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_update_item_full(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
        item_id: i64,
        input: ShoppingItemInput,
    ) -> Result<ShoppingItem, String> {
        db.shopping_list_update_item(list_id, item_id, input)
            .await
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_toggle_item(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
        item_id: i64,
        purchased: bool,
    ) -> Result<ShoppingItem, String> {
        db.shopping_list_toggle_item(list_id, item_id, purchased)
            .await
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_remove_item(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
        item_id: i64,
    ) -> Result<(), String> {
        db.shopping_list_remove_item(list_id, item_id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_reorder_items(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
        item_ids: Vec<i64>,
    ) -> Result<Vec<ShoppingItem>, String> {
        db.shopping_list_reorder_items(list_id, item_ids)
            .await
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_clear_purchased(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
    ) -> Result<ShoppingList, String> {
        db.shopping_list_clear_purchased(list_id)
            .await
            .map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn shopping_list_group_by_category(
        db: tauri::State<'_, crate::AppDb>,
        list_id: i64,
    ) -> Result<std::collections::HashMap<String, Vec<ShoppingItem>>, String> {
        db.shopping_list_group_by_category(list_id)
            .await
            .map_err(|e| e.to_string())
    }

    // Suggester
    #[tauri::command]
    pub async fn suggester_suggest(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<SuggestedRecipe>, String> {
        db.suggest_recipes().await.map_err(|e| e.to_string())
    }

    // Cost
    #[tauri::command]
    pub async fn cost_calculate(
        db: tauri::State<'_, crate::AppDb>,
        recipe_id: i64,
    ) -> Result<CostBreakdown, String> {
        db.calculate_cost(recipe_id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn cost_analyze(
        db: tauri::State<'_, crate::AppDb>,
        recipe_id: i64,
        margin_percent: f64,
    ) -> Result<CostBreakdown, String> {
        db.analyze_cost(recipe_id, margin_percent).await.map_err(|e| e.to_string())
    }

    // Settings
    #[tauri::command]
    pub async fn settings_get(
        db: tauri::State<'_, crate::AppDb>,
        key: String,
    ) -> Result<Option<String>, String> {
        db.get_setting(&key).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn settings_set(
        db: tauri::State<'_, crate::AppDb>,
        key: String,
        value: String,
    ) -> Result<(), String> {
        db.set_setting(&key, &value).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn settings_get_all(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<std::collections::HashMap<String, String>, String> {
        db.get_all_settings().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn settings_reset(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<(), String> {
        db.reset_settings().await.map_err(|e| e.to_string())
    }

    #[cfg(debug_assertions)]
    #[tauri::command]
    pub async fn delete_all_data(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<(), String> {
        db.delete_all_data().await.map_err(|e| e.to_string())
    }

    #[cfg(debug_assertions)]
    #[tauri::command]
    pub async fn seed_demo_data(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<(), String> {
        db.seed_demo_data().await.map_err(|e| e.to_string())
    }

    // Categories
    #[tauri::command]
    pub async fn categories_list(
        db: tauri::State<'_, crate::AppDb>,
        kind: Option<String>,
    ) -> Result<Vec<Category>, String> {
        db.categories_list(kind.as_deref()).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn category_create(
        db: tauri::State<'_, crate::AppDb>,
        input: CategoryInput,
    ) -> Result<Category, String> {
        db.create_category(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn category_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        input: CategoryInput,
    ) -> Result<Category, String> {
        db.update_category(id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn category_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.delete_category(id).await.map_err(|e| e.to_string())
    }

    // Suppliers
    #[tauri::command]
    pub async fn suppliers_list(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<Supplier>, String> {
        db.suppliers_list().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn supplier_get(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<Supplier, String> {
        db.supplier_get(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn supplier_create(
        db: tauri::State<'_, crate::AppDb>,
        input: SupplierInput,
    ) -> Result<Supplier, String> {
        db.create_supplier(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn supplier_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        input: SupplierInput,
    ) -> Result<Supplier, String> {
        db.update_supplier(id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn supplier_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.delete_supplier(id).await.map_err(|e| e.to_string())
    }

    // Price quotes
    #[tauri::command]
    pub async fn price_quotes_list(
        db: tauri::State<'_, crate::AppDb>,
        ingredient_id: i64,
    ) -> Result<Vec<PriceQuote>, String> {
        db.price_quotes_list(ingredient_id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn price_quotes_all(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<PriceQuoteWithIngredient>, String> {
        db.price_quotes_all().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn price_quotes_stats(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<PriceQuoteStats>, String> {
        db.price_quotes_stats().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn price_quote_create(
        db: tauri::State<'_, crate::AppDb>,
        input: PriceQuoteInput,
    ) -> Result<PriceQuote, String> {
        db.create_price_quote(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn price_quote_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        input: PriceQuoteInput,
    ) -> Result<PriceQuote, String> {
        db.update_price_quote(id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn price_quote_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.delete_price_quote(id).await.map_err(|e| e.to_string())
    }

    // Import/Export
    #[tauri::command]
    pub async fn export_data(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<ImportData, String> {
        db.export_data().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn import_data(
        db: tauri::State<'_, crate::AppDb>,
        data: ImportData,
    ) -> Result<ImportResult, String> {
        db.import_data(data).await.map_err(|e| e.to_string())
    }

    // Meal Planner
    #[tauri::command]
    pub async fn meal_plans_list(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<Vec<MealPlan>, String> {
        db.meal_plans_list().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_plan_get(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<MealPlanWithEntries, String> {
        db.meal_plan_get(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_plan_create(
        db: tauri::State<'_, crate::AppDb>,
        input: MealPlanInput,
    ) -> Result<MealPlan, String> {
        db.meal_plan_create(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_plan_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        input: MealPlanInput,
    ) -> Result<MealPlan, String> {
        db.meal_plan_update(id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_plan_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.meal_plan_delete(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_entry_add(
        db: tauri::State<'_, crate::AppDb>,
        meal_plan_id: i64,
        input: MealEntryInput,
    ) -> Result<MealPlanEntry, String> {
        db.meal_entry_add(meal_plan_id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_entry_update(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
        input: MealEntryInput,
    ) -> Result<MealPlanEntry, String> {
        db.meal_entry_update(id, input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_entry_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.meal_entry_delete(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn meal_plan_generate_shopping_list(
        db: tauri::State<'_, crate::AppDb>,
        plan_id: i64,
        portions_multiplier: u32,
    ) -> Result<MealPlanShoppingList, String> {
        db.meal_plan_generate_shopping_list(plan_id, portions_multiplier)
            .await
            .map_err(|e| e.to_string())
    }

    // Dashboard
    #[tauri::command]
    pub async fn dashboard_stats(
        db: tauri::State<'_, crate::AppDb>,
    ) -> Result<DashboardStats, String> {
        db.dashboard_stats().await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn dashboard_recent_activity(
        db: tauri::State<'_, crate::AppDb>,
        limit: u32,
    ) -> Result<Vec<ActivityItem>, String> {
        db.dashboard_recent_activity(limit).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn dashboard_upcoming_meals(
        db: tauri::State<'_, crate::AppDb>,
        days: u32,
    ) -> Result<Vec<MealPlanEntryWithRecipe>, String> {
        db.dashboard_upcoming_meals(days).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn dashboard_low_stock(
        db: tauri::State<'_, crate::AppDb>,
        threshold: f64,
    ) -> Result<Vec<StockItemWithIngredient>, String> {
        db.dashboard_low_stock(threshold).await.map_err(|e| e.to_string())
    }

    // Calendar
    #[tauri::command]
    pub async fn meal_plan_entries_by_date_range(
        db: tauri::State<'_, crate::AppDb>,
        start_date: String,
        end_date: String,
    ) -> Result<Vec<MealPlanEntryWithRecipe>, String> {
        let start = DateTime::parse_from_rfc3339(&start_date)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| e.to_string())?;
        let end = DateTime::parse_from_rfc3339(&end_date)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| e.to_string())?;
        db.meal_plan_entries_by_date_range(start, end).await
    }

    #[tauri::command]
    pub async fn meal_plan_entries_by_month(
        db: tauri::State<'_, crate::AppDb>,
        year: i32,
        month: u32,
    ) -> Result<Vec<MealPlanEntryWithRecipe>, String> {
        db.meal_plan_entries_by_month(year, month).await
    }

    // Reports
    #[tauri::command]
    pub async fn report_cost(
        db: tauri::State<'_, crate::AppDb>,
        days: u32,
    ) -> Result<CostReport, String> {
        db.get_cost_report(days).await
    }

    #[tauri::command]
    pub async fn report_waste(
        db: tauri::State<'_, crate::AppDb>,
        days: u32,
    ) -> Result<WasteReport, String> {
        db.get_waste_report(days).await
    }

    #[tauri::command]
    pub async fn report_stock_trends(
        db: tauri::State<'_, crate::AppDb>,
        days: u32,
    ) -> Result<Vec<StockSnapshot>, String> {
        db.get_stock_trends(days).await
    }

    #[tauri::command]
    pub async fn report_meal_stats(
        db: tauri::State<'_, crate::AppDb>,
        days: u32,
    ) -> Result<MealStats, String> {
        db.get_meal_stats(days).await
    }

    #[tauri::command]
    pub async fn report_price_trends(
        db: tauri::State<'_, crate::AppDb>,
        ingredient_id: i64,
        days: u32,
    ) -> Result<Vec<PricePoint>, String> {
        db.get_price_trends(ingredient_id, days).await
    }

    // ===== IMAGES =====
    #[tauri::command]
    pub async fn image_upload(
        db: tauri::State<'_, crate::AppDb>,
        input: ImageUploadInput,
    ) -> Result<Image, String> {
        db.image_upload(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn image_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.image_delete(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn image_set_primary(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<Image, String> {
        db.image_set_primary(id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn image_get(
        db: tauri::State<'_, crate::AppDb>,
        entity_type: ImageEntityType,
        entity_id: i64,
    ) -> Result<Vec<Image>, String> {
        db.image_get(entity_type, entity_id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn image_search_proxy(
        db: tauri::State<'_, crate::AppDb>,
        query: String,
        per_page: Option<u32>,
    ) -> Result<Vec<ProxyImageResult>, String> {
        db.image_search_proxy(query, per_page).await.map_err(|e| e.to_string())
    }

    // ===== STOCK PURCHASES =====
    #[tauri::command]
    pub async fn stock_purchase_add(
        db: tauri::State<'_, crate::AppDb>,
        input: StockPurchaseInput,
    ) -> Result<StockPurchase, String> {
        db.stock_purchase_add(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn stock_purchases_list(
        db: tauri::State<'_, crate::AppDb>,
        ingredient_id: i64,
    ) -> Result<Vec<StockPurchase>, String> {
        db.stock_purchases_list(ingredient_id).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn stock_purchase_delete(
        db: tauri::State<'_, crate::AppDb>,
        id: i64,
    ) -> Result<(), String> {
        db.stock_purchase_delete(id).await.map_err(|e| e.to_string())
    }

    // ===== RECEIPT OCR =====
    #[tauri::command]
    pub async fn receipt_scan(
        db: tauri::State<'_, crate::AppDb>,
        input: ReceiptScanInput,
    ) -> Result<ReceiptParseResult, String> {
        db.receipt_scan(input).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn receipt_parse(
        db: tauri::State<'_, crate::AppDb>,
        raw_text: String,
    ) -> Result<Vec<ParsedReceiptItem>, String> {
        db.receipt_parse(raw_text).await.map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub async fn receipt_confirm(
        db: tauri::State<'_, crate::AppDb>,
        input: ReceiptConfirmInput,
    ) -> Result<Vec<StockPurchase>, String> {
        db.receipt_confirm(input).await.map_err(|e| e.to_string())
    }
}

/// Initialize app state (called from src-tauri)
pub async fn initialize_app_state(app: &tauri::AppHandle) -> Result<(), String> {
    apply_native_theme();

    // Get app data directory (works on Android, iOS, Desktop)
    let app_data_dir = app
        .path()
        .resolve("mise", BaseDirectory::AppData)
        .map_err(|e| e.to_string())?;

    let db = mise_core::db::open_db(Some(app_data_dir))
        .await
        .map_err(|e| e.to_string())?;
    app.manage(AppDb::new(db));
    Ok(())
}

// Re-export AppDb for src-tauri
// Commands are in the commands module - use mise_tauri::commands::<command_name>