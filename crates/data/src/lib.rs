pub mod db;
pub mod ingredient_repo;
pub mod recipe_repo;
pub mod stock_repo;

use async_trait::async_trait;
use mise_core::{Ingredient, Recipe, Unit, RecipeIngredient};
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

pub mod import {
    use super::*;
    use mise_core::{Ingredient, Recipe, Unit, RecipeIngredient};
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ImportRecipeIngredient {
        pub ingredient_name: String,
        pub quantity: f64,
        pub unit: Unit,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ImportRecipe {
        pub name: String,
        pub category: String,
        pub portions: u32,
        pub instructions: String,
        pub ingredients: Vec<ImportRecipeIngredient>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ImportData {
        pub version: u32,
        pub recipes: Vec<ImportRecipe>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ImportResult {
        pub recipes_created: usize,
        pub ingredients_created: usize,
        pub errors: Vec<String>,
    }

    pub fn parse_import_json(json: &str) -> Result<ImportData, String> {
        let data: ImportData = serde_json::from_str(json)
            .map_err(|e| format!("JSON inválido: {}", e))?;
        
        if data.version != 1 {
            return Err(format!("Versão não suportada: {} (esperado 1)", data.version));
        }
        
        if data.recipes.is_empty() {
            return Err("Nenhuma receita no arquivo".to_string());
        }
        
        for recipe in &data.recipes {
            if recipe.name.trim().is_empty() {
                return Err("Nome da receita não pode ser vazio".to_string());
            }
            if recipe.portions == 0 {
                return Err("Porções deve ser maior que zero".to_string());
            }
            if recipe.ingredients.is_empty() {
                return Err(format!("Receita '{}' não tem ingredientes", recipe.name));
            }
            for ing in &recipe.ingredients {
                if ing.ingredient_name.trim().is_empty() {
                    return Err("Nome do ingrediente não pode ser vazio".to_string());
                }
                if ing.quantity <= 0.0 {
                    return Err(format!("Quantidade do ingrediente '{}' deve ser positiva", ing.ingredient_name));
                }
            }
        }
        
        Ok(data)
    }

    pub async fn execute_import(
        data: ImportData,
        recipe_repo: &mut dyn RecipeRepo,
        ingredient_repo: &mut dyn IngredientRepo,
    ) -> ImportResult {
        let mut result = ImportResult {
            recipes_created: 0,
            ingredients_created: 0,
            errors: Vec::new(),
        };

        let mut ingredient_name_to_id: HashMap<String, u64> = HashMap::new();

        let existing_ingredients = ingredient_repo.list().await.unwrap_or_default();
        for ing in &existing_ingredients {
            ingredient_name_to_id.insert(ing.name.to_lowercase(), ing.id as u64);
        }

        // Create new ingredients in DB before recipes (FK constraint)
        for import_recipe in &data.recipes {
            for import_ing in &import_recipe.ingredients {
                let ing_key = import_ing.ingredient_name.to_lowercase();
                if !ingredient_name_to_id.contains_key(&ing_key) {
                    let _ = ingredient_repo.create(IngredientInput {
                        name: import_ing.ingredient_name.clone(),
                        unit: import_ing.unit,
                        price_per_unit: 0.0,
                    }).await;
                    // Re-fetch to get the actual DB ID
                    let all_ings = ingredient_repo.list().await.unwrap_or_default();
                    if let Some(new_ing) = all_ings.iter().find(|i| i.name.to_lowercase() == ing_key) {
                        ingredient_name_to_id.insert(ing_key, new_ing.id as u64);
                    }
                }
            }
        }

        for import_recipe in data.recipes {
            let mut recipe_ingredients = Vec::new();

            for import_ing in import_recipe.ingredients {
                let ing_key = import_ing.ingredient_name.to_lowercase();
                let ingredient_id = if let Some(&id) = ingredient_name_to_id.get(&ing_key) {
                    id
                } else {
                    let new_id = (ingredient_name_to_id.len() + 1) as u64;
                    ingredient_name_to_id.insert(ing_key.clone(), new_id);
                    new_id
                };

                recipe_ingredients.push(RecipeIngredient {
                    ingredient_id: ingredient_id,
                    ingredient_name: import_ing.ingredient_name,
                    quantity: import_ing.quantity,
                    unit: import_ing.unit,
                });
            }

            let recipe_input = RecipeInput {
                name: import_recipe.name,
                category: import_recipe.category,
                portions: import_recipe.portions,
                instructions: import_recipe.instructions,
                ingredients: recipe_ingredients.into_iter().map(|ri| RecipeIngredientInput {
                    ingredient_id: ri.ingredient_id,
                    quantity: ri.quantity,
                    unit: ri.unit,
                }).collect(),
            };

            match recipe_repo.create(recipe_input).await {
                Ok(_) => result.recipes_created += 1,
                Err(e) => result.errors.push(format!("Erro ao criar receita: {}", e)),
            }
        }

        result.ingredients_created = ingredient_name_to_id.len() 
            .saturating_sub(
                ingredient_name_to_id.values()
                    .filter(|id| {
                        let id_val = **id;
                        existing_ingredients.iter().any(|e| e.id as u64 == id_val)
                    })
                    .count()
            );

        result
    }
}

#[cfg(test)]
mod import_tests {
    use super::*;
    use crate::{db::open_local, ingredient_repo::SqliteIngredientRepo, recipe_repo::SqliteRecipeRepo, IngredientInput, RecipeInput, RecipeIngredientInput, StockInput, IngredientRepo, RecipeRepo};
    use mise_core::Unit;

    async fn test_setup() -> (SqliteRecipeRepo, SqliteIngredientRepo) {
        let conn = open_local(":memory:").await.unwrap();
        (SqliteRecipeRepo { conn: conn.clone() }, SqliteIngredientRepo { conn })
    }

    #[tokio::test]
    async fn test_parse_valid_import_json() {
        let json = r#"{
            "version": 1,
            "recipes": [
                {
                    "name": "Pão",
                    "category": "Padaria",
                    "portions": 1,
                    "instructions": "Misturar e assar",
                    "ingredients": [
                        {"ingredient_name": "Farinha", "quantity": 500.0, "unit": "gram"},
                        {"ingredient_name": "Fermento", "quantity": 10.0, "unit": "gram"}
                    ]
                }
            ]
        }"#;
        
        let data = import::parse_import_json(json).unwrap();
        assert_eq!(data.version, 1);
        assert_eq!(data.recipes.len(), 1);
        assert_eq!(data.recipes[0].name, "Pão");
        assert_eq!(data.recipes[0].ingredients.len(), 2);
    }

    #[tokio::test]
    async fn test_execute_import() {
        let (recipe_repo, ing_repo) = test_setup().await;
        
        let json = r#"{
            "version": 1,
            "recipes": [
                {
                    "name": "Pão",
                    "category": "Padaria",
                    "portions": 1,
                    "instructions": "Misturar e assar",
                    "ingredients": [
                        {"ingredient_name": "Farinha", "quantity": 500.0, "unit": "gram"},
                        {"ingredient_name": "Água", "quantity": 300.0, "unit": "milliliter"}
                    ]
                }
            ]
        }"#;
        
        let data = import::parse_import_json(json).unwrap();
        let mut recipe_repo = recipe_repo;
        let mut ing_repo = ing_repo;
        
        let result = import::execute_import(data, &mut recipe_repo, &mut ing_repo).await;
        //eprintln!("Result: {:?}", result);
        assert_eq!(result.recipes_created, 1);
        assert_eq!(result.ingredients_created, 2);
        assert!(result.errors.is_empty());
    }

    #[tokio::test]
    async fn test_execute_import_duplicate_ingredients() {
        let (recipe_repo, ing_repo) = test_setup().await;
        
        let json = r#"{
            "version": 1,
            "recipes": [
                {
                    "name": "Pão",
                    "category": "Padaria",
                    "portions": 1,
                    "instructions": "Misturar",
                    "ingredients": [
                        {"ingredient_name": "Farinha", "quantity": 500.0, "unit": "gram"}
                    ]
                },
                {
                    "name": "Bolo",
                    "category": "Sobremesa",
                    "portions": 1,
                    "instructions": "Misturar",
                    "ingredients": [
                        {"ingredient_name": "Farinha", "quantity": 300.0, "unit": "gram"}
                    ]
                }
            ]
        }"#;
        
        let data = import::parse_import_json(json).unwrap();
        let mut recipe_repo = recipe_repo;
        let mut ing_repo = ing_repo;
        
        let result = import::execute_import(data, &mut recipe_repo, &mut ing_repo).await;
        assert_eq!(result.recipes_created, 2);
        assert_eq!(result.ingredients_created, 1);
    }
}