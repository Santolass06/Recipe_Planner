mod commands;
mod db;
mod models;

use tauri::Manager;

/// Estado global da aplicação — o pool SQLite é partilhado entre todos os commands
pub struct AppState {
    pub db: sqlx::SqlitePool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let pool = db::init_db(&handle)
                    .await
                    .expect("Falha ao inicializar a base de dados");

                handle.manage(AppState { db: pool });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Ingredientes
            commands::ingredientes::listar_ingredientes,
            commands::ingredientes::obter_ingrediente,
            commands::ingredientes::criar_ingrediente,
            commands::ingredientes::atualizar_ingrediente,
            commands::ingredientes::eliminar_ingrediente,
            // Imagens
            commands::imagens::importar_imagem,
            // Receitas
            commands::receitas::listar_receitas,
            commands::receitas::obter_receita,
            commands::receitas::obter_receita_completa,
            commands::receitas::criar_receita,
            commands::receitas::atualizar_receita,
            commands::receitas::eliminar_receita,
            // Cálculo de custos
            commands::custos::calcular_custo_receita,
            // Stock
            commands::stock::listar_stock,
            commands::stock::atualizar_stock,
            // Sugestor
            commands::sugestor::receitas_possiveis,
            // Relatórios
            commands::relatorios::relatorio_resumo,
        ])
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar a aplicação");
}
