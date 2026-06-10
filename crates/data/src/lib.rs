use async_trait::async_trait;
use mise_core::{Ingredient, Recipe};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RepoError {
    #[error("Not found")]
    NotFound,
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
}

#[async_trait]
pub trait IngredientRepo {
    async fn create(&self, ingredient: Ingredient) -> Result<Ingredient, RepoError>;
    async fn get(&self, id: u64) -> Result<Ingredient, RepoError>;
    async fn list(&self) -> Result<Vec<Ingredient>, RepoError>;
    async fn update(&self, ingredient: Ingredient) -> Result<Ingredient, RepoError>;
    async fn delete(&self, id: u64) -> Result<(), RepoError>;
}

#[async_trait]
pub trait RecipeRepo {
    async fn create(&self, recipe: Recipe) -> Result<Recipe, RepoError>;
    async fn get(&self, id: u64) -> Result<Recipe, RepoError>;
    async fn list(&self) -> Result<Vec<Recipe>, RepoError>;
    async fn update(&self, recipe: Recipe) -> Result<Recipe, RepoError>;
    async fn delete(&self, id: u64) -> Result<(), RepoError>;
}
