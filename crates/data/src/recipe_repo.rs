use crate::{RecipeInput, RecipeIngredientInput, RepoError, RepoResult};
use async_trait::async_trait;
use libsql::Connection;
use mise_core::{Recipe, RecipeIngredient, Unit};

pub struct SqliteRecipeRepo {
    pub conn: Connection,
}

fn parse_unit(s: &str) -> Unit {
    match s {
        "gram" => Unit::Gram,
        "kilogram" => Unit::Kilogram,
        "milligram" => Unit::Milligram,
        "ounce" => Unit::Ounce,
        "pound" => Unit::Pound,
        "milliliter" => Unit::Milliliter,
        "liter" => Unit::Liter,
        "fluid_ounce" => Unit::FluidOunce,
        "cup" => Unit::Cup,
        "pint" => Unit::Pint,
        "quart" => Unit::Quart,
        "gallon" => Unit::Gallon,
        "teaspoon" => Unit::Teaspoon,
        "tablespoon" => Unit::Tablespoon,
        "piece" => Unit::Piece,
        "dozen" => Unit::Dozen,
        "pinch" => Unit::Pinch,
        "bunch" => Unit::Bunch,
        "clove" => Unit::Clove,
        "slice" => Unit::Slice,
        "centimeter" => Unit::Centimeter,
        "celsius" => Unit::Celsius,
        "fahrenheit" => Unit::Fahrenheit,
        _ => Unit::Gram,
    }
}

fn unit_str(u: Unit) -> &'static str {
    match u {
        Unit::Gram => "gram",
        Unit::Kilogram => "kilogram",
        Unit::Milligram => "milligram",
        Unit::Ounce => "ounce",
        Unit::Pound => "pound",
        Unit::Milliliter => "milliliter",
        Unit::Liter => "liter",
        Unit::FluidOunce => "fluid_ounce",
        Unit::Cup => "cup",
        Unit::Pint => "pint",
        Unit::Quart => "quart",
        Unit::Gallon => "gallon",
        Unit::Teaspoon => "teaspoon",
        Unit::Tablespoon => "tablespoon",
        Unit::Piece => "piece",
        Unit::Dozen => "dozen",
        Unit::Pinch => "pinch",
        Unit::Bunch => "bunch",
        Unit::Clove => "clove",
        Unit::Slice => "slice",
        Unit::Centimeter => "centimeter",
        Unit::Celsius => "celsius",
        Unit::Fahrenheit => "fahrenheit",
    }
}

#[async_trait]
impl crate::RecipeRepo for SqliteRecipeRepo {
    async fn list(&self) -> RepoResult<Vec<Recipe>> {
        let mut rows = self.conn
            .query(
                "SELECT id, name, category, portions, instructions
                 FROM recipes ORDER BY name",
                (),
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        let mut recipes = Vec::new();
        while let Some(row) = rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            let id: i64 = row.get(0).map_err(|e| RepoError::Storage(e.to_string()))?;
            let name: String = row.get(1).map_err(|e| RepoError::Storage(e.to_string()))?;
            let category: String = row.get(2).map_err(|e| RepoError::Storage(e.to_string()))?;
            let portions: u32 = row.get(3).map_err(|e| RepoError::Storage(e.to_string()))?;
            let instructions: String = row.get(4).map_err(|e| RepoError::Storage(e.to_string()))?;

            let ingredients = self.load_recipe_ingredients(id).await?;
            recipes.push(Recipe {
                id: id as u64,
                name,
                category,
                portions,
                instructions,
                ingredients,
                favorite: false,
                prep_time_minutes: None,
                cook_time_minutes: None,
                tags: vec![],
                nutrition: None,
            });
        }
        Ok(recipes)
    }

    async fn get(&self, id: i64) -> RepoResult<Recipe> {
        let mut rows = self.conn
            .query(
                "SELECT id, name, category, portions, instructions
                 FROM recipes WHERE id = ?1",
                [id],
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        match rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            None => Err(RepoError::NotFound),
            Some(row) => {
                let ingredients = self.load_recipe_ingredients(id).await?;
                Ok(Recipe {
                    id: row.get::<i64>(0).map_err(|e| RepoError::Storage(e.to_string()))? as u64,
                    name: row.get::<String>(1).map_err(|e| RepoError::Storage(e.to_string()))?,
                    category: row.get::<String>(2).map_err(|e| RepoError::Storage(e.to_string()))?,
                    portions: row.get::<i64>(3).map_err(|e| RepoError::Storage(e.to_string()))? as u32,
                    instructions: row.get::<String>(4).map_err(|e| RepoError::Storage(e.to_string()))?,
                    ingredients,
                    favorite: false,
                    prep_time_minutes: None,
                    cook_time_minutes: None,
                    tags: vec![],
                    nutrition: None,
                })
            },
        }
    }

    async fn create(&self, input: RecipeInput) -> RepoResult<Recipe> {
        let tx = self.conn
            .transaction()
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;

        tx.execute(
            "INSERT INTO recipes (name, category, portions, instructions)
             VALUES (?1, ?2, ?3, ?4)",
            libsql::params![
                input.name.clone(),
                input.category.clone(),
                input.portions as i64,
                input.instructions.clone(),
            ],
        )
        .await
        .map_err(|e| RepoError::Storage(e.to_string()))?;

        let mut rows = tx
            .query("SELECT last_insert_rowid()", ())
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        let recipe_id: i64 = rows
            .next()
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?
            .ok_or(RepoError::Storage("insert recipe falhou".into()))?
            .get(0)
            .map_err(|e| RepoError::Storage(e.to_string()))?;

        for ing_input in &input.ingredients {
            tx.execute(
                "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                 VALUES (?1, ?2, ?3, ?4)",
                libsql::params![
                    recipe_id,
                    ing_input.ingredient_id as i64,
                    ing_input.quantity,
                    unit_str(ing_input.unit),
                ],
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        }

        tx.commit().await.map_err(|e| RepoError::Storage(e.to_string()))?;

        self.get(recipe_id).await
    }

    async fn update(&self, id: i64, input: RecipeInput) -> RepoResult<Recipe> {
        let tx = self.conn
            .transaction()
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;

        let affected = tx.execute(
            "UPDATE recipes
             SET name = ?1, category = ?2, portions = ?3, instructions = ?4
             WHERE id = ?5",
            libsql::params![
                input.name.clone(),
                input.category.clone(),
                input.portions as i64,
                input.instructions.clone(),
                id,
            ],
        )
        .await
        .map_err(|e| RepoError::Storage(e.to_string()))?;
        if affected == 0 { return Err(RepoError::NotFound); }

        tx.execute(
            "DELETE FROM recipe_ingredients WHERE recipe_id = ?1",
            [id],
        )
        .await
        .map_err(|e| RepoError::Storage(e.to_string()))?;

        for ing_input in &input.ingredients {
            tx.execute(
                "INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                 VALUES (?1, ?2, ?3, ?4)",
                libsql::params![
                    id,
                    ing_input.ingredient_id as i64,
                    ing_input.quantity,
                    unit_str(ing_input.unit),
                ],
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        }

        tx.commit().await.map_err(|e| RepoError::Storage(e.to_string()))?;
        self.get(id).await
    }

    async fn delete(&self, id: i64) -> RepoResult<()> {
        let affected = self.conn
            .execute("DELETE FROM recipes WHERE id = ?1", [id])
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        if affected == 0 { return Err(RepoError::NotFound); }
        Ok(())
    }
}

impl SqliteRecipeRepo {
    async fn load_recipe_ingredients(&self, recipe_id: i64) -> RepoResult<Vec<RecipeIngredient>> {
        let mut rows = self.conn
            .query(
                "SELECT ri.ingredient_id, i.name, ri.quantity, ri.unit
                 FROM recipe_ingredients ri
                 JOIN ingredients i ON i.id = ri.ingredient_id
                 WHERE ri.recipe_id = ?1",
                [recipe_id],
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        let mut ingredients = Vec::new();
        while let Some(row) = rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            let ingredient_id: i64 = row.get(0).map_err(|e| RepoError::Storage(e.to_string()))?;
            let ingredient_name: String = row.get(1).map_err(|e| RepoError::Storage(e.to_string()))?;
            let quantity: f64 = row.get(2).map_err(|e| RepoError::Storage(e.to_string()))?;
            let unit_str: String = row.get(3).map_err(|e| RepoError::Storage(e.to_string()))?;
            ingredients.push(RecipeIngredient {
                ingredient_id: ingredient_id as u64,
                ingredient_name,
                quantity,
                unit: parse_unit(&unit_str),
            });
        }
        Ok(ingredients)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{db::open_local, ingredient_repo::SqliteIngredientRepo, IngredientInput, IngredientRepo, RecipeRepo, RecipeInput, RecipeIngredientInput};
    use mise_core::Unit;

    async fn test_repo() -> (SqliteRecipeRepo, SqliteIngredientRepo) {
        let conn = open_local(":memory:").await.unwrap();
        (SqliteRecipeRepo { conn: conn.clone() }, SqliteIngredientRepo { conn })
    }

    #[tokio::test]
    async fn create_and_list() {
        let (repo, ing_repo) = test_repo().await;
        let ing = ing_repo.create(IngredientInput {
            name: "Arroz".into(),
            unit: Unit::Kilogram,
            price_per_unit: 2.0,
        }).await.unwrap();
        let recipe = repo.create(RecipeInput {
            name: "Arroz de marisco".into(),
            category: "Prato principal".into(),
            portions: 4,
            instructions: "Cozer o arroz...".into(),
            ingredients: vec![
                RecipeIngredientInput { ingredient_id: ing.id as u64, quantity: 200.0, unit: Unit::Gram },
            ],
        }).await.unwrap();
        assert_eq!(recipe.name, "Arroz de marisco");
        let list = repo.list().await.unwrap();
        assert_eq!(list.len(), 1);
    }

    #[tokio::test]
    async fn update_and_delete() {
        let (repo, _ing_repo) = test_repo().await;
        let recipe = repo.create(RecipeInput {
            name: "Sopa".into(),
            category: "Entrada".into(),
            portions: 2,
            instructions: "Ferver".into(),
            ingredients: vec![],
        }).await.unwrap();
        let updated = repo.update(recipe.id as i64, RecipeInput {
            name: "Sopa de legumes".into(),
            category: "Entrada".into(),
            portions: 4,
            instructions: "Ferver tudo".into(),
            ingredients: vec![],
        }).await.unwrap();
        assert_eq!(updated.name, "Sopa de legumes");
        repo.delete(recipe.id as i64).await.unwrap();
        let list = repo.list().await.unwrap();
        assert!(list.is_empty());
    }

    #[tokio::test]
    async fn delete_not_found() {
        let (repo, _ing_repo) = test_repo().await;
        let result = repo.delete(999).await;
        assert!(result.is_err());
    }
}