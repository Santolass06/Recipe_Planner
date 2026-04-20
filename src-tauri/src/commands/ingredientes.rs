// src-tauri/src/commands/ingredientes.rs
// Tauri commands para CRUD de ingredientes.
// Cada função é chamada pelo frontend via invoke().

use crate::{models::*, AppState};
use tauri::State;

type CmdResult<T> = Result<T, String>;

// Converte erros internos para String (que o Tauri sabe serializar para o frontend)
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ─── Listar ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn listar_ingredientes(state: State<'_, AppState>) -> CmdResult<Vec<Ingrediente>> {
    sqlx::query_as!(
        Ingrediente,
        "SELECT id, nome, unidade, preco_atual, imagem_path, created_at, updated_at
         FROM ingredientes
         ORDER BY nome ASC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(err)
}

// ─── Obter um ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn obter_ingrediente(
    state: State<'_, AppState>,
    id: i64,
) -> CmdResult<Option<Ingrediente>> {
    sqlx::query_as!(
        Ingrediente,
        "SELECT id, nome, unidade, preco_atual, imagem_path, created_at, updated_at
         FROM ingredientes
         WHERE id = ?",
        id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(err)
}

// ─── Criar ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn criar_ingrediente(
    state: State<'_, AppState>,
    payload: IngredientePayload,
) -> CmdResult<Ingrediente> {
    let id = sqlx::query!(
        "INSERT INTO ingredientes (nome, unidade, preco_atual, imagem_path)
         VALUES (?, ?, ?, ?)",
        payload.nome,
        payload.unidade,
        payload.preco_atual,
        payload.imagem_path,
    )
    .execute(&state.db)
    .await
    .map_err(err)?
    .last_insert_rowid();

    // O histórico inicial é inserido pelo trigger da BD ao primeiro UPDATE.
    // Aqui inserimos manualmente porque é um INSERT (trigger só cobre UPDATE).
    sqlx::query!(
        "INSERT INTO historico_precos (ingrediente_id, preco) VALUES (?, ?)",
        id,
        payload.preco_atual,
    )
    .execute(&state.db)
    .await
    .map_err(err)?;

    obter_ingrediente(state, id)
        .await?
        .ok_or_else(|| "Ingrediente não encontrado após criação".to_string())
}

// ─── Atualizar ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn atualizar_ingrediente(
    state: State<'_, AppState>,
    id: i64,
    payload: IngredientePayload,
) -> CmdResult<Ingrediente> {
    // O trigger `historico_preco_on_update` na BD guarda automaticamente
    // o histórico se o preço mudar.
    sqlx::query!(
        "UPDATE ingredientes
         SET nome = ?, unidade = ?, preco_atual = ?, imagem_path = ?
         WHERE id = ?",
        payload.nome,
        payload.unidade,
        payload.preco_atual,
        payload.imagem_path,
        id,
    )
    .execute(&state.db)
    .await
    .map_err(err)?;

    obter_ingrediente(state, id)
        .await?
        .ok_or_else(|| format!("Ingrediente com id {} não encontrado", id))
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn eliminar_ingrediente(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    // ON DELETE RESTRICT na receita_ingredientes impede eliminar ingredientes em uso
    let resultado = sqlx::query!("DELETE FROM ingredientes WHERE id = ?", id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            if e.to_string().contains("FOREIGN KEY") {
                "Não é possível eliminar: este ingrediente está a ser usado numa receita.".to_string()
            } else {
                e.to_string()
            }
        })?;

    if resultado.rows_affected() == 0 {
        return Err(format!("Ingrediente com id {} não encontrado", id));
    }

    Ok(())
}
