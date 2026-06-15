pub mod db;
pub mod ingredient_repo;
pub mod recipe_repo;
pub mod stock_repo;

use async_trait::async_trait;
use mise_core::{Ingredient, Recipe, Unit};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RepoError {
    #[error("não encontrado")]
    NotFound,
    #[error("erro de armazenamento: {0}")]
    Storage(String),
}

pub type RepoResult<T> = Result<T, RepoError>;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct IngredientInput {
    pub name:           String,
    pub unit:           Unit,
    pub price_per_unit: f64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct RecipeInput {
    pub name:         String,
    pub category:     String,
    pub portions:     u32,
    pub instructions: String,
    pub ingredients:  Vec<RecipeIngredientInput>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct RecipeIngredientInput {
    pub ingredient_id: u64,
    pub quantity:      f64,
    pub unit:          Unit,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct StockItem {
    pub id:             i64,
    pub ingredient_id:  i64,
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
    pub quantity:       f64,
    pub min_quantity:   f64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct StockInput {
    pub ingredient_id: u64,
    pub quantity:      f64,
    pub min_quantity:  f64,
}

#[async_trait]
pub trait IngredientRepo: Send + Sync {
    async fn list(&self)                              -> RepoResult<Vec<Ingredient>>;
    async fn get(&self, id: i64)                      -> RepoResult<Ingredient>;
    async fn create(&self, input: IngredientInput)    -> RepoResult<Ingredient>;
    async fn update(&self, id: i64, input: IngredientInput) -> RepoResult<Ingredient>;
    async fn delete(&self, id: i64)                   -> RepoResult<()>;
}

#[async_trait]
pub trait RecipeRepo: Send + Sync {
    async fn list(&self)                    -> RepoResult<Vec<Recipe>>;
    async fn get(&self, id: i64)            -> RepoResult<Recipe>;
    async fn create(&self, input: RecipeInput) -> RepoResult<Recipe>;
    async fn update(&self, id: i64, input: RecipeInput) -> RepoResult<Recipe>;
    async fn delete(&self, id: i64)         -> RepoResult<()>;
}

#[async_trait]
pub trait StockRepo: Send + Sync {
    async fn list(&self)                              -> RepoResult<Vec<StockItem>>;
    async fn get(&self, ingredient_id: i64)           -> RepoResult<StockItem>;
    async fn upsert(&self, input: StockInput)         -> RepoResult<StockItem>;
    async fn update_quantity(&self, ingredient_id: i64, quantity: f64) -> RepoResult<StockItem>;
    async fn delete(&self, ingredient_id: i64)        -> RepoResult<()>;
}
