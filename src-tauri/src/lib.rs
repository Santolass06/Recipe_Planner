use mise_core::*;
use mise_tauri;
use mise_tauri::AppDb;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize database and state via mise-tauri
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                mise_tauri::initialize_app_state(&app_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Ingredients
            mise_tauri::commands::ingredients_list,
            mise_tauri::commands::ingredient_create,
            mise_tauri::commands::ingredient_update,
            mise_tauri::commands::ingredient_delete,
            mise_tauri::commands::ingredient_toggle_favorite,
            // Recipes
            mise_tauri::commands::recipes_list,
            mise_tauri::commands::recipes_paginated,
            mise_tauri::commands::recipe_get,
            mise_tauri::commands::recipe_create,
            mise_tauri::commands::recipe_update,
            mise_tauri::commands::recipe_delete,
            mise_tauri::commands::recipe_toggle_favorite,
            mise_tauri::commands::recipe_clone,
            // Stock
            mise_tauri::commands::stock_list,
            mise_tauri::commands::stock_upsert,
            mise_tauri::commands::stock_delete,
            mise_tauri::commands::stock_get,
            mise_tauri::commands::stock_update_quantity,
            // Shopping
            mise_tauri::commands::shopping_lists_list,
            mise_tauri::commands::shopping_list_get,
            mise_tauri::commands::shopping_list_create,
            mise_tauri::commands::shopping_list_create_from_recipes,
            mise_tauri::commands::shopping_list_update_item,
            mise_tauri::commands::shopping_list_delete,
            // Suggester
            mise_tauri::commands::suggester_suggest,
            // Cost
            mise_tauri::commands::cost_calculate,
            mise_tauri::commands::cost_analyze,
            // Settings
            mise_tauri::commands::settings_get,
            mise_tauri::commands::settings_set,
            // Categories
            mise_tauri::commands::categories_list,
            mise_tauri::commands::category_create,
            mise_tauri::commands::category_update,
            mise_tauri::commands::category_delete,
            // Suppliers
            mise_tauri::commands::suppliers_list,
            mise_tauri::commands::supplier_create,
            mise_tauri::commands::supplier_update,
            mise_tauri::commands::supplier_delete,
            // Price quotes
            mise_tauri::commands::price_quotes_list,
            mise_tauri::commands::price_quote_create,
            mise_tauri::commands::price_quote_delete,
            // Import/Export
            mise_tauri::commands::export_data,
            mise_tauri::commands::import_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}