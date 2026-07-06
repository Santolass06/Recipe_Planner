use mise_tauri;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize database and state via mise-tauri.
            // Run SYNCHRONOUSLY and blocking via block_on (NOT spawn) so that
            // app.manage(db) inside initialize_app_state FINISHES before
            // setup() returns — and therefore before any invoke_handler can be
            // called by the frontend. Previously this ran in a spawned task
            // that raced the first invoke(), causing "state not managed for
            // field `db`" errors on every DB command.
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                mise_tauri::initialize_app_state(&app_handle).await
            })
            .map_err(|e| {
                // Treat the Result as a real error: log the full message and
                // propagate out of setup() so Tauri aborts startup cleanly
                // instead of opening a window with no managed state.
                eprintln!("Failed to initialize app state: {}", e);
                Box::<dyn std::error::Error>::from(e)
            })
        })
        .invoke_handler(tauri::generate_handler![
            mise_tauri::commands::get_system_theme,
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
            // Dashboard
            mise_tauri::commands::dashboard_stats,
            mise_tauri::commands::dashboard_recent_activity,
            mise_tauri::commands::dashboard_upcoming_meals,
            mise_tauri::commands::dashboard_low_stock,
            // Meal Planner
            mise_tauri::commands::meal_plans_list,
            mise_tauri::commands::meal_plan_get,
            mise_tauri::commands::meal_plan_create,
            mise_tauri::commands::meal_plan_update,
            mise_tauri::commands::meal_plan_delete,
            mise_tauri::commands::meal_plan_entries_by_date_range,
            mise_tauri::commands::meal_plan_entries_by_month,
            mise_tauri::commands::meal_plan_generate_shopping_list,
            mise_tauri::commands::meal_entry_add,
            mise_tauri::commands::meal_entry_update,
            mise_tauri::commands::meal_entry_delete,
            // Reports
            mise_tauri::commands::report_cost,
            mise_tauri::commands::report_waste,
            mise_tauri::commands::report_stock_trends,
            mise_tauri::commands::report_meal_stats,
            mise_tauri::commands::report_price_trends,
            // Suppliers (extras)
            mise_tauri::commands::supplier_get,
            mise_tauri::commands::price_quotes_all,
            mise_tauri::commands::price_quotes_stats,
            mise_tauri::commands::price_quote_update,
            // Shopping (items) — Lote 2
            mise_tauri::commands::shopping_list_update,
            mise_tauri::commands::shopping_list_add_item,
            mise_tauri::commands::shopping_list_update_item_full,
            mise_tauri::commands::shopping_list_toggle_item,
            mise_tauri::commands::shopping_list_remove_item,
            mise_tauri::commands::shopping_list_reorder_items,
            mise_tauri::commands::shopping_list_clear_purchased,
            mise_tauri::commands::shopping_list_group_by_category,
            // Stock purchases — Lote 2
            mise_tauri::commands::stock_purchase_add,
            mise_tauri::commands::stock_purchases_list,
            mise_tauri::commands::stock_purchase_delete,
            // Settings (extras) — Lote 2
            mise_tauri::commands::settings_get_all,
            mise_tauri::commands::settings_reset,
            // Images — Lote 2
            mise_tauri::commands::image_upload,
            mise_tauri::commands::image_delete,
            mise_tauri::commands::image_set_primary,
            mise_tauri::commands::image_get,
            mise_tauri::commands::image_search_proxy,
            // Receipts (OCR) — Lote 2 (backend only; frontend ReceiptScannerPage fora de scope)
            mise_tauri::commands::receipt_scan,
            mise_tauri::commands::receipt_parse,
            mise_tauri::commands::receipt_confirm,
            // Data management — Lote 3
            #[cfg(debug_assertions)]
            mise_tauri::commands::seed_demo_data,
            #[cfg(debug_assertions)]
            mise_tauri::commands::delete_all_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}