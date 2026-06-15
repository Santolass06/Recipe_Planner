//! Tauri commands and app state
//!
//! This crate provides all Tauri command handlers using mise-core directly.
//! No repository traits, no async-trait — just direct libSQL calls.

use mise_core::*;
use mise_tauri::AppDb;
use libsql::Database;
use tauri::Manager;
use tauri::path::BaseDirectory;

pub mod commands {
    use super::*;

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
    ) -> Result<Vec<Recipe>, String> {
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
    pub async fn price_quote_create(
        db: tauri::State<'_, crate::AppDb>,
        input: PriceQuoteInput,
    ) -> Result<PriceQuote, String> {
        db.create_price_quote(input).await.map_err(|e| e.to_string())
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
}

/// Initialize app state (called from src-tauri)
pub async fn initialize_app_state(app: &tauri::AppHandle) -> Result<(), String> {
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