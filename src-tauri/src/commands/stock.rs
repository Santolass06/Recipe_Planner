use crate::{models::*, AppState};
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn listar_stock(state: State<'_, AppState>) -> CmdResult<Vec<StockItem>> {
    let rows = sqlx::query!(
        "SELECT i.id as ingrediente_id, i.nome, i.unidade,
                COALESCE(s.quantidade_disponivel, 0.0) as quantidade_disponivel,
                COALESCE(s.updated_at, datetime('now')) as updated_at
         FROM ingredientes i
         LEFT JOIN stock s ON s.ingrediente_id = i.id
         ORDER BY i.nome ASC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(err)?;

    Ok(rows
        .into_iter()
        .map(|r| StockItem {
            ingrediente_id: r.ingrediente_id,
            nome: r.nome,
            unidade: r.unidade,
            quantidade_disponivel: r.quantidade_disponivel,
            updated_at: r.updated_at.unwrap_or_default(),
        })
        .collect())
}

#[tauri::command]
pub async fn atualizar_stock(
    state: State<'_, AppState>,
    payload: StockPayload,
) -> CmdResult<StockItem> {
    sqlx::query!(
        "INSERT INTO stock (ingrediente_id, quantidade_disponivel, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(ingrediente_id) DO UPDATE SET
             quantidade_disponivel = excluded.quantidade_disponivel,
             updated_at = datetime('now')",
        payload.ingrediente_id,
        payload.quantidade_disponivel,
    )
    .execute(&state.db)
    .await
    .map_err(err)?;

    let row = sqlx::query!(
        "SELECT i.id as ingrediente_id, i.nome, i.unidade,
                s.quantidade_disponivel, s.updated_at
         FROM stock s
         JOIN ingredientes i ON i.id = s.ingrediente_id
         WHERE s.ingrediente_id = ?",
        payload.ingrediente_id
    )
    .fetch_one(&state.db)
    .await
    .map_err(err)?;

    Ok(StockItem {
        ingrediente_id: row.ingrediente_id,
        nome: row.nome,
        unidade: row.unidade,
        quantidade_disponivel: row.quantidade_disponivel,
        updated_at: row.updated_at,
    })
}
