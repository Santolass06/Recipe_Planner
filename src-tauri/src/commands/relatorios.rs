use crate::{models::*, AppState};
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn relatorio_resumo(state: State<'_, AppState>) -> CmdResult<RelatorioResumo> {
    let total_ingredientes: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM ingredientes")
        .fetch_one(&state.db)
        .await
        .map_err(err)?;

    let total_receitas: i64 = sqlx::query_scalar!("SELECT COUNT(*) FROM receitas")
        .fetch_one(&state.db)
        .await
        .map_err(err)?;

    let ingrediente_mais_caro: Option<String> = sqlx::query_scalar!(
        "SELECT nome FROM ingredientes ORDER BY preco_atual DESC LIMIT 1"
    )
    .fetch_optional(&state.db)
    .await
    .map_err(err)?;

    let receita_mais_cara: Option<String> = sqlx::query_scalar!(
        "SELECT r.nome
         FROM receitas r
         LEFT JOIN (
             SELECT ri.receita_id, SUM(i.preco_atual * ri.quantidade) as custo_total
             FROM receita_ingredientes ri
             JOIN ingredientes i ON i.id = ri.ingrediente_id
             GROUP BY ri.receita_id
         ) costs ON costs.receita_id = r.id
         ORDER BY COALESCE(costs.custo_total, 0.0) DESC
         LIMIT 1"
    )
    .fetch_optional(&state.db)
    .await
    .map_err(err)?;

    let historico_rows = sqlx::query!(
        "SELECT i.nome as ingrediente_nome, hp.preco, hp.data
         FROM historico_precos hp
         JOIN ingredientes i ON i.id = hp.ingrediente_id
         ORDER BY hp.data DESC
         LIMIT 10"
    )
    .fetch_all(&state.db)
    .await
    .map_err(err)?;

    let historico_precos_recentes = historico_rows
        .into_iter()
        .map(|r| HistoricoPrecoItem {
            ingrediente_nome: r.ingrediente_nome,
            preco: r.preco,
            data: r.data,
        })
        .collect();

    Ok(RelatorioResumo {
        total_ingredientes,
        total_receitas,
        ingrediente_mais_caro,
        receita_mais_cara,
        historico_precos_recentes,
    })
}
