// src-tauri/src/models/mod.rs
// Structs que espelham as tabelas da base de dados.
// Derivam Serialize/Deserialize para comunicar com o frontend via Tauri commands.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Ingrediente {
    pub id: i64,
    pub nome: String,
    pub unidade: String,
    pub preco_atual: f64,
    pub imagem_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IngredientePayload {
    pub nome: String,
    pub unidade: String,
    pub preco_atual: f64,
    pub imagem_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct HistoricoPreco {
    pub id: i64,
    pub ingrediente_id: i64,
    pub preco: f64,
    pub data: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Receita {
    pub id: i64,
    pub nome: String,
    pub categoria: Option<String>,
    pub tags: String,
    pub porcoes_base: i64,
    pub instrucoes: Option<String>,
    pub imagem_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReceitaPayload {
    pub nome: String,
    pub categoria: Option<String>,
    pub tags: Vec<String>,
    pub porcoes_base: i64,
    pub instrucoes: Option<String>,
    pub imagem_path: Option<String>,
    pub ingredientes: Vec<ReceitaIngredientePayload>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct ReceitaIngrediente {
    pub receita_id: i64,
    pub ingrediente_id: i64,
    pub quantidade: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReceitaIngredientePayload {
    pub ingrediente_id: i64,
    pub quantidade: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PedidoCustoReceita {
    pub receita_id: i64,
    pub porcoes: i64,
    pub margem_percentagem: f64,
    pub promocoes: Vec<IngredientePromocao>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IngredientePromocao {
    pub ingrediente_id: i64,
    pub preco_promocao: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustoReceita {
    pub receita_id: i64,
    pub porcoes: i64,
    pub custo_total: f64,
    pub custo_por_porcao: f64,
    pub margem_percentagem: f64,
    pub preco_venda_sugerido: f64,
    pub breakdown: Vec<CustoIngrediente>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustoIngrediente {
    pub ingrediente_id: i64,
    pub nome: String,
    pub quantidade: f64,
    pub unidade: String,
    pub preco_usado: f64,
    pub e_promocao: bool,
    pub custo_parcial: f64,
}