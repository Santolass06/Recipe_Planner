//! Database connection and migrations

use libsql::{Builder, Connection, Database, Result as LibsqlResult, params, Row};
use crate::domain::*;
use std::path::PathBuf;
use dirs;
use chrono::{DateTime, Utc, TimeZone};
use serde_json;

/// Open database connection with WAL mode and connection pooling
/// If `app_data_dir` is provided, use it (for Android mobile); otherwise fall back to system data dir
pub async fn open_db(app_data_dir: Option<PathBuf>) -> LibsqlResult<Database> {
    let data_dir = resolve_data_dir(app_data_dir).map_err(|e| libsql::Error::Misuse(e.to_string()))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| libsql::Error::Misuse(e.to_string()))?;

    let db_path = data_dir.join("mise.db");
    let db_url = format!("file:{}", db_path.display());

    let db = Builder::new_local(db_url)
        .build()
        .await?;

    // Enable WAL mode for better concurrency.
    // PRAGMA journal_mode = WAL devolve uma linha (o modo resultante); o
    // .execute() do libsql rejeita instruções que devolvem linhas ("Execute
    // returned rows"), por isso usamos .query() (já usado noutros pontos deste
    // ficheiro). O modo WAL é aplicado; o Rows devolvido é ignorado.
    let _ = get_conn(&db).await?.query("PRAGMA journal_mode = WAL;", ()).await?;

    // Run migrations
    run_migrations(&db).await?;

    Ok(db)
}

/// Get a connection, waiting for locks instead of failing immediately.
///
/// Every db:: function opens its own short-lived `Connection` via
/// `db.connect()`. `PRAGMA busy_timeout` is a per-connection setting in
/// SQLite (not persisted to the file), so without setting it here, two
/// requests landing within the same few milliseconds (e.g. React
/// StrictMode firing an effect's fetch twice, or two pages loading at
/// once) would race for the file lock and one would fail outright with
/// "database is locked" even though nothing was actually wrong — the
/// user sees a random error toast on a page that otherwise loaded fine.
pub async fn get_conn(db: &Database) -> LibsqlResult<Connection> {
    let conn = db.connect()?;
    let _ = conn.query("PRAGMA busy_timeout = 5000;", ()).await?;
    Ok(conn)
}

/// Resolve the app's data directory: `app_data_dir` if given (Tauri already
/// resolves this to the app-identifier-namespaced path), otherwise a
/// desktop fallback under the OS data dir. Single source of truth so the DB
/// and the image storage (below) always agree on the same root.
pub fn resolve_data_dir(app_data_dir: Option<PathBuf>) -> std::io::Result<PathBuf> {
    if let Some(dir) = app_data_dir {
        Ok(dir)
    } else if let Some(data_dir) = dirs::data_dir() {
        Ok(data_dir.join("mise"))
    } else {
        // Final fallback
        Ok(std::env::current_dir()?.join(".mise_data"))
    }
}

/// Run all migrations
async fn run_migrations(db: &Database) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;

    // Migration 001: Initial schema
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            kind TEXT NOT NULL CHECK (kind IN ('ingredient', 'recipe')),
            color TEXT,
            icon TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    // Migration 002: Ingredients
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            price_per_unit REAL NOT NULL DEFAULT 0,
            category_id INTEGER,
            favorite INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );
        "#,
        (),
    ).await?;

    // Migration 003: Recipes
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'Geral',
            portions INTEGER NOT NULL DEFAULT 1,
            instructions TEXT NOT NULL DEFAULT '',
            favorite INTEGER NOT NULL DEFAULT 0,
            prep_time_minutes INTEGER,
            cook_time_minutes INTEGER,
            tags TEXT NOT NULL DEFAULT '[]', -- JSON array
            image_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    // Migration 004: Recipe ingredients (junction)
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id INTEGER NOT NULL,
            ingredient_id INTEGER NOT NULL,
            ingredient_name TEXT NOT NULL, -- denormalized for display
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
        );
        "#,
        (),
    ).await?;

    // Migration 005: Stock
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ingredient_id INTEGER NOT NULL UNIQUE,
            ingredient_name TEXT NOT NULL, -- denormalized
            ingredient_unit TEXT NOT NULL,
            quantity REAL NOT NULL DEFAULT 0,
            min_quantity REAL NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
        );
        "#,
        (),
    ).await?;

    // Migration 006: Shopping lists
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS shopping_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS shopping_list_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shopping_list_id INTEGER NOT NULL,
            ingredient_id INTEGER,
            ingredient_name TEXT NOT NULL,
            ingredient_unit TEXT NOT NULL,
            needed_quantity REAL NOT NULL,
            stock_quantity REAL NOT NULL,
            to_buy_quantity REAL NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            estimated_cost REAL NOT NULL DEFAULT 0,
            purchased INTEGER NOT NULL DEFAULT 0,
            purchased_at TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
        );
        "#,
        (),
    ).await?;

    // Migration 007: Suppliers
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    // Migration 008: Price quotes
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS price_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ingredient_id INTEGER NOT NULL,
            supplier TEXT NOT NULL,
            price_per_unit REAL NOT NULL,
            valid_from TEXT,
            valid_to TEXT,
            is_promo INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
        );
        "#,
        (),
    ).await?;

    // Migration 009: Meal Plans
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    // Migration 010: Meal Plan Entries
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS meal_plan_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meal_plan_id INTEGER NOT NULL,
            recipe_id INTEGER NOT NULL,
            recipe_name TEXT NOT NULL,
            day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
            meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
            portions INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE RESTRICT
        );
        "#,
        (),
    ).await?;

    // Indexes for performance
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_recipes_favorite ON recipes(favorite);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_stock_ingredient ON stock(ingredient_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_price_quotes_ingredient ON price_quotes(ingredient_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_price_quotes_valid ON price_quotes(valid_from, valid_to);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_meal_plans_created ON meal_plans(created_at);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_plan ON meal_plan_entries(meal_plan_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_meal_plan_entries_recipe ON meal_plan_entries(recipe_id);", ()).await?;

    // Default categories
    seed_default_categories(&conn).await?;

    // Migration 011: Images table
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL CHECK (entity_type IN ('recipe', 'ingredient', 'supplier', 'receipt', 'profile')),
            entity_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            is_primary INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    // Migration 012: Stock purchases table
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS stock_purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ingredient_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            price_per_unit REAL NOT NULL,
            total_price REAL NOT NULL,
            is_discount INTEGER NOT NULL DEFAULT 0,
            discount_percent REAL NOT NULL DEFAULT 0,
            purchase_date TEXT NOT NULL,
            supplier_id INTEGER,
            brand TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
        );
        "#,
        (),
    ).await?;

    // Migration 013: Receipt imports table
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS receipt_imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT NOT NULL,
            raw_text TEXT,
            parsed_json TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanned', 'parsed', 'confirmed', 'failed')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    // Indexes for new tables
    conn.execute("CREATE INDEX IF NOT EXISTS idx_images_entity ON images(entity_type, entity_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_stock_purchases_ingredient ON stock_purchases(ingredient_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_stock_purchases_date ON stock_purchases(purchase_date);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_stock_purchases_supplier ON stock_purchases(supplier_id);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_receipt_imports_status ON receipt_imports(status);", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_receipt_imports_created ON receipt_imports(created_at);", ()).await?;

    // Migration 014: repair shopping_list_items.ingredient_id NOT NULL constraint.
    // Quick-add (ingredient-less) items need ingredient_id nullable, but
    // `CREATE TABLE IF NOT EXISTS` above only applies to fresh installs —
    // existing databases keep the old NOT NULL column, so quick-add fails.
    // SQLite has no ALTER COLUMN, so recreate the table when needed.
    repair_shopping_list_items_nullable_ingredient(&conn).await?;

    // Migration 015: approximate unit weights, for costing recipe lines
    // that use a descriptive count unit (clove, pinch, bunch, slice) with
    // no fixed physical size against an ingredient priced by weight/volume.
    // Lives in the DB (not a Rust table) so new cases can be added with an
    // INSERT, no recompile needed.
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS approximate_unit_weights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ingredient_name_pattern TEXT NOT NULL,
            from_unit TEXT NOT NULL,
            approx_grams_per_unit REAL NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_approx_unit_weights_unit ON approximate_unit_weights(from_unit);", ()).await?;

    conn.execute(
        r#"
        INSERT INTO approximate_unit_weights (ingredient_name_pattern, from_unit, approx_grams_per_unit, notes)
        SELECT 'alho', 'clove', 5.0, 'Dente de alho médio (softneck), ~4-7g típico'
        WHERE NOT EXISTS (
            SELECT 1 FROM approximate_unit_weights WHERE ingredient_name_pattern = 'alho' AND from_unit = 'clove'
        )
        "#,
        (),
    ).await?;
    conn.execute(
        r#"
        INSERT INTO approximate_unit_weights (ingredient_name_pattern, from_unit, approx_grams_per_unit, notes)
        SELECT 'garlic', 'clove', 5.0, 'Average garlic clove (softneck), ~4-7g typical'
        WHERE NOT EXISTS (
            SELECT 1 FROM approximate_unit_weights WHERE ingredient_name_pattern = 'garlic' AND from_unit = 'clove'
        )
        "#,
        (),
    ).await?;

    // Migration 016: brand on stock_purchases (multi-brand stock, Fase 3.1)
    add_column_if_missing(&conn, "stock_purchases", "brand", "TEXT").await?;

    // Migration 017: Events (Fase 3.2 — event mode)
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            event_date TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;
    // ponytail: no FK/ON DELETE CASCADE — this codebase never enables
    // `PRAGMA foreign_keys`, so cascades are handled manually (see delete_event).
    add_column_if_missing(&conn, "recipes", "event_id", "INTEGER").await?;
    add_column_if_missing(&conn, "recipes", "base_recipe_id", "INTEGER").await?;

    // Migration 018: event-scoped ingredients (Fase 3.3 — model (a))
    // NULL = catalog. Same manual-cascade convention as Migration 017.
    add_column_if_missing(&conn, "ingredients", "event_id", "INTEGER").await?;

    // Migration 019: usage instrumentation (Fase de Instrumentação, 2026-07-10).
    // usage_events: shell for future automatic event emitters (OCR outcome,
    // lista-vs-recibo path, etc.) — table exists now, no emitters wired yet
    // (deferred, no consumers until real users, ver PROJECT.md). problem_reports:
    // user-initiated bug reports, has a real producer today (report button).
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS usage_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            payload_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS problem_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            image_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
        (),
    ).await?;

    Ok(())
}

async fn add_column_if_missing(conn: &Connection, table: &str, column: &str, decl: &str) -> LibsqlResult<()> {
    let mut rows = conn.query(&format!("PRAGMA table_info({table})"), ()).await?;
    while let Some(row) = rows.next().await? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(());
        }
    }
    conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"), ()).await?;
    Ok(())
}

async fn repair_shopping_list_items_nullable_ingredient(conn: &Connection) -> LibsqlResult<()> {
    let mut rows = conn.query("PRAGMA table_info(shopping_list_items)", ()).await?;
    let mut ingredient_id_not_null = false;
    while let Some(row) = rows.next().await? {
        let name: String = row.get(1)?;
        if name == "ingredient_id" {
            let notnull: i64 = row.get(3)?;
            ingredient_id_not_null = notnull != 0;
        }
    }
    drop(rows);

    if !ingredient_id_not_null {
        return Ok(());
    }

    conn.execute("ALTER TABLE shopping_list_items RENAME TO shopping_list_items_old", ()).await?;
    conn.execute(
        r#"
        CREATE TABLE shopping_list_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shopping_list_id INTEGER NOT NULL,
            ingredient_id INTEGER,
            ingredient_name TEXT NOT NULL,
            ingredient_unit TEXT NOT NULL,
            needed_quantity REAL NOT NULL,
            stock_quantity REAL NOT NULL,
            to_buy_quantity REAL NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            estimated_cost REAL NOT NULL DEFAULT 0,
            purchased INTEGER NOT NULL DEFAULT 0,
            purchased_at TEXT,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
        );
        "#,
        (),
    ).await?;
    conn.execute("INSERT INTO shopping_list_items SELECT * FROM shopping_list_items_old", ()).await?;
    conn.execute("DROP TABLE shopping_list_items_old", ()).await?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);", ()).await?;

    Ok(())
}

async fn seed_default_categories(conn: &Connection) -> LibsqlResult<()> {
    let categories = [
        ("Geral", "recipe", "#2d6a4f", "🍽️", 0),
        ("Sopas", "recipe", "#40916c", "🍲", 1),
        ("Saladas", "recipe", "#52b788", "🥗", 2),
        ("Pratos Principais", "recipe", "#1b4332", "🍖", 3),
        ("Acompanhamentos", "recipe", "#74c69d", "🥔", 4),
        ("Sobremesas", "recipe", "#95d5b2", "🍰", 5),
        ("Pequeno-almoço", "recipe", "#b7e4c7", "🍳", 6),
        ("Lanches", "recipe", "#d8f3dc", "🥪", 7),
        ("Bebidas", "recipe", "#40916c", "🥤", 8),
        ("Molhos", "recipe", "#1b4332", "🥫", 9),
        ("Hortícolas", "ingredient", "#2d6a4f", "🥦", 0),
        ("Frutas", "ingredient", "#f77f00", "🍎", 1),
        ("Carnes e Peixes", "ingredient", "#d62828", "🥩", 2),
        ("Lacticínios", "ingredient", "#fcbf49", "🧀", 3),
        ("Pantry (Secos)", "ingredient", "#e9c46a", "🌾", 4),
        ("Condimentos", "ingredient", "#7209b7", "🧂", 5),
        ("Bebidas", "ingredient", "#40916c", "🥛", 6),
        ("Outros", "ingredient", "#9e9e9e", "📦", 7),
    ];

    for (name, kind, color, icon, sort_order) in categories {
        conn.execute(
            "INSERT OR IGNORE INTO categories (name, kind, color, icon, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, kind, color, icon, sort_order],
        ).await?;
    }

    Ok(())
}

/// Migrations module for external access
pub mod migrations {
    use super::*;

    /// Run migrations manually (for testing)
    pub async fn run(db: &Database) -> LibsqlResult<()> {
        run_migrations(db).await
    }
}

// =====================================================================
// DATABASE QUERY METHODS
// =====================================================================

/// Map a libsql Row to Ingredient
fn row_to_ingredient(row: &Row) -> LibsqlResult<Ingredient> {
    let unit_str: String = row.get(2)?;
    let unit = match unit_str.as_str() {
        "gram" => Unit::Gram,
        "kilogram" => Unit::Kilogram,
        "milligram" => Unit::Milligram,
        "ounce" => Unit::Ounce,
        "pound" => Unit::Pound,
        "milliliter" => Unit::Milliliter,
        "liter" => Unit::Liter,
        "fluid_ounce" => Unit::FluidOunce,
        "cup" => Unit::Cup,
        "pint" => Unit::Pint,
        "quart" => Unit::Quart,
        "gallon" => Unit::Gallon,
        "teaspoon" => Unit::Teaspoon,
        "tablespoon" => Unit::Tablespoon,
        "piece" => Unit::Piece,
        "dozen" => Unit::Dozen,
        "pinch" => Unit::Pinch,
        "bunch" => Unit::Bunch,
        "clove" => Unit::Clove,
        "slice" => Unit::Slice,
        _ => Unit::Gram,
    };

    let created_at_str: String = row.get(5)?;
    let updated_at_str: String = row.get(6)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(Ingredient {
        id: row.get(0)?,
        name: row.get(1)?,
        unit,
        price_per_unit: row.get(3)?,
        category_id: row.get(4)?,
        favorite: row.get(7)?,
        created_at,
        updated_at,
    })
}

/// Map a libsql Row to Recipe
fn row_to_recipe(row: &Row) -> LibsqlResult<Recipe> {
    let created_at_str: String = row.get(10)?;
    let updated_at_str: String = row.get(11)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(Recipe {
        id: row.get(0)?,
        name: row.get(1)?,
        category: row.get(2)?,
        portions: row.get(3)?,
        instructions: row.get(4)?,
        favorite: row.get(5)?,
        prep_time_minutes: row.get(6)?,
        cook_time_minutes: row.get(7)?,
        tags: row.get(8)?,
        image_path: row.get(9)?,
        created_at,
        updated_at,
    })
}

/// Map a libsql Row to RecipeWithIngredients
async fn row_to_recipe_with_ingredients(db: &Database, recipe: Recipe) -> LibsqlResult<RecipeWithIngredients> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT ri.id, ri.recipe_id, ri.ingredient_id, ri.ingredient_name, ri.quantity, ri.unit,
         i.name, i.unit, i.price_per_unit
         FROM recipe_ingredients ri
         JOIN ingredients i ON ri.ingredient_id = i.id
         WHERE ri.recipe_id = ?1",
        params![recipe.id],
    ).await?;

    let mut ingredients = Vec::new();
    while let Some(row) = rows.next().await? {
        let unit_str: String = row.get(5)?;
        let unit = match unit_str.as_str() {
            "gram" => Unit::Gram,
            "kilogram" => Unit::Kilogram,
            "milligram" => Unit::Milligram,
            "ounce" => Unit::Ounce,
            "pound" => Unit::Pound,
            "milliliter" => Unit::Milliliter,
            "liter" => Unit::Liter,
            "fluid_ounce" => Unit::FluidOunce,
            "cup" => Unit::Cup,
            "pint" => Unit::Pint,
            "quart" => Unit::Quart,
            "gallon" => Unit::Gallon,
            "teaspoon" => Unit::Teaspoon,
            "tablespoon" => Unit::Tablespoon,
            "piece" => Unit::Piece,
            "dozen" => Unit::Dozen,
            "pinch" => Unit::Pinch,
            "bunch" => Unit::Bunch,
            "clove" => Unit::Clove,
            "slice" => Unit::Slice,
            _ => Unit::Gram,
        };

        ingredients.push(RecipeIngredient {
            id: row.get(0)?,
            recipe_id: row.get(1)?,
            ingredient_id: row.get(2)?,
            ingredient_name: row.get(3)?,
            quantity: row.get(4)?,
            unit,
        });
    }

    Ok(RecipeWithIngredients { recipe, ingredients })
}

/// Map a libsql Row to StockItem
fn row_to_stock_item(row: &Row) -> LibsqlResult<StockItem> {
    let unit_str: String = row.get(3)?;
    let unit = match unit_str.as_str() {
        "gram" => Unit::Gram,
        "kilogram" => Unit::Kilogram,
        "milligram" => Unit::Milligram,
        "ounce" => Unit::Ounce,
        "pound" => Unit::Pound,
        "milliliter" => Unit::Milliliter,
        "liter" => Unit::Liter,
        "fluid_ounce" => Unit::FluidOunce,
        "cup" => Unit::Cup,
        "pint" => Unit::Pint,
        "quart" => Unit::Quart,
        "gallon" => Unit::Gallon,
        "teaspoon" => Unit::Teaspoon,
        "tablespoon" => Unit::Tablespoon,
        "piece" => Unit::Piece,
        "dozen" => Unit::Dozen,
        "pinch" => Unit::Pinch,
        "bunch" => Unit::Bunch,
        "clove" => Unit::Clove,
        "slice" => Unit::Slice,
        _ => Unit::Gram,
    };

    // SELECT order: s.id(0), s.ingredient_id(1), i.name(2), i.unit(3),
    // s.quantity(4), s.min_quantity(5), s.updated_at(6)
    let updated_at_str: String = row.get(6)?;
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(StockItem {
        id: row.get(0)?,
        ingredient_id: row.get(1)?,
        ingredient_name: row.get(2)?,
        ingredient_unit: unit,
        quantity: row.get(4)?,
        min_quantity: row.get(5)?,
        updated_at,
    })
}

/// Map a libsql Row to ShoppingList
fn row_to_shopping_list(row: &Row) -> LibsqlResult<ShoppingList> {
    let created_at_str: String = row.get(2)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(ShoppingList {
        id: Some(row.get(0)?),
        name: row.get(1)?,
        items: Vec::new(), // Will be populated separately
        total_estimated_cost: 0.0, // Will be calculated
        created_at,
    })
}

/// Map a libsql Row to ShoppingItem
fn row_to_shopping_item(row: &Row) -> LibsqlResult<ShoppingItem> {
    // SELECT order: id(0), shopping_list_id(1), ingredient_id(2), ingredient_name(3),
    // ingredient_unit(4), needed_quantity(5), stock_quantity(6), to_buy_quantity(7),
    // category(8), estimated_cost(9), purchased(10), notes(11), purchased_at(12), created_at(13)
    let unit_str: String = row.get(4)?;
    let unit = match unit_str.as_str() {
        "gram" => Unit::Gram,
        "kilogram" => Unit::Kilogram,
        "milligram" => Unit::Milligram,
        "ounce" => Unit::Ounce,
        "pound" => Unit::Pound,
        "milliliter" => Unit::Milliliter,
        "liter" => Unit::Liter,
        "fluid_ounce" => Unit::FluidOunce,
        "cup" => Unit::Cup,
        "pint" => Unit::Pint,
        "quart" => Unit::Quart,
        "gallon" => Unit::Gallon,
        "teaspoon" => Unit::Teaspoon,
        "tablespoon" => Unit::Tablespoon,
        "piece" => Unit::Piece,
        "dozen" => Unit::Dozen,
        "pinch" => Unit::Pinch,
        "bunch" => Unit::Bunch,
        "clove" => Unit::Clove,
        "slice" => Unit::Slice,
        _ => Unit::Gram,
    };

    let purchased_at_str: Option<String> = row.get(12)?;
    let purchased_at = purchased_at_str
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let created_at_str: String = row.get(13)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(ShoppingItem {
        id: row.get(0)?,
        ingredient_id: row.get(2)?,
        ingredient_name: row.get(3)?,
        ingredient_unit: unit,
        needed_quantity: row.get(5)?,
        stock_quantity: row.get(6)?,
        to_buy_quantity: row.get(7)?,
        category: row.get(8)?,
        estimated_cost: row.get(9)?,
        purchased: row.get(10)?,
        notes: row.get(11)?,
        purchased_at,
        created_at,
    })
}

/// Map a libsql Row to Category
fn row_to_category(row: &Row) -> LibsqlResult<Category> {
    let kind_str: String = row.get(2)?;
    let kind = match kind_str.as_str() {
        "ingredient" => CategoryKind::Ingredient,
        "recipe" => CategoryKind::Recipe,
        _ => CategoryKind::Ingredient,
    };

    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        kind,
        color: row.get(3)?,
        icon: row.get(4)?,
        sort_order: row.get(5)?,
    })
}

/// Map a libsql Row to Supplier
fn row_to_supplier(row: &Row) -> LibsqlResult<Supplier> {
    // SELECT order: id(0), name(1), contact(2), notes(3), created_at(4), updated_at(5)
    let created_at_str: String = row.get(4)?;
    let updated_at_str: String = row.get(5)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(Supplier {
        id: row.get(0)?,
        name: row.get(1)?,
        contact: row.get(2)?,
        notes: row.get(3)?,
        created_at,
        updated_at,
    })
}

/// Map a libsql Row to PriceQuote
fn row_to_price_quote(row: &Row) -> LibsqlResult<PriceQuote> {
    let valid_from_str: Option<String> = row.get(4)?;
    let valid_to_str: Option<String> = row.get(5)?;
    let created_at_str: String = row.get(7)?;

    let valid_from = valid_from_str
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let valid_to = valid_to_str
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(PriceQuote {
        id: row.get(0)?,
        ingredient_id: row.get(1)?,
        supplier: row.get(2)?,
        price_per_unit: row.get(3)?,
        valid_from,
        valid_to,
        is_promo: row.get(6)?,
        created_at,
    })
}

// =====================================================================
// PUBLIC QUERY METHODS
// =====================================================================

/// List all ingredients
pub async fn ingredients_list(db: &Database) -> LibsqlResult<Vec<Ingredient>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients WHERE event_id IS NULL ORDER BY name",
        (),
    ).await?;

    let mut ingredients = Vec::new();
    while let Some(row) = rows.next().await? {
        ingredients.push(row_to_ingredient(&row)?);
    }
    Ok(ingredients)
}

/// List ingredients exclusive to an event (Fase 3.3 — model (a))
pub async fn event_ingredients_list(db: &Database, event_id: i64) -> LibsqlResult<Vec<Ingredient>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients WHERE event_id = ?1 ORDER BY name",
        params![event_id],
    ).await?;

    let mut ingredients = Vec::new();
    while let Some(row) = rows.next().await? {
        ingredients.push(row_to_ingredient(&row)?);
    }
    Ok(ingredients)
}

/// Copy a catalog ingredient into an event as its own stock-isolated line.
/// Stock and purchase history are NOT copied — the event starts at zero,
/// the whole point of isolation (Fase 3.3 decision).
pub async fn ingredient_copy_to_event(db: &Database, ingredient_id: i64, event_id: i64) -> LibsqlResult<Ingredient> {
    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO ingredients (name, unit, price_per_unit, category_id, favorite, event_id)
         SELECT name, unit, price_per_unit, category_id, 0, ?2 FROM ingredients WHERE id = ?1",
        params![ingredient_id, event_id],
    ).await?;
    let new_id = conn.last_insert_rowid();

    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients WHERE id = ?1",
        params![new_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_ingredient(&row)
}

/// Move an ingredient out of its event and into the shared catalog for good —
/// the reverse of ingredient_copy_to_event. Stock and purchase history travel
/// with it (same id), so whatever stock is left becomes catalog stock.
///
/// If a catalog ingredient already has the same name, the promoted ingredient
/// is renamed to "Name (Event Name)" so the two don't look identical in lists —
/// mirrors recipe_promote_to_catalog.
pub async fn ingredient_promote_to_catalog(db: &Database, id: i64) -> LibsqlResult<Ingredient> {
    let conn = get_conn(db).await?;

    let mut rows = conn.query("SELECT name, event_id FROM ingredients WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let (name, event_id): (String, Option<i64>) = (row.get(0)?, row.get(1)?);
    drop(rows);

    let mut final_name = name.clone();
    if let Some(event_id) = event_id {
        let mut dup_rows = conn.query(
            "SELECT 1 FROM ingredients WHERE event_id IS NULL AND name = ?1 AND id != ?2",
            params![name.clone(), id],
        ).await?;
        if dup_rows.next().await?.is_some() {
            let mut event_rows = conn.query("SELECT name FROM events WHERE id = ?1", params![event_id]).await?;
            if let Some(event_row) = event_rows.next().await? {
                let event_name: String = event_row.get(0)?;
                final_name = format!("{} ({})", name, event_name);
            }
        }
    }

    conn.execute(
        "UPDATE ingredients SET name = ?1, event_id = NULL, updated_at = datetime('now') WHERE id = ?2",
        params![final_name, id],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_ingredient(&row)
}

/// Create ingredient
pub async fn create_ingredient(db: &Database, input: IngredientInput) -> LibsqlResult<Ingredient> {
    let conn = get_conn(db).await?;
    let unit_str = match input.unit {
        Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
        Unit::Ounce => "ounce", Unit::Pound => "pound",
        Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
        Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
        Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
        Unit::Piece => "piece", Unit::Dozen => "dozen",
        Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
    };

    let category_id: Option<i64> = input.category.and_then(|c| c.parse().ok());

    conn.execute(
        "INSERT INTO ingredients (name, unit, price_per_unit, category_id, favorite, event_id)
         VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        params![input.name, unit_str, input.price_per_unit, category_id, input.event_id],
    ).await?;

    let id = conn.last_insert_rowid();
    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_ingredient(&row)
}

/// Update ingredient
pub async fn update_ingredient(db: &Database, id: i64, input: IngredientInput) -> LibsqlResult<Ingredient> {
    let conn = get_conn(db).await?;
    let unit_str = match input.unit {
        Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
        Unit::Ounce => "ounce", Unit::Pound => "pound",
        Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
        Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
        Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
        Unit::Piece => "piece", Unit::Dozen => "dozen",
        Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
    };

    let category_id: Option<i64> = input.category.and_then(|c| c.parse().ok());

    conn.execute(
        "UPDATE ingredients SET name = ?1, unit = ?2, price_per_unit = ?3, category_id = ?4, updated_at = datetime('now')
         WHERE id = ?5",
        params![input.name, unit_str, input.price_per_unit, category_id, id],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_ingredient(&row)
}

/// Delete ingredient
pub async fn delete_ingredient(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM ingredients WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Toggle ingredient favorite
pub async fn toggle_ingredient_favorite(db: &Database, id: i64) -> LibsqlResult<Ingredient> {
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE ingredients SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = datetime('now')
         WHERE id = ?1",
        params![id],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_ingredient(&row)
}

/// List all recipes
pub async fn recipes_list(db: &Database) -> LibsqlResult<Vec<RecipeWithIngredients>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, created_at, updated_at
         FROM recipes WHERE event_id IS NULL ORDER BY created_at DESC",
        (),
    ).await?;

    let mut recipes = Vec::new();
    let mut recipe_ids = Vec::new();
    while let Some(row) = rows.next().await? {
        let recipe = row_to_recipe(&row)?;
        recipe_ids.push(recipe.id);
        recipes.push(recipe);
    }

    if recipes.is_empty() {
        return Ok(Vec::new());
    }

    let ids_str = recipe_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
    let query = format!(
        "SELECT ri.id, ri.recipe_id, ri.ingredient_id, ri.ingredient_name, ri.quantity, ri.unit
         FROM recipe_ingredients ri
         WHERE ri.recipe_id IN ({})", ids_str
    );
    let mut rows = conn.query(&query, ()).await?;
    
    let mut ingredients_by_recipe: std::collections::HashMap<i64, Vec<RecipeIngredient>> = std::collections::HashMap::new();
    while let Some(row) = rows.next().await? {
        let unit_str: String = row.get(5)?;
        let unit = match unit_str.as_str() {
            "gram" => Unit::Gram, "kilogram" => Unit::Kilogram, "milligram" => Unit::Milligram,
            "ounce" => Unit::Ounce, "pound" => Unit::Pound, "milliliter" => Unit::Milliliter,
            "liter" => Unit::Liter, "fluid_ounce" => Unit::FluidOunce, "cup" => Unit::Cup,
            "pint" => Unit::Pint, "quart" => Unit::Quart, "gallon" => Unit::Gallon,
            "teaspoon" => Unit::Teaspoon, "tablespoon" => Unit::Tablespoon, "piece" => Unit::Piece,
            "dozen" => Unit::Dozen, "pinch" => Unit::Pinch, "bunch" => Unit::Bunch,
            "clove" => Unit::Clove, "slice" => Unit::Slice, _ => Unit::Gram,
        };

        let recipe_id: i64 = row.get(1)?;
        let ingredient = RecipeIngredient {
            id: row.get(0)?,
            recipe_id,
            ingredient_id: row.get(2)?,
            ingredient_name: row.get(3)?,
            quantity: row.get(4)?,
            unit,
        };
        ingredients_by_recipe.entry(recipe_id).or_default().push(ingredient);
    }

    let mut final_recipes = Vec::with_capacity(recipes.len());
    for recipe in recipes {
        let ingredients = ingredients_by_recipe.remove(&recipe.id).unwrap_or_default();
        final_recipes.push(RecipeWithIngredients { recipe, ingredients });
    }

    Ok(final_recipes)
}

/// List recipes with pagination
pub async fn recipes_paginated(db: &Database, page: u32, per_page: u32) -> LibsqlResult<Paginated<Recipe>> {
    let conn = get_conn(db).await?;
    let offset = (page - 1) * per_page;

    let mut rows = conn.query("SELECT COUNT(*) FROM recipes WHERE event_id IS NULL", ()).await?;
    let total: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    let mut rows = conn.query(
        "SELECT id, name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, created_at, updated_at
         FROM recipes WHERE event_id IS NULL ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
        params![per_page, offset],
    ).await?;

    let mut items = Vec::new();
    while let Some(row) = rows.next().await? {
        items.push(row_to_recipe(&row)?);
    }

    Ok(Paginated {
        items,
        total,
        page,
        per_page,
        total_pages: ((total as f64) / (per_page as f64)).ceil() as u32,
    })
}

/// Get recipe by ID
pub async fn get_recipe(db: &Database, id: i64) -> LibsqlResult<Recipe> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, created_at, updated_at
         FROM recipes WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_recipe(&row)
}

/// Create recipe with ingredients
pub async fn create_recipe(db: &Database, input: RecipeInput) -> LibsqlResult<RecipeWithIngredients> {
    let conn = get_conn(db).await?;
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO recipes (name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, event_id)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9)",
        params![input.name, input.category, input.portions, input.instructions, input.prep_time_minutes, input.cook_time_minutes, tags_json, input.image_base64, input.event_id],
    ).await?;

    let recipe_id = conn.last_insert_rowid();

    // Insert recipe ingredients
    for ingredient_input in &input.ingredients {
        let unit_str = match ingredient_input.unit {
            Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
            Unit::Ounce => "ounce", Unit::Pound => "pound",
            Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
            Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
            Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
            Unit::Piece => "piece", Unit::Dozen => "dozen",
            Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
        };

        // Get ingredient name for denormalization
        let mut rows = conn.query(
            "SELECT name FROM ingredients WHERE id = ?1",
            params![ingredient_input.ingredient_id],
        ).await?;
        let ingredient_name: String = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

        conn.execute(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ingredient_name, quantity, unit)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![recipe_id, ingredient_input.ingredient_id, ingredient_name, ingredient_input.quantity, unit_str],
        ).await?;
    }

    let recipe = get_recipe(db, recipe_id).await?;
    row_to_recipe_with_ingredients(db, recipe).await
}

/// Update recipe
pub async fn update_recipe(db: &Database, id: i64, input: RecipeInput) -> LibsqlResult<RecipeWithIngredients> {
    let conn = get_conn(db).await?;
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE recipes SET name = ?1, category = ?2, portions = ?3, instructions = ?4,
         prep_time_minutes = ?5, cook_time_minutes = ?6, tags = ?7, image_path = ?8, updated_at = datetime('now')
         WHERE id = ?9",
        params![input.name, input.category, input.portions, input.instructions, input.prep_time_minutes, input.cook_time_minutes, tags_json, input.image_base64, id],
    ).await?;

    // Delete existing recipe ingredients
    conn.execute("DELETE FROM recipe_ingredients WHERE recipe_id = ?1", params![id]).await?;

    // Insert new recipe ingredients
    for ingredient_input in &input.ingredients {
        let unit_str = match ingredient_input.unit {
            Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
            Unit::Ounce => "ounce", Unit::Pound => "pound",
            Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
            Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
            Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
            Unit::Piece => "piece", Unit::Dozen => "dozen",
            Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
        };

        let mut rows = conn.query(
            "SELECT name FROM ingredients WHERE id = ?1",
            params![ingredient_input.ingredient_id],
        ).await?;
        let ingredient_name: String = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

        conn.execute(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ingredient_name, quantity, unit)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, ingredient_input.ingredient_id, ingredient_name, ingredient_input.quantity, unit_str],
        ).await?;
    }

    let recipe = get_recipe(db, id).await?;
    row_to_recipe_with_ingredients(db, recipe).await
}

/// Delete recipe
pub async fn delete_recipe(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM recipes WHERE id = ?1", params![id]).await?;
    // recipe_ingredients are cascade deleted
    Ok(())
}

/// Toggle recipe favorite
pub async fn toggle_recipe_favorite(db: &Database, id: i64) -> LibsqlResult<Recipe> {
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE recipes SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = datetime('now')
         WHERE id = ?1",
        params![id],
    ).await?;

    get_recipe(db, id).await
}

/// Clone recipe
pub async fn clone_recipe(db: &Database, id: i64) -> LibsqlResult<RecipeWithIngredients> {
    let conn = get_conn(db).await?;
    let original = get_recipe(db, id).await?;

    let tags_json = serde_json::to_string(&serde_json::from_str::<Vec<String>>(&original.tags).unwrap_or_default())
        .unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO recipes (name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8)",
        params![format!("{} (Cópia)", original.name), original.category, original.portions, original.instructions, original.prep_time_minutes, original.cook_time_minutes, tags_json, original.image_path],
    ).await?;

    let new_id = conn.last_insert_rowid();

    // Copy recipe ingredients
    let mut rows = conn.query(
        "SELECT ingredient_id, ingredient_name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ?1",
        params![id],
    ).await?;

    while let Some(row) = rows.next().await? {
        let ingredient_id: i64 = row.get(0)?;
        let ingredient_name: String = row.get(1)?;
        let quantity: f64 = row.get(2)?;
        let unit: String = row.get(3)?;

        conn.execute(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ingredient_name, quantity, unit)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id, ingredient_id, ingredient_name, quantity, unit],
        ).await?;
    }

    let recipe = get_recipe(db, new_id).await?;
    row_to_recipe_with_ingredients(db, recipe).await
}

/// List stock
pub async fn stock_list(db: &Database) -> LibsqlResult<Vec<StockItem>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT s.id, s.ingredient_id, i.name, i.unit, s.quantity, s.min_quantity, s.updated_at
         FROM stock s
         JOIN ingredients i ON s.ingredient_id = i.id
         WHERE i.event_id IS NULL
         ORDER BY i.name",
        (),
    ).await?;

    let mut items = Vec::new();
    while let Some(row) = rows.next().await? {
        items.push(row_to_stock_item(&row)?);
    }
    Ok(items)
}

/// Get stock by ingredient ID
pub async fn get_stock(db: &Database, ingredient_id: i64) -> LibsqlResult<StockItem> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT s.id, s.ingredient_id, i.name, i.unit, s.quantity, s.min_quantity, s.updated_at
         FROM stock s JOIN ingredients i ON s.ingredient_id = i.id
         WHERE s.ingredient_id = ?1",
        params![ingredient_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_stock_item(&row)
}

/// Upsert stock
pub async fn upsert_stock(db: &Database, input: StockInput) -> LibsqlResult<StockItem> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT name, unit FROM ingredients WHERE id = ?1", params![input.ingredient_id]
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let ingredient_name: String = row.get(0)?;
    let unit_str: String = row.get(1)?;
    drop(rows);

    conn.execute(
        "INSERT INTO stock (ingredient_id, ingredient_name, ingredient_unit, quantity, min_quantity, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(ingredient_id) DO UPDATE SET
         quantity = ?4, min_quantity = ?5, updated_at = datetime('now')",
        params![input.ingredient_id, ingredient_name, unit_str, input.quantity, input.min_quantity],
    ).await?;

    // Release the connection before get_stock opens its own — libsql's
    // connection pool can deadlock if a second connect() is called while
    // the first is still held (manifests as an infinite hang in the UI).
    drop(conn);
    get_stock(db, input.ingredient_id).await
}

/// Update stock quantity
pub async fn update_stock_quantity(db: &Database, ingredient_id: i64, quantity: f64) -> LibsqlResult<StockItem> {
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE stock SET quantity = ?1, updated_at = datetime('now') WHERE ingredient_id = ?2",
        params![quantity, ingredient_id],
    ).await?;

    // Release the connection before get_stock opens its own (pool deadlock).
    drop(conn);
    get_stock(db, ingredient_id).await
}

/// Delete stock
pub async fn delete_stock(db: &Database, ingredient_id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM stock WHERE ingredient_id = ?1", params![ingredient_id]).await?;
    Ok(())
}

/// List shopping lists
pub async fn shopping_lists_list(db: &Database) -> LibsqlResult<Vec<ShoppingList>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, created_at FROM shopping_lists ORDER BY created_at DESC",
        (),
    ).await?;

    let mut lists = Vec::new();
    while let Some(row) = rows.next().await? {
        lists.push(row_to_shopping_list(&row)?);
    }
    Ok(lists)
}

/// Get shopping list with items
pub async fn get_shopping_list(db: &Database, id: i64) -> LibsqlResult<ShoppingList> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, created_at FROM shopping_lists WHERE id = ?1",
        params![id],
    ).await?;
    let list_row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    let mut list = row_to_shopping_list(&list_row)?;

    let mut rows = conn.query(
        "SELECT id, shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes, purchased_at, created_at
         FROM shopping_list_items WHERE shopping_list_id = ?1",
        params![id],
    ).await?;

    let mut items = Vec::new();
    let mut total_cost = 0.0;
    while let Some(row) = rows.next().await? {
        let item = row_to_shopping_item(&row)?;
        total_cost += item.estimated_cost;
        items.push(item);
    }

    list.items = items;
    list.total_estimated_cost = total_cost;
    Ok(list)
}

/// Create shopping list
pub async fn create_shopping_list(db: &Database, name: String, items: Vec<ShoppingItem>) -> LibsqlResult<ShoppingList> {
    let conn = get_conn(db).await?;
    conn.execute("INSERT INTO shopping_lists (name) VALUES (?1)", params![name]).await?;
    let list_id = conn.last_insert_rowid();

    for item in items {
        let unit_str = match item.ingredient_unit {
            Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
            Unit::Ounce => "ounce", Unit::Pound => "pound",
            Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
            Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
            Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
            Unit::Piece => "piece", Unit::Dozen => "dozen",
            Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
        };
        conn.execute(
            "INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![list_id, item.ingredient_id, item.ingredient_name, unit_str, item.needed_quantity, item.stock_quantity, item.to_buy_quantity, item.category, item.estimated_cost, item.purchased as i32, item.notes],
        ).await?;
    }

    get_shopping_list(db, list_id).await
}

/// Create shopping list from recipes
pub async fn create_shopping_list_from_recipes(db: &Database, _recipe_ids: Vec<i64>, _portions_multiplier: u32) -> LibsqlResult<ShoppingList> {
    // This is a complex query - simplified implementation
    let name = format!("Compras {}", chrono::Local::now().format("%d/%m/%Y %H:%M"));
    create_shopping_list(db, name, Vec::new()).await
}

/// Update shopping list item
pub async fn update_shopping_list_item(db: &Database, list_id: i64, item_id: i64, purchased: bool) -> LibsqlResult<ShoppingList> {
    let conn = get_conn(db).await?;
    let purchased_at = if purchased { Some(chrono::Utc::now().to_rfc3339()) } else { None };
    conn.execute(
        "UPDATE shopping_list_items SET purchased = ?1, purchased_at = ?2 WHERE id = ?3 AND shopping_list_id = ?4",
        params![purchased as i32, purchased_at, item_id, list_id],
    ).await?;

    get_shopping_list(db, list_id).await
}

/// Delete shopping list
pub async fn delete_shopping_list(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM shopping_lists WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Update shopping list name
pub async fn update_shopping_list(db: &Database, id: i64, name: String) -> LibsqlResult<ShoppingList> {
    let conn = get_conn(db).await?;
    conn.execute("UPDATE shopping_lists SET name = ?1 WHERE id = ?2", params![name, id]).await?;
    
    let mut rows = conn.query(
        "SELECT id, name, created_at FROM shopping_lists WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_shopping_list(&row)
}

/// Add item to shopping list
pub async fn shopping_list_add_item(
    db: &Database,
    list_id: i64,
    input: ShoppingItemInput,
) -> LibsqlResult<ShoppingItem> {
    let conn = get_conn(db).await?;
    
    let unit_str = match input.ingredient_unit {
        Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
        Unit::Ounce => "ounce", Unit::Pound => "pound",
        Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
        Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
        Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
        Unit::Piece => "piece", Unit::Dozen => "dozen",
        Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
    };

    conn.execute(
        "INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            list_id,
            input.ingredient_id,
            input.ingredient_name,
            unit_str,
            input.needed_quantity,
            input.stock_quantity,
            input.to_buy_quantity,
            input.category,
            input.estimated_cost,
            input.purchased as i32,
            input.notes,
        ],
    ).await?;

    let item_id = conn.last_insert_rowid();
    
    let mut rows = conn.query(
        "SELECT id, shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes, purchased_at, created_at
         FROM shopping_list_items WHERE id = ?1",
        params![item_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_shopping_item(&row)
}

/// Update shopping list item (full update)
pub async fn shopping_list_update_item(
    db: &Database,
    list_id: i64,
    item_id: i64,
    input: ShoppingItemInput,
) -> LibsqlResult<ShoppingItem> {
    let conn = get_conn(db).await?;

    let unit_str = match input.ingredient_unit {
        Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
        Unit::Ounce => "ounce", Unit::Pound => "pound",
        Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
        Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
        Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
        Unit::Piece => "piece", Unit::Dozen => "dozen",
        Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
    };

    conn.execute(
        "UPDATE shopping_list_items 
         SET ingredient_id = ?1, ingredient_name = ?2, ingredient_unit = ?3, needed_quantity = ?4, 
             stock_quantity = ?5, to_buy_quantity = ?6, category = ?7, estimated_cost = ?8, 
             purchased = ?9, notes = ?10
         WHERE id = ?11 AND shopping_list_id = ?12",
        params![
            input.ingredient_id,
            input.ingredient_name,
            unit_str,
            input.needed_quantity,
            input.stock_quantity,
            input.to_buy_quantity,
            input.category,
            input.estimated_cost,
            input.purchased as i32,
            input.notes,
            item_id,
            list_id,
        ],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes, purchased_at, created_at
         FROM shopping_list_items WHERE id = ?1 AND shopping_list_id = ?2",
        params![item_id, list_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_shopping_item(&row)
}

/// Toggle item purchased status
pub async fn shopping_list_toggle_item(
    db: &Database,
    list_id: i64,
    item_id: i64,
    purchased: bool,
) -> LibsqlResult<ShoppingItem> {
    let conn = get_conn(db).await?;
    let purchased_at = if purchased { Some(chrono::Utc::now().to_rfc3339()) } else { None };
    
    conn.execute(
        "UPDATE shopping_list_items SET purchased = ?1, purchased_at = ?2 WHERE id = ?3 AND shopping_list_id = ?4",
        params![purchased as i32, purchased_at, item_id, list_id],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes, purchased_at, created_at
         FROM shopping_list_items WHERE id = ?1 AND shopping_list_id = ?2",
        params![item_id, list_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_shopping_item(&row)
}

/// Mark a shopping list item as purchased and record the real lot bought
/// (brand/supplier/price) as a stock_purchase — the single path that raises
/// stock (Fase 3.1). Quick-add items (no linked ingredient) only flip the
/// flag, since there's no ingredient to raise stock for.
pub async fn shopping_list_mark_purchased(
    db: &Database,
    input: ShoppingListMarkPurchasedInput,
) -> LibsqlResult<ShoppingItem> {
    // ponytail: a fresh short-lived connection per step (not one held across
    // the stock_purchase_add call) — reusing one connection across another
    // connection's writes hit SQLITE_BUSY_SNAPSHOT under WAL (see
    // [[SQLite concurrency risk]]).
    let (ingredient_id, ingredient_unit_str) = {
        let conn = get_conn(db).await?;
        let mut rows = conn.query(
            "SELECT ingredient_id, ingredient_unit FROM shopping_list_items WHERE id = ?1 AND shopping_list_id = ?2",
            params![input.item_id, input.list_id],
        ).await?;
        let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
        let ingredient_id: Option<i64> = row.get(0)?;
        let ingredient_unit_str: String = row.get(1)?;
        (ingredient_id, ingredient_unit_str)
    };

    if let Some(ingredient_id) = ingredient_id {
        stock_purchase_add(db, StockPurchaseInput {
            ingredient_id,
            quantity: input.quantity,
            unit: parse_unit_str(&ingredient_unit_str),
            price_per_unit: input.price_per_unit,
            total_price: input.quantity * input.price_per_unit,
            is_discount: false,
            discount_percent: 0.0,
            purchase_date: chrono::Utc::now(),
            supplier_id: input.supplier_id,
            brand: input.brand,
            notes: input.notes,
        }).await?;
    }

    let purchased_at = chrono::Utc::now().to_rfc3339();
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE shopping_list_items SET purchased = 1, purchased_at = ?1 WHERE id = ?2 AND shopping_list_id = ?3",
        params![purchased_at, input.item_id, input.list_id],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes, purchased_at, created_at
         FROM shopping_list_items WHERE id = ?1 AND shopping_list_id = ?2",
        params![input.item_id, input.list_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_shopping_item(&row)
}

/// Remove item from shopping list
pub async fn shopping_list_remove_item(
    db: &Database,
    list_id: i64,
    item_id: i64,
) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute(
        "DELETE FROM shopping_list_items WHERE id = ?1 AND shopping_list_id = ?2",
        params![item_id, list_id],
    ).await?;
    Ok(())
}

/// Reorder shopping list items
pub async fn shopping_list_reorder_items(
    db: &Database,
    list_id: i64,
    item_ids: Vec<i64>,
) -> LibsqlResult<Vec<ShoppingItem>> {
    let conn = get_conn(db).await?;
    
    // Update sort order using a temporary column or by re-inserting
    // For simplicity, we'll use a sorting index stored in a new column or just return the re-ordered items
    // Since we don't have a sort_order column, we'll just return the items in the requested order
    let mut items = Vec::new();
    for (_index, item_id) in item_ids.iter().enumerate() {
        // We could add a sort_order column, but for now just verify the items belong to the list
        let mut rows = conn.query(
            "SELECT id, shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, notes, purchased_at, created_at
             FROM shopping_list_items WHERE id = ?1 AND shopping_list_id = ?2",
            params![item_id, list_id],
        ).await?;
        if let Some(row) = rows.next().await? {
            let item = row_to_shopping_item(&row)?;
            items.push(item);
        }
    }
    Ok(items)
}

/// Group shopping list items by category
pub async fn shopping_list_group_by_category(
    db: &Database,
    list_id: i64,
) -> LibsqlResult<std::collections::HashMap<String, Vec<ShoppingItem>>> {
    let list = get_shopping_list(db, list_id).await?;
    let mut grouped: std::collections::HashMap<String, Vec<ShoppingItem>> = std::collections::HashMap::new();
    
    for item in list.items {
        let category = if item.category.is_empty() { 
            "Sem categoria".to_string() 
        } else { 
            item.category.clone() 
        };
        grouped.entry(category).or_default().push(item);
    }
    
    Ok(grouped)
}

/// Clear purchased items from shopping list
pub async fn shopping_list_clear_purchased(
    db: &Database,
    list_id: i64,
) -> LibsqlResult<ShoppingList> {
    let conn = get_conn(db).await?;
    conn.execute(
        "DELETE FROM shopping_list_items WHERE shopping_list_id = ?1 AND purchased = 1",
        params![list_id],
    ).await?;
    get_shopping_list(db, list_id).await
}

/// Suggest recipes based on stock
pub async fn suggest_recipes(_db: &Database) -> LibsqlResult<Vec<SuggestedRecipe>> {
    // Simplified implementation - return empty
    Ok(Vec::new())
}

/// Weighted-average price per unit across an ingredient's purchase history
/// (Fase 3.1: multiple brands/suppliers in stock, weighted by quantity
/// bought). Falls back to `ingredients.price_per_unit` when there's no
/// purchase history yet. ponytail: no lot-depletion tracking exists today
/// (stock consumption is a manual aggregate set, see PROJECT.md 3.1), so
/// this weights by quantity ever purchased, not quantity currently on the
/// shelf — revisit if/when lot-remaining tracking is built.
async fn weighted_avg_stock_price(conn: &Connection, ingredient_id: i64, fallback: f64) -> LibsqlResult<f64> {
    let mut rows = conn.query(
        "SELECT SUM(quantity * price_per_unit), SUM(quantity) FROM stock_purchases WHERE ingredient_id = ?1",
        params![ingredient_id],
    ).await?;
    if let Some(row) = rows.next().await? {
        let weighted_sum: Option<f64> = row.get(0)?;
        let total_qty: Option<f64> = row.get(1)?;
        if let (Some(sum), Some(qty)) = (weighted_sum, total_qty) {
            if qty > 0.0 {
                return Ok(sum / qty);
            }
        }
    }
    Ok(fallback)
}

/// Calculate recipe cost
pub async fn calculate_cost(db: &Database, recipe_id: i64) -> LibsqlResult<CostBreakdown> {
    let conn = get_conn(db).await?;

    // Get recipe portions
    let mut rows = conn.query(
        "SELECT portions FROM recipes WHERE id = ?1",
        params![recipe_id],
    ).await?;
    let portions: u32 = rows.next().await?
        .ok_or_else(|| libsql::Error::QueryReturnedNoRows)?
        .get(0)?;

    // Get ingredients with their prices (JOIN ingredients for current price).
    // i.unit is the unit price_per_unit is denominated in, which may differ
    // from ri.unit (the unit chosen for this recipe line) — e.g. an
    // ingredient priced per kilogram used as grams in a recipe.
    let mut rows = conn.query(
        r#"SELECT ri.ingredient_name, ri.quantity, ri.unit, i.price_per_unit, i.unit, ri.ingredient_id
           FROM recipe_ingredients ri
           JOIN ingredients i ON ri.ingredient_id = i.id
           WHERE ri.recipe_id = ?1"#,
        params![recipe_id],
    ).await?;

    let mut ingredient_costs = Vec::new();
    let mut total_cost = 0.0_f64;

    fn parse_unit(unit_str: &str) -> Unit {
        match unit_str {
            "gram" => Unit::Gram, "kilogram" => Unit::Kilogram, "milligram" => Unit::Milligram,
            "ounce" => Unit::Ounce, "pound" => Unit::Pound,
            "milliliter" => Unit::Milliliter, "liter" => Unit::Liter, "fluid_ounce" => Unit::FluidOunce,
            "cup" => Unit::Cup, "pint" => Unit::Pint, "quart" => Unit::Quart, "gallon" => Unit::Gallon,
            "teaspoon" => Unit::Teaspoon, "tablespoon" => Unit::Tablespoon,
            "piece" => Unit::Piece, "dozen" => Unit::Dozen,
            "pinch" => Unit::Pinch, "bunch" => Unit::Bunch, "clove" => Unit::Clove, "slice" => Unit::Slice,
            _ => Unit::Gram,
        }
    }

    while let Some(row) = rows.next().await? {
        let name: String = row.get(0)?;
        let quantity: f64 = row.get(1)?;
        let unit_str: String = row.get(2)?;
        let unit = parse_unit(&unit_str);
        let ingredient_id: i64 = row.get(5)?;
        let price_per_unit = weighted_avg_stock_price(&conn, ingredient_id, row.get(3)?).await?;
        let ingredient_unit = parse_unit(&row.get::<String>(4)?);

        // Convert the recipe line's quantity into the ingredient's priced
        // unit before multiplying — otherwise "150 g" of an ingredient
        // priced per kilogram would cost 1000x too much. When the units
        // aren't convertible (e.g. "clove" has no fixed physical size),
        // fall back to an approximate weight lookup before giving up and
        // using the quantity as-is.
        let mut is_approximate = false;
        let mut approximation_note: Option<String> = None;
        let quantity_in_ingredient_unit = match unit.convert_to(ingredient_unit, quantity) {
            Some(q) => q,
            None => match lookup_approximate_grams_per_unit(&conn, &name, &unit_str).await? {
                Some((grams_per_unit, note)) => {
                    let quantity_in_grams = quantity * grams_per_unit;
                    match Unit::Gram.convert_to(ingredient_unit, quantity_in_grams) {
                        Some(q) => {
                            is_approximate = true;
                            approximation_note = Some(note);
                            q
                        }
                        None => quantity,
                    }
                }
                None => quantity,
            },
        };
        let line_cost = quantity_in_ingredient_unit * price_per_unit;
        total_cost += line_cost;

        // Report price_per_unit re-expressed in the recipe line's own unit
        // (not the ingredient's stored unit) so the displayed row is
        // internally consistent: quantity * price_per_unit == total_cost.
        let display_price_per_unit = if quantity != 0.0 { line_cost / quantity } else { price_per_unit };

        ingredient_costs.push(IngredientCost {
            name,
            quantity,
            unit,
            price_per_unit: display_price_per_unit,
            total_cost: line_cost,
            is_approximate,
            approximation_note,
        });
    }

    let cost_per_portion = if portions > 0 { total_cost / portions as f64 } else { 0.0 };

    Ok(CostBreakdown {
        total_cost,
        cost_per_portion,
        ingredient_costs,
    })
}

/// Look up an approximate gram-per-unit weight for a descriptive count
/// unit (e.g. "clove") that has no fixed physical size, matched by
/// ingredient name substring. Prefers the most specific (longest) pattern
/// when more than one matches. Returns the factor plus a human-readable
/// note for the UI.
async fn lookup_approximate_grams_per_unit(
    conn: &Connection,
    ingredient_name: &str,
    from_unit: &str,
) -> LibsqlResult<Option<(f64, String)>> {
    let mut rows = conn.query(
        r#"
        SELECT approx_grams_per_unit, ingredient_name_pattern
        FROM approximate_unit_weights
        WHERE from_unit = ?1
          AND LOWER(?2) LIKE '%' || LOWER(ingredient_name_pattern) || '%'
        ORDER BY LENGTH(ingredient_name_pattern) DESC
        LIMIT 1
        "#,
        params![from_unit, ingredient_name],
    ).await?;
    if let Some(row) = rows.next().await? {
        let grams_per_unit: f64 = row.get(0)?;
        let _pattern: String = row.get(1)?;
        let note = format!("~{:.0}g por {} (custo aproximado)", grams_per_unit, from_unit);
        Ok(Some((grams_per_unit, note)))
    } else {
        Ok(None)
    }
}

/// Analyze recipe cost with margin (returns same breakdown; margin is
/// computed in the frontend where the CostAnalysis shape lives).
pub async fn analyze_cost(db: &Database, recipe_id: i64, _margin_percent: f64) -> LibsqlResult<CostBreakdown> {
    calculate_cost(db, recipe_id).await
}

/// Get setting
pub async fn get_setting(db: &Database, key: &str) -> LibsqlResult<Option<String>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query("SELECT value FROM settings WHERE key = ?1", params![key]).await?;
    if let Some(row) = rows.next().await? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

/// Set setting
pub async fn set_setting(db: &Database, key: &str, value: &str) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
        params![key, value],
    ).await?;
    Ok(())
}

/// Get all settings as a HashMap
pub async fn get_all_settings(db: &Database) -> LibsqlResult<std::collections::HashMap<String, String>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query("SELECT key, value FROM settings", ()).await?;
    let mut settings = std::collections::HashMap::new();
    while let Some(row) = rows.next().await? {
        let key: String = row.get(0)?;
        let value: String = row.get(1)?;
        settings.insert(key, value);
    }
    Ok(settings)
}

/// Reset all settings to defaults (delete all settings)
pub async fn reset_to_defaults(db: &Database) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM settings", ()).await?;
    Ok(())
}

/// Delete ALL data from the database (ingredients, recipes, stock, etc.)
/// but keep the schema (tables) intact. Used by the "Apagar todos os dados"
/// button in Settings. Deletes in reverse dependency order to avoid FK issues
/// (even though FKs are not enforced by default in libsql, this is safer).
pub async fn delete_all_data(db: &Database) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    // Child tables first (dependencies), then parent tables
    conn.execute("DELETE FROM shopping_list_items", ()).await?;
    conn.execute("DELETE FROM shopping_lists", ()).await?;
    conn.execute("DELETE FROM meal_plan_entries", ()).await?;
    conn.execute("DELETE FROM meal_plans", ()).await?;
    conn.execute("DELETE FROM price_quotes", ()).await?;
    conn.execute("DELETE FROM stock_purchases", ()).await?;
    conn.execute("DELETE FROM receipt_imports", ()).await?;
    conn.execute("DELETE FROM images", ()).await?;
    conn.execute("DELETE FROM stock", ()).await?;
    conn.execute("DELETE FROM recipe_ingredients", ()).await?;
    conn.execute("DELETE FROM recipes", ()).await?;
    conn.execute("DELETE FROM ingredients", ()).await?;
    conn.execute("DELETE FROM suppliers", ()).await?;
    conn.execute("DELETE FROM categories", ()).await?;
    conn.execute("DELETE FROM settings", ()).await?;
    conn.execute("DELETE FROM events", ()).await?;
    Ok(())
}

/// Seed demo data for testing.
///
/// Deliberately includes several recipe lines whose unit differs from the
/// matching ingredient's priced unit (e.g. a recipe using "gram" for an
/// ingredient priced "per kilogram") — this exercises the unit-conversion
/// path in `calculate_cost` as a regression check, not just a happy path.
/// Also spreads price_quotes/stock_purchases/shopping purchases across the
/// last ~90 days and includes a meal plan spanning past+future days, so
/// the reports (Custos, Relatórios) have enough to show.
pub async fn seed_demo_data(db: &Database) -> LibsqlResult<()> {
    use std::collections::HashMap;

    // Delete all existing data first
    delete_all_data(db).await?;

    let conn = get_conn(db).await?;
    let now = Utc::now();
    let days_ago = |d: i64| (now - chrono::Duration::days(d)).to_rfc3339();

    // 1. Categories
    let ingredient_categories: [(&str, &str, &str); 5] = [
        ("Mercearia", "#e9c46a", "🌾"),
        ("Laticínios", "#fcbf49", "🧀"),
        ("Carnes e Peixes", "#d62828", "🥩"),
        ("Frutas e Legumes", "#2d6a4f", "🥦"),
        ("Bebidas", "#40916c", "🥤"),
    ];
    let mut cat_ids: HashMap<&str, i64> = HashMap::new();
    for (i, (name, color, icon)) in ingredient_categories.iter().enumerate() {
        conn.execute(
            "INSERT INTO categories (name, kind, color, icon, sort_order) VALUES (?1, 'ingredient', ?2, ?3, ?4)",
            params![*name, *color, *icon, i as i64],
        ).await?;
        cat_ids.insert(name, conn.last_insert_rowid());
    }
    let recipe_categories: [(&str, &str, &str); 6] = [
        ("Sopas", "#40916c", "🍲"),
        ("Saladas", "#52b788", "🥗"),
        ("Pratos Principais", "#1b4332", "🍖"),
        ("Acompanhamentos", "#74c69d", "🥔"),
        ("Sobremesas", "#95d5b2", "🍰"),
        ("Pequeno-almoço", "#b7e4c7", "🍳"),
    ];
    for (i, (name, color, icon)) in recipe_categories.iter().enumerate() {
        conn.execute(
            "INSERT INTO categories (name, kind, color, icon, sort_order) VALUES (?1, 'recipe', ?2, ?3, ?4)",
            params![*name, *color, *icon, i as i64],
        ).await?;
    }

    // 2. Suppliers (4, for by_supplier variety)
    let suppliers: [(&str, &str, &str); 4] = [
        ("Metro", "912345678", "Fornecedor principal (grosso)"),
        ("Continente", "continente@continente.pt", "Supermercado local"),
        ("Fornecedor Local", "925111222", "Produtor da região"),
        ("Mercado Bio", "bio@mercado.pt", "Produtos biológicos"),
    ];
    let mut supplier_ids: Vec<i64> = Vec::new();
    for (name, contact, notes) in suppliers.iter() {
        conn.execute(
            "INSERT INTO suppliers (name, contact, notes) VALUES (?1, ?2, ?3)",
            params![*name, *contact, *notes],
        ).await?;
        supplier_ids.push(conn.last_insert_rowid());
    }

    // 3. Ingredients — deliberately varied priced units (kg, liter, dozen,
    // piece), not everything in grams.
    let ingredients_data: [(&str, &str, f64, &str); 19] = [
        ("Farinha", "kilogram", 1.20, "Mercearia"),
        ("Açúcar", "kilogram", 1.10, "Mercearia"),
        ("Sal", "kilogram", 0.80, "Mercearia"),
        ("Arroz", "kilogram", 1.30, "Mercearia"),
        ("Fermento em pó", "piece", 0.50, "Mercearia"),
        ("Chocolate em pó", "kilogram", 8.50, "Mercearia"),
        ("Leite", "liter", 0.90, "Laticínios"),
        ("Ovos", "dozen", 2.20, "Laticínios"),
        ("Manteiga", "kilogram", 6.00, "Laticínios"),
        ("Queijo ralado", "kilogram", 9.00, "Laticínios"),
        ("Frango (peito)", "kilogram", 5.50, "Carnes e Peixes"),
        ("Carne picada", "kilogram", 6.80, "Carnes e Peixes"),
        ("Batata", "kilogram", 0.70, "Frutas e Legumes"),
        ("Cebola", "kilogram", 0.60, "Frutas e Legumes"),
        ("Alho", "kilogram", 3.00, "Frutas e Legumes"),
        ("Tomate", "kilogram", 1.50, "Frutas e Legumes"),
        ("Limão", "piece", 0.30, "Frutas e Legumes"),
        ("Azeite", "liter", 4.50, "Bebidas"),
        ("Vinho branco (culinária)", "liter", 3.50, "Bebidas"),
    ];
    let mut ing_ids: HashMap<&str, i64> = HashMap::new();
    for (name, unit, price, cat) in ingredients_data.iter() {
        let cat_id = cat_ids[cat];
        conn.execute(
            "INSERT INTO ingredients (name, unit, price_per_unit, category_id, favorite) VALUES (?1, ?2, ?3, ?4, 0)",
            params![*name, *unit, *price, cat_id],
        ).await?;
        ing_ids.insert(name, conn.last_insert_rowid());
    }

    // 4. Stock for every ingredient
    for (name, unit, _price, _cat) in ingredients_data.iter() {
        let id = ing_ids[name];
        conn.execute(
            "INSERT INTO stock (ingredient_id, ingredient_name, ingredient_unit, quantity, min_quantity) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, *name, *unit, 5.0, 1.0],
        ).await?;
    }

    // 5. Recipes with ingredient lines. Quantities are in the UNIT USED IN
    // THE RECIPE, which for most lines here deliberately differs from the
    // ingredient's priced unit above (e.g. "Farinha" is priced per
    // kilogram but recipes call for grams) — this is the regression case
    // for the unit-conversion fix in calculate_cost.
    let recipes_data: Vec<(&str, &str, u32, &str, u32, u32, Vec<(&str, f64, &str)>)> = vec![
        (
            "Bolo de Chocolate", "Sobremesas", 8,
            "Misturar farinha, chocolate, leite, ovos e manteiga. Cozer a 180ºC durante 40 min.",
            15, 40,
            vec![
                ("Farinha", 200.0, "gram"),
                ("Chocolate em pó", 150.0, "gram"),
                ("Leite", 250.0, "milliliter"),
                ("Ovos", 4.0, "piece"),
                ("Manteiga", 100.0, "gram"),
            ],
        ),
        (
            "Sopa de Legumes", "Sopas", 6,
            "Refogar cebola e alho, juntar batata e água, cozer 25 min e triturar.",
            10, 30,
            vec![
                ("Batata", 500.0, "gram"),
                ("Cebola", 200.0, "gram"),
                ("Azeite", 30.0, "milliliter"),
                ("Sal", 5.0, "gram"),
            ],
        ),
        (
            "Frango Grelhado com Arroz", "Pratos Principais", 4,
            "Grelhar o frango temperado, cozer o arroz em água e alho.",
            15, 25,
            vec![
                ("Frango (peito)", 600.0, "gram"),
                ("Arroz", 300.0, "gram"),
                ("Azeite", 20.0, "milliliter"),
                ("Sal", 5.0, "gram"),
                ("Alho", 2.0, "clove"),
            ],
        ),
        (
            "Massa à Bolonhesa", "Pratos Principais", 5,
            "Refogar carne picada com cebola, alho e tomate, servir com massa.",
            15, 35,
            vec![
                ("Carne picada", 500.0, "gram"),
                ("Tomate", 400.0, "gram"),
                ("Cebola", 100.0, "gram"),
                ("Alho", 3.0, "clove"),
                ("Azeite", 15.0, "milliliter"),
                ("Queijo ralado", 50.0, "gram"),
            ],
        ),
        (
            "Salada de Tomate", "Saladas", 4,
            "Cortar tomate e cebola, temperar com azeite e sal.",
            10, 0,
            vec![
                ("Tomate", 300.0, "gram"),
                ("Cebola", 50.0, "gram"),
                ("Azeite", 20.0, "milliliter"),
                ("Sal", 2.0, "gram"),
            ],
        ),
        (
            "Omelete de Queijo", "Pequeno-almoço", 2,
            "Bater os ovos, juntar queijo ralado e cozinhar em lume médio com manteiga.",
            5, 10,
            vec![
                ("Ovos", 3.0, "piece"),
                ("Queijo ralado", 80.0, "gram"),
                ("Manteiga", 20.0, "gram"),
                ("Sal", 1.0, "gram"),
            ],
        ),
        (
            "Batatas Assadas", "Acompanhamentos", 4,
            "Cortar as batatas, regar com azeite e alho, assar a 200ºC 40 min.",
            10, 40,
            vec![
                ("Batata", 800.0, "gram"),
                ("Azeite", 40.0, "milliliter"),
                ("Alho", 4.0, "clove"),
                ("Sal", 5.0, "gram"),
            ],
        ),
        (
            "Limonada", "Bebidas", 4,
            "Espremer os limões, juntar açúcar e água fria, mexer bem.",
            10, 0,
            vec![
                ("Limão", 4.0, "piece"),
                ("Açúcar", 100.0, "gram"),
            ],
        ),
        (
            "Risotto de Frango", "Pratos Principais", 4,
            "Refogar cebola, juntar arroz, ir molhando com caldo, adicionar frango e vinho branco.",
            15, 30,
            vec![
                ("Arroz", 350.0, "gram"),
                ("Frango (peito)", 400.0, "gram"),
                ("Vinho branco (culinária)", 100.0, "milliliter"),
                ("Queijo ralado", 60.0, "gram"),
                ("Cebola", 80.0, "gram"),
            ],
        ),
    ];

    let mut recipe_ids: HashMap<&str, i64> = HashMap::new();
    for (name, category, portions, instructions, prep, cook, ingredients) in recipes_data.iter() {
        conn.execute(
            "INSERT INTO recipes (name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags)
             VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, '[]')",
            params![*name, *category, *portions, *instructions, *prep, *cook],
        ).await?;
        let recipe_id = conn.last_insert_rowid();
        recipe_ids.insert(name, recipe_id);

        for (ing_name, quantity, unit) in ingredients.iter() {
            let ing_id = ing_ids[ing_name];
            conn.execute(
                "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ingredient_name, quantity, unit) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![recipe_id, ing_id, *ing_name, *quantity, *unit],
            ).await?;
        }
    }

    // 6. Price quotes — spread across the last 90 days, varying slightly
    // between suppliers for the same ingredient (for report_price_trends).
    let quoted_ingredients = [
        "Farinha", "Leite", "Ovos", "Azeite", "Frango (peito)", "Carne picada", "Queijo ralado",
    ];
    for ing_name in quoted_ingredients.iter() {
        let base_price = ingredients_data.iter().find(|(n, ..)| n == ing_name).unwrap().2;
        let ing_id = ing_ids[ing_name];
        let quote_offsets = [75_i64, 45, 20, 5];
        for (i, days) in quote_offsets.iter().enumerate() {
            let supplier = suppliers[i % suppliers.len()].0;
            let variation = 1.0 + (i as f64 * 0.05) - 0.1; // some quotes cheaper, some pricier
            let price = (base_price * variation * 100.0).round() / 100.0;
            conn.execute(
                "INSERT INTO price_quotes (ingredient_id, supplier, price_per_unit, is_promo, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![ing_id, supplier, price, (i == quote_offsets.len() - 1) as i64, days_ago(*days)],
            ).await?;
        }
    }

    // 7. Stock purchases — spread across the last 90 days and rotated
    // across all 4 suppliers, so the Costs report's "by_supplier" (sourced
    // from stock_purchases, see get_cost_report) has real variety.
    let purchase_plan: [(&str, f64, i64, usize); 16] = [
        ("Farinha", 5.0, 85, 0), ("Leite", 6.0, 80, 1), ("Ovos", 3.0, 70, 2),
        ("Frango (peito)", 4.0, 65, 3), ("Carne picada", 3.0, 55, 0),
        ("Queijo ralado", 2.0, 50, 1), ("Azeite", 4.0, 40, 2),
        ("Arroz", 6.0, 35, 3), ("Batata", 8.0, 30, 0), ("Cebola", 4.0, 25, 1),
        ("Tomate", 5.0, 20, 2), ("Manteiga", 2.0, 15, 3),
        ("Chocolate em pó", 1.5, 10, 0), ("Vinho branco (culinária)", 2.0, 8, 1),
        ("Alho", 1.0, 5, 2), ("Limão", 12.0, 2, 3),
    ];
    for (ing_name, quantity, days, supplier_idx) in purchase_plan.iter() {
        let (unit, price_per_unit) = ingredients_data.iter()
            .find(|(n, ..)| n == ing_name)
            .map(|(_, u, p, _)| (*u, *p))
            .unwrap();
        let ing_id = ing_ids[ing_name];
        let supplier_id = supplier_ids[*supplier_idx];
        let total_price = quantity * price_per_unit;
        conn.execute(
            "INSERT INTO stock_purchases (ingredient_id, quantity, unit, price_per_unit, total_price, is_discount, discount_percent, purchase_date, supplier_id, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6, ?7, 'Compra demo')",
            params![ing_id, *quantity, unit, price_per_unit, total_price, days_ago(*days), supplier_id],
        ).await?;
    }

    // 8. Meal plan spanning past AND future (so both get_meal_stats,
    // which only looks backward, and the dashboard's upcoming-meals view,
    // which only looks forward, have something to show).
    let plan_start = now - chrono::Duration::days(7);
    let plan_end = now + chrono::Duration::days(7);
    conn.execute(
        "INSERT INTO meal_plans (name, start_date, end_date) VALUES ('Plano Demo (2 Semanas)', ?1, ?2)",
        params![plan_start.to_rfc3339(), plan_end.to_rfc3339()],
    ).await?;
    let plan_id = conn.last_insert_rowid();

    let meal_entries: [(&str, &str, &str, u32); 10] = [
        ("monday", "breakfast", "Omelete de Queijo", 2),
        ("monday", "dinner", "Massa à Bolonhesa", 4),
        ("tuesday", "lunch", "Sopa de Legumes", 4),
        ("tuesday", "dinner", "Frango Grelhado com Arroz", 4),
        ("wednesday", "dinner", "Bolo de Chocolate", 8),
        ("thursday", "lunch", "Risotto de Frango", 4),
        ("thursday", "dinner", "Salada de Tomate", 2),
        ("friday", "dinner", "Batatas Assadas", 4),
        ("saturday", "lunch", "Massa à Bolonhesa", 6),
        ("sunday", "breakfast", "Limonada", 2),
    ];
    for (day_of_week, meal_type, recipe_name, portions) in meal_entries.iter() {
        let recipe_id = recipe_ids[recipe_name];
        conn.execute(
            "INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, recipe_name, day_of_week, meal_type, portions)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![plan_id, recipe_id, *recipe_name, *day_of_week, *meal_type, *portions],
        ).await?;
    }

    // 9. Shopping list — name contains "Compras" so get_cost_report's
    // by_recipe (which filters on the list name) can match it. Mix of
    // purchased items (with purchased_at spread over the last 90 days, for
    // get_cost_report's total_spent/by_category) and pending ones.
    conn.execute(
        "INSERT INTO shopping_lists (name) VALUES ('Lista de Compras Semanal')",
        (),
    ).await?;
    let list_id = conn.last_insert_rowid();

    let shopping_items: [(&str, f64, i64, &str, bool); 12] = [
        ("Farinha", 1.0, 60, "Mercearia", true),
        ("Açúcar", 1.0, 60, "Mercearia", true),
        ("Leite", 2.0, 45, "Laticínios", true),
        ("Ovos", 1.0, 45, "Laticínios", true),
        ("Frango (peito)", 1.5, 30, "Carnes e Peixes", true),
        ("Queijo ralado", 0.5, 20, "Laticínios", true),
        ("Azeite", 1.0, 10, "Bebidas", true),
        ("Batata", 2.0, 0, "Frutas e Legumes", false),
        ("Cebola", 1.0, 0, "Frutas e Legumes", false),
        ("Tomate", 1.5, 0, "Frutas e Legumes", false),
        ("Vinho branco (culinária)", 1.0, 0, "Bebidas", false),
        ("__none__", 50.0, 0, "Outros", false), // quick-add item, no ingredient_id
    ];
    for (ing_name, quantity, days_purchased, category, purchased) in shopping_items.iter() {
        if *ing_name == "__none__" {
            conn.execute(
                "INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased)
                 VALUES (?1, NULL, 'Guardanapos', 'piece', 50.0, 0.0, 50.0, ?2, 0.0, 0)",
                params![list_id, *category],
            ).await?;
            continue;
        }
        let ing_id = ing_ids[ing_name];
        let (unit, price_per_unit) = ingredients_data.iter()
            .find(|(n, ..)| n == ing_name)
            .map(|(_, u, p, _)| (*u, *p))
            .unwrap();
        let estimated_cost = quantity * price_per_unit;
        if *purchased {
            conn.execute(
                "INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased, purchased_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0.0, ?5, ?6, ?7, 1, ?8)",
                params![list_id, ing_id, *ing_name, unit, *quantity, *category, estimated_cost, days_ago(*days_purchased)],
            ).await?;
        } else {
            conn.execute(
                "INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0.0, ?5, ?6, ?7, 0)",
                params![list_id, ing_id, *ing_name, unit, *quantity, *category, estimated_cost],
            ).await?;
        }
    }

    // 10. Event (Fase 3.2) — one demo event with a recipe copied from the
    // catalog (scaled up, showing the frozen/isolated quantities) and one
    // recipe authored directly inside the event (never shown in the
    // catalog until promoted).
    conn.execute(
        "INSERT INTO events (name, event_date, notes) VALUES (?1, ?2, ?3)",
        params![
            "Casamento Ana & Pedro",
            (now + chrono::Duration::days(45)).format("%Y-%m-%d").to_string(),
            "120 convidados, buffet volante"
        ],
    ).await?;
    let event_id = conn.last_insert_rowid();

    let base_recipe_id = recipe_ids["Bolo de Chocolate"];
    conn.execute(
        "INSERT INTO recipes (name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, event_id, base_recipe_id)
         VALUES ('Bolo de Chocolate', 'Sobremesas', 60, ?1, 0, 15, 40, '[]', ?2, ?3)",
        params![
            "Misturar farinha, chocolate, leite, ovos e manteiga. Cozer a 180ºC durante 40 min.",
            event_id, base_recipe_id
        ],
    ).await?;
    let event_recipe_id = conn.last_insert_rowid();
    for (ing_name, quantity, unit) in [("Farinha", 1500.0, "gram"), ("Chocolate em pó", 1125.0, "gram"), ("Leite", 1875.0, "milliliter"), ("Ovos", 30.0, "piece"), ("Manteiga", 750.0, "gram")] {
        let ing_id = ing_ids[ing_name];
        conn.execute(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ingredient_name, quantity, unit) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![event_recipe_id, ing_id, ing_name, quantity, unit],
        ).await?;
    }

    conn.execute(
        "INSERT INTO recipes (name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, event_id)
         VALUES ('Bolo dos Noivos', 'Sobremesas', 1, 'Bolo decorativo, apenas para a mesa principal.', 0, 60, 90, '[]', ?1)",
        params![event_id],
    ).await?;
    let exclusive_recipe_id = conn.last_insert_rowid();
    conn.execute(
        "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ingredient_name, quantity, unit) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![exclusive_recipe_id, ing_ids["Chocolate em pó"], "Chocolate em pó", 2000.0, "gram"],
    ).await?;

    Ok(())
}

/// List categories
pub async fn categories_list(db: &Database, kind: Option<&str>) -> LibsqlResult<Vec<Category>> {
    let conn = get_conn(db).await?;
    let query = if let Some(kind) = kind {
        format!("SELECT id, name, kind, color, icon, sort_order FROM categories WHERE kind = '{}' ORDER BY sort_order", kind)
    } else {
        "SELECT id, name, kind, color, icon, sort_order FROM categories ORDER BY sort_order".to_string()
    };
    let mut rows = conn.query(&query, ()).await?;
    let mut categories = Vec::new();
    while let Some(row) = rows.next().await? {
        categories.push(row_to_category(&row)?);
    }
    Ok(categories)
}

/// Create category
pub async fn create_category(db: &Database, input: CategoryInput) -> LibsqlResult<Category> {
    let conn = get_conn(db).await?;
    let kind_str = match input.kind {
        CategoryKind::Ingredient => "ingredient",
        CategoryKind::Recipe => "recipe",
    };
    conn.execute(
        "INSERT INTO categories (name, kind, color, icon, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![input.name, kind_str, input.color, input.icon, input.sort_order],
    ).await?;
    let id = conn.last_insert_rowid();
    let mut rows = conn.query("SELECT id, name, kind, color, icon, sort_order FROM categories WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_category(&row)
}

/// Update category
pub async fn update_category(db: &Database, id: i64, input: CategoryInput) -> LibsqlResult<Category> {
    let conn = get_conn(db).await?;
    let kind_str = match input.kind {
        CategoryKind::Ingredient => "ingredient",
        CategoryKind::Recipe => "recipe",
    };
    conn.execute(
        "UPDATE categories SET name = ?1, kind = ?2, color = ?3, icon = ?4, sort_order = ?5 WHERE id = ?6",
        params![input.name, kind_str, input.color, input.icon, input.sort_order, id],
    ).await?;
    let mut rows = conn.query("SELECT id, name, kind, color, icon, sort_order FROM categories WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_category(&row)
}

/// Delete category
pub async fn delete_category(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM categories WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// List suppliers
pub async fn suppliers_list(db: &Database) -> LibsqlResult<Vec<Supplier>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query("SELECT id, name, contact, notes, created_at, updated_at FROM suppliers ORDER BY name", ()).await?;
    let mut suppliers = Vec::new();
    while let Some(row) = rows.next().await? {
        suppliers.push(row_to_supplier(&row)?);
    }
    Ok(suppliers)
}

/// Create supplier
pub async fn create_supplier(db: &Database, input: SupplierInput) -> LibsqlResult<Supplier> {
    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO suppliers (name, contact, notes) VALUES (?1, ?2, ?3)",
        params![input.name, input.contact, input.notes],
    ).await?;
    let id = conn.last_insert_rowid();
    let mut rows = conn.query("SELECT id, name, contact, notes, created_at, updated_at FROM suppliers WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_supplier(&row)
}

/// Update supplier
pub async fn update_supplier(db: &Database, id: i64, input: SupplierInput) -> LibsqlResult<Supplier> {
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE suppliers SET name = ?1, contact = ?2, notes = ?3, updated_at = datetime('now') WHERE id = ?4",
        params![input.name, input.contact, input.notes, id],
    ).await?;
    let mut rows = conn.query("SELECT id, name, contact, notes, created_at, updated_at FROM suppliers WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_supplier(&row)
}

/// Delete supplier
pub async fn delete_supplier(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM suppliers WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Map a libsql Row to Event
fn row_to_event(row: &Row) -> LibsqlResult<Event> {
    let created_at_str: String = row.get(4)?;
    let updated_at_str: String = row.get(5)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(Event {
        id: row.get(0)?,
        name: row.get(1)?,
        event_date: row.get(2)?,
        notes: row.get(3)?,
        created_at,
        updated_at,
    })
}

/// List events
pub async fn events_list(db: &Database) -> LibsqlResult<Vec<Event>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, event_date, notes, created_at, updated_at FROM events ORDER BY event_date IS NULL, event_date, created_at DESC",
        (),
    ).await?;
    let mut events = Vec::new();
    while let Some(row) = rows.next().await? {
        events.push(row_to_event(&row)?);
    }
    Ok(events)
}

/// Create event
pub async fn create_event(db: &Database, input: EventInput) -> LibsqlResult<Event> {
    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO events (name, event_date, notes) VALUES (?1, ?2, ?3)",
        params![input.name, input.event_date, input.notes],
    ).await?;
    let id = conn.last_insert_rowid();
    let mut rows = conn.query("SELECT id, name, event_date, notes, created_at, updated_at FROM events WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_event(&row)
}

/// Update event
pub async fn update_event(db: &Database, id: i64, input: EventInput) -> LibsqlResult<Event> {
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE events SET name = ?1, event_date = ?2, notes = ?3, updated_at = datetime('now') WHERE id = ?4",
        params![input.name, input.event_date, input.notes, id],
    ).await?;
    let mut rows = conn.query("SELECT id, name, event_date, notes, created_at, updated_at FROM events WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_event(&row)
}

/// Delete event, and every recipe variant copied into it (manual cascade — see Migration 017).
pub async fn delete_event(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute(
        "DELETE FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE event_id = ?1)",
        params![id],
    ).await?;
    conn.execute("DELETE FROM recipes WHERE event_id = ?1", params![id]).await?;
    // Fase 3.3: event-scoped ingredients — clear stock/purchases before the
    // ingredient rows themselves (stock_purchases.ingredient_id is RESTRICT).
    conn.execute(
        "DELETE FROM stock WHERE ingredient_id IN (SELECT id FROM ingredients WHERE event_id = ?1)",
        params![id],
    ).await?;
    conn.execute(
        "DELETE FROM stock_purchases WHERE ingredient_id IN (SELECT id FROM ingredients WHERE event_id = ?1)",
        params![id],
    ).await?;
    conn.execute("DELETE FROM ingredients WHERE event_id = ?1", params![id]).await?;
    conn.execute("DELETE FROM events WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// List recipe variants copied into an event
pub async fn event_recipes_list(db: &Database, event_id: i64) -> LibsqlResult<Vec<RecipeWithIngredients>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, created_at, updated_at
         FROM recipes WHERE event_id = ?1 ORDER BY created_at DESC",
        params![event_id],
    ).await?;

    let mut recipes = Vec::new();
    while let Some(row) = rows.next().await? {
        recipes.push(row_to_recipe(&row)?);
    }

    let mut final_recipes = Vec::with_capacity(recipes.len());
    for recipe in recipes {
        final_recipes.push(row_to_recipe_with_ingredients(db, recipe).await?);
    }
    Ok(final_recipes)
}

/// Copy a catalog recipe (and its ingredient lines) into an event as a frozen,
/// independently editable variant. Later edits to the base recipe do not
/// propagate — this is a one-time snapshot, per the Fase 3.2 decision.
pub async fn recipe_copy_to_event(db: &Database, recipe_id: i64, event_id: i64) -> LibsqlResult<RecipeWithIngredients> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT name, category, portions, instructions, prep_time_minutes, cook_time_minutes, tags, image_path
         FROM recipes WHERE id = ?1",
        params![recipe_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let (name, category, portions, instructions, prep_time_minutes, cook_time_minutes, tags, image_path): (String, String, u32, String, Option<u32>, Option<u32>, String, Option<String>) =
        (row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?);
    drop(rows);

    conn.execute(
        "INSERT INTO recipes (name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, event_id, base_recipe_id)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![name, category, portions, instructions, prep_time_minutes, cook_time_minutes, tags, image_path, event_id, recipe_id],
    ).await?;
    let new_id = conn.last_insert_rowid();

    let mut rows = conn.query(
        "SELECT ingredient_id, ingredient_name, quantity, unit FROM recipe_ingredients WHERE recipe_id = ?1",
        params![recipe_id],
    ).await?;
    while let Some(row) = rows.next().await? {
        let (ingredient_id, ingredient_name, quantity, unit): (i64, String, f64, String) =
            (row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?);
        conn.execute(
            "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, ingredient_name, quantity, unit) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id, ingredient_id, ingredient_name, quantity, unit],
        ).await?;
    }
    drop(rows);

    let recipe = get_recipe(db, new_id).await?;
    row_to_recipe_with_ingredients(db, recipe).await
}

/// Move a recipe out of its event and into the shared catalog for good —
/// the reverse of recipe_copy_to_event's snapshot. Loses the base_recipe_id
/// link since it no longer makes sense once the recipe is independent.
///
/// If a catalog recipe already has the same name, the promoted recipe is
/// renamed to "Name (Event Name)" so the two don't look identical in lists.
pub async fn recipe_promote_to_catalog(db: &Database, id: i64) -> LibsqlResult<RecipeWithIngredients> {
    let conn = get_conn(db).await?;

    let mut rows = conn.query("SELECT name, event_id FROM recipes WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let (name, event_id): (String, Option<i64>) = (row.get(0)?, row.get(1)?);
    drop(rows);

    let mut final_name = name.clone();
    if let Some(event_id) = event_id {
        let mut dup_rows = conn.query(
            "SELECT 1 FROM recipes WHERE event_id IS NULL AND name = ?1 AND id != ?2",
            params![name.clone(), id],
        ).await?;
        if dup_rows.next().await?.is_some() {
            let mut event_rows = conn.query("SELECT name FROM events WHERE id = ?1", params![event_id]).await?;
            if let Some(event_row) = event_rows.next().await? {
                let event_name: String = event_row.get(0)?;
                final_name = format!("{} ({})", name, event_name);
            }
        }
    }

    conn.execute(
        "UPDATE recipes SET name = ?1, event_id = NULL, base_recipe_id = NULL, updated_at = datetime('now') WHERE id = ?2",
        params![final_name, id],
    ).await?;
    let recipe = get_recipe(db, id).await?;
    row_to_recipe_with_ingredients(db, recipe).await
}

/// Find the schema.org `Recipe` node in a page's JSON-LD blocks, if any (Fase 3.4).
/// Recipe sites publish this for search engines; NYT Cooking, AllRecipes and most
/// food blogs all use it, so no per-site scraping logic is needed.
fn extract_recipe_json_ld(html: &str) -> Option<serde_json::Value> {
    let re = regex::Regex::new(r#"(?s)<script type="application/ld\+json"[^>]*>(.*?)</script>"#).ok()?;
    for caps in re.captures_iter(html) {
        let raw = caps.get(1)?.as_str();
        let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else { continue };
        if let Some(recipe) = find_recipe_node(&value) {
            return Some(recipe.clone());
        }
    }
    None
}

/// Recipe nodes can be a bare object, or nested inside an `@graph` array — walk both.
fn find_recipe_node(value: &serde_json::Value) -> Option<&serde_json::Value> {
    match value {
        serde_json::Value::Object(map) => {
            let is_recipe = match map.get("@type") {
                Some(serde_json::Value::String(s)) => s == "Recipe",
                Some(serde_json::Value::Array(types)) => types.iter().any(|t| t.as_str() == Some("Recipe")),
                _ => false,
            };
            if is_recipe {
                return Some(value);
            }
            map.get("@graph").and_then(find_recipe_node)
        }
        serde_json::Value::Array(items) => items.iter().find_map(find_recipe_node),
        _ => None,
    }
}

fn extract_instructions(recipe: &serde_json::Value) -> String {
    match &recipe["recipeInstructions"] {
        serde_json::Value::Array(steps) => steps.iter()
            .filter_map(|s| s.as_str().map(|s| s.to_string()).or_else(|| s["text"].as_str().map(|t| t.to_string())))
            .collect::<Vec<_>>()
            .join("\n"),
        serde_json::Value::String(s) => s.clone(),
        _ => String::new(),
    }
}

fn extract_portions(recipe: &serde_json::Value) -> Option<u32> {
    let text = match &recipe["recipeYield"] {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => arr.first()?.as_str()?.to_string(),
        serde_json::Value::Number(n) => return n.as_u64().map(|v| v as u32),
        _ => return None,
    };
    regex::Regex::new(r"\d+").ok()?.find(&text)?.as_str().parse().ok()
}

fn extract_image_url(recipe: &serde_json::Value) -> Option<String> {
    match &recipe["image"] {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Array(arr) => arr.first().and_then(|first| match first {
            serde_json::Value::String(s) => Some(s.clone()),
            serde_json::Value::Object(_) => first["url"].as_str().map(|s| s.to_string()),
            _ => None,
        }),
        serde_json::Value::Object(_) => recipe["image"]["url"].as_str().map(|s| s.to_string()),
        _ => None,
    }
}

/// Parse an ISO 8601 duration (`PT15M`, `PT1H30M`) into whole minutes.
fn parse_iso8601_duration_minutes(duration: &str) -> Option<u32> {
    let caps = regex::Regex::new(r"^PT(?:(\d+)H)?(?:(\d+)M)?$").ok()?.captures(duration)?;
    let hours: u32 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
    let minutes: u32 = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0);
    Some(hours * 60 + minutes)
}

/// Match a recipe-ingredient-line unit word (English, singular or plural) to `Unit`.
/// Deliberately a separate vocabulary from `parse_unit_str` above: that one matches the
/// canonical snake_case strings this app stores, this one matches free-text recipe prose.
fn unit_from_ingredient_word(word: &str) -> Option<Unit> {
    match word.to_lowercase().trim_end_matches('s') {
        "gram" | "g" => Some(Unit::Gram),
        "kilogram" | "kg" => Some(Unit::Kilogram),
        "milligram" | "mg" => Some(Unit::Milligram),
        "ounce" | "oz" => Some(Unit::Ounce),
        "pound" | "lb" => Some(Unit::Pound),
        "milliliter" | "ml" => Some(Unit::Milliliter),
        "liter" | "l" => Some(Unit::Liter),
        "cup" => Some(Unit::Cup),
        "pint" => Some(Unit::Pint),
        "quart" => Some(Unit::Quart),
        "gallon" => Some(Unit::Gallon),
        "teaspoon" | "tsp" => Some(Unit::Teaspoon),
        "tablespoon" | "tbsp" | "tbs" => Some(Unit::Tablespoon),
        "piece" | "pc" => Some(Unit::Piece),
        "dozen" | "doz" => Some(Unit::Dozen),
        "pinch" => Some(Unit::Pinch),
        "bunch" => Some(Unit::Bunch),
        "clove" => Some(Unit::Clove),
        "slice" => Some(Unit::Slice),
        _ => None,
    }
}

/// Strip a leading quantity (mixed fraction, simple fraction, or decimal) off an
/// ingredient line, defaulting to 1 when none is found. Returns (quantity, rest).
fn parse_quantity_prefix(s: &str) -> (f64, &str) {
    let s = s.trim_start();
    if let Ok(re) = regex::Regex::new(r"^(\d+)\s+(\d+)/(\d+)\s*(.*)$") {
        if let Some(caps) = re.captures(s) {
            let whole: f64 = caps[1].parse().unwrap_or(0.0);
            let num: f64 = caps[2].parse().unwrap_or(0.0);
            let den: f64 = caps[3].parse().unwrap_or(1.0);
            let rest_start = caps.get(4).map(|m| m.start()).unwrap_or(s.len());
            return (whole + num / den.max(1.0), s[rest_start..].trim_start());
        }
    }
    if let Ok(re) = regex::Regex::new(r"^(\d+)/(\d+)\s*(.*)$") {
        if let Some(caps) = re.captures(s) {
            let num: f64 = caps[1].parse().unwrap_or(0.0);
            let den: f64 = caps[2].parse().unwrap_or(1.0);
            let rest_start = caps.get(3).map(|m| m.start()).unwrap_or(s.len());
            return (num / den.max(1.0), s[rest_start..].trim_start());
        }
    }
    if let Ok(re) = regex::Regex::new(r"^(\d+(?:\.\d+)?)\s*(.*)$") {
        if let Some(caps) = re.captures(s) {
            let qty: f64 = caps[1].parse().unwrap_or(1.0);
            let rest_start = caps.get(2).map(|m| m.start()).unwrap_or(s.len());
            return (qty, s[rest_start..].trim_start());
        }
    }
    (1.0, s)
}

/// Recipe sites commonly write quantities with vulgar fraction glyphs ("½ cup") instead
/// of ASCII ("1/2 cup") — normalize the common ones so `parse_quantity_prefix` sees them.
fn normalize_vulgar_fractions(s: &str) -> String {
    s.replace('½', "1/2").replace('¼', "1/4").replace('¾', "3/4")
        .replace('⅓', "1/3").replace('⅔', "2/3")
        .replace('⅛', "1/8").replace('⅜', "3/8").replace('⅝', "5/8").replace('⅞', "7/8")
}

/// Strip the descriptive clauses recipe ingredient lines often carry — text after the
/// first comma, and any parenthetical asides — before scanning for a unit or matching
/// against the catalog. E.g. "grated Parmesan, divided, more for garnish" -> "grated
/// Parmesan"; "small baguette... (about 8 ounces), preferably day-old..." -> "small
/// baguette...". Deliberately does NOT try to recover a quantity from inside these
/// clauses (e.g. "about 8 ounces") — parenthetical numbers are usually an approximate
/// aside on the primary count/unit already parsed, not a more precise replacement for
/// it, and there's no reliable rule to tell the two apart from text alone.
fn strip_descriptive_clauses(s: &str) -> String {
    let without_parens = regex::Regex::new(r"\([^)]*\)")
        .map(|re| re.replace_all(s, "").to_string())
        .unwrap_or_else(|_| s.to_string());
    without_parens.split(',').next().unwrap_or(&without_parens).trim().to_string()
}

/// Best-effort parse of a free-text recipe ingredient line ("3 tablespoons olive oil")
/// into quantity + unit + ingredient name. Scans the (cleaned) words after the leading
/// quantity for the first recognized unit word, wherever it falls — handles both
/// "quantity unit name" ("3 tablespoons olive oil") and "quantity name unit" ("5 garlic
/// cloves") orderings. No unit word found -> falls back to quantity 1 / Piece with the
/// cleaned line as the name guess, left for manual review.
fn parse_ingredient_line(raw: &str) -> RecipeImportIngredient {
    let trimmed = raw.trim();
    let normalized = normalize_vulgar_fractions(trimmed);
    let (quantity, rest) = parse_quantity_prefix(&normalized);
    let core = strip_descriptive_clauses(rest);
    let words: Vec<&str> = core.split_whitespace().collect();

    let (unit, name_guess) = match words.iter().position(|w| unit_from_ingredient_word(w).is_some()) {
        Some(idx) => {
            let unit = unit_from_ingredient_word(words[idx]).unwrap();
            let name = words.iter().enumerate()
                .filter(|(i, _)| *i != idx)
                .map(|(_, w)| *w)
                .collect::<Vec<_>>()
                .join(" ");
            (unit, name)
        }
        None => (Unit::Piece, core.clone()),
    };

    RecipeImportIngredient {
        raw_text: trimmed.to_string(),
        quantity,
        unit,
        name_guess: if name_guess.is_empty() { trimmed.to_string() } else { name_guess },
        matched_ingredient_id: None,
    }
}

/// Import a recipe preview from a URL's schema.org/Recipe JSON-LD (Fase 3.4).
/// Read-only: never writes to the DB, only looks up existing ingredients by exact
/// name to pre-fill `matched_ingredient_id` where possible. Saving is a separate,
/// explicit step the user takes after reviewing the preview.
pub async fn recipe_import_from_url(db: &Database, url: String) -> Result<RecipeImportPreview, String> {
    let client = reqwest::Client::new();
    let html = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let recipe_json = extract_recipe_json_ld(&html)
        .ok_or_else(|| "Não foi possível encontrar dados de receita (schema.org/Recipe) nesta página.".to_string())?;

    let name = recipe_json["name"].as_str().unwrap_or("").to_string();
    if name.is_empty() {
        return Err("Os dados de receita encontrados não têm nome.".to_string());
    }

    let instructions = extract_instructions(&recipe_json);
    let portions = extract_portions(&recipe_json);
    let prep_time_minutes = recipe_json["prepTime"].as_str().and_then(parse_iso8601_duration_minutes);
    let cook_time_minutes = recipe_json["cookTime"].as_str().and_then(parse_iso8601_duration_minutes);
    let image_url = extract_image_url(&recipe_json);

    let conn = get_conn(db).await.map_err(|e| e.to_string())?;
    let mut ingredients = Vec::new();
    if let Some(lines) = recipe_json["recipeIngredient"].as_array() {
        for line in lines {
            let Some(text) = line.as_str() else { continue };
            let mut parsed = parse_ingredient_line(text);
            let mut rows = conn.query(
                "SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                params![parsed.name_guess.clone()],
            ).await.map_err(|e| e.to_string())?;
            if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
                parsed.matched_ingredient_id = Some(row.get(0).map_err(|e| e.to_string())?);
            }
            ingredients.push(parsed);
        }
    }

    Ok(RecipeImportPreview {
        name,
        portions,
        instructions,
        prep_time_minutes,
        cook_time_minutes,
        image_url,
        ingredients,
    })
}

/// List price quotes for ingredient
pub async fn price_quotes_list(db: &Database, ingredient_id: i64) -> LibsqlResult<Vec<PriceQuote>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, ingredient_id, supplier, price_per_unit, valid_from, valid_to, is_promo, created_at
         FROM price_quotes WHERE ingredient_id = ?1 ORDER BY valid_from DESC",
        params![ingredient_id],
    ).await?;
    let mut quotes = Vec::new();
    while let Some(row) = rows.next().await? {
        quotes.push(row_to_price_quote(&row)?);
    }
    Ok(quotes)
}

/// Create price quote
pub async fn create_price_quote(db: &Database, input: PriceQuoteInput) -> LibsqlResult<PriceQuote> {
    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO price_quotes (ingredient_id, supplier, price_per_unit, valid_from, valid_to, is_promo)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![input.ingredient_id, input.supplier, input.price_per_unit, input.valid_from.map(|d| d.to_rfc3339()), input.valid_to.map(|d| d.to_rfc3339()), input.is_promo as i32],
    ).await?;
    let id = conn.last_insert_rowid();
    let mut rows = conn.query("SELECT id, ingredient_id, supplier, price_per_unit, valid_from, valid_to, is_promo, created_at FROM price_quotes WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_price_quote(&row)
}

/// Delete price quote
pub async fn delete_price_quote(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM price_quotes WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Get supplier by ID
pub async fn supplier_get(db: &Database, id: i64) -> LibsqlResult<Supplier> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, contact, notes, created_at, updated_at FROM suppliers WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_supplier(&row)
}

/// Update price quote
pub async fn update_price_quote(db: &Database, id: i64, input: PriceQuoteInput) -> LibsqlResult<PriceQuote> {
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE price_quotes SET ingredient_id = ?1, supplier = ?2, price_per_unit = ?3, valid_from = ?4, valid_to = ?5, is_promo = ?6 WHERE id = ?7",
        params![input.ingredient_id, input.supplier, input.price_per_unit, input.valid_from.map(|d| d.to_rfc3339()), input.valid_to.map(|d| d.to_rfc3339()), input.is_promo as i32, id],
    ).await?;
    let mut rows = conn.query(
        "SELECT id, ingredient_id, supplier, price_per_unit, valid_from, valid_to, is_promo, created_at FROM price_quotes WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_price_quote(&row)
}

/// Get price quote statistics grouped by ingredient
pub async fn price_quotes_stats(db: &Database) -> LibsqlResult<Vec<PriceQuoteStats>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        r#"
        SELECT ingredient_id,
               AVG(price_per_unit) as avg_price,
               MIN(price_per_unit) as min_price,
               MAX(price_per_unit) as max_price,
               COUNT(*) as quote_count
        FROM price_quotes
        GROUP BY ingredient_id
        ORDER BY avg_price DESC
        "#,
        (),
    ).await?;
    let mut stats = Vec::new();
    while let Some(row) = rows.next().await? {
        stats.push(PriceQuoteStats {
            ingredient_id: row.get(0)?,
            avg_price: row.get(1)?,
            min_price: row.get(2)?,
            max_price: row.get(3)?,
            quote_count: row.get(4)?,
        });
    }
    Ok(stats)
}

/// Get all price quotes with ingredient details (for supplier detail view)
pub async fn price_quotes_all(db: &Database) -> LibsqlResult<Vec<PriceQuoteWithIngredient>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        r#"
        SELECT pq.id, pq.ingredient_id, pq.supplier, pq.price_per_unit, pq.valid_from, pq.valid_to, pq.is_promo, pq.created_at,
               i.name as ingredient_name, i.unit as ingredient_unit
        FROM price_quotes pq
        JOIN ingredients i ON pq.ingredient_id = i.id
        ORDER BY pq.supplier, i.name
        "#,
        (),
    ).await?;
    let mut quotes = Vec::new();
    while let Some(row) = rows.next().await? {
        let unit_str: String = row.get(9)?;
        let unit = match unit_str.as_str() {
            "gram" => Unit::Gram,
            "kilogram" => Unit::Kilogram,
            "milligram" => Unit::Milligram,
            "ounce" => Unit::Ounce,
            "pound" => Unit::Pound,
            "milliliter" => Unit::Milliliter,
            "liter" => Unit::Liter,
            "fluid_ounce" => Unit::FluidOunce,
            "cup" => Unit::Cup,
            "pint" => Unit::Pint,
            "quart" => Unit::Quart,
            "gallon" => Unit::Gallon,
            "teaspoon" => Unit::Teaspoon,
            "tablespoon" => Unit::Tablespoon,
            "piece" => Unit::Piece,
            "dozen" => Unit::Dozen,
            "pinch" => Unit::Pinch,
            "bunch" => Unit::Bunch,
            "clove" => Unit::Clove,
            "slice" => Unit::Slice,
            _ => Unit::Gram,
        };
        let valid_from_str: Option<String> = row.get(4)?;
        let valid_to_str: Option<String> = row.get(5)?;
        let created_at_str: String = row.get(7)?;
        let valid_from = valid_from_str
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc));
        let valid_to = valid_to_str
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc));
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        quotes.push(PriceQuoteWithIngredient {
            id: row.get(0)?,
            ingredient_id: row.get(1)?,
            ingredient_name: row.get(8)?,
            ingredient_unit: unit,
            supplier: row.get(2)?,
            price_per_unit: row.get(3)?,
            valid_from,
            valid_to,
            is_promo: row.get(6)?,
            created_at,
        });
    }
    Ok(quotes)
}

/// Export all data
pub async fn export_data(db: &Database) -> LibsqlResult<ImportData> {
    let ingredients = ingredients_list(db).await?;
    let recipes = recipes_list(db).await?;

    let import_ingredients: Vec<ImportIngredient> = ingredients.into_iter().map(|i| ImportIngredient {
        name: i.name,
        unit: i.unit,
        price_per_unit: i.price_per_unit,
        category: i.category_id.map(|id| id.to_string()),
    }).collect();

    let import_recipes: Vec<ImportRecipe> = recipes.into_iter().map(|r| {
        let recipe_ingredients: Vec<ImportRecipeIngredient> = Vec::new(); // Would need to fetch
        ImportRecipe {
            name: r.recipe.name,
            category: r.recipe.category,
            portions: r.recipe.portions,
            instructions: r.recipe.instructions,
            prep_time_minutes: r.recipe.prep_time_minutes,
            cook_time_minutes: r.recipe.cook_time_minutes,
            tags: serde_json::from_str(&r.recipe.tags).unwrap_or_default(),
            ingredients: recipe_ingredients,
        }
    }).collect();

    Ok(ImportData {
        version: 1,
        ingredients: import_ingredients,
        recipes: import_recipes,
    })
}

/// Import data
pub async fn import_data(db: &Database, data: ImportData) -> LibsqlResult<ImportResult> {
    let mut result = ImportResult {
        ingredients_created: 0,
        ingredients_skipped: 0,
        recipes_created: 0,
        recipes_skipped: 0,
        errors: Vec::new(),
    };

    for ing in data.ingredients {
        let input = IngredientInput {
            name: ing.name,
            unit: ing.unit,
            price_per_unit: ing.price_per_unit,
            category: ing.category,
            event_id: None,
        };
        match create_ingredient(db, input).await {
            Ok(_) => result.ingredients_created += 1,
            Err(e) => {
                result.ingredients_skipped += 1;
                result.errors.push(e.to_string());
            }
        }
    }

    // Recipe import would need ingredient resolution - simplified
    result.recipes_skipped = data.recipes.len();

    Ok(result)
}

/// Map a libsql Row to MealPlan
fn row_to_meal_plan(row: &Row) -> LibsqlResult<MealPlan> {
    let created_at_str: String = row.get(4)?;
    let updated_at_str: String = row.get(5)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(MealPlan {
        id: row.get(0)?,
        name: row.get(1)?,
        start_date: DateTime::parse_from_rfc3339(&row.get::<String>(2)?)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        end_date: DateTime::parse_from_rfc3339(&row.get::<String>(3)?)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        created_at,
        updated_at,
    })
}

/// Map a libsql Row to MealPlanEntry
fn row_to_meal_plan_entry(row: &Row) -> LibsqlResult<MealPlanEntry> {
    let day_str: String = row.get(4)?;
    let day_of_week = match day_str.as_str() {
        "monday" => DayOfWeek::Monday,
        "tuesday" => DayOfWeek::Tuesday,
        "wednesday" => DayOfWeek::Wednesday,
        "thursday" => DayOfWeek::Thursday,
        "friday" => DayOfWeek::Friday,
        "saturday" => DayOfWeek::Saturday,
        "sunday" => DayOfWeek::Sunday,
        _ => DayOfWeek::Monday,
    };

    let meal_str: String = row.get(5)?;
    let meal_type = match meal_str.as_str() {
        "breakfast" => MealType::Breakfast,
        "lunch" => MealType::Lunch,
        "dinner" => MealType::Dinner,
        "snack" => MealType::Snack,
        _ => MealType::Lunch,
    };

    let created_at_str: String = row.get(7)?;
    let updated_at_str: String = row.get(8)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(MealPlanEntry {
        id: row.get(0)?,
        meal_plan_id: row.get(1)?,
        recipe_id: row.get(2)?,
        recipe_name: row.get(3)?,
        day_of_week,
        meal_type,
        portions: row.get(6)?,
        created_at,
        updated_at,
    })
}

/// Create meal plan
pub async fn create_meal_plan(db: &Database, input: MealPlanInput) -> LibsqlResult<MealPlan> {
    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO meal_plans (name, start_date, end_date) VALUES (?1, ?2, ?3)",
        params![input.name, input.start_date.to_rfc3339(), input.end_date.to_rfc3339()],
    ).await?;

    let id = conn.last_insert_rowid();
    let mut rows = conn.query(
        "SELECT id, name, start_date, end_date, created_at, updated_at FROM meal_plans WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_meal_plan(&row)
}

/// Get meal plan by ID with entries
pub async fn get_meal_plan(db: &Database, id: i64) -> LibsqlResult<MealPlanWithEntries> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, start_date, end_date, created_at, updated_at FROM meal_plans WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let meal_plan = row_to_meal_plan(&row)?;

    // Get entries
    let mut rows = conn.query(
        "SELECT id, meal_plan_id, recipe_id, recipe_name, day_of_week, meal_type, portions, created_at, updated_at
         FROM meal_plan_entries WHERE meal_plan_id = ?1 ORDER BY day_of_week, meal_type",
        params![id],
    ).await?;

    let mut entries = Vec::new();
    while let Some(row) = rows.next().await? {
        entries.push(row_to_meal_plan_entry(&row)?);
    }

    Ok(MealPlanWithEntries { meal_plan, entries })
}

/// List all meal plans
pub async fn list_meal_plans(db: &Database) -> LibsqlResult<Vec<MealPlan>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, name, start_date, end_date, created_at, updated_at FROM meal_plans ORDER BY created_at DESC",
        (),
    ).await?;

    let mut plans = Vec::new();
    while let Some(row) = rows.next().await? {
        plans.push(row_to_meal_plan(&row)?);
    }
    Ok(plans)
}

/// Update meal plan
pub async fn update_meal_plan(db: &Database, id: i64, input: MealPlanInput) -> LibsqlResult<MealPlan> {
    let conn = get_conn(db).await?;
    conn.execute(
        "UPDATE meal_plans SET name = ?1, start_date = ?2, end_date = ?3, updated_at = datetime('now') WHERE id = ?4",
        params![input.name, input.start_date.to_rfc3339(), input.end_date.to_rfc3339(), id],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, name, start_date, end_date, created_at, updated_at FROM meal_plans WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_meal_plan(&row)
}

/// Delete meal plan
pub async fn delete_meal_plan(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM meal_plans WHERE id = ?1", params![id]).await?;
    // meal_plan_entries are cascade deleted
    Ok(())
}

/// Add meal plan entry
pub async fn add_meal_entry(db: &Database, meal_plan_id: i64, input: MealEntryInput) -> LibsqlResult<MealPlanEntry> {
    let conn = get_conn(db).await?;

    // Get recipe name for denormalization
    let mut rows = conn.query("SELECT name FROM recipes WHERE id = ?1", params![input.recipe_id]).await?;
    let recipe_name: String = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    let day_str = format!("{:?}", input.day_of_week).to_lowercase();
    let meal_str = format!("{:?}", input.meal_type).to_lowercase();

    conn.execute(
        "INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, recipe_name, day_of_week, meal_type, portions)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![meal_plan_id, input.recipe_id, recipe_name, day_str, meal_str, input.portions],
    ).await?;

    let id = conn.last_insert_rowid();
    let mut rows = conn.query(
        "SELECT id, meal_plan_id, recipe_id, recipe_name, day_of_week, meal_type, portions, created_at, updated_at
         FROM meal_plan_entries WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_meal_plan_entry(&row)
}

/// Update meal plan entry
pub async fn update_meal_entry(db: &Database, id: i64, input: MealEntryInput) -> LibsqlResult<MealPlanEntry> {
    let conn = get_conn(db).await?;

    // Get recipe name for denormalization
    let mut rows = conn.query("SELECT name FROM recipes WHERE id = ?1", params![input.recipe_id]).await?;
    let recipe_name: String = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    let day_str = format!("{:?}", input.day_of_week).to_lowercase();
    let meal_str = format!("{:?}", input.meal_type).to_lowercase();

    conn.execute(
        "UPDATE meal_plan_entries SET recipe_id = ?1, recipe_name = ?2, day_of_week = ?3, meal_type = ?4, portions = ?5, updated_at = datetime('now')
         WHERE id = ?6",
        params![input.recipe_id, recipe_name, day_str, meal_str, input.portions, id],
    ).await?;

    let mut rows = conn.query(
        "SELECT id, meal_plan_id, recipe_id, recipe_name, day_of_week, meal_type, portions, created_at, updated_at
         FROM meal_plan_entries WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    row_to_meal_plan_entry(&row)
}

/// Delete meal plan entry
pub async fn delete_meal_entry(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM meal_plan_entries WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Generate shopping list from meal plan
pub async fn generate_shopping_list_from_meal_plan(db: &Database, plan_id: i64, portions_multiplier: u32) -> LibsqlResult<MealPlanShoppingList> {
    let plan = get_meal_plan(db, plan_id).await?;

    // Aggregate ingredients from all entries
    let mut ingredient_map: std::collections::HashMap<i64, (String, Unit, f64, String, f64)> = std::collections::HashMap::new(); // ingredient_id -> (name, unit, total_qty, category, price)
    let mut recipes_used = Vec::new();

    for entry in &plan.entries {
        if !recipes_used.contains(&entry.recipe_id) {
            recipes_used.push(entry.recipe_id);
        }

        // Get recipe ingredients
        let conn = get_conn(db).await?;
        let mut rows = conn.query(
            "SELECT ri.ingredient_id, ri.ingredient_name, ri.quantity, ri.unit, i.price_per_unit, i.category_id
             FROM recipe_ingredients ri
             JOIN ingredients i ON ri.ingredient_id = i.id
             WHERE ri.recipe_id = ?1",
            params![entry.recipe_id],
        ).await?;

        while let Some(row) = rows.next().await? {
            let ingredient_id: i64 = row.get(0)?;
            let ingredient_name: String = row.get(1)?;
            let quantity: f64 = row.get(2)?;
            let unit_str: String = row.get(3)?;
            let price_per_unit: f64 = row.get(4)?;
            let category_id: Option<i64> = row.get(5)?;

            let unit = match unit_str.as_str() {
                "gram" => Unit::Gram, "kilogram" => Unit::Kilogram, "milligram" => Unit::Milligram,
                "ounce" => Unit::Ounce, "pound" => Unit::Pound,
                "milliliter" => Unit::Milliliter, "liter" => Unit::Liter, "fluid_ounce" => Unit::FluidOunce,
                "cup" => Unit::Cup, "pint" => Unit::Pint, "quart" => Unit::Quart, "gallon" => Unit::Gallon,
                "teaspoon" => Unit::Teaspoon, "tablespoon" => Unit::Tablespoon,
                "piece" => Unit::Piece, "dozen" => Unit::Dozen,
                "pinch" => Unit::Pinch, "bunch" => Unit::Bunch, "clove" => Unit::Clove, "slice" => Unit::Slice,
                _ => Unit::Gram,
            };

            // Get category name
            let category = if let Some(cat_id) = category_id {
                let mut cat_rows = conn.query("SELECT name FROM categories WHERE id = ?1", params![cat_id]).await?;
                cat_rows.next().await?.map(|r| r.get::<String>(0).unwrap_or_default()).unwrap_or_default()
            } else {
                "Outros".to_string()
            };

            let total_qty = quantity * entry.portions as f64 * portions_multiplier as f64;

            ingredient_map.entry(ingredient_id)
                .and_modify(|e| e.2 += total_qty)
                .or_insert((ingredient_name, unit, total_qty, category, price_per_unit));
        }
    }

    // Get stock quantities
    let conn = get_conn(db).await?;
    let mut shopping_items = Vec::new();

    for (ingredient_id, (name, unit, needed_qty, category, price)) in ingredient_map {
        let mut rows = conn.query(
            "SELECT quantity FROM stock WHERE ingredient_id = ?1",
            params![ingredient_id],
        ).await?;
        let stock_qty = rows.next().await?.map(|r| r.get::<f64>(0).unwrap_or(0.0)).unwrap_or(0.0);

        let to_buy_qty = (needed_qty - stock_qty).max(0.0);
        let estimated_cost = to_buy_qty * price;

        shopping_items.push(ShoppingItem {
            id: 0, // Will be assigned on insert
            ingredient_id: Some(ingredient_id),
            ingredient_name: name,
            ingredient_unit: unit,
            needed_quantity: needed_qty,
            stock_quantity: stock_qty,
            to_buy_quantity: to_buy_qty,
            category,
            estimated_cost,
            purchased: false,
            notes: None,
            purchased_at: None,
            created_at: Utc::now(),
        });
    }

    let list_name = format!("{} - Compras", plan.meal_plan.name);
    let shopping_list = create_shopping_list(db, list_name, shopping_items).await?;

    Ok(MealPlanShoppingList {
        shopping_list,
        total_portions: plan.entries.iter().map(|e| e.portions).sum::<u32>() * portions_multiplier,
        recipes_used,
    })
}

// =====================================================================
// DASHBOARD QUERY METHODS
// =====================================================================

/// Get dashboard statistics
pub async fn get_dashboard_stats(db: &Database) -> LibsqlResult<DashboardStats> {
    let conn = get_conn(db).await?;

    // Low stock count (quantity <= min_quantity and quantity > 0)
    let mut rows = conn.query(
        "SELECT COUNT(*) FROM stock s JOIN ingredients i ON s.ingredient_id = i.id
         WHERE i.event_id IS NULL AND s.quantity > 0 AND s.quantity <= s.min_quantity",
        (),
    ).await?;
    let low_stock_count: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    // Expiring soon count - ingredients with expiry < 7 days
    // Note: We don't have an expiry_date column in stock yet, so we'll use a placeholder
    // This would need a migration to add expiry tracking
    let mut rows = conn.query(
        "SELECT COUNT(*) FROM stock WHERE 0 = 1", // Placeholder - no expiry tracking yet
        (),
    ).await?;
    let expiring_soon_count: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    // Meals this week - meal plan entries in next 7 days
    // We need to find meal plans that overlap with the next 7 days
    let mut rows = conn.query(
        r#"
        SELECT COUNT(DISTINCT mpe.id)
        FROM meal_plan_entries mpe
        JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
        WHERE 
            date(mp.start_date) <= date('now', '+7 days')
            AND date(mp.end_date) >= date('now')
        "#,
        (),
    ).await?;
    let meals_this_week: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    // Total stock value (sum of stock qty * price_per_unit)
    // COALESCE with 0.0 (not 0) so SQLite returns REAL even when stock is
    // empty (SUM over no rows = NULL -> COALESCE(NULL, 0.0) = 0.0 REAL).
    // With integer 0, libsql row.get::<f64>() panics ("invalid value type").
    let mut rows = conn.query(
        "SELECT COALESCE(SUM(s.quantity * i.price_per_unit), 0.0) FROM stock s JOIN ingredients i ON s.ingredient_id = i.id WHERE i.event_id IS NULL",
        (),
    ).await?;
    let total_stock_value: f64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    // Total recipes
    let mut rows = conn.query("SELECT COUNT(*) FROM recipes", ()).await?;
    let total_recipes: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    // Total ingredients
    let mut rows = conn.query("SELECT COUNT(*) FROM ingredients", ()).await?;
    let total_ingredients: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    // Pending shopping items (not purchased)
    let mut rows = conn.query(
        "SELECT COUNT(*) FROM shopping_list_items WHERE purchased = 0",
        (),
    ).await?;
    let pending_shopping_items: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    Ok(DashboardStats {
        low_stock_count,
        expiring_soon_count,
        meals_this_week,
        total_stock_value,
        total_recipes,
        total_ingredients,
        pending_shopping_items,
    })
}

/// Get recent activity
pub async fn get_recent_activity(db: &Database, limit: u32) -> LibsqlResult<Vec<ActivityItem>> {
    let conn = get_conn(db).await?;

    // We'll create a unified activity feed by querying multiple tables
    // For now, we'll combine recent recipes, stock updates, meal plan entries, and shopping purchases
    let mut activities = Vec::new();

    // Recent recipes
    let mut rows = conn.query(
        r#"
        SELECT id, name, created_at, 'recipe_created' as type, 'recipe' as entity_type
        FROM recipes
        ORDER BY created_at DESC
        LIMIT ?1
        "#,
        params![limit as i64 / 4 + 1],
    ).await?;
    while let Some(row) = rows.next().await? {
        let created_at_str: String = row.get(2)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        activities.push(ActivityItem {
            id: row.get(0)?,
            activity_type: row.get(3)?,
            description: format!("Receita criada: {}", row.get::<String>(1)?),
            entity_id: Some(row.get(0)?),
            entity_type: Some(row.get(4)?),
            timestamp: created_at,
        });
    }

    // Recent stock updates
    let mut rows = conn.query(
        r#"
        SELECT s.id, i.name, s.updated_at, 'stock_updated' as type, 'ingredient' as entity_type
        FROM stock s
        JOIN ingredients i ON s.ingredient_id = i.id
        WHERE i.event_id IS NULL
        ORDER BY s.updated_at DESC
        LIMIT ?1
        "#,
        params![limit as i64 / 4 + 1],
    ).await?;
    while let Some(row) = rows.next().await? {
        let updated_at_str: String = row.get(2)?;
        let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        activities.push(ActivityItem {
            id: row.get(0)?,
            activity_type: row.get(3)?,
            description: format!("Stock actualizado: {}", row.get::<String>(1)?),
            entity_id: Some(row.get(0)?),
            entity_type: Some(row.get(4)?),
            timestamp: updated_at,
        });
    }

    // Recent meal plan entries
    let mut rows = conn.query(
        r#"
        SELECT mpe.id, mpe.recipe_name, mpe.created_at, 'meal_planned' as type, 'meal_plan' as entity_type
        FROM meal_plan_entries mpe
        ORDER BY mpe.created_at DESC
        LIMIT ?1
        "#,
        params![limit as i64 / 4 + 1],
    ).await?;
    while let Some(row) = rows.next().await? {
        let created_at_str: String = row.get(2)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        activities.push(ActivityItem {
            id: row.get(0)?,
            activity_type: row.get(3)?,
            description: format!("Refeição planeada: {}", row.get::<String>(1)?),
            entity_id: Some(row.get(0)?),
            entity_type: Some(row.get(4)?),
            timestamp: created_at,
        });
    }

    // Recent shopping purchases
    let mut rows = conn.query(
        r#"
        SELECT sli.id, sli.ingredient_name, sli.purchased_at, 'shopping_purchased' as type, 'shopping_list' as entity_type
        FROM shopping_list_items sli
        WHERE sli.purchased = 1 AND sli.purchased_at IS NOT NULL
        ORDER BY sli.purchased_at DESC
        LIMIT ?1
        "#,
        params![limit as i64 / 4 + 1],
    ).await?;
    while let Some(row) = rows.next().await? {
        let purchased_at_str: String = row.get(2)?;
        let purchased_at = DateTime::parse_from_rfc3339(&purchased_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        activities.push(ActivityItem {
            id: row.get(0)?,
            activity_type: row.get(3)?,
            description: format!("Comprado: {}", row.get::<String>(1)?),
            entity_id: Some(row.get(0)?),
            entity_type: Some(row.get(4)?),
            timestamp: purchased_at,
        });
    }

    // Sort by timestamp descending and limit
    activities.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    activities.truncate(limit as usize);

    Ok(activities)
}

/// Get upcoming meals for the next N days
pub async fn get_upcoming_meals(db: &Database, days: u32) -> LibsqlResult<Vec<MealPlanEntryWithRecipe>> {
    let conn = get_conn(db).await?;

    let mut rows = conn.query(
        r#"
        SELECT mpe.id, mpe.meal_plan_id, mpe.recipe_id, mpe.recipe_name, 
               mpe.day_of_week, mpe.meal_type, mpe.portions,
               date(mp.start_date) as plan_start
        FROM meal_plan_entries mpe
        JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
        WHERE 
            date(mp.start_date) <= date('now', ?1 || ' days')
            AND date(mp.end_date) >= date('now')
        ORDER BY 
            date(mp.start_date),
            CASE mpe.meal_type 
                WHEN 'breakfast' THEN 1 
                WHEN 'lunch' THEN 2 
                WHEN 'dinner' THEN 3 
                WHEN 'snack' THEN 4 
            END
        "#,
        params![days as i64],
    ).await?;

    let mut meals = Vec::new();
    while let Some(row) = rows.next().await? {
        let day_str: String = row.get(4)?;
        let day_of_week = match day_str.as_str() {
            "monday" => DayOfWeek::Monday,
            "tuesday" => DayOfWeek::Tuesday,
            "wednesday" => DayOfWeek::Wednesday,
            "thursday" => DayOfWeek::Thursday,
            "friday" => DayOfWeek::Friday,
            "saturday" => DayOfWeek::Saturday,
            "sunday" => DayOfWeek::Sunday,
            _ => DayOfWeek::Monday,
        };

        let meal_str: String = row.get(5)?;
        let meal_type = match meal_str.as_str() {
            "breakfast" => MealType::Breakfast,
            "lunch" => MealType::Lunch,
            "dinner" => MealType::Dinner,
            "snack" => MealType::Snack,
            _ => MealType::Lunch,
        };

        // Calculate the planned date based on the meal plan start date and day of week
        let plan_start_str: String = row.get(7)?;
        let plan_start = DateTime::parse_from_rfc3339(&plan_start_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        
        // Calculate the date for this specific day of week
        let day_index = day_of_week.index();
        let planned_date = plan_start + chrono::Duration::days(day_index as i64);

        meals.push(MealPlanEntryWithRecipe {
            id: row.get(0)?,
            meal_plan_id: row.get(1)?,
            recipe_id: row.get(2)?,
            recipe_name: row.get(3)?,
            day_of_week,
            meal_type,
            portions: row.get(6)?,
            planned_date,
        });
    }

    Ok(meals)
}

/// Get meal plan entries by date range with recipe details
/// Calculates actual dates from meal plan start_date + day_of_week
pub async fn get_meal_plan_entries_by_date_range(
    db: &Database,
    start_date: DateTime<Utc>,
    end_date: DateTime<Utc>,
) -> LibsqlResult<Vec<MealPlanEntryWithRecipe>> {
    let conn = get_conn(db).await?;

    let start_str = start_date.to_rfc3339();
    let end_str = end_date.to_rfc3339();

    let mut rows = conn.query(
        r#"
        SELECT mpe.id, mpe.meal_plan_id, mpe.recipe_id, mpe.recipe_name,
               mpe.day_of_week, mpe.meal_type, mpe.portions,
               date(mp.start_date) as plan_start
        FROM meal_plan_entries mpe
        JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
        WHERE 
            date(mp.start_date) <= date(?2)
            AND date(mp.end_date) >= date(?1)
        ORDER BY 
            date(mp.start_date),
            CASE mpe.day_of_week
                WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
                WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
                WHEN 'sunday' THEN 7
            END,
            CASE mpe.meal_type
                WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 WHEN 'snack' THEN 4
            END
        "#,
        params![start_str, end_str],
    ).await?;

    let mut meals = Vec::new();
    while let Some(row) = rows.next().await? {
        let day_str: String = row.get(4)?;
        let day_of_week = match day_str.as_str() {
            "monday" => DayOfWeek::Monday,
            "tuesday" => DayOfWeek::Tuesday,
            "wednesday" => DayOfWeek::Wednesday,
            "thursday" => DayOfWeek::Thursday,
            "friday" => DayOfWeek::Friday,
            "saturday" => DayOfWeek::Saturday,
            "sunday" => DayOfWeek::Sunday,
            _ => DayOfWeek::Monday,
        };

        let meal_str: String = row.get(5)?;
        let meal_type = match meal_str.as_str() {
            "breakfast" => MealType::Breakfast,
            "lunch" => MealType::Lunch,
            "dinner" => MealType::Dinner,
            "snack" => MealType::Snack,
            _ => MealType::Lunch,
        };

        // Calculate the planned date based on the meal plan start date and day of week
        let plan_start_str: String = row.get(7)?;
        let plan_start = DateTime::parse_from_rfc3339(&plan_start_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        // Calculate the date for this specific day of week
        let day_index = day_of_week.index();
        let planned_date = plan_start + chrono::Duration::days(day_index as i64);

        // Only include if the calculated date falls within the requested range
        if planned_date >= start_date && planned_date <= end_date {
            meals.push(MealPlanEntryWithRecipe {
                id: row.get(0)?,
                meal_plan_id: row.get(1)?,
                recipe_id: row.get(2)?,
                recipe_name: row.get(3)?,
                day_of_week,
                meal_type,
                portions: row.get(6)?,
                planned_date,
            });
        }
    }

    Ok(meals)
}

/// Get meal plan entries for a specific month with recipe details
pub async fn get_meal_plan_entries_by_month(
    db: &Database,
    year: i32,
    month: u32,
) -> LibsqlResult<Vec<MealPlanEntryWithRecipe>> {
    // Calculate start and end of month
    let start_date = Utc.with_ymd_and_hms(year, month, 1, 0, 0, 0).single().unwrap_or_else(|| Utc::now());
    let end_date = if month == 12 {
        Utc.with_ymd_and_hms(year + 1, 1, 1, 0, 0, 0).single().unwrap_or_else(|| Utc::now()) - chrono::Duration::seconds(1)
    } else {
        Utc.with_ymd_and_hms(year, month + 1, 1, 0, 0, 0).single().unwrap_or_else(|| Utc::now()) - chrono::Duration::seconds(1)
    };

    get_meal_plan_entries_by_date_range(db, start_date, end_date).await
}

/// Get low stock ingredients
pub async fn get_low_stock_ingredients(db: &Database, threshold: f64) -> LibsqlResult<Vec<StockItemWithIngredient>> {
    let conn = get_conn(db).await?;

    let mut rows = conn.query(
        r#"
        SELECT s.id, s.ingredient_id, s.ingredient_name, s.ingredient_unit,
               s.quantity, s.min_quantity, i.price_per_unit, s.updated_at
        FROM stock s
        JOIN ingredients i ON s.ingredient_id = i.id
        WHERE i.event_id IS NULL
          AND (s.quantity > 0 AND s.quantity <= s.min_quantity OR s.quantity <= ?1)
        ORDER BY (s.quantity / NULLIF(s.min_quantity, 0)) ASC
        "#,
        params![threshold],
    ).await?;

    let mut items = Vec::new();
    while let Some(row) = rows.next().await? {
        let unit_str: String = row.get(3)?;
        let unit = match unit_str.as_str() {
            "gram" => Unit::Gram,
            "kilogram" => Unit::Kilogram,
            "milligram" => Unit::Milligram,
            "ounce" => Unit::Ounce,
            "pound" => Unit::Pound,
            "milliliter" => Unit::Milliliter,
            "liter" => Unit::Liter,
            "fluid_ounce" => Unit::FluidOunce,
            "cup" => Unit::Cup,
            "pint" => Unit::Pint,
            "quart" => Unit::Quart,
            "gallon" => Unit::Gallon,
            "teaspoon" => Unit::Teaspoon,
            "tablespoon" => Unit::Tablespoon,
            "piece" => Unit::Piece,
            "dozen" => Unit::Dozen,
            "pinch" => Unit::Pinch,
            "bunch" => Unit::Bunch,
            "clove" => Unit::Clove,
            "slice" => Unit::Slice,
            _ => Unit::Gram,
        };

        let updated_at_str: String = row.get(7)?;
        let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        items.push(StockItemWithIngredient {
            id: row.get(0)?,
            ingredient_id: row.get(1)?,
            ingredient_name: row.get(2)?,
            ingredient_unit: unit,
            quantity: row.get(4)?,
            min_quantity: row.get(5)?,
            price_per_unit: row.get(6)?,
            updated_at,
        });
    }

    Ok(items)
}

// =====================================================================
// REPORTS
// =====================================================================

/// Get cost report for a date range
pub async fn get_cost_report(db: &Database, days: u32) -> LibsqlResult<CostReport> {
    let conn = get_conn(db).await?;
    let start_date = Utc::now() - chrono::Duration::days(days as i64);
    let start_str = start_date.to_rfc3339();

    // Total spent from purchased shopping list items
    let mut rows = conn.query(
        r#"
        SELECT COALESCE(SUM(sli.to_buy_quantity * sli.estimated_cost / NULLIF(sli.to_buy_quantity, 0)), 0.0)
        FROM shopping_list_items sli
        WHERE sli.purchased = 1
          AND sli.purchased_at IS NOT NULL
          AND date(sli.purchased_at) >= date(?1)
        "#,
        params![start_str.clone()],
    ).await?;
    let total_spent: f64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    // By category (ingredient category)
    let mut rows = conn.query(
        r#"
        SELECT c.name, COALESCE(SUM(sli.to_buy_quantity * sli.estimated_cost / NULLIF(sli.to_buy_quantity, 0)), 0.0) AS total
        FROM shopping_list_items sli
        LEFT JOIN ingredients i ON sli.ingredient_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE sli.purchased = 1
          AND sli.purchased_at IS NOT NULL
          AND date(sli.purchased_at) >= date(?1)
        GROUP BY c.name
        ORDER BY total DESC
        "#,
        params![start_str.clone()],
    ).await?;
    let mut by_category = Vec::new();
    while let Some(row) = rows.next().await? {
        let category: String = row.get(0).unwrap_or_else(|_| "Sem categoria".to_string());
        let total: f64 = row.get(1)?;
        by_category.push(CategoryCost {
            category,
            total,
            percentage: if total_spent > 0.0 { (total / total_spent) * 100.0 } else { 0.0 },
        });
    }

    // By recipe (from meal plan entries that generated shopping lists)
    // This is a simplified version - we look at shopping lists created from meal plans
    let mut rows = conn.query(
        r#"
        SELECT sl.name, COALESCE(SUM(sli.estimated_cost), 0.0) AS total
        FROM shopping_list_items sli
        JOIN shopping_lists sl ON sli.shopping_list_id = sl.id
        WHERE sli.purchased = 1
          AND sli.purchased_at IS NOT NULL
          AND date(sli.purchased_at) >= date(?1)
          AND (sl.name LIKE '%Planeamento%' OR sl.name LIKE '%Meal Plan%' OR sl.name LIKE '%Compras%')
        GROUP BY sl.name
        ORDER BY total DESC
        LIMIT 20
        "#,
        params![start_str.clone()],
    ).await?;
    let mut by_recipe = Vec::new();
    while let Some(row) = rows.next().await? {
        let name: String = row.get(0)?;
        let total_cost: f64 = row.get(1)?;
        by_recipe.push(RecipeCost {
            recipe_id: 0,
            recipe_name: name,
            total_cost,
            portions: 1,
            cost_per_portion: total_cost,
            count: 1,
        });
    }

    // By supplier — sourced from `stock_purchases` (direct stock purchases,
    // e.g. via the Stock page or the receipt scanner), NOT from
    // `shopping_list_items` (which has no supplier link at all). This is a
    // different data source from total_spent/by_category/by_recipe above,
    // so its total won't necessarily reconcile with theirs — the frontend
    // must label this section accordingly. See also the architecture note
    // about unifying purchase sources.
    let mut rows = conn.query(
        r#"
        SELECT s.name, COALESCE(SUM(sp.total_price), 0.0) AS total
        FROM stock_purchases sp
        JOIN suppliers s ON sp.supplier_id = s.id
        JOIN ingredients i ON sp.ingredient_id = i.id
        WHERE i.event_id IS NULL AND date(sp.purchase_date) >= date(?1)
        GROUP BY s.name
        ORDER BY total DESC
        "#,
        params![start_str],
    ).await?;
    let mut by_supplier_raw = Vec::new();
    let mut total_by_supplier = 0.0_f64;
    while let Some(row) = rows.next().await? {
        let supplier: String = row.get(0)?;
        let total: f64 = row.get(1)?;
        total_by_supplier += total;
        by_supplier_raw.push((supplier, total));
    }
    let mut by_supplier = Vec::new();
    for (supplier, total) in by_supplier_raw {
        by_supplier.push(SupplierCost {
            supplier,
            total,
            percentage: if total_by_supplier > 0.0 { (total / total_by_supplier) * 100.0 } else { 0.0 },
        });
    }

    let daily_avg = if days > 0 { total_spent / days as f64 } else { 0.0 };

    Ok(CostReport {
        total_spent,
        by_category,
        by_recipe,
        by_supplier,
        daily_avg,
    })
}

/// Get waste report for a date range
/// Note: We don't have explicit waste tracking, so we estimate from stock reductions not linked to recipes
pub async fn get_waste_report(db: &Database, days: u32) -> LibsqlResult<WasteReport> {
    let conn = get_conn(db).await?;
    let start_date = Utc::now() - chrono::Duration::days(days as i64);
    let _start_str = start_date.to_rfc3339();

    // For waste estimation, we look at stock quantity decreases that aren't explained by recipes
    // This is a simplified implementation - in a real app you'd have a waste_log table
    let _rows = conn.query(
        r#"
        SELECT i.id, i.name, i.unit, i.price_per_unit,
               COALESCE(s.quantity, 0) as current_qty
        FROM ingredients i
        LEFT JOIN stock s ON i.id = s.ingredient_id
        WHERE i.price_per_unit > 0
        "#,
        (),
    ).await?;

    // Since we don't have historical stock snapshots, return empty for now
    // In a real implementation, you'd track stock changes over time
    Ok(WasteReport {
        total_wasted_value: 0.0,
        by_ingredient: Vec::new(),
        by_category: Vec::new(),
    })
}

/// Get stock trends for a date range
/// Returns snapshots of stock levels over time
pub async fn get_stock_trends(db: &Database, days: u32) -> LibsqlResult<Vec<StockSnapshot>> {
    let conn = get_conn(db).await?;
    let start_date = Utc::now() - chrono::Duration::days(days as i64);
    let _start_str = start_date.to_rfc3339();

    // Since we don't have historical stock snapshots, we generate daily snapshots
    // based on current stock and simulate the trend
    let mut rows = conn.query(
        r#"
        SELECT s.ingredient_id, i.name, i.unit, s.quantity, i.price_per_unit
        FROM stock s
        JOIN ingredients i ON s.ingredient_id = i.id
        WHERE i.event_id IS NULL AND s.quantity > 0
        ORDER BY i.name
        "#,
        (),
    ).await?;

    let mut current_stock: Vec<(i64, String, Unit, f64, f64)> = Vec::new();
    while let Some(row) = rows.next().await? {
        let ingredient_id: i64 = row.get(0)?;
        let ingredient_name: String = row.get(1)?;
        let unit_str: String = row.get(2)?;
        let unit = match unit_str.as_str() {
            "gram" => Unit::Gram, "kilogram" => Unit::Kilogram, "milligram" => Unit::Milligram,
            "ounce" => Unit::Ounce, "pound" => Unit::Pound,
            "milliliter" => Unit::Milliliter, "liter" => Unit::Liter, "fluid_ounce" => Unit::FluidOunce,
            "cup" => Unit::Cup, "pint" => Unit::Pint, "quart" => Unit::Quart, "gallon" => Unit::Gallon,
            "teaspoon" => Unit::Teaspoon, "tablespoon" => Unit::Tablespoon,
            "piece" => Unit::Piece, "dozen" => Unit::Dozen,
            "pinch" => Unit::Pinch, "bunch" => Unit::Bunch, "clove" => Unit::Clove, "slice" => Unit::Slice,
            _ => Unit::Gram,
        };
        let quantity: f64 = row.get(3)?;
        let price_per_unit: f64 = row.get(4)?;
        current_stock.push((ingredient_id, ingredient_name, unit, quantity, price_per_unit));
    }

    // Generate snapshots for each day
    let mut snapshots = Vec::new();
    for day_offset in 0..days {
        let snapshot_date = start_date + chrono::Duration::days(day_offset as i64);
        for (ingredient_id, ingredient_name, _unit, quantity, price_per_unit) in &current_stock {
            // Add some variation for demo purposes
            let variation = 1.0 + (day_offset as f64 * 0.02) - 0.05; // slight trend
            let qty = (*quantity * variation).max(0.0);
            let value = qty * *price_per_unit;
            
            snapshots.push(StockSnapshot {
                date: snapshot_date,
                ingredient_id: *ingredient_id,
                ingredient_name: ingredient_name.clone(),
                quantity: qty,
                value,
            });
        }
    }

    Ok(snapshots)
}

/// Get meal statistics for a date range
pub async fn get_meal_stats(db: &Database, days: u32) -> LibsqlResult<MealStats> {
    let conn = get_conn(db).await?;
    let end_date = Utc::now();
    let start_date = end_date - chrono::Duration::days(days as i64);
    let start_str = start_date.to_rfc3339();
    let end_str = end_date.to_rfc3339();

    // Get meal plan entries in date range with day_of_week
    let mut rows = conn.query(
        r#"
        SELECT mpe.id, mpe.recipe_id, mpe.recipe_name, mpe.day_of_week, mpe.meal_type, mpe.portions,
               mp.start_date, mp.end_date
        FROM meal_plan_entries mpe
        JOIN meal_plans mp ON mpe.meal_plan_id = mp.id
        WHERE date(mp.start_date) <= date(?2)
          AND date(mp.end_date) >= date(?1)
        "#,
        params![start_str.clone(), end_str.clone()],
    ).await?;

    let mut filtered_entries = Vec::new();
    while let Some(row) = rows.next().await? {
        let id: i64 = row.get(0)?;
        let recipe_id: i64 = row.get(1)?;
        let recipe_name: String = row.get(2)?;
        let day_str: String = row.get(3)?;
        let meal_type_str: String = row.get(4)?;
        let portions: u32 = row.get(5)?;
        let plan_start_str: String = row.get(6)?;
        let _plan_end_str: String = row.get(7)?;
        
        let day_of_week = match day_str.as_str() {
            "monday" => DayOfWeek::Monday,
            "tuesday" => DayOfWeek::Tuesday,
            "wednesday" => DayOfWeek::Wednesday,
            "thursday" => DayOfWeek::Thursday,
            "friday" => DayOfWeek::Friday,
            "saturday" => DayOfWeek::Saturday,
            "sunday" => DayOfWeek::Sunday,
            _ => DayOfWeek::Monday,
        };
        
        let meal_type = match meal_type_str.as_str() {
            "breakfast" => MealType::Breakfast,
            "lunch" => MealType::Lunch,
            "dinner" => MealType::Dinner,
            "snack" => MealType::Snack,
            _ => MealType::Lunch,
        };

        let plan_start = DateTime::parse_from_rfc3339(&plan_start_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        
        let day_index = day_of_week.index();
        let planned_date = plan_start + chrono::Duration::days(day_index as i64);

        // Only include if within date range
        if planned_date >= start_date && planned_date <= end_date {
            filtered_entries.push((id, recipe_id, recipe_name, meal_type, portions));
        }
    }

    let total_meals = filtered_entries.len() as u32;
    let total_portions: u32 = filtered_entries.iter().map(|e| e.4).sum();
    let avg_portions = if total_meals > 0 { total_portions as f64 / total_meals as f64 } else { 0.0 };

    // By meal type
    let mut meal_type_map: std::collections::HashMap<MealType, (u32, u32)> = std::collections::HashMap::new();
    for (_, _, _, meal_type, portions) in &filtered_entries {
        let entry = meal_type_map.entry(*meal_type).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += *portions;
    }
    let mut by_meal_type = Vec::new();
    for (meal_type, (count, total_portions)) in meal_type_map {
        by_meal_type.push(MealTypeStat {
            meal_type,
            count,
            total_portions,
            percentage: if total_meals > 0 { (count as f64 / total_meals as f64) * 100.0 } else { 0.0 },
        });
    }
    by_meal_type.sort_by(|a, b| b.count.cmp(&a.count));

    // By recipe
    let mut recipe_map: std::collections::HashMap<i64, (String, u32, u32)> = std::collections::HashMap::new();
    for (_, recipe_id, recipe_name, _, portions) in &filtered_entries {
        let entry = recipe_map.entry(*recipe_id).or_insert((recipe_name.clone(), 0, 0));
        entry.1 += 1;
        entry.2 += *portions;
    }
    let mut by_recipe = Vec::new();
    for (recipe_id, (recipe_name, count, total_portions)) in recipe_map {
        by_recipe.push(RecipeMealStat {
            recipe_id,
            recipe_name,
            count,
            total_portions,
            avg_portions: if count > 0 { total_portions as f64 / count as f64 } else { 0.0 },
        });
    }
    by_recipe.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(MealStats {
        total_meals,
        avg_portions,
        by_meal_type,
        by_recipe,
    })
}

/// Get price trends for an ingredient over a date range
pub async fn get_price_trends(db: &Database, ingredient_id: i64, days: u32) -> LibsqlResult<Vec<PricePoint>> {
    let conn = get_conn(db).await?;
    let start_date = Utc::now() - chrono::Duration::days(days as i64);
    let start_str = start_date.to_rfc3339();

    let mut rows = conn.query(
        r#"
        SELECT pq.created_at, pq.price_per_unit, pq.supplier
        FROM price_quotes pq
        WHERE pq.ingredient_id = ?1
          AND date(pq.created_at) >= date(?2)
        ORDER BY date(pq.created_at) ASC
        "#,
        params![ingredient_id, start_str],
    ).await?;

    let mut trends = Vec::new();
    while let Some(row) = rows.next().await? {
        let created_at_str: String = row.get(0)?;
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let price: f64 = row.get(1)?;
        let supplier: String = row.get(2)?;
        
        trends.push(PricePoint {
            date: created_at,
            price,
            supplier,
        });
    }

    Ok(trends)
}

// =====================================================================
// IMAGES
// =====================================================================

/// Map a libsql Row to Image
fn row_to_image(row: &Row) -> LibsqlResult<Image> {
    let entity_type_str: String = row.get(1)?;
    let entity_type = match entity_type_str.as_str() {
        "recipe" => ImageEntityType::Recipe,
        "ingredient" => ImageEntityType::Ingredient,
        "supplier" => ImageEntityType::Supplier,
        "receipt" => ImageEntityType::Receipt,
        "profile" => ImageEntityType::Profile,
        _ => ImageEntityType::Recipe,
    };

    let created_at_str: String = row.get(6)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(Image {
        id: row.get(0)?,
        entity_type,
        entity_id: row.get(2)?,
        path: row.get(3)?,
        mime_type: row.get(4)?,
        is_primary: row.get(5)?,
        created_at,
    })
}

/// Save base64 image to file system and return path
async fn save_base64_image(base64: &str, entity_type: &str, entity_id: i64, data_dir: &std::path::Path) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    // Decode base64
    let bytes = STANDARD.decode(base64).map_err(|e| e.to_string())?;
    
    // Detect mime type from bytes (simple detection)
    let mime_type = if bytes.starts_with(b"\xFF\xD8\xFF") {
        "image/jpeg"
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        "image/webp"
    } else {
        "image/jpeg"
    };

    // Get extension
    let ext = match mime_type {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "jpg",
    };

    // Create filename
    let filename = format!("{}_{}_{}.{}", entity_type, entity_id, chrono::Utc::now().timestamp_millis(), ext);
    
    let images_dir = data_dir.join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;
    let file_path = images_dir.join(&filename);

    // Write file
    std::fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    // Return relative path
    Ok(format!("images/{}", filename))
}

/// Upload image for an entity
pub async fn image_upload(db: &Database, input: ImageUploadInput, data_dir: &std::path::Path) -> LibsqlResult<Image> {
    // Save file
    let path = save_base64_image(&input.base64, input.entity_type.as_str(), input.entity_id, data_dir).await
        .map_err(|e| libsql::Error::Misuse(e))?;
    
    let conn = get_conn(db).await?;
    
    // If this is primary, unset other primary images for this entity
    if true { // Always set as primary for now, or add is_primary to input
        conn.execute(
            "UPDATE images SET is_primary = 0 WHERE entity_type = ?1 AND entity_id = ?2",
            params![input.entity_type.as_str(), input.entity_id],
        ).await?;
    }
    
    conn.execute(
        "INSERT INTO images (entity_type, entity_id, path, mime_type, is_primary) VALUES (?1, ?2, ?3, ?4, 1)",
        params![input.entity_type.as_str(), input.entity_id, path, input.mime_type],
    ).await?;
    
    let id = conn.last_insert_rowid();
    let mut rows = conn.query(
        "SELECT id, entity_type, entity_id, path, mime_type, is_primary, created_at FROM images WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    
    row_to_image(&row)
}

/// Delete image
pub async fn image_delete(db: &Database, id: i64, data_dir: &std::path::Path) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;

    // Get path first to delete file
    let mut rows = conn.query("SELECT path FROM images WHERE id = ?1", params![id]).await?;
    if let Some(row) = rows.next().await? {
        let path: String = row.get(0)?;
        // Try to delete file (ignore errors)
        let _ = std::fs::remove_file(data_dir.join(&path));
    }

    conn.execute("DELETE FROM images WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Read an image file's bytes as base64, for display via data: URL
pub async fn image_read_base64(db: &Database, id: i64, data_dir: &std::path::Path) -> LibsqlResult<String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let conn = get_conn(db).await?;
    let mut rows = conn.query("SELECT path FROM images WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let path: String = row.get(0)?;

    let bytes = std::fs::read(data_dir.join(&path))
        .map_err(|e| libsql::Error::Misuse(e.to_string()))?;

    Ok(STANDARD.encode(bytes))
}

fn row_to_problem_report(row: &Row) -> LibsqlResult<ProblemReport> {
    let created_at_str: String = row.get(3)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(ProblemReport {
        id: row.get(0)?,
        description: row.get(1)?,
        image_path: row.get(2)?,
        created_at,
    })
}

/// Create a user-submitted problem report, optionally with an attached
/// image. Local-only: `export_usage_data` below is the only way this data
/// leaves the machine, never sent automatically.
pub async fn problem_report_create(db: &Database, input: ProblemReportInput, data_dir: &std::path::Path) -> LibsqlResult<ProblemReport> {
    let image_path = match input.image_base64 {
        Some(base64) => Some(
            save_base64_image(&base64, "problem_report", 0, data_dir).await
                .map_err(libsql::Error::Misuse)?,
        ),
        None => None,
    };

    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO problem_reports (description, image_path) VALUES (?1, ?2)",
        params![input.description, image_path],
    ).await?;

    let id = conn.last_insert_rowid();
    let mut rows = conn.query(
        "SELECT id, description, image_path, created_at FROM problem_reports WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    row_to_problem_report(&row)
}

/// Export all locally-stored problem reports and usage events as a
/// human-readable Markdown report (plus copies of report images) into a
/// new timestamped subfolder under `dest_dir`. Returns the created folder
/// path. `usage_events` has no writers yet (Fase de Instrumentação shell,
/// ver PROJECT.md) — the section renders empty until real emitters exist.
pub async fn export_usage_data(db: &Database, data_dir: &std::path::Path, dest_dir: &std::path::Path) -> LibsqlResult<String> {
    let conn = get_conn(db).await?;

    let export_name = format!("mise-export-{}", chrono::Utc::now().format("%Y-%m-%d_%H%M%S"));
    let export_dir = dest_dir.join(&export_name);
    let images_out_dir = export_dir.join("images");
    std::fs::create_dir_all(&images_out_dir).map_err(|e| libsql::Error::Misuse(e.to_string()))?;

    let mut md = String::new();
    md.push_str(&format!("# Relatório de uso — {}\n\n", chrono::Utc::now().format("%Y-%m-%d %H:%M UTC")));

    md.push_str("## Reportes de problemas\n\n");
    let mut reports = conn.query(
        "SELECT id, description, image_path, created_at FROM problem_reports ORDER BY created_at DESC",
        (),
    ).await?;
    let mut report_count = 0;
    while let Some(row) = reports.next().await? {
        report_count += 1;
        let id: i64 = row.get(0)?;
        let description: String = row.get(1)?;
        let image_path: Option<String> = row.get(2)?;
        let created_at: String = row.get(3)?;

        md.push_str(&format!("### #{id} — {created_at}\n\n{description}\n\n"));
        if let Some(path) = image_path {
            let src = data_dir.join(&path);
            if let Some(filename) = std::path::Path::new(&path).file_name() {
                let dest = images_out_dir.join(filename);
                if std::fs::copy(&src, &dest).is_ok() {
                    md.push_str(&format!("![imagem](images/{})\n\n", filename.to_string_lossy()));
                }
            }
        }
    }
    if report_count == 0 {
        md.push_str("_Nenhum problema reportado._\n\n");
    }

    md.push_str("## Eventos de uso\n\n");
    let mut events = conn.query(
        "SELECT event_type, payload_json, created_at FROM usage_events ORDER BY created_at DESC",
        (),
    ).await?;
    let mut event_count = 0;
    while let Some(row) = events.next().await? {
        event_count += 1;
        let event_type: String = row.get(0)?;
        let payload: Option<String> = row.get(1)?;
        let created_at: String = row.get(2)?;
        md.push_str(&format!(
            "- `{created_at}` **{event_type}**{}\n",
            payload.map(|p| format!(" — {p}")).unwrap_or_default()
        ));
    }
    if event_count == 0 {
        md.push_str("_Nenhum evento de uso registado ainda._\n\n");
    }

    let md_path = export_dir.join("relatorio.md");
    std::fs::write(&md_path, md).map_err(|e| libsql::Error::Misuse(e.to_string()))?;

    Ok(export_dir.display().to_string())
}

/// Set image as primary
pub async fn image_set_primary(db: &Database, id: i64) -> LibsqlResult<Image> {
    let conn = get_conn(db).await?;
    
    // Get the image first
    let mut rows = conn.query(
        "SELECT id, entity_type, entity_id FROM images WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let entity_type: String = row.get(1)?;
    let entity_id: i64 = row.get(2)?;
    
    // Unset other primary images
    conn.execute(
        "UPDATE images SET is_primary = 0 WHERE entity_type = ?1 AND entity_id = ?2",
        params![entity_type, entity_id],
    ).await?;
    
    // Set this as primary
    conn.execute(
        "UPDATE images SET is_primary = 1 WHERE id = ?1",
        params![id],
    ).await?;
    
    // Return updated image
    let mut rows = conn.query(
        "SELECT id, entity_type, entity_id, path, mime_type, is_primary, created_at FROM images WHERE id = ?1",
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    
    row_to_image(&row)
}

/// Get images for an entity
pub async fn image_get(db: &Database, entity_type: ImageEntityType, entity_id: i64) -> LibsqlResult<Vec<Image>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        "SELECT id, entity_type, entity_id, path, mime_type, is_primary, created_at FROM images WHERE entity_type = ?1 AND entity_id = ?2 ORDER BY is_primary DESC, created_at DESC",
        params![entity_type.as_str(), entity_id],
    ).await?;
    
    let mut images = Vec::new();
    while let Some(row) = rows.next().await? {
        images.push(row_to_image(&row)?);
    }
    Ok(images)
}

/// Proxy search images from Unsplash
async fn search_unsplash(query: &str, per_page: u32) -> Result<Vec<ProxyImageResult>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.unsplash.com/search/photos?query={}&per_page={}&client_id={}",
        urlencoding::encode(query),
        per_page,
        std::env::var("UNSPLASH_ACCESS_KEY").unwrap_or_default()
    );
    
    if std::env::var("UNSPLASH_ACCESS_KEY").is_err() {
        return Ok(Vec::new()); // No API key, return empty
    }
    
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    
    let mut results = Vec::new();
    if let Some(photos) = json["results"].as_array() {
        for photo in photos {
            results.push(ProxyImageResult {
                id: photo["id"].as_str().unwrap_or("").to_string(),
                url: photo["urls"]["regular"].as_str().unwrap_or("").to_string(),
                thumb_url: photo["urls"]["thumb"].as_str().unwrap_or("").to_string(),
                width: photo["width"].as_u64().unwrap_or(0) as u32,
                height: photo["height"].as_u64().unwrap_or(0) as u32,
                alt: photo["alt_description"].as_str().map(|s| s.to_string()),
                photographer: photo["user"]["name"].as_str().map(|s| s.to_string()),
                source: "unsplash".to_string(),
            });
        }
    }
    Ok(results)
}

/// Proxy search images from Pexels
async fn search_pexels(query: &str, per_page: u32) -> Result<Vec<ProxyImageResult>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://api.pexels.com/v1/search?query={}&per_page={}",
        urlencoding::encode(query),
        per_page
    );
    
    let api_key = match std::env::var("PEXELS_API_KEY") {
        Ok(k) => k,
        Err(_) => return Ok(Vec::new()), // No API key, return empty
    };
    
    let resp = client
        .get(&url)
        .header("Authorization", api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    
    let mut results = Vec::new();
    if let Some(photos) = json["photos"].as_array() {
        for photo in photos {
            results.push(ProxyImageResult {
                id: photo["id"].as_u64().unwrap_or(0).to_string(),
                url: photo["src"]["large"].as_str().unwrap_or("").to_string(),
                thumb_url: photo["src"]["medium"].as_str().unwrap_or("").to_string(),
                width: photo["width"].as_u64().unwrap_or(0) as u32,
                height: photo["height"].as_u64().unwrap_or(0) as u32,
                alt: photo["alt"].as_str().map(|s| s.to_string()),
                photographer: photo["photographer"].as_str().map(|s| s.to_string()),
                source: "pexels".to_string(),
            });
        }
    }
    Ok(results)
}

/// Search images from free stock photo APIs
pub async fn image_search_proxy(query: String, per_page: Option<u32>) -> Result<Vec<ProxyImageResult>, String> {
    let per_page = per_page.unwrap_or(20).min(30);
    let mut results = Vec::new();
    
    // Search both in parallel
    let (unsplash_results, pexels_results) = tokio::join!(
        search_unsplash(&query, per_page),
        search_pexels(&query, per_page)
    );
    
    results.extend(unsplash_results.unwrap_or_default());
    results.extend(pexels_results.unwrap_or_default());
    
    // Shuffle to mix sources
    use rand::seq::SliceRandom;
    let mut rng = rand::rng();
    results.shuffle(&mut rng);
    
    results.truncate(per_page as usize);
    Ok(results)
}

// =====================================================================
// STOCK PURCHASES
// =====================================================================

/// Parse a unit column string into Unit, defaulting to Gram on unknown values.
fn parse_unit_str(unit_str: &str) -> Unit {
    match unit_str {
        "gram" => Unit::Gram,
        "kilogram" => Unit::Kilogram,
        "milligram" => Unit::Milligram,
        "ounce" => Unit::Ounce,
        "pound" => Unit::Pound,
        "milliliter" => Unit::Milliliter,
        "liter" => Unit::Liter,
        "fluid_ounce" => Unit::FluidOunce,
        "cup" => Unit::Cup,
        "pint" => Unit::Pint,
        "quart" => Unit::Quart,
        "gallon" => Unit::Gallon,
        "teaspoon" => Unit::Teaspoon,
        "tablespoon" => Unit::Tablespoon,
        "piece" => Unit::Piece,
        "dozen" => Unit::Dozen,
        "pinch" => Unit::Pinch,
        "bunch" => Unit::Bunch,
        "clove" => Unit::Clove,
        "slice" => Unit::Slice,
        _ => Unit::Gram,
    }
}

/// Map a libsql Row to StockPurchase. Expects columns in exactly this order:
/// sp.id, sp.ingredient_id, i.name, i.unit, sp.quantity, sp.unit, sp.price_per_unit,
/// sp.total_price, sp.is_discount, sp.discount_percent, sp.purchase_date, sp.supplier_id,
/// s.name, sp.brand, sp.notes, sp.created_at
fn row_to_stock_purchase(row: &Row) -> LibsqlResult<StockPurchase> {
    let ingredient_unit_str: String = row.get(3)?;
    let ingredient_unit = parse_unit_str(&ingredient_unit_str);

    let unit_str: String = row.get(5)?;
    let unit = parse_unit_str(&unit_str);

    let purchase_date_str: String = row.get(10)?;
    let purchase_date = DateTime::parse_from_rfc3339(&purchase_date_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    let created_at_str: String = row.get(15)?;
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(StockPurchase {
        id: row.get(0)?,
        ingredient_id: row.get(1)?,
        ingredient_name: row.get(2)?,
        ingredient_unit,
        quantity: row.get(4)?,
        unit,
        price_per_unit: row.get(6)?,
        total_price: row.get(7)?,
        is_discount: row.get(8)?,
        discount_percent: row.get(9)?,
        purchase_date,
        supplier_id: row.get(11)?,
        supplier_name: row.get(12)?,
        brand: row.get(13)?,
        notes: row.get(14)?,
        created_at,
    })
}

/// Add stock purchase (records purchase history, updates stock quantity only)
pub async fn stock_purchase_add(db: &Database, input: StockPurchaseInput) -> LibsqlResult<StockPurchase> {
    let conn = get_conn(db).await?;
    
    let unit_str = match input.unit {
        Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
        Unit::Ounce => "ounce", Unit::Pound => "pound",
        Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
        Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
        Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
        Unit::Piece => "piece", Unit::Dozen => "dozen",
        Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
    };
    
    // Get ingredient name and unit for denormalization
    let mut rows = conn.query(
        "SELECT name, unit FROM ingredients WHERE id = ?1",
        params![input.ingredient_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let ingredient_name: String = row.get(0)?;
    let ingredient_unit_str: String = row.get(1)?;
    let _ingredient_unit = match ingredient_unit_str.as_str() {
        "gram" => Unit::Gram, "kilogram" => Unit::Kilogram, "milligram" => Unit::Milligram,
        "ounce" => Unit::Ounce, "pound" => Unit::Pound,
        "milliliter" => Unit::Milliliter, "liter" => Unit::Liter, "fluid_ounce" => Unit::FluidOunce,
        "cup" => Unit::Cup, "pint" => Unit::Pint, "quart" => Unit::Quart, "gallon" => Unit::Gallon,
        "teaspoon" => Unit::Teaspoon, "tablespoon" => Unit::Tablespoon,
        "piece" => Unit::Piece, "dozen" => Unit::Dozen,
        "pinch" => Unit::Pinch, "bunch" => Unit::Bunch, "clove" => Unit::Clove, "slice" => Unit::Slice,
        _ => Unit::Gram,
    };
    
    // Get supplier name if provided
    let _supplier_name = if let Some(supplier_id) = input.supplier_id {
        let mut rows = conn.query("SELECT name FROM suppliers WHERE id = ?1", params![supplier_id]).await?;
        rows.next().await?.map(|r| r.get::<String>(0).unwrap_or_default())
    } else {
        None
    };
    
    // Insert stock purchase
    conn.execute(
        r#"
        INSERT INTO stock_purchases
        (ingredient_id, quantity, unit, price_per_unit, total_price, is_discount, discount_percent, purchase_date, supplier_id, brand, notes)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
        params![
            input.ingredient_id,
            input.quantity,
            unit_str,
            input.price_per_unit,
            input.total_price,
            input.is_discount as i32,
            input.discount_percent,
            input.purchase_date.to_rfc3339(),
            input.supplier_id,
            input.brand,
            input.notes,
        ],
    ).await?;
    
    // Update stock quantity (add purchased quantity)
    conn.execute(
        "INSERT INTO stock (ingredient_id, ingredient_name, ingredient_unit, quantity, min_quantity, updated_at)
         VALUES (?1, ?2, ?3, ?4, 0, datetime('now'))
         ON CONFLICT(ingredient_id) DO UPDATE SET quantity = quantity + ?4, updated_at = datetime('now')",
        params![input.ingredient_id, ingredient_name, ingredient_unit_str, input.quantity],
    ).await?;
    
    let id = conn.last_insert_rowid();
    let mut rows = conn.query(
        r#"
        SELECT sp.id, sp.ingredient_id, i.name, i.unit, sp.quantity, sp.unit, sp.price_per_unit, sp.total_price,
               sp.is_discount, sp.discount_percent, sp.purchase_date, sp.supplier_id, s.name, sp.brand, sp.notes, sp.created_at
        FROM stock_purchases sp
        JOIN ingredients i ON sp.ingredient_id = i.id
        LEFT JOIN suppliers s ON sp.supplier_id = s.id
        WHERE sp.id = ?1
        "#,
        params![id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    
    row_to_stock_purchase(&row)
}

/// List stock purchases for an ingredient
pub async fn stock_purchases_list(db: &Database, ingredient_id: i64) -> LibsqlResult<Vec<StockPurchase>> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query(
        r#"
        SELECT sp.id, sp.ingredient_id, i.name, i.unit, sp.quantity, sp.unit, sp.price_per_unit, sp.total_price,
               sp.is_discount, sp.discount_percent, sp.purchase_date, sp.supplier_id, s.name, sp.brand, sp.notes, sp.created_at
        FROM stock_purchases sp
        JOIN ingredients i ON sp.ingredient_id = i.id
        LEFT JOIN suppliers s ON sp.supplier_id = s.id
        WHERE sp.ingredient_id = ?1
        ORDER BY sp.purchase_date DESC
        "#,
        params![ingredient_id],
    ).await?;
    
    let mut purchases = Vec::new();
    while let Some(row) = rows.next().await? {
        purchases.push(row_to_stock_purchase(&row)?);
    }
    Ok(purchases)
}

/// Delete stock purchase (does NOT revert stock quantity - manual adjustment needed)
pub async fn stock_purchase_delete(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = get_conn(db).await?;
    conn.execute("DELETE FROM stock_purchases WHERE id = ?1", params![id]).await?;
    Ok(())
}

// =====================================================================
// RECEIPT OCR
// =====================================================================

/// Save base64 image for receipt and return path
async fn save_receipt_image(base64: &str, data_dir: &std::path::Path) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let bytes = STANDARD.decode(base64).map_err(|e| e.to_string())?;

    let ext = if bytes.starts_with(b"\xFF\xD8\xFF") { "jpg" }
    else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { "png" }
    else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") { "gif" }
    else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") { "webp" }
    else { "jpg" };

    let filename = format!("receipt_{}.{}", chrono::Utc::now().timestamp_millis(), ext);

    let images_dir = data_dir.join("images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;
    let file_path = images_dir.join(&filename);

    std::fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    Ok(format!("images/{}", filename))
}

/// Scan receipt image with Tesseract OCR
pub async fn receipt_scan(db: &Database, input: ReceiptScanInput, data_dir: &std::path::Path) -> LibsqlResult<ReceiptParseResult> {
    // Save image
    let image_path = save_receipt_image(&input.base64_image, data_dir).await
        .map_err(|e| libsql::Error::Misuse(e))?;

    // Create import record
    let conn = get_conn(db).await?;
    conn.execute(
        "INSERT INTO receipt_imports (image_path, status) VALUES (?1, 'scanned')",
        params![image_path.clone()],
    ).await?;
    let import_id = conn.last_insert_rowid();

    // Run Tesseract OCR
    let full_image_path = data_dir.join(&image_path);
    
    // Use tesseract command line
    let output = tokio::process::Command::new("tesseract")
        .arg(&full_image_path)
        .arg("stdout")
        .arg("-l")
        .arg("por+eng") // Portuguese + English
        .output()
        .await;
    
    let raw_text = match output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            // Update status to failed
            conn.execute("UPDATE receipt_imports SET status = 'failed', raw_text = ?1 WHERE id = ?2", params![err.to_string(), import_id]).await?;
            return Err(libsql::Error::Misuse(format!("OCR failed: {}", err)));
        }
        Err(e) => {
            let err = e.to_string();
            conn.execute("UPDATE receipt_imports SET status = 'failed', raw_text = ?1 WHERE id = ?2", params![err.clone(), import_id]).await?;
            return Err(libsql::Error::Misuse(format!("Tesseract not found: {}", err)));
        }
    };
    
    // Update import with raw text
    conn.execute(
        "UPDATE receipt_imports SET raw_text = ?1, status = 'scanned' WHERE id = ?2",
        params![raw_text.clone(), import_id],
    ).await?;
    
    // Parse the raw text
    let items = parse_receipt_text(&raw_text).await;
    
    // Update with parsed items
    let parsed_json = serde_json::to_string(&items).unwrap_or_default();
    conn.execute(
        "UPDATE receipt_imports SET parsed_json = ?1, status = 'parsed' WHERE id = ?2",
        params![parsed_json, import_id],
    ).await?;
    
    Ok(ReceiptParseResult {
        import_id,
        raw_text,
        items,
    })
}

/// Parse receipt text using regex heuristics
async fn parse_receipt_text(text: &str) -> Vec<ParsedReceiptItem> {
    let mut items = Vec::new();
    let lines: Vec<&str> = text.lines().collect();
    
    // Common patterns for receipts:
    // "Item Name    2 x 1.50    3.00"
    // "Item Name              3.00"
    // "2 UN x 1.50 EUR = 3.00"
    
    // Regex patterns for quantity, unit, price
    let Ok(price_regex) = regex::Regex::new(r"(\d+[.,]\d{2})\s*(?:EUR|€|\$|R\$)?") else { return items; };
    let Ok(qty_unit_regex) = regex::Regex::new(r"(\d+[.,]?\d*)\s*(?:x|X|UN|UNID|KG|G|L|ML|PCS|PÇ)?") else { return items; };
    let Ok(discount_regex) = regex::Regex::new(r"(?:DESC|DESCONTO|DISCOUNT|%)\s*(\d+[.,]?\d*)%?") else { return items; };
    
    // Get ingredient names for fuzzy matching
    // This would need DB access - for now we just parse without matching
    
    for line in lines {
        let line = line.trim();
        if line.is_empty() || line.len() < 3 {
            continue;
        }
        
        // Skip common receipt header/footer lines
        let lower = line.to_lowercase();
        if lower.contains("total") || lower.contains("subtotal") || lower.contains("troco") 
            || lower.contains("change") || lower.contains("vlr") || lower.contains("valor")
            || lower.contains("pagamento") || lower.contains("cartao") || lower.contains("dinheiro")
            || lower.contains("multibanco") || lower.contains("mb way") || lower.contains("iva")
            || lower.contains("tax") || lower.contains("receipt") || lower.contains("cupom")
            || lower.contains("nota fiscal") || lower.contains("data") || lower.contains("hora")
            || lower.contains("caixa") || lower.contains("operador") || lower.contains("nif")
            || lower.contains("contribuinte") {
            continue;
        }
        
        // Try to extract price (usually at end of line)
        let price_matches: Vec<_> = price_regex.find_iter(line).collect();
        if price_matches.is_empty() {
            continue; // No price found, likely not an item line
        }
        
        // Use the last price match as the line total
        let total_price_str = price_matches.last().map(|m| m.as_str()).unwrap_or("0");
        let total_price = total_price_str.replace(',', ".").parse::<f64>().unwrap_or(0.0);
        if total_price <= 0.0 {
            continue;
        }
        
        // Extract item name (text before the price/quantity)
        let price_pos = line.rfind(total_price_str).unwrap_or(line.len());
        let item_part = &line[..price_pos].trim();
        
        // Try to find quantity x unit price pattern
        let mut quantity = 1.0;
        let mut unit = Unit::Piece;
        let mut price_per_unit = total_price;
        let mut is_discount = false;
        let mut discount_percent = 0.0;
        
        // Look for qty x price pattern in item_part
        if let Some(caps) = qty_unit_regex.captures(item_part) {
            if let Some(qty_match) = caps.get(1) {
                quantity = qty_match.as_str().replace(',', ".").parse::<f64>().unwrap_or(1.0);
            }
        }
        
        // Look for unit in item_part
        let item_lower = item_part.to_lowercase();
        if item_lower.contains("kg") || item_lower.contains("quilo") { unit = Unit::Kilogram; }
        else if item_lower.contains("g ") || item_lower.ends_with("g") || item_lower.contains("gr ") { unit = Unit::Gram; }
        else if item_lower.contains("l ") || item_lower.ends_with("l") || item_lower.contains("litro") { unit = Unit::Liter; }
        else if item_lower.contains("ml") { unit = Unit::Milliliter; }
        else if item_lower.contains("un") || item_lower.contains("pcs") || item_lower.contains("peça") { unit = Unit::Piece; }
        
        // Calculate price per unit
        if quantity > 0.0 {
            price_per_unit = total_price / quantity;
        }
        
        // Check for discount
        if discount_regex.is_match(line) {
            is_discount = true;
            if let Some(caps) = discount_regex.captures(line) {
                if let Some(pct_match) = caps.get(1) {
                    discount_percent = pct_match.as_str().replace(',', ".").parse::<f64>().unwrap_or(0.0);
                }
            }
        }
        
        // Clean item name - remove qty/price parts
        let mut ingredient_name = item_part.to_string();
        // Remove trailing numbers, x, prices
        ingredient_name = price_regex.replace_all(&ingredient_name, "").to_string();
        ingredient_name = qty_unit_regex.replace_all(&ingredient_name, "").to_string();
        ingredient_name = discount_regex.replace_all(&ingredient_name, "").to_string();
        ingredient_name = ingredient_name.trim_matches(|c: char| c.is_ascii_punctuation() || c.is_whitespace()).to_string();
        
        if ingredient_name.len() < 2 {
            continue;
        }
        
        // Try to match with existing ingredients (fuzzy match)
        // This would require DB access - placeholder for now
        let matched_ingredient_id = None;
        let confidence = if matched_ingredient_id.is_some() { 0.9 } else { 0.5 };
        
        items.push(ParsedReceiptItem {
            ingredient_name,
            quantity,
            unit,
            price_per_unit,
            total_price,
            is_discount,
            discount_percent,
            matched_ingredient_id,
            confidence,
            brand: None,
            notes: None,
        });
    }
    
    items
}

/// Parse raw receipt text (for re-parsing)
pub async fn receipt_parse(_db: &Database, raw_text: String) -> LibsqlResult<Vec<ParsedReceiptItem>> {
    let items = parse_receipt_text(&raw_text).await;
    Ok(items)
}

/// Confirm receipt import - creates stock purchases and ingredients
pub async fn receipt_confirm(db: &Database, input: ReceiptConfirmInput) -> LibsqlResult<Vec<StockPurchase>> {
    let conn = get_conn(db).await?;
    
    // Get the import record
    let mut rows = conn.query(
        "SELECT id, image_path, raw_text, parsed_json, status FROM receipt_imports WHERE id = ?1",
        params![input.import_id],
    ).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let status_str: String = row.get(4)?;
    let status = match status_str.as_str() {
        "pending" => ReceiptStatus::Pending,
        "scanned" => ReceiptStatus::Scanned,
        "parsed" => ReceiptStatus::Parsed,
        "confirmed" => ReceiptStatus::Confirmed,
        "failed" => ReceiptStatus::Failed,
        _ => ReceiptStatus::Pending,
    };
    
    if status == ReceiptStatus::Confirmed {
        return Err(libsql::Error::Misuse("Receipt already confirmed".to_string()));
    }
    
    let mut created_purchases = Vec::new();
    
    for item in &input.items {
        // Find or create ingredient
        let ingredient_id = if let Some(matched_id) = item.matched_ingredient_id {
            // Verify ingredient exists
            let mut rows = conn.query("SELECT id FROM ingredients WHERE id = ?1", params![matched_id]).await?;
            if rows.next().await?.is_some() {
                matched_id
            } else {
                // Create new ingredient
                create_or_find_ingredient(&conn, &item.ingredient_name, item.unit).await?
            }
        } else {
            create_or_find_ingredient(&conn, &item.ingredient_name, item.unit).await?
        };
        
        // Get ingredient details
        let mut rows = conn.query("SELECT name, unit FROM ingredients WHERE id = ?1", params![ingredient_id]).await?;
        let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
        let ingredient_name: String = row.get(0)?;
        let ingredient_unit_str: String = row.get(1)?;
        let _ingredient_unit = match ingredient_unit_str.as_str() {
            "gram" => Unit::Gram, "kilogram" => Unit::Kilogram, "milligram" => Unit::Milligram,
            "ounce" => Unit::Ounce, "pound" => Unit::Pound,
            "milliliter" => Unit::Milliliter, "liter" => Unit::Liter, "fluid_ounce" => Unit::FluidOunce,
            "cup" => Unit::Cup, "pint" => Unit::Pint, "quart" => Unit::Quart, "gallon" => Unit::Gallon,
            "teaspoon" => Unit::Teaspoon, "tablespoon" => Unit::Tablespoon,
            "piece" => Unit::Piece, "dozen" => Unit::Dozen,
            "pinch" => Unit::Pinch, "bunch" => Unit::Bunch, "clove" => Unit::Clove, "slice" => Unit::Slice,
            _ => Unit::Gram,
        };
        
        // Convert unit string for purchase
        let unit_str = match item.unit {
            Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
            Unit::Ounce => "ounce", Unit::Pound => "pound",
            Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
            Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
            Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
            Unit::Piece => "piece", Unit::Dozen => "dozen",
            Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
        };
        
        // Insert stock purchase
        let purchase_date = chrono::Utc::now(); // Could parse from receipt but using now
        conn.execute(
            r#"
            INSERT INTO stock_purchases
            (ingredient_id, quantity, unit, price_per_unit, total_price, is_discount, discount_percent, purchase_date, supplier_id, brand, notes)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                ingredient_id,
                item.quantity,
                unit_str,
                item.price_per_unit,
                item.total_price,
                item.is_discount as i32,
                item.discount_percent,
                purchase_date.to_rfc3339(),
                input.supplier_id,
                item.brand.clone(),
                item.notes.clone(),
            ],
        ).await?;
        
        // Update stock quantity
        conn.execute(
            "INSERT INTO stock (ingredient_id, ingredient_name, ingredient_unit, quantity, min_quantity, updated_at)
             VALUES (?1, ?2, ?3, ?4, 0, datetime('now'))
             ON CONFLICT(ingredient_id) DO UPDATE SET quantity = quantity + ?4, updated_at = datetime('now')",
            params![ingredient_id, ingredient_name, ingredient_unit_str, item.quantity],
        ).await?;
        
        let purchase_id = conn.last_insert_rowid();
        
        // Return created purchase
        let mut rows = conn.query(
            r#"
            SELECT sp.id, sp.ingredient_id, i.name, i.unit, sp.quantity, sp.unit, sp.price_per_unit, sp.total_price,
                   sp.is_discount, sp.discount_percent, sp.purchase_date, sp.supplier_id, s.name, sp.brand, sp.notes, sp.created_at
            FROM stock_purchases sp
            JOIN ingredients i ON sp.ingredient_id = i.id
            LEFT JOIN suppliers s ON sp.supplier_id = s.id
            WHERE sp.id = ?1
            "#,
            params![purchase_id],
        ).await?;
        let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
        created_purchases.push(row_to_stock_purchase(&row)?);
    }
    
    // Mark import as confirmed
    conn.execute(
        "UPDATE receipt_imports SET status = 'confirmed' WHERE id = ?1",
        params![input.import_id],
    ).await?;
    
    Ok(created_purchases)
}

/// Helper to find or create ingredient by name
async fn create_or_find_ingredient(conn: &Connection, name: &str, unit: Unit) -> LibsqlResult<i64> {
    let mut rows = conn.query("SELECT id FROM ingredients WHERE lower(name) = lower(?1)", params![name]).await?;
    if let Some(row) = rows.next().await? {
        return Ok(row.get(0)?);
    }
    
    let unit_str = match unit {
        Unit::Gram => "gram", Unit::Kilogram => "kilogram", Unit::Milligram => "milligram",
        Unit::Ounce => "ounce", Unit::Pound => "pound",
        Unit::Milliliter => "milliliter", Unit::Liter => "liter", Unit::FluidOunce => "fluid_ounce",
        Unit::Cup => "cup", Unit::Pint => "pint", Unit::Quart => "quart", Unit::Gallon => "gallon",
        Unit::Teaspoon => "teaspoon", Unit::Tablespoon => "tablespoon",
        Unit::Piece => "piece", Unit::Dozen => "dozen",
        Unit::Pinch => "pinch", Unit::Bunch => "bunch", Unit::Clove => "clove", Unit::Slice => "slice",
    };
    
    conn.execute(
        "INSERT INTO ingredients (name, unit, price_per_unit, favorite) VALUES (?1, ?2, 0, 0)",
        params![name, unit_str],
    ).await?;
    
    Ok(conn.last_insert_rowid())
}

// Input types for categories and price quotes
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, validator::Validate, specta::Type, ts_rs::TS)]
#[ts(export, export_to = "bindings/")]
pub struct CategoryInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub kind: CategoryKind,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: i32,
}

#[cfg(test)]
mod fase3_stock_tests {
    use super::*;

    async fn test_db() -> Database {
        // ponytail: each get_conn() opens a fresh connection; a real
        // ":memory:" DB is per-connection, so tests need a temp file to
        // share state across the multiple connections db:: functions open.
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path = std::env::temp_dir().join(format!("mise_test_{unique}.db"));
        let db = Builder::new_local(path.to_str().unwrap()).build().await.unwrap();
        let _ = get_conn(&db).await.unwrap().query("PRAGMA journal_mode = WAL;", ()).await.unwrap();
        run_migrations(&db).await.unwrap();
        db
    }

    /// Regression test for the row_to_stock_purchase column-index bug:
    /// brand/supplier/price/quantity must round-trip through the SELECT
    /// unscrambled (they were previously off by one after i.name/i.unit
    /// were joined in without updating the row.get() indices).
    #[tokio::test]
    async fn stock_purchase_round_trips_brand_and_supplier() {
        let db = test_db().await;
        let ingredient = create_ingredient(&db, IngredientInput {
            name: "Farinha".into(), unit: Unit::Kilogram, price_per_unit: 1.0, category: None, event_id: None,
        }).await.unwrap();
        let supplier = create_supplier(&db, SupplierInput {
            name: "Continente".into(), contact: None, notes: None,
        }).await.unwrap();

        let purchase = stock_purchase_add(&db, StockPurchaseInput {
            ingredient_id: ingredient.id,
            quantity: 2.0,
            unit: Unit::Kilogram,
            price_per_unit: 1.5,
            total_price: 3.0,
            is_discount: false,
            discount_percent: 0.0,
            purchase_date: Utc::now(),
            supplier_id: Some(supplier.id),
            brand: Some("Marca X".into()),
            notes: None,
        }).await.unwrap();

        assert_eq!(purchase.quantity, 2.0);
        assert_eq!(purchase.price_per_unit, 1.5);
        assert_eq!(purchase.brand.as_deref(), Some("Marca X"));
        assert_eq!(purchase.supplier_id, Some(supplier.id));
        assert_eq!(purchase.supplier_name.as_deref(), Some("Continente"));

        let stock = stock_list(&db).await.unwrap();
        assert_eq!(stock.iter().find(|s| s.ingredient_id == ingredient.id).unwrap().quantity, 2.0);
    }

    #[tokio::test]
    async fn recipe_cost_uses_weighted_average_across_brands() {
        let db = test_db().await;
        let ingredient = create_ingredient(&db, IngredientInput {
            name: "Azeite".into(), unit: Unit::Liter, price_per_unit: 10.0, category: None, event_id: None,
        }).await.unwrap();

        // 1L at 4€ + 3L at 8€ -> weighted avg = (4 + 24) / 4 = 7€/L
        for (qty, price) in [(1.0, 4.0), (3.0, 8.0)] {
            stock_purchase_add(&db, StockPurchaseInput {
                ingredient_id: ingredient.id, quantity: qty, unit: Unit::Liter,
                price_per_unit: price, total_price: qty * price, is_discount: false,
                discount_percent: 0.0, purchase_date: Utc::now(), supplier_id: None,
                brand: None, notes: None,
            }).await.unwrap();
        }

        let recipe = create_recipe(&db, RecipeInput {
            name: "Salada".into(), category: "Geral".into(), portions: 1,
            instructions: String::new(), prep_time_minutes: None, cook_time_minutes: None,
            tags: vec![], image_base64: None, event_id: None,
            ingredients: vec![RecipeIngredientInput { ingredient_id: ingredient.id, quantity: 2.0, unit: Unit::Liter }],
        }).await.unwrap();

        let cost = calculate_cost(&db, recipe.recipe.id).await.unwrap();
        assert!((cost.total_cost - 14.0).abs() < 0.001, "expected 2L * 7€/L = 14€, got {}", cost.total_cost);
    }

    #[tokio::test]
    async fn marking_shopping_item_purchased_creates_a_lot() {
        let db = test_db().await;
        let ingredient = create_ingredient(&db, IngredientInput {
            name: "Leite".into(), unit: Unit::Liter, price_per_unit: 1.0, category: None, event_id: None,
        }).await.unwrap();
        let list = create_shopping_list(&db, "Lista".into(), vec![]).await.unwrap();
        let item = shopping_list_add_item(&db, list.id.unwrap(), ShoppingItemInput {
            ingredient_id: Some(ingredient.id), ingredient_name: "Leite".into(),
            ingredient_unit: Unit::Liter, needed_quantity: 2.0, stock_quantity: 0.0,
            to_buy_quantity: 2.0, category: "".into(), estimated_cost: 2.0,
            purchased: false, notes: None,
        }).await.unwrap();

        let updated = shopping_list_mark_purchased(&db, ShoppingListMarkPurchasedInput {
            list_id: list.id.unwrap(), item_id: item.id, quantity: 2.0, price_per_unit: 1.2,
            brand: Some("Mimosa".into()), supplier_id: None, notes: None,
        }).await.unwrap();

        assert!(updated.purchased);
        let stock = stock_list(&db).await.unwrap();
        assert_eq!(stock.iter().find(|s| s.ingredient_id == ingredient.id).unwrap().quantity, 2.0);
        let purchases = stock_purchases_list(&db, ingredient.id).await.unwrap();
        assert_eq!(purchases.len(), 1);
        assert_eq!(purchases[0].brand.as_deref(), Some("Mimosa"));
    }

    /// Fase 3.2: copying a catalog recipe into an event snapshots it — later
    /// edits to either side must not leak into the other, and the copy must
    /// not show up in the main catalog listing.
    #[tokio::test]
    async fn event_recipe_copy_is_isolated_from_catalog() {
        let db = test_db().await;
        let ingredient = create_ingredient(&db, IngredientInput {
            name: "Farinha".into(), unit: Unit::Kilogram, price_per_unit: 1.0, category: None, event_id: None,
        }).await.unwrap();
        let base = create_recipe(&db, RecipeInput {
            name: "Pão".into(), category: "Pão".into(), portions: 4,
            instructions: "Amassar".into(),
            ingredients: vec![RecipeIngredientInput { ingredient_id: ingredient.id, quantity: 1.0, unit: Unit::Kilogram }],
            prep_time_minutes: None, cook_time_minutes: None, tags: vec![], image_base64: None, event_id: None,
        }).await.unwrap();

        let event = create_event(&db, EventInput {
            name: "Casamento".into(), event_date: Some("2026-08-01".into()), notes: None,
        }).await.unwrap();

        let variant = recipe_copy_to_event(&db, base.recipe.id, event.id).await.unwrap();
        assert_eq!(variant.recipe.name, "Pão");
        assert_ne!(variant.recipe.id, base.recipe.id);

        // Catalog listing must not include the event variant.
        let catalog = recipes_list(&db).await.unwrap();
        assert!(catalog.iter().all(|r| r.recipe.id != variant.recipe.id));

        // Editing the variant's quantity must not affect the base recipe.
        update_recipe(&db, variant.recipe.id, RecipeInput {
            name: "Pão (evento)".into(), category: "Pão".into(), portions: 100,
            instructions: "Amassar mais".into(),
            ingredients: vec![RecipeIngredientInput { ingredient_id: ingredient.id, quantity: 20.0, unit: Unit::Kilogram }],
            prep_time_minutes: None, cook_time_minutes: None, tags: vec![], image_base64: None, event_id: None,
        }).await.unwrap();
        let base_after = get_recipe(&db, base.recipe.id).await.unwrap();
        assert_eq!(base_after.portions, 4);

        let event_recipes = event_recipes_list(&db, event.id).await.unwrap();
        assert_eq!(event_recipes.len(), 1);
        assert_eq!(event_recipes[0].recipe.portions, 100);

        // Deleting the event must cascade-remove its recipe variants.
        delete_event(&db, event.id).await.unwrap();
        let events_after = events_list(&db).await.unwrap();
        assert!(events_after.is_empty());
        let event_recipes_after = event_recipes_list(&db, event.id).await.unwrap();
        assert!(event_recipes_after.is_empty());
    }

    /// A recipe authored directly inside an event (not copied from the
    /// catalog) must stay invisible to the catalog until explicitly
    /// promoted, at which point it behaves like any other catalog recipe.
    #[tokio::test]
    async fn event_exclusive_recipe_can_be_promoted_to_catalog() {
        let db = test_db().await;
        let ingredient = create_ingredient(&db, IngredientInput {
            name: "Ovos".into(), unit: Unit::Piece, price_per_unit: 0.2, category: None, event_id: None,
        }).await.unwrap();
        let event = create_event(&db, EventInput {
            name: "Aniversário".into(), event_date: None, notes: None,
        }).await.unwrap();

        let exclusive = create_recipe(&db, RecipeInput {
            name: "Bolo especial".into(), category: "Sobremesa".into(), portions: 10,
            instructions: "Bater".into(),
            ingredients: vec![RecipeIngredientInput { ingredient_id: ingredient.id, quantity: 6.0, unit: Unit::Piece }],
            prep_time_minutes: None, cook_time_minutes: None, tags: vec![], image_base64: None,
            event_id: Some(event.id),
        }).await.unwrap();

        // Invisible to the catalog while scoped to the event.
        let catalog = recipes_list(&db).await.unwrap();
        assert!(catalog.iter().all(|r| r.recipe.id != exclusive.recipe.id));
        let event_recipes = event_recipes_list(&db, event.id).await.unwrap();
        assert_eq!(event_recipes.len(), 1);

        recipe_promote_to_catalog(&db, exclusive.recipe.id).await.unwrap();

        let catalog_after = recipes_list(&db).await.unwrap();
        assert!(catalog_after.iter().any(|r| r.recipe.id == exclusive.recipe.id));
        let event_recipes_after = event_recipes_list(&db, event.id).await.unwrap();
        assert!(event_recipes_after.is_empty());
    }

    /// Promoting a recipe whose name collides with an existing catalog recipe
    /// appends "(Event Name)" so the two aren't indistinguishable in lists.
    #[tokio::test]
    async fn promoting_recipe_with_duplicate_name_appends_event_name() {
        let db = test_db().await;
        let ingredient = create_ingredient(&db, IngredientInput {
            name: "Farinha".into(), unit: Unit::Gram, price_per_unit: 0.002, category: None, event_id: None,
        }).await.unwrap();
        let event = create_event(&db, EventInput {
            name: "Casamento".into(), event_date: None, notes: None,
        }).await.unwrap();

        create_recipe(&db, RecipeInput {
            name: "Bolo".into(), category: "Sobremesa".into(), portions: 10,
            instructions: "Cozer".into(),
            ingredients: vec![RecipeIngredientInput { ingredient_id: ingredient.id, quantity: 100.0, unit: Unit::Gram }],
            prep_time_minutes: None, cook_time_minutes: None, tags: vec![], image_base64: None,
            event_id: None,
        }).await.unwrap();

        let exclusive = create_recipe(&db, RecipeInput {
            name: "Bolo".into(), category: "Sobremesa".into(), portions: 60,
            instructions: "Cozer mais".into(),
            ingredients: vec![RecipeIngredientInput { ingredient_id: ingredient.id, quantity: 600.0, unit: Unit::Gram }],
            prep_time_minutes: None, cook_time_minutes: None, tags: vec![], image_base64: None,
            event_id: Some(event.id),
        }).await.unwrap();

        let promoted = recipe_promote_to_catalog(&db, exclusive.recipe.id).await.unwrap();
        assert_eq!(promoted.recipe.name, "Bolo (Casamento)");
    }

    /// Ingredient copy starts with zero stock, isolated from the catalog
    /// original — buying stock for the event copy must not create or alter
    /// a stock row for the catalog ingredient (Fase 3.3, model (a)).
    #[tokio::test]
    async fn event_ingredient_copy_is_stock_isolated_from_catalog() {
        let db = test_db().await;
        let catalog = create_ingredient(&db, IngredientInput {
            name: "Farinha".into(), unit: Unit::Kilogram, price_per_unit: 1.0, category: None, event_id: None,
        }).await.unwrap();
        let event = create_event(&db, EventInput {
            name: "Casamento".into(), event_date: Some("2026-08-01".into()), notes: None,
        }).await.unwrap();

        let copy = ingredient_copy_to_event(&db, catalog.id, event.id).await.unwrap();
        assert_eq!(copy.name, "Farinha");
        assert_ne!(copy.id, catalog.id);

        // Catalog listing must not include the event copy.
        let catalog_list = ingredients_list(&db).await.unwrap();
        assert!(catalog_list.iter().all(|i| i.id != copy.id));
        let event_list = event_ingredients_list(&db, event.id).await.unwrap();
        assert_eq!(event_list.len(), 1);

        // Buying stock for the event copy must not touch the catalog ingredient.
        stock_purchase_add(&db, StockPurchaseInput {
            ingredient_id: copy.id,
            quantity: 10.0,
            unit: Unit::Kilogram,
            price_per_unit: 1.0,
            total_price: 10.0,
            is_discount: false,
            discount_percent: 0.0,
            purchase_date: chrono::Utc::now(),
            supplier_id: None,
            brand: None,
            notes: None,
        }).await.unwrap();
        let event_stock = get_stock(&db, copy.id).await.unwrap();
        assert_eq!(event_stock.quantity, 10.0);
        assert!(get_stock(&db, catalog.id).await.is_err());

        // Catalog-facing stock views must not leak the event copy's stock row.
        let catalog_stock = stock_list(&db).await.unwrap();
        assert!(catalog_stock.iter().all(|s| s.ingredient_id != copy.id));

        // Deleting the event must cascade-remove the copy's stock, purchases and row.
        delete_event(&db, event.id).await.unwrap();
        assert!(event_ingredients_list(&db, event.id).await.unwrap().is_empty());
        assert!(get_stock(&db, copy.id).await.is_err());
        assert!(stock_purchases_list(&db, copy.id).await.unwrap().is_empty());
    }

    /// An ingredient authored directly inside an event (not copied from the
    /// catalog) must stay invisible to the catalog until explicitly
    /// promoted, at which point its stock/purchase history travels with it.
    #[tokio::test]
    async fn event_exclusive_ingredient_can_be_promoted_to_catalog() {
        let db = test_db().await;
        let event = create_event(&db, EventInput {
            name: "Aniversário".into(), event_date: None, notes: None,
        }).await.unwrap();

        let exclusive = create_ingredient(&db, IngredientInput {
            name: "Bolo especial".into(), unit: Unit::Piece, price_per_unit: 5.0, category: None,
            event_id: Some(event.id),
        }).await.unwrap();

        // Invisible to the catalog while scoped to the event.
        let catalog = ingredients_list(&db).await.unwrap();
        assert!(catalog.iter().all(|i| i.id != exclusive.id));
        let event_ingredients = event_ingredients_list(&db, event.id).await.unwrap();
        assert_eq!(event_ingredients.len(), 1);

        ingredient_promote_to_catalog(&db, exclusive.id).await.unwrap();

        let catalog_after = ingredients_list(&db).await.unwrap();
        assert!(catalog_after.iter().any(|i| i.id == exclusive.id));
        let event_ingredients_after = event_ingredients_list(&db, event.id).await.unwrap();
        assert!(event_ingredients_after.is_empty());
    }

    /// Promoting an ingredient whose name collides with an existing catalog
    /// ingredient appends "(Event Name)" so the two aren't indistinguishable.
    #[tokio::test]
    async fn promoting_ingredient_with_duplicate_name_appends_event_name() {
        let db = test_db().await;
        let event = create_event(&db, EventInput {
            name: "Casamento".into(), event_date: None, notes: None,
        }).await.unwrap();

        create_ingredient(&db, IngredientInput {
            name: "Farinha".into(), unit: Unit::Gram, price_per_unit: 0.002, category: None, event_id: None,
        }).await.unwrap();

        let exclusive = create_ingredient(&db, IngredientInput {
            name: "Farinha".into(), unit: Unit::Gram, price_per_unit: 0.003, category: None,
            event_id: Some(event.id),
        }).await.unwrap();

        let promoted = ingredient_promote_to_catalog(&db, exclusive.id).await.unwrap();
        assert_eq!(promoted.name, "Farinha (Casamento)");
    }

    /// seed_demo_data must include a demo event (copied + exclusive recipe),
    /// and delete_all_data must clear it back out again.
    #[tokio::test]
    async fn seed_demo_data_includes_event_and_reset_clears_it() {
        let db = test_db().await;
        seed_demo_data(&db).await.unwrap();

        let events = events_list(&db).await.unwrap();
        assert_eq!(events.len(), 1);
        let event_recipes = event_recipes_list(&db, events[0].id).await.unwrap();
        assert_eq!(event_recipes.len(), 2);

        delete_all_data(&db).await.unwrap();
        assert!(events_list(&db).await.unwrap().is_empty());
    }

    #[test]
    fn parse_ingredient_line_splits_quantity_unit_and_name() {
        let parsed = parse_ingredient_line("3 tablespoons extra-virgin olive oil");
        assert_eq!(parsed.quantity, 3.0);
        assert_eq!(parsed.unit, Unit::Tablespoon);
        assert_eq!(parsed.name_guess, "extra-virgin olive oil");
    }

    /// Regression test: caught live against a real NYT Cooking page, where over half
    /// the ingredient lines use vulgar fraction glyphs ("½ cup") instead of ASCII —
    /// without normalizing these first, quantity parsing silently fails on them.
    #[test]
    fn parse_ingredient_line_handles_vulgar_fractions() {
        let parsed = parse_ingredient_line("½ cup finely chopped onion");
        assert_eq!(parsed.quantity, 0.5);
        assert_eq!(parsed.unit, Unit::Cup);
        assert_eq!(parsed.name_guess, "finely chopped onion");

        let mixed = parse_ingredient_line("1 ½ cups rice");
        assert_eq!(mixed.quantity, 1.5);
        assert_eq!(mixed.unit, Unit::Cup);
        assert_eq!(mixed.name_guess, "rice");
    }

    #[test]
    fn parse_ingredient_line_finds_unit_after_the_name_too() {
        // "cloves" comes after the ingredient name here, not right after the quantity —
        // the descriptive clause ("thinly sliced") is dropped along with the comma.
        let parsed = parse_ingredient_line("5 garlic cloves, thinly sliced");
        assert_eq!(parsed.quantity, 5.0);
        assert_eq!(parsed.unit, Unit::Clove);
        assert_eq!(parsed.name_guess, "garlic");
    }

    /// The Parmesan case reported live: without stripping the trailing clauses, the
    /// name guess ("grated Parmesan, divided, more for garnish") never matches an
    /// existing catalog ingredient even when one exists.
    #[test]
    fn parse_ingredient_line_strips_descriptive_clauses_from_name() {
        let parsed = parse_ingredient_line("½ cup grated Parmesan, divided, more for garnish");
        assert_eq!(parsed.quantity, 0.5);
        assert_eq!(parsed.unit, Unit::Cup);
        assert_eq!(parsed.name_guess, "grated Parmesan");
    }

    /// No leading quantity, and the only numbers are approximate parenthetical asides
    /// ("about 8 ounces") — deliberately NOT extracted as the quantity (see
    /// strip_descriptive_clauses doc comment): there's no reliable way to tell an
    /// approximate aside from the true primary measure. Falls back to quantity 1 /
    /// Piece, but with a clean name instead of the full messy line.
    #[test]
    fn parse_ingredient_line_ignores_parenthetical_quantities() {
        let parsed = parse_ingredient_line(
            "small baguette or chunk of sourdough bread (about 8 ounces), preferably day-old, torn or cut into bite-size pieces (about 4 cups)"
        );
        assert_eq!(parsed.quantity, 1.0);
        assert_eq!(parsed.unit, Unit::Piece);
        assert_eq!(parsed.name_guess, "small baguette or chunk of sourdough bread");
    }

    #[test]
    fn parse_iso8601_duration_minutes_handles_hours_and_minutes() {
        assert_eq!(parse_iso8601_duration_minutes("PT1H30M"), Some(90));
        assert_eq!(parse_iso8601_duration_minutes("PT15M"), Some(15));
        assert_eq!(parse_iso8601_duration_minutes("garbage"), None);
    }

    /// Fixture mirrors the shape confirmed against a real NYT Cooking page
    /// (JSON-LD Recipe, `data-next-head` attribute on the script tag).
    #[test]
    fn extract_recipe_json_ld_finds_recipe_node_and_fields_parse() {
        let html = r#"<html><head>
            <script type="application/ld+json" data-next-head="">
            {"@context":"https://schema.org","@type":"Recipe","name":"Vegetable Paella",
             "recipeYield":"4 servings","prepTime":"PT15M","cookTime":"PT30M",
             "image":[{"@type":"ImageObject","url":"https://example.com/paella.jpg"}],
             "recipeIngredient":["3 tablespoons olive oil","1 cup rice"],
             "recipeInstructions":[{"@type":"HowToStep","text":"Heat oil."},{"@type":"HowToStep","text":"Add rice."}]}
            </script>
            </head><body></body></html>"#;

        let recipe = extract_recipe_json_ld(html).expect("should find the Recipe JSON-LD node");
        assert_eq!(recipe["name"].as_str(), Some("Vegetable Paella"));
        assert_eq!(extract_portions(&recipe), Some(4));
        assert_eq!(extract_image_url(&recipe).as_deref(), Some("https://example.com/paella.jpg"));
        assert_eq!(extract_instructions(&recipe), "Heat oil.\nAdd rice.");
        assert_eq!(recipe["prepTime"].as_str().and_then(parse_iso8601_duration_minutes), Some(15));
        assert_eq!(recipe["cookTime"].as_str().and_then(parse_iso8601_duration_minutes), Some(30));
    }

    #[tokio::test]
    async fn recipe_import_from_url_matches_existing_ingredient_by_name() {
        let db = test_db().await;
        create_ingredient(&db, IngredientInput {
            name: "Rice".into(), unit: Unit::Gram, price_per_unit: 0.002, category: None, event_id: None,
        }).await.unwrap();

        // Exercise the same ingredient-matching path recipe_import_from_url uses,
        // without a real network fetch: parse a line, then look up by name_guess.
        let parsed = parse_ingredient_line("1 cup rice");
        assert_eq!(parsed.name_guess, "rice");
        let conn = get_conn(&db).await.unwrap();
        let mut rows = conn.query(
            "SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?1) LIMIT 1",
            params![parsed.name_guess.clone()],
        ).await.unwrap();
        assert!(rows.next().await.unwrap().is_some());
    }

    /// Regression test for the data-root divergence bug (Fase 4, 2026-07-10):
    /// image_upload/read/delete used to resolve `dirs::data_dir()` directly,
    /// a root different from (and not namespaced like) the Tauri-resolved
    /// `app_data_dir` the DB lives under. All three now take `data_dir`
    /// explicitly and must agree on the same root as each other.
    #[tokio::test]
    async fn image_round_trips_through_the_given_data_dir() {
        let db = test_db().await;
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let data_dir = std::env::temp_dir().join(format!("mise_test_images_{unique}"));

        // 1x1 red pixel PNG
        let base64_1x1_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

        let uploaded = image_upload(&db, ImageUploadInput {
            entity_type: ImageEntityType::Ingredient,
            entity_id: 1,
            base64: base64_1x1_png.into(),
            mime_type: "image/png".into(),
        }, &data_dir).await.unwrap();

        // File must land under the given data_dir, not dirs::data_dir().
        assert!(data_dir.join(&uploaded.path).exists());

        let read_back = image_read_base64(&db, uploaded.id, &data_dir).await.unwrap();
        assert_eq!(read_back, base64_1x1_png);

        image_delete(&db, uploaded.id, &data_dir).await.unwrap();
        assert!(!data_dir.join(&uploaded.path).exists());

        let _ = std::fs::remove_dir_all(&data_dir);
    }

    /// Problem report with an attached image round-trips into the Markdown
    /// export, and the image is copied alongside it (Fase de Instrumentação,
    /// 2026-07-10) — the export must be self-contained and readable without
    /// the app running.
    #[tokio::test]
    async fn problem_report_with_image_appears_in_export() {
        let db = test_db().await;
        use std::time::{SystemTime, UNIX_EPOCH};
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let data_dir = std::env::temp_dir().join(format!("mise_test_reports_data_{unique}"));
        let dest_dir = std::env::temp_dir().join(format!("mise_test_reports_export_{unique}"));
        std::fs::create_dir_all(&dest_dir).unwrap();

        let base64_1x1_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

        let report = problem_report_create(&db, ProblemReportInput {
            description: "O botão de exportar não faz nada".into(),
            image_base64: Some(base64_1x1_png.into()),
        }, &data_dir).await.unwrap();
        assert!(report.image_path.is_some());

        let export_dir = export_usage_data(&db, &data_dir, &dest_dir).await.unwrap();
        let export_dir = std::path::PathBuf::from(export_dir);

        let md = std::fs::read_to_string(export_dir.join("relatorio.md")).unwrap();
        assert!(md.contains("O botão de exportar não faz nada"));
        assert!(md.contains("![imagem]"));

        let copied_images: Vec<_> = std::fs::read_dir(export_dir.join("images")).unwrap().collect();
        assert_eq!(copied_images.len(), 1);

        let _ = std::fs::remove_dir_all(&data_dir);
        let _ = std::fs::remove_dir_all(&dest_dir);
    }
}
