use mise_data::{
    db::open_local,
    ingredient_repo::SqliteIngredientRepo,
    IngredientInput, IngredientRepo,
};
use mise_core::Unit;
use mise_entitlements::{is_allowed, AccountType, Feature};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct AppState {
    pub ingredients: Arc<Mutex<SqliteIngredientRepo>>,
}

#[tauri::command]
fn ping() -> String { "pong".to_string() }

#[tauri::command]
fn feature_allowed(account: AccountType, feature: Feature) -> bool {
    is_allowed(account, feature)
}

#[tauri::command]
async fn ingredients_list(
    state: State<'_, AppState>,
) -> Result<Vec<mise_core::Ingredient>, String> {
    state.ingredients.lock().await
        .list().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ingredient_create(
    state: State<'_, AppState>,
    name: String,
    unit: String,
    price_per_unit: f64,
) -> Result<mise_core::Ingredient, String> {
    let unit = match unit.as_str() {
        "kilogram"   => Unit::Kilogram,
        "liter"      => Unit::Liter,
        "milliliter" => Unit::Milliliter,
        "piece"      => Unit::Piece,
        _            => Unit::Gram,
    };
    state.ingredients.lock().await
        .create(IngredientInput { name, unit, price_per_unit })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ingredient_delete(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state.ingredients.lock().await
        .delete(id).await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path()
                .app_data_dir()
                .expect("sem app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            let db_path = data_dir.join("mise.db")
                .to_string_lossy()
                .to_string();
            tauri::async_runtime::block_on(async {
                let conn = open_local(&db_path)
                    .await
                    .expect("falha ao abrir base de dados");
                let repo = SqliteIngredientRepo { conn };
                app.manage(AppState {
                    ingredients: Arc::new(Mutex::new(repo)),
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            feature_allowed,
            ingredients_list,
            ingredient_create,
            ingredient_delete,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao arrancar a aplicação Tauri");
}
