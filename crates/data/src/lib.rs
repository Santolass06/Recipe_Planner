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

pub mod shopping {
    use super::*;
    use mise_core::{Ingredient, Recipe, Unit};
    use std::collections::HashMap;

    #[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
    pub struct ShoppingItem {
        pub ingredient_id: u64,
        pub ingredient_name: String,
        pub ingredient_unit: Unit,
        pub needed_quantity: f64,
        pub stock_quantity: f64,
        pub category: String,
    }

    #[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
    pub struct ShoppingList {
        pub items: Vec<ShoppingItem>,
        pub total_estimated_cost: f64,
    }

    pub fn generate_shopping_list(
        recipes: &[Recipe],
        stock: &[StockItem],
        ingredients: &[Ingredient],
        portions_multiplier: u32,
    ) -> ShoppingList {
        let mut needed: HashMap<u64, f64> = HashMap::new();
        let mut ingredient_info: HashMap<u64, (String, Unit, String)> = HashMap::new();

        for ing in ingredients {
            ingredient_info.insert(ing.id as u64, (ing.name.clone(), ing.unit, String::new()));
        }

        for stock_item in stock {
            let ing_id = stock_item.ingredient_id as u64;
            if let Some((name, unit, _)) = ingredient_info.get(&ing_id) {
                ingredient_info.insert(ing_id, (name.clone(), *unit, String::new()));
            }
        }

        for recipe in recipes {
            for recipe_ing in &recipe.ingredients {
                let total_needed = recipe_ing.quantity * portions_multiplier as f64 * recipe.portions as f64;
                *needed.entry(recipe_ing.ingredient_id).or_insert(0.0) += total_needed;
                
                if !ingredient_info.contains_key(&recipe_ing.ingredient_id) {
                    ingredient_info.insert(recipe_ing.ingredient_id, (recipe_ing.ingredient_name.clone(), recipe_ing.unit, String::new()));
                }
            }
        }

        let mut items = Vec::new();
        let mut total_estimated_cost = 0.0;

        for (ingredient_id, needed_qty) in needed {
            let stock_qty = stock.iter()
                .find(|s| s.ingredient_id == ingredient_id as i64)
                .map(|s| s.quantity)
                .unwrap_or(0.0);

            if needed_qty > stock_qty {
                let to_buy = needed_qty - stock_qty;
                let (name, unit, category) = ingredient_info.get(&ingredient_id)
                    .cloned()
                    .unwrap_or_else(|| ("Desconhecido".to_string(), Unit::Gram, String::new()));
                
                let price = ingredients.iter()
                    .find(|i| i.id == ingredient_id as i64)
                    .map(|i| i.price_per_unit)
                    .unwrap_or(0.0);
                
                let estimated_cost = to_buy * price;
                total_estimated_cost += estimated_cost;

                items.push(ShoppingItem {
                    ingredient_id: ingredient_id as u64,
                    ingredient_name: name,
                    ingredient_unit: unit,
                    needed_quantity: to_buy,
                    stock_quantity: stock_qty,
                    category,
                });
            }
        }

        items.sort_by(|a, b| a.category.cmp(&b.category).then_with(|| a.ingredient_name.cmp(&b.ingredient_name)));

        ShoppingList {
            items,
            total_estimated_cost,
        }
    }
}

#[cfg(test)]
mod shopping_tests {
    use super::*;
    use crate::{db::open_local, ingredient_repo::SqliteIngredientRepo, recipe_repo::SqliteRecipeRepo, stock_repo::SqliteStockRepo, IngredientInput, RecipeInput, RecipeIngredientInput, StockInput, IngredientRepo, RecipeRepo, StockRepo};
    use mise_core::Unit;

    async fn test_setup() -> (SqliteRecipeRepo, SqliteIngredientRepo, SqliteStockRepo) {
        let conn = open_local(":memory:").await.unwrap();
        (SqliteRecipeRepo { conn: conn.clone() }, SqliteIngredientRepo { conn: conn.clone() }, SqliteStockRepo { conn })
    }

    #[tokio::test]
    async fn test_generate_shopping_list_simple() {
        let (recipe_repo, ing_repo, stock_repo) = test_setup().await;
        let ing = ing_repo.create(IngredientInput {
            name: "Farinha".into(),
            unit: Unit::Gram,
            price_per_unit: 0.01,
        }).await.unwrap();
        let recipe = recipe_repo.create(RecipeInput {
            name: "Pão".into(),
            category: "Padaria".into(),
            portions: 1,
            instructions: "Misturar".into(),
            ingredients: vec![RecipeIngredientInput {
                ingredient_id: ing.id as u64,
                quantity: 500.0,
                unit: Unit::Gram,
            }],
        }).await.unwrap();
        stock_repo.upsert(StockInput {
            ingredient_id: ing.id as u64,
            quantity: 200.0,
            min_quantity: 100.0,
        }).await.unwrap();

        let recipes = recipe_repo.list().await.unwrap();
        let stock = stock_repo.list().await.unwrap();
        let ingredients = ing_repo.list().await.unwrap();

        let list = shopping::generate_shopping_list(&recipes, &stock, &ingredients, 1);
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0].ingredient_name, "Farinha");
        assert_eq!(list.items[0].needed_quantity, 300.0);
        assert_eq!(list.items[0].stock_quantity, 200.0);
    }

    #[tokio::test]
    async fn test_generate_shopping_list_multiple_recipes() {
        let (recipe_repo, ing_repo, stock_repo) = test_setup().await;
        let ing = ing_repo.create(IngredientInput {
            name: "Farinha".into(),
            unit: Unit::Gram,
            price_per_unit: 0.01,
        }).await.unwrap();
        recipe_repo.create(RecipeInput {
            name: "Pão".into(),
            category: "Padaria".into(),
            portions: 1,
            instructions: "Misturar".into(),
            ingredients: vec![RecipeIngredientInput {
                ingredient_id: ing.id as u64,
                quantity: 500.0,
                unit: Unit::Gram,
            }],
        }).await.unwrap();
        recipe_repo.create(RecipeInput {
            name: "Bolo".into(),
            category: "Sobremesa".into(),
            portions: 1,
            instructions: "Misturar".into(),
            ingredients: vec![RecipeIngredientInput {
                ingredient_id: ing.id as u64,
                quantity: 300.0,
                unit: Unit::Gram,
            }],
        }).await.unwrap();
        stock_repo.upsert(StockInput {
            ingredient_id: ing.id as u64,
            quantity: 200.0,
            min_quantity: 100.0,
        }).await.unwrap();

        let recipes = recipe_repo.list().await.unwrap();
        let stock = stock_repo.list().await.unwrap();
        let ingredients = ing_repo.list().await.unwrap();

        let list = shopping::generate_shopping_list(&recipes, &stock, &ingredients, 1);
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0].needed_quantity, 600.0);
    }
}
