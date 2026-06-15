use mise_data::{
    db::open_local,
    ingredient_repo::SqliteIngredientRepo,
    recipe_repo::SqliteRecipeRepo,
    IngredientInput, IngredientRepo, RecipeInput, RecipeIngredientInput, RecipeRepo,
};
use mise_entitlements::{is_allowed, AccountType, Feature};
use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::Mutex;

pub struct AppState {
    pub ingredients: Arc<Mutex<SqliteIngredientRepo>>,
    pub recipes: Arc<Mutex<SqliteRecipeRepo>>,
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

fn parse_unit_str(s: &str) -> mise_core::Unit {
    match s {
        "gram" => mise_core::Unit::Gram,
        "kilogram" => mise_core::Unit::Kilogram,
        "milligram" => mise_core::Unit::Milligram,
        "ounce" => mise_core::Unit::Ounce,
        "pound" => mise_core::Unit::Pound,
        "milliliter" => mise_core::Unit::Milliliter,
        "liter" => mise_core::Unit::Liter,
        "fluid_ounce" => mise_core::Unit::FluidOunce,
        "cup" => mise_core::Unit::Cup,
        "pint" => mise_core::Unit::Pint,
        "quart" => mise_core::Unit::Quart,
        "gallon" => mise_core::Unit::Gallon,
        "teaspoon" => mise_core::Unit::Teaspoon,
        "tablespoon" => mise_core::Unit::Tablespoon,
        "piece" => mise_core::Unit::Piece,
        "dozen" => mise_core::Unit::Dozen,
        "pinch" => mise_core::Unit::Pinch,
        "bunch" => mise_core::Unit::Bunch,
        "clove" => mise_core::Unit::Clove,
        "slice" => mise_core::Unit::Slice,
        "centimeter" => mise_core::Unit::Centimeter,
        "celsius" => mise_core::Unit::Celsius,
        "fahrenheit" => mise_core::Unit::Fahrenheit,
        _ => mise_core::Unit::Gram,
    }
}

#[tauri::command]
async fn ingredient_create(
    state: State<'_, AppState>,
    name: String,
    unit: String,
    price_per_unit: f64,
) -> Result<mise_core::Ingredient, String> {
    let unit = parse_unit_str(&unit);
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

#[tauri::command]
async fn ingredient_update(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    unit: String,
    price_per_unit: f64,
) -> Result<mise_core::Ingredient, String> {
    let unit = parse_unit_str(&unit);
    state.ingredients.lock().await
        .update(id, IngredientInput { name, unit, price_per_unit })
        .await
        .map_err(|e| e.to_string())
}

// Recipe commands
#[tauri::command]
async fn recipes_list(
    state: State<'_, AppState>,
) -> Result<Vec<mise_core::Recipe>, String> {
    state.recipes.lock().await
        .list().await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn recipe_get(
    state: State<'_, AppState>,
    id: i64,
) -> Result<mise_core::Recipe, String> {
    state.recipes.lock().await
        .get(id).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn recipe_create(
    state: State<'_, AppState>,
    name: String,
    category: String,
    portions: u32,
    instructions: String,
    ingredients: Vec<RecipeIngredientInput>,
) -> Result<mise_core::Recipe, String> {
    state.recipes.lock().await
        .create(RecipeInput { name, category, portions, instructions, ingredients })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn recipe_update(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    category: String,
    portions: u32,
    instructions: String,
    ingredients: Vec<RecipeIngredientInput>,
) -> Result<mise_core::Recipe, String> {
    state.recipes.lock().await
        .update(id, RecipeInput { name, category, portions, instructions, ingredients })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn recipe_delete(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state.recipes.lock().await
        .delete(id).await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn analyze_recipe_cost(
    state: State<'_, AppState>,
    recipe_id: i64,
    margin_percent: f64,
    promo_prices: Vec<(u64, f64)>,
) -> Result<mise_core::cost::CostAnalysis, String> {
    let recipe = state.recipes.lock().await
        .get(recipe_id).await
        .map_err(|e| e.to_string())?;
    let ingredients = state.ingredients.lock().await
        .list().await
        .map_err(|e| e.to_string())?;
    
    use mise_core::cost::analyze_recipe_cost;
    Ok(analyze_recipe_cost(&recipe, &ingredients, &promo_prices, margin_percent))
}

#[tauri::command]
fn unit_convert(
    value: f64,
    from: String,
    to: String,
) -> Result<f64, String> {
    use mise_core::{convert, ConversionResult};
    match convert(value, parse_unit_str(&from), parse_unit_str(&to)) {
        ConversionResult::Ok(v) => Ok(v),
        ConversionResult::NeedsDensity => Err("needs_density".into()),
        ConversionResult::Incompatible => Err("incompatible".into()),
    }
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
                let ingredients_repo = SqliteIngredientRepo { conn: conn.clone() };
                let recipes_repo = SqliteRecipeRepo { conn };
                app.manage(AppState {
                    ingredients: Arc::new(Mutex::new(ingredients_repo)),
                    recipes: Arc::new(Mutex::new(recipes_repo)),
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
            ingredient_update,
            recipes_list,
            recipe_get,
            recipe_create,
            recipe_update,
            recipe_delete,
            analyze_recipe_cost,
            unit_convert,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao arrancar a aplicação Tauri");
}