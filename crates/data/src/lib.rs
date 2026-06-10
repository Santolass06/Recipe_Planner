pub mod db;
pub mod ingredient_repo;

use async_trait::async_trait;
use mise_core::{Ingredient, Unit};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RepoError {
    #[error("não encontrado")]
    NotFound,
    #[error("erro de armazenamento: {0}")]
    Storage(String),
}

pub type RepoResult<T> = Result<T, RepoError>;

#[derive(Debug, Clone)]
pub struct IngredientInput {
    pub name:           String,
    pub unit:           Unit,
    pub price_per_unit: f64,
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
    async fn list(&self)           -> RepoResult<Vec<mise_core::Recipe>>;
    async fn get(&self, id: i64)   -> RepoResult<mise_core::Recipe>;
    async fn delete(&self, id: i64)-> RepoResult<()>;
}
