// src-tauri/src/commands/custos.rs
// Lógica de cálculo de custo de receita.
// Este é o coração do negócio: calcula custo total, por porção e preço sugerido.
// Suporta preços promocionais temporários (não persistidos na BD).

use crate::{models::*, AppState};
use tauri::State;

type CmdResult<T> = Result<T, String>;

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn calcular_custo_receita(
    state: State<'_, AppState>,
    pedido: PedidoCustoReceita,
) -> CmdResult<CustoReceita> {
    // 1. Busca a receita para saber as porções base
    let receita = sqlx::query!(
        "SELECT porcoes_base FROM receitas WHERE id = ?",
        pedido.receita_id
    )
    .fetch_optional(&state.db)
    .await
    .map_err(err)?
    .ok_or_else(|| format!("Receita {} não encontrada", pedido.receita_id))?;

    // 2. Busca os ingredientes da receita com os respetivos preços e quantidades
    let ingredientes = sqlx::query!(
        "SELECT ri.ingrediente_id, ri.quantidade, i.nome, i.unidade, i.preco_atual
         FROM receita_ingredientes ri
         JOIN ingredientes i ON i.id = ri.ingrediente_id
         WHERE ri.receita_id = ?",
        pedido.receita_id
    )
    .fetch_all(&state.db)
    .await
    .map_err(err)?;

    // 3. Fator de escala para ajustar à quantidade de porções pedida
    let fator = pedido.porcoes as f64 / receita.porcoes_base as f64;

    // 4. Calcula o custo de cada ingrediente
    let mut breakdown: Vec<CustoIngrediente> = Vec::new();
    let mut custo_total = 0.0_f64;

    for ing in ingredientes {
        // Verifica se há promoção para este ingrediente
        let promocao = pedido
            .promocoes
            .iter()
            .find(|p| p.ingrediente_id == ing.ingrediente_id);

        let (preco_usado, e_promocao) = match promocao.and_then(|p| p.preco_promocao) {
            Some(preco_promo) => (preco_promo, true),
            None => (ing.preco_atual, false),
        };

        let quantidade_ajustada = ing.quantidade * fator;
        let custo_parcial = preco_usado * quantidade_ajustada;

        custo_total += custo_parcial;

        breakdown.push(CustoIngrediente {
            ingrediente_id: ing.ingrediente_id,
            nome: ing.nome,
            quantidade: quantidade_ajustada,
            unidade: ing.unidade,
            preco_usado,
            e_promocao,
            custo_parcial,
        });
    }

    // 5. Arredonda a 2 casas decimais para evitar floating-point noise
    let custo_total = (custo_total * 100.0).round() / 100.0;
    let custo_por_porcao = (custo_total / pedido.porcoes as f64 * 100.0).round() / 100.0;

    // 6. Preço de venda = custo * (1 + margem%)
    let preco_venda_sugerido =
        (custo_total * (1.0 + pedido.margem_percentagem / 100.0) * 100.0).round() / 100.0;

    Ok(CustoReceita {
        receita_id: pedido.receita_id,
        porcoes: pedido.porcoes,
        custo_total,
        custo_por_porcao,
        margem_percentagem: pedido.margem_percentagem,
        preco_venda_sugerido,
        breakdown,
    })
}
