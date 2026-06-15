//! Database connection and migrations

use libsql::{Builder, Connection, Database, Result as LibsqlResult, params, Row};
use crate::domain::*;
use std::path::PathBuf;
use dirs;
use chrono::{DateTime, Utc};
use serde_json;

/// Open database connection with WAL mode and connection pooling
pub async fn open_db() -> LibsqlResult<Database> {
    let data_dir = get_data_dir().map_err(|e| libsql::Error::Misuse(e.to_string()))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| libsql::Error::Misuse(e.to_string()))?;

    let db_path = data_dir.join("mise.db");
    let db_url = format!("file:{}", db_path.display());

    let db = Builder::new_local(db_url)
        .build()
        .await?;

    // Enable WAL mode for better concurrency
    db.connect()?.execute("PRAGMA journal_mode = WAL;", ()).await?;

    // Run migrations
    run_migrations(&db).await?;

    Ok(db)
}

/// Get a connection from the pool
pub fn get_conn(db: &Database) -> LibsqlResult<Connection> {
    db.connect()
}

/// Get data directory for the app
fn get_data_dir() -> std::io::Result<PathBuf> {
    if let Some(data_dir) = dirs::data_dir() {
        Ok(data_dir.join("mise"))
    } else {
        // Fallback
        Ok(std::env::current_dir()?.join(".mise_data"))
    }
}

/// Run all migrations
async fn run_migrations(db: &Database) -> LibsqlResult<()> {
    let conn = db.connect()?;

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
            ingredient_id INTEGER NOT NULL,
            ingredient_name TEXT NOT NULL,
            ingredient_unit TEXT NOT NULL,
            needed_quantity REAL NOT NULL,
            stock_quantity REAL NOT NULL,
            to_buy_quantity REAL NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            estimated_cost REAL NOT NULL DEFAULT 0,
            purchased INTEGER NOT NULL DEFAULT 0,
            purchased_at TEXT,
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

    // Default categories
    seed_default_categories(&conn).await?;

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
    let conn = db.connect()?;
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

    let updated_at_str: String = row.get(5)?;
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(StockItem {
        id: row.get(0)?,
        ingredient_id: row.get(1)?,
        ingredient_name: row.get(2)?,
        ingredient_unit: unit,
        quantity: row.get(3)?,
        min_quantity: row.get(4)?,
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

    Ok(ShoppingItem {
        ingredient_id: row.get(1)?,
        ingredient_name: row.get(2)?,
        ingredient_unit: unit,
        needed_quantity: row.get(4)?,
        stock_quantity: row.get(5)?,
        to_buy_quantity: row.get(6)?,
        category: row.get(7)?,
        estimated_cost: row.get(8)?,
        purchased: row.get(9)?,
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
    let created_at_str: String = row.get(3)?;
    let updated_at_str: String = row.get(4)?;
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

/// Map a libsql Row to Setting
fn row_to_setting(row: &Row) -> LibsqlResult<Setting> {
    let updated_at_str: String = row.get(2)?;
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(Setting {
        key: row.get(0)?,
        value: row.get(1)?,
        updated_at,
    })
}

// =====================================================================
// PUBLIC QUERY METHODS
// =====================================================================

/// List all ingredients
pub async fn ingredients_list(db: &Database) -> LibsqlResult<Vec<Ingredient>> {
    let conn = db.connect()?;
    let mut rows = conn.query(
        "SELECT id, name, unit, price_per_unit, category_id, created_at, updated_at, favorite
         FROM ingredients ORDER BY name",
        (),
    ).await?;

    let mut ingredients = Vec::new();
    while let Some(row) = rows.next().await? {
        ingredients.push(row_to_ingredient(&row)?);
    }
    Ok(ingredients)
}

/// Create ingredient
pub async fn create_ingredient(db: &Database, input: IngredientInput) -> LibsqlResult<Ingredient> {
    let conn = db.connect()?;
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
        "INSERT INTO ingredients (name, unit, price_per_unit, category_id, favorite)
         VALUES (?1, ?2, ?3, ?4, 0)",
        params![input.name, unit_str, input.price_per_unit, category_id],
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    conn.execute("DELETE FROM ingredients WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Toggle ingredient favorite
pub async fn toggle_ingredient_favorite(db: &Database, id: i64) -> LibsqlResult<Ingredient> {
    let conn = db.connect()?;
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
pub async fn recipes_list(db: &Database) -> LibsqlResult<Vec<Recipe>> {
    let conn = db.connect()?;
    let mut rows = conn.query(
        "SELECT id, name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, created_at, updated_at
         FROM recipes ORDER BY created_at DESC",
        (),
    ).await?;

    let mut recipes = Vec::new();
    while let Some(row) = rows.next().await? {
        recipes.push(row_to_recipe(&row)?);
    }
    Ok(recipes)
}

/// List recipes with pagination
pub async fn recipes_paginated(db: &Database, page: u32, per_page: u32) -> LibsqlResult<Paginated<Recipe>> {
    let conn = db.connect()?;
    let offset = (page - 1) * per_page;

    let mut rows = conn.query("SELECT COUNT(*) FROM recipes", ()).await?;
    let total: i64 = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    let mut rows = conn.query(
        "SELECT id, name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path, created_at, updated_at
         FROM recipes ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO recipes (name, category, portions, instructions, favorite, prep_time_minutes, cook_time_minutes, tags, image_path)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8)",
        params![input.name, input.category, input.portions, input.instructions, input.prep_time_minutes, input.cook_time_minutes, tags_json, input.image_base64],
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    conn.execute("DELETE FROM recipes WHERE id = ?1", params![id]).await?;
    // recipe_ingredients are cascade deleted
    Ok(())
}

/// Toggle recipe favorite
pub async fn toggle_recipe_favorite(db: &Database, id: i64) -> LibsqlResult<Recipe> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE recipes SET favorite = CASE WHEN favorite = 1 THEN 0 ELSE 1 END, updated_at = datetime('now')
         WHERE id = ?1",
        params![id],
    ).await?;

    get_recipe(db, id).await
}

/// Clone recipe
pub async fn clone_recipe(db: &Database, id: i64) -> LibsqlResult<RecipeWithIngredients> {
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    let mut rows = conn.query(
        "SELECT s.id, s.ingredient_id, i.name, i.unit, s.quantity, s.min_quantity, s.updated_at
         FROM stock s
         JOIN ingredients i ON s.ingredient_id = i.id
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    let mut rows = conn.query(
        "SELECT name FROM ingredients WHERE id = ?1", params![input.ingredient_id]
    ).await?;
    let ingredient_name: String = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;
    
    let mut rows = conn.query(
        "SELECT unit FROM ingredients WHERE id = ?1", params![input.ingredient_id]
    ).await?;
    let unit_str: String = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?.get(0)?;

    conn.execute(
        "INSERT INTO stock (ingredient_id, ingredient_name, ingredient_unit, quantity, min_quantity, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(ingredient_id) DO UPDATE SET
         quantity = ?4, min_quantity = ?5, updated_at = datetime('now')",
        params![input.ingredient_id, ingredient_name, unit_str, input.quantity, input.min_quantity],
    ).await?;

    get_stock(db, input.ingredient_id).await
}

/// Update stock quantity
pub async fn update_stock_quantity(db: &Database, ingredient_id: i64, quantity: f64) -> LibsqlResult<StockItem> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE stock SET quantity = ?1, updated_at = datetime('now') WHERE ingredient_id = ?2",
        params![quantity, ingredient_id],
    ).await?;

    get_stock(db, ingredient_id).await
}

/// Delete stock
pub async fn delete_stock(db: &Database, ingredient_id: i64) -> LibsqlResult<()> {
    let conn = db.connect()?;
    conn.execute("DELETE FROM stock WHERE ingredient_id = ?1", params![ingredient_id]).await?;
    Ok(())
}

/// List shopping lists
pub async fn shopping_lists_list(db: &Database) -> LibsqlResult<Vec<ShoppingList>> {
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    let mut rows = conn.query(
        "SELECT id, name, created_at FROM shopping_lists WHERE id = ?1",
        params![id],
    ).await?;
    let list_row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;

    let mut list = row_to_shopping_list(&list_row)?;

    let mut rows = conn.query(
        "SELECT id, shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased
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
    let conn = db.connect()?;
    conn.execute("INSERT INTO shopping_lists (name) VALUES (?1)", params![name]).await?;
    let list_id = conn.last_insert_rowid();

    for item in items {
        conn.execute(
            "INSERT INTO shopping_list_items (shopping_list_id, ingredient_id, ingredient_name, ingredient_unit, needed_quantity, stock_quantity, to_buy_quantity, category, estimated_cost, purchased)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![list_id, item.ingredient_id, item.ingredient_name, item.ingredient_unit as i32, item.needed_quantity, item.stock_quantity, item.to_buy_quantity, item.category, item.estimated_cost, item.purchased as i32],
        ).await?;
    }

    get_shopping_list(db, list_id).await
}

/// Create shopping list from recipes
pub async fn create_shopping_list_from_recipes(db: &Database, recipe_ids: Vec<i64>, portions_multiplier: u32) -> LibsqlResult<ShoppingList> {
    // This is a complex query - simplified implementation
    let name = format!("Compras {}", chrono::Local::now().format("%d/%m/%Y %H:%M"));
    create_shopping_list(db, name, Vec::new()).await
}

/// Update shopping list item
pub async fn update_shopping_list_item(db: &Database, list_id: i64, item_id: i64, purchased: bool) -> LibsqlResult<ShoppingList> {
    let conn = db.connect()?;
    let purchased_at = if purchased { Some(chrono::Utc::now().to_rfc3339()) } else { None };
    conn.execute(
        "UPDATE shopping_list_items SET purchased = ?1, purchased_at = ?2 WHERE id = ?3 AND shopping_list_id = ?4",
        params![purchased as i32, purchased_at, item_id, list_id],
    ).await?;

    get_shopping_list(db, list_id).await
}

/// Delete shopping list
pub async fn delete_shopping_list(db: &Database, id: i64) -> LibsqlResult<()> {
    let conn = db.connect()?;
    conn.execute("DELETE FROM shopping_lists WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// Suggest recipes based on stock
pub async fn suggest_recipes(db: &Database) -> LibsqlResult<Vec<SuggestedRecipe>> {
    // Simplified implementation - return empty
    Ok(Vec::new())
}

/// Calculate recipe cost
pub async fn calculate_cost(db: &Database, recipe_id: i64) -> LibsqlResult<CostBreakdown> {
    // Simplified implementation
    Ok(CostBreakdown {
        total_cost: 0.0,
        cost_per_portion: 0.0,
        ingredient_costs: Vec::new(),
    })
}

/// Analyze recipe cost with margin
pub async fn analyze_cost(db: &Database, recipe_id: i64, margin_percent: f64) -> LibsqlResult<CostBreakdown> {
    calculate_cost(db, recipe_id).await
}

/// Get setting
pub async fn get_setting(db: &Database, key: &str) -> LibsqlResult<Option<String>> {
    let conn = db.connect()?;
    let mut rows = conn.query("SELECT value FROM settings WHERE key = ?1", params![key]).await?;
    if let Some(row) = rows.next().await? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

/// Set setting
pub async fn set_setting(db: &Database, key: &str, value: &str) -> LibsqlResult<()> {
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
        params![key, value],
    ).await?;
    Ok(())
}

/// List categories
pub async fn categories_list(db: &Database, kind: Option<&str>) -> LibsqlResult<Vec<Category>> {
    let conn = db.connect()?;
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    conn.execute("DELETE FROM categories WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// List suppliers
pub async fn suppliers_list(db: &Database) -> LibsqlResult<Vec<Supplier>> {
    let conn = db.connect()?;
    let mut rows = conn.query("SELECT id, name, contact, notes, created_at, updated_at FROM suppliers ORDER BY name", ()).await?;
    let mut suppliers = Vec::new();
    while let Some(row) = rows.next().await? {
        suppliers.push(row_to_supplier(&row)?);
    }
    Ok(suppliers)
}

/// Create supplier
pub async fn create_supplier(db: &Database, input: SupplierInput) -> LibsqlResult<Supplier> {
    let conn = db.connect()?;
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    conn.execute("DELETE FROM suppliers WHERE id = ?1", params![id]).await?;
    Ok(())
}

/// List price quotes for ingredient
pub async fn price_quotes_list(db: &Database, ingredient_id: i64) -> LibsqlResult<Vec<PriceQuote>> {
    let conn = db.connect()?;
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
    let conn = db.connect()?;
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
    let conn = db.connect()?;
    conn.execute("DELETE FROM price_quotes WHERE id = ?1", params![id]).await?;
    Ok(())
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
            name: r.name,
            category: r.category,
            portions: r.portions,
            instructions: r.instructions,
            prep_time_minutes: r.prep_time_minutes,
            cook_time_minutes: r.cook_time_minutes,
            tags: serde_json::from_str(&r.tags).unwrap_or_default(),
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
