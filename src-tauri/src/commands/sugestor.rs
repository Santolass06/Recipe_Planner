use crate::{models::*, AppState};
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn receitas_possiveis(state: State<'_, AppState>) -> CmdResult<Vec<Receita>> {
    // Return recipes where:
    // 1. The recipe has at least one ingredient
    // 2. Every ingredient has stock >= required quantity (for porcoes_base)
    let rows = sqlx::query_as!(
        Receita,
        "SELECT id, nome, categoria, tags, porcoes_base, instrucoes, imagem_path, created_at, updated_at
         FROM receitas r
         WHERE (SELECT COUNT(*) FROM receita_ingredientes ri WHERE ri.receita_id = r.id) > 0
           AND NOT EXISTS (
               SELECT 1 FROM receita_ingredientes ri
               LEFT JOIN stock s ON s.ingrediente_id = ri.ingrediente_id
               WHERE ri.receita_id = r.id
                 AND (s.ingrediente_id IS NULL OR s.quantidade_disponivel < ri.quantidade)
           )
         ORDER BY nome ASC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(err)?;

    Ok(rows)
}
