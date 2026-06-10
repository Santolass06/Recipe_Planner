use crate::{IngredientInput, RepoError, RepoResult};
use async_trait::async_trait;
use libsql::Connection;
use mise_core::{Ingredient, Unit};

pub struct SqliteIngredientRepo {
    pub conn: Connection,
}

fn parse_unit(s: &str) -> Unit {
    match s {
        "kilogram"    => Unit::Kilogram,
        "liter"       => Unit::Liter,
        "milliliter"  => Unit::Milliliter,
        "piece"       => Unit::Piece,
        _             => Unit::Gram,
    }
}

fn unit_str(u: Unit) -> &'static str {
    match u {
        Unit::Gram       => "gram",
        Unit::Kilogram   => "kilogram",
        Unit::Liter      => "liter",
        Unit::Milliliter => "milliliter",
        Unit::Piece      => "piece",
    }
}

#[async_trait]
impl crate::IngredientRepo for SqliteIngredientRepo {
    async fn list(&self) -> RepoResult<Vec<Ingredient>> {
        let mut rows = self.conn
            .query("SELECT id, name, unit, price_per_unit
                    FROM ingredients ORDER BY name", ())
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        let mut result = Vec::new();
        while let Some(row) = rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            result.push(Ingredient {
                id:             row.get(0).map_err(|e| RepoError::Storage(e.to_string()))?,
                name:           row.get(1).map_err(|e| RepoError::Storage(e.to_string()))?,
                unit:           parse_unit(&row.get::<String>(2)
                                    .map_err(|e| RepoError::Storage(e.to_string()))?),
                price_per_unit: row.get(3).map_err(|e| RepoError::Storage(e.to_string()))?,
            });
        }
        Ok(result)
    }

    async fn get(&self, id: i64) -> RepoResult<Ingredient> {
        let mut rows = self.conn
            .query("SELECT id, name, unit, price_per_unit
                    FROM ingredients WHERE id = ?1", [id])
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        match rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            None => Err(RepoError::NotFound),
            Some(row) => Ok(Ingredient {
                id:             row.get(0).map_err(|e| RepoError::Storage(e.to_string()))?,
                name:           row.get(1).map_err(|e| RepoError::Storage(e.to_string()))?,
                unit:           parse_unit(&row.get::<String>(2)
                                    .map_err(|e| RepoError::Storage(e.to_string()))?),
                price_per_unit: row.get(3).map_err(|e| RepoError::Storage(e.to_string()))?,
            }),
        }
    }

    async fn create(&self, input: IngredientInput) -> RepoResult<Ingredient> {
        self.conn.execute(
            "INSERT INTO ingredients (name, unit, price_per_unit)
             VALUES (?1, ?2, ?3)",
            libsql::params![
                input.name.clone(),
                unit_str(input.unit),
                input.price_per_unit
            ],
        ).await.map_err(|e| RepoError::Storage(e.to_string()))?;

        let mut rows = self.conn
            .query("SELECT id, name, unit, price_per_unit
                    FROM ingredients WHERE id = last_insert_rowid()", ())
            .await
            .map_err(|e| RepoError::Storage(e.to_string()))?;
        match rows.next().await
            .map_err(|e| RepoError::Storage(e.to_string()))? {
            None => Err(RepoError::Storage("insert falhou".into())),
            Some(row) => Ok(Ingredient {
                id:             row.get(0).map_err(|e| RepoError::Storage(e.to_string()))?,
                name:           row.get(1).map_err(|e| RepoError::Storage(e.to_string()))?,
                unit:           parse_unit(&row.get::<String>(2)
                                    .map_err(|e| RepoError::Storage(e.to_string()))?),
                price_per_unit: row.get(3).map_err(|e| RepoError::Storage(e.to_string()))?,
            }),
        }
    }

    async fn update(&self, id: i64, input: IngredientInput) -> RepoResult<Ingredient> {
        let affected = self.conn.execute(
            "UPDATE ingredients
             SET name = ?1, unit = ?2, price_per_unit = ?3
             WHERE id = ?4",
            libsql::params![
                input.name.clone(),
                unit_str(input.unit),
                input.price_per_unit,
                id
            ],
        ).await.map_err(|e| RepoError::Storage(e.to_string()))?;
        if affected == 0 { return Err(RepoError::NotFound); }
        self.get(id).await
    }

    async fn delete(&self, id: i64) -> RepoResult<()> {
        let affected = self.conn.execute(
            "DELETE FROM ingredients WHERE id = ?1", [id],
        ).await.map_err(|e| RepoError::Storage(e.to_string()))?;
        if affected == 0 { return Err(RepoError::NotFound); }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{db::open_local, IngredientRepo, IngredientInput};
    use mise_core::Unit;

    async fn test_repo() -> SqliteIngredientRepo {
        let conn = open_local(":memory:").await.unwrap();
        SqliteIngredientRepo { conn }
    }

    #[tokio::test]
    async fn create_and_list() {
        let repo = test_repo().await;
        let ing = repo.create(IngredientInput {
            name: "arroz".into(),
            unit: Unit::Kilogram,
            price_per_unit: 2.0,
        }).await.unwrap();
        assert_eq!(ing.name, "arroz");
        let list = repo.list().await.unwrap();
        assert_eq!(list.len(), 1);
    }

    #[tokio::test]
    async fn update_and_delete() {
        let repo = test_repo().await;
        let ing = repo.create(IngredientInput {
            name: "sal".into(),
            unit: Unit::Gram,
            price_per_unit: 0.5,
        }).await.unwrap();
        let updated = repo.update(ing.id, IngredientInput {
            name: "sal fino".into(),
            unit: Unit::Gram,
            price_per_unit: 0.8,
        }).await.unwrap();
        assert_eq!(updated.name, "sal fino");
        repo.delete(ing.id).await.unwrap();
        let list = repo.list().await.unwrap();
        assert!(list.is_empty());
    }

    #[tokio::test]
    async fn delete_not_found() {
        let repo = test_repo().await;
        let result = repo.delete(999).await;
        assert!(result.is_err());
    }
}