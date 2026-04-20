// src-tauri/src/commands/receitas.rs
// Tauri commands para CRUD de receitas.

use crate::{models::*, AppState};
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

// ─── Listar ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn listar_receitas(state: State<'_, AppState>) -> CmdResult<Vec<Receita>> {
    sqlx::query_as!(
        Receita,
        "SELECT id, nome, categoria, tags, porcoes_base, instrucoes, imagem_path, created_at, updated_at
         FROM receitas
         ORDER BY nome ASC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(err)
}

// ─── Obter uma ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn obter_receita(
    state: State<'_, AppState>,
    id: i64,
) -> CmdResult<Option<Receita>> {
    sqlx::query_as!(
        Receita,
        "SELECT id, nome, categoria, tags, porcoes_base, instrucoes, imagem_path, created_at, updated_at
         FROM receitas
         WHERE id = ?",
        id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(err)
}

// ─── Criar ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn criar_receita(
    state: State<'_, AppState>,
    payload: ReceitaPayload,
) -> CmdResult<Receita> {
    let tags_json = serde_json::to_string(&payload.tags).map_err(err)?;

    let id = sqlx::query!(
        "INSERT INTO receitas (nome, categoria, tags, porcoes_base, instrucoes, imagem_path)
         VALUES (?, ?, ?, ?, ?, ?)",
        payload.nome,
        payload.categoria,
        tags_json,
        payload.porcoes_base,
        payload.instrucoes,
        payload.imagem_path,
    )
    .execute(&state.db)
    .await
    .map_err(err)?
    .last_insert_rowid();

    // Insere os ingredientes da receita
    for item in &payload.ingredientes {
        sqlx::query!(
            "INSERT INTO receita_ingredientes (receita_id, ingrediente_id, quantidade)
             VALUES (?, ?, ?)",
            id,
            item.ingrediente_id,
            item.quantidade,
        )
        .execute(&state.db)
        .await
        .map_err(err)?;
    }

    obter_receita(state, id)
        .await?
        .ok_or_else(|| "Receita não encontrada após criação".to_string())
}

// ─── Atualizar ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn atualizar_receita(
    state: State<'_, AppState>,
    id: i64,
    payload: ReceitaPayload,
) -> CmdResult<Receita> {
    let tags_json = serde_json::to_string(&payload.tags).map_err(err)?;

    sqlx::query!(
        "UPDATE receitas
         SET nome = ?, categoria = ?, tags = ?, porcoes_base = ?, instrucoes = ?, imagem_path = ?
         WHERE id = ?",
        payload.nome,
        payload.categoria,
        tags_json,
        payload.porcoes_base,
        payload.instrucoes,
        payload.imagem_path,
        id,
    )
    .execute(&state.db)
    .await
    .map_err(err)?;

    // Substitui todos os ingredientes (delete + insert é mais simples que diff)
    sqlx::query!("DELETE FROM receita_ingredientes WHERE receita_id = ?", id)
        .execute(&state.db)
        .await
        .map_err(err)?;

    for item in &payload.ingredientes {
        sqlx::query!(
            "INSERT INTO receita_ingredientes (receita_id, ingrediente_id, quantidade)
             VALUES (?, ?, ?)",
            id,
            item.ingrediente_id,
            item.quantidade,
        )
        .execute(&state.db)
        .await
        .map_err(err)?;
    }

    obter_receita(state, id)
        .await?
        .ok_or_else(|| format!("Receita com id {} não encontrada", id))
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn eliminar_receita(state: State<'_, AppState>, id: i64) -> CmdResult<()> {
    let resultado = sqlx::query!("DELETE FROM receitas WHERE id = ?", id)
        .execute(&state.db)
        .await
        .map_err(err)?;

    if resultado.rows_affected() == 0 {
        return Err(format!("Receita com id {} não encontrada", id));
    }

    Ok(())
}
