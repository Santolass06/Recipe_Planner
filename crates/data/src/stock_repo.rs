use crate::{RepoError, RepoResult, StockInput, StockItem};
use async_trait::async_trait;
use libsql::Connection;
use mise_core::Unit;

pub struct SqliteStockRepo {
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

#[async_trait]
impl crate::StockRepo for SqliteStockRepo {
    async fn list(&self) -> RepoResult<Vec<StockItem>> {
        let mut rows = self.conn
            .query(
                "SELECT s.id, s.ingredient_id, i.name, i.unit, s.quantity, s.min_quantity
                 FROM stock s
                 JOIN ingredients i ON i.id = s.ingredient_id
                 ORDER BY i.name",
                (),
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        let mut result = Vec::new();
        while let Some(row) = rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            let ingredient_id: i64 = row.get(1).map_err(|e| RepoError::Storage(e.to_string()))?;
            let ingredient_name: String = row.get(2).map_err(|e| RepoError::Storage(e.to_string()))?;
            let unit_str: String = row.get(3).map_err(|e| RepoError::Storage(e.to_string()))?;
            result.push(StockItem {
                id:             row.get(0).map_err(|e| RepoError::Storage(e.to_string()))?,
                ingredient_id,
                ingredient_name,
                ingredient_unit: parse_unit(&unit_str),
                quantity:       row.get(4).map_err(|e| RepoError::Storage(e.to_string()))?,
                min_quantity:   row.get(5).map_err(|e| RepoError::Storage(e.to_string()))?,
            });
        }
        Ok(result)
    }

    async fn get(&self, ingredient_id: i64) -> RepoResult<StockItem> {
        let mut rows = self.conn
            .query(
                "SELECT s.id, s.ingredient_id, i.name, i.unit, s.quantity, s.min_quantity
                 FROM stock s
                 JOIN ingredients i ON i.id = s.ingredient_id
                 WHERE s.ingredient_id = ?1",
                [ingredient_id],
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        match rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            None => Err(RepoError::NotFound),
            Some(row) => {
                let ingredient_id: i64 = row.get(1).map_err(|e| RepoError::Storage(e.to_string()))?;
                let ingredient_name: String = row.get(2).map_err(|e| RepoError::Storage(e.to_string()))?;
                let unit_str: String = row.get(3).map_err(|e| RepoError::Storage(e.to_string()))?;
                Ok(StockItem {
                    id:             row.get(0).map_err(|e| RepoError::Storage(e.to_string()))?,
                    ingredient_id,
                    ingredient_name,
                    ingredient_unit: parse_unit(&unit_str),
                    quantity:       row.get(4).map_err(|e| RepoError::Storage(e.to_string()))?,
                    min_quantity:   row.get(5).map_err(|e| RepoError::Storage(e.to_string()))?,
                })
            },
        }
    }

    async fn upsert(&self, input: StockInput) -> RepoResult<StockItem> {
        let ingredient_id = input.ingredient_id as i64;
        
        let existing = self.conn
            .query("SELECT id FROM stock WHERE ingredient_id = ?1", [ingredient_id])
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?
            .next()
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;

        if existing.is_some() {
            self.conn
                .execute(
                    "UPDATE stock SET quantity = ?1, min_quantity = ?2, updated_at = datetime('now')
                     WHERE ingredient_id = ?3",
                    libsql::params![input.quantity, input.min_quantity, ingredient_id],
                )
                .await
                .map_err(|e| RepoError::Storage(e.to_string()))?;
        } else {
            self.conn
                .execute(
                    "INSERT INTO stock (ingredient_id, quantity, min_quantity)
                     VALUES (?1, ?2, ?3)",
                    libsql::params![ingredient_id, input.quantity, input.min_quantity],
                )
                .await
                .map_err(|e| RepoError::Storage(e.to_string()))?;
        }
        self.get(ingredient_id).await
    }

    async fn update_quantity(&self, ingredient_id: i64, quantity: f64) -> RepoResult<StockItem> {
        let affected = self.conn
            .execute(
                "UPDATE stock SET quantity = ?1, updated_at = datetime('now')
                 WHERE ingredient_id = ?2",
                libsql::params![quantity, ingredient_id],
            )
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        if affected == 0 {
            return Err(RepoError::NotFound);
        }
        self.get(ingredient_id).await
    }

    async fn delete(&self, ingredient_id: i64) -> RepoResult<()> {
        let affected = self.conn
            .execute("DELETE FROM stock WHERE ingredient_id = ?1", [ingredient_id])
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        if affected == 0 { return Err(RepoError::NotFound); }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{db::open_local, ingredient_repo::SqliteIngredientRepo, IngredientInput, IngredientRepo, StockRepo, StockInput};
    use mise_core::Unit;

    async fn test_repo() -> (SqliteStockRepo, SqliteIngredientRepo) {
        let conn = open_local(":memory:").await.unwrap();
        (SqliteStockRepo { conn: conn.clone() }, SqliteIngredientRepo { conn })
    }

    #[tokio::test]
    async fn create_and_list() {
        let (repo, ing_repo) = test_repo().await;
        let ing = ing_repo.create(IngredientInput {
            name: "Arroz".into(),
            unit: Unit::Kilogram,
            price_per_unit: 2.0,
        }).await.unwrap();
        let item = repo.upsert(StockInput {
            ingredient_id: ing.id as u64,
            quantity: 10.0,
            min_quantity: 2.0,
        }).await.unwrap();
        assert_eq!(item.quantity, 10.0);
        assert_eq!(item.min_quantity, 2.0);
        let list = repo.list().await.unwrap();
        assert_eq!(list.len(), 1);
    }

    #[tokio::test]
    async fn update_quantity() {
        let (repo, ing_repo) = test_repo().await;
        let ing = ing_repo.create(IngredientInput {
            name: "Arroz".into(),
            unit: Unit::Kilogram,
            price_per_unit: 2.0,
        }).await.unwrap();
        repo.upsert(StockInput {
            ingredient_id: ing.id as u64,
            quantity: 10.0,
            min_quantity: 2.0,
        }).await.unwrap();
        let updated = repo.update_quantity(ing.id, 5.0).await.unwrap();
        assert_eq!(updated.quantity, 5.0);
    }

    #[tokio::test]
    async fn delete_not_found() {
        let (repo, _ing_repo) = test_repo().await;
        let result = repo.delete(999).await;
        assert!(result.is_err());
    }
}