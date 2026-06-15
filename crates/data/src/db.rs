use libsql::{Builder, Connection};

pub async fn open_local(path: &str) -> Result<Connection, String> {
    let db = Builder::new_local(path)
        .build()
        .await
        .map_err(|e| e.to_string())?;
    let conn = db.connect().map_err(|e| e.to_string())?;
    run_migrations(&conn).await?;
    Ok(conn)
}

async fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(MIGRATION_001)
        .await
        .map_err(|e| e.to_string())?;
    conn.execute_batch(MIGRATION_002)
        .await
        .map_err(|e| e.to_string())?;
    conn.execute_batch(MIGRATION_003)
        .await
        .map_err(|e| e.to_string())?;
    conn.execute_batch(MIGRATION_004)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

const MIGRATION_001: &str = "
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingredients (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    unit           TEXT    NOT NULL,
    price_per_unit REAL    NOT NULL DEFAULT 0.0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ingredients_name
    ON ingredients(name);

CREATE TRIGGER IF NOT EXISTS ingredients_updated_at
    AFTER UPDATE ON ingredients
    FOR EACH ROW
BEGIN
    UPDATE ingredients SET updated_at = datetime('now')
    WHERE id = OLD.id;
END;
";

const MIGRATION_002: &str = "
CREATE TABLE IF NOT EXISTS recipes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    category      TEXT    NOT NULL DEFAULT 'Geral',
    portions      INTEGER NOT NULL DEFAULT 1,
    instructions  TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recipes_name
    ON recipes(name);

CREATE INDEX IF NOT EXISTS idx_recipes_category
    ON recipes(category);

CREATE TRIGGER IF NOT EXISTS recipes_updated_at
    AFTER UPDATE ON recipes
    FOR EACH ROW
BEGIN
    UPDATE recipes SET updated_at = datetime('now')
    WHERE id = OLD.id;
END;
";

const MIGRATION_003: &str = "
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id       INTEGER NOT NULL,
    ingredient_id   INTEGER NOT NULL,
    quantity        REAL    NOT NULL,
    unit            TEXT    NOT NULL,
    FOREIGN KEY (recipe_id)     REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
    ON recipe_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient
    ON recipe_ingredients(ingredient_id);
";

const MIGRATION_004: &str = "
CREATE TABLE IF NOT EXISTS stock (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id   INTEGER NOT NULL UNIQUE,
    quantity        REAL    NOT NULL DEFAULT 0.0,
    min_quantity    REAL    NOT NULL DEFAULT 0.0,
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stock_ingredient
    ON stock(ingredient_id);
";