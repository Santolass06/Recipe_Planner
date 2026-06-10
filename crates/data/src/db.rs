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