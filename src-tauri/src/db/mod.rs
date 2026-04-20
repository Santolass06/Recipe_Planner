use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::fs;
use tauri::{AppHandle, Manager};

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool> {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("Não foi possível obter o diretório de dados");

    eprintln!(">>> data_dir: {:?}", data_dir);

    fs::create_dir_all(&data_dir)?;

    eprintln!(">>> diretório criado/confirmado");

    let db_path = data_dir.join("recipe_planner.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    eprintln!(">>> db_url: {}", db_url);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    eprintln!(">>> base de dados pronta");
    Ok(pool)
}
