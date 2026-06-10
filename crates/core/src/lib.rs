use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Unit {
    Grams,
    Milliliters,
    Pieces,
    Tablespoons,
    Teaspoons,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ingredient {
    pub id: u64,
    pub name: String,
    pub quantity: f64,
    pub unit: Unit,
    pub cost_per_unit: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeIngredient {
    pub ingredient_id: u64,
    pub ingredient_name: String,
    pub quantity: f64,
    pub unit: Unit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: u64,
    pub name: String,
    pub ingredients: Vec<RecipeIngredient>,
    pub portions: u32,
    pub instructions: String,
}

pub mod cost {
    use super::*;

    pub struct CostBreakdown {
        pub total_cost: f64,
        pub cost_per_portion: f64,
        pub ingredient_costs: Vec<(String, f64)>,
    }

    pub fn calculate_recipe_cost(
        recipe: &Recipe,
        ingredients: &[Ingredient],
    ) -> CostBreakdown {
        let mut total_cost = 0.0;
        let mut ingredient_costs = Vec::new();

        for recipe_ing in &recipe.ingredients {
            if let Some(ing) = ingredients.iter().find(|i| i.id == recipe_ing.ingredient_id) {
                let cost = recipe_ing.quantity * ing.cost_per_unit;
                total_cost += cost;
                ingredient_costs.push((recipe_ing.ingredient_name.clone(), cost));
            }
        }

        CostBreakdown {
            total_cost,
            cost_per_portion: total_cost / recipe.portions as f64,
            ingredient_costs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ingredient_creation() {
        let ing = Ingredient {
            id: 1,
            name: "Flour".to_string(),
            quantity: 1000.0,
            unit: Unit::Grams,
            cost_per_unit: 0.01,
        };
        assert_eq!(ing.name, "Flour");
    }

    #[test]
    fn test_recipe_creation() {
        let recipe = Recipe {
            id: 1,
            name: "Bread".to_string(),
            ingredients: vec![],
            portions: 4,
            instructions: "Mix and bake".to_string(),
        };
        assert_eq!(recipe.portions, 4);
    }

    #[test]
    fn test_cost_calculation_simple() {
        let recipe = Recipe {
            id: 1,
            name: "Test Recipe".to_string(),
            ingredients: vec![RecipeIngredient {
                ingredient_id: 1,
                ingredient_name: "Flour".to_string(),
                quantity: 500.0,
                unit: Unit::Grams,
            }],
            portions: 2,
            instructions: "Test".to_string(),
        };

        let ingredients = vec![Ingredient {
            id: 1,
            name: "Flour".to_string(),
            quantity: 1000.0,
            unit: Unit::Grams,
            cost_per_unit: 0.01,
        }];

        let breakdown = cost::calculate_recipe_cost(&recipe, &ingredients);
        assert_eq!(breakdown.total_cost, 5.0);
        assert_eq!(breakdown.cost_per_portion, 2.5);
    }

    #[test]
    fn test_recipe_multiple_ingredients() {
        let recipe = Recipe {
            id: 1,
            name: "Multi Ingredient".to_string(),
            ingredients: vec![
                RecipeIngredient {
                    ingredient_id: 1,
                    ingredient_name: "Flour".to_string(),
                    quantity: 200.0,
                    unit: Unit::Grams,
                },
                RecipeIngredient {
                    ingredient_id: 2,
                    ingredient_name: "Butter".to_string(),
                    quantity: 100.0,
                    unit: Unit::Grams,
                },
            ],
            portions: 1,
            instructions: "Test".to_string(),
        };

        let ingredients = vec![
            Ingredient {
                id: 1,
                name: "Flour".to_string(),
                quantity: 1000.0,
                unit: Unit::Grams,
                cost_per_unit: 0.01,
            },
            Ingredient {
                id: 2,
                name: "Butter".to_string(),
                quantity: 250.0,
                unit: Unit::Grams,
                cost_per_unit: 0.02,
            },
        ];

        let breakdown = cost::calculate_recipe_cost(&recipe, &ingredients);
        assert_eq!(breakdown.total_cost, 4.0);
    }
}
