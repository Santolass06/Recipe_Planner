use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Unit {
    Gram, Kilogram, Milligram, Ounce, Pound,
    Milliliter, Liter, FluidOunce, Cup, Pint, Quart, Gallon,
    Teaspoon, Tablespoon,
    Piece, Dozen, Pinch, Bunch, Clove, Slice,
    Centimeter, Celsius, Fahrenheit,
}

impl Unit {
    pub fn group(self) -> UnitGroup {
        match self {
            Unit::Gram | Unit::Kilogram | Unit::Milligram
            | Unit::Ounce | Unit::Pound | Unit::Pinch
            | Unit::Bunch | Unit::Clove | Unit::Slice
                => UnitGroup::Weight,
            Unit::Milliliter | Unit::Liter | Unit::FluidOunce
            | Unit::Cup | Unit::Pint | Unit::Quart | Unit::Gallon
            | Unit::Teaspoon | Unit::Tablespoon
                => UnitGroup::Volume,
            Unit::Piece | Unit::Dozen => UnitGroup::Count,
            Unit::Centimeter => UnitGroup::Length,
            Unit::Celsius | Unit::Fahrenheit => UnitGroup::Temperature,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Unit::Gram => "g", Unit::Kilogram => "kg",
            Unit::Milligram => "mg", Unit::Ounce => "oz",
            Unit::Pound => "lb", Unit::Milliliter => "ml",
            Unit::Liter => "l", Unit::FluidOunce => "fl oz",
            Unit::Cup => "cup", Unit::Pint => "pt",
            Unit::Quart => "qt", Unit::Gallon => "gal",
            Unit::Teaspoon => "tsp", Unit::Tablespoon => "tbsp",
            Unit::Piece => "pcs", Unit::Dozen => "dz",
            Unit::Pinch => "pitada", Unit::Bunch => "molho",
            Unit::Clove => "dente", Unit::Slice => "fatia",
            Unit::Centimeter => "cm", Unit::Celsius => "°C",
            Unit::Fahrenheit => "°F",
        }
    }

    pub fn name_pt(self) -> &'static str {
        match self {
            Unit::Gram => "Grama", Unit::Kilogram => "Quilograma",
            Unit::Milligram => "Miligrama", Unit::Ounce => "Onça",
            Unit::Pound => "Libra", Unit::Milliliter => "Mililitro",
            Unit::Liter => "Litro", Unit::FluidOunce => "Fluid Ounce",
            Unit::Cup => "Chávena", Unit::Pint => "Pint",
            Unit::Quart => "Quart", Unit::Gallon => "Galão",
            Unit::Teaspoon => "Colher de chá",
            Unit::Tablespoon => "Colher de sopa",
            Unit::Piece => "Peça", Unit::Dozen => "Dúzia",
            Unit::Pinch => "Pitada", Unit::Bunch => "Molho",
            Unit::Clove => "Dente", Unit::Slice => "Fatia",
            Unit::Centimeter => "Centímetro",
            Unit::Celsius => "Celsius",
            Unit::Fahrenheit => "Fahrenheit",
        }
    }

    pub fn all() -> &'static [Unit] {
        &[
            Unit::Gram, Unit::Kilogram, Unit::Milligram,
            Unit::Ounce, Unit::Pound,
            Unit::Milliliter, Unit::Liter, Unit::FluidOunce,
            Unit::Cup, Unit::Pint, Unit::Quart, Unit::Gallon,
            Unit::Teaspoon, Unit::Tablespoon,
            Unit::Piece, Unit::Dozen, Unit::Pinch,
            Unit::Bunch, Unit::Clove, Unit::Slice,
            Unit::Centimeter, Unit::Celsius, Unit::Fahrenheit,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnitGroup {
    Weight, Volume, Count, Length, Temperature,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ingredient {
    pub id: i64,
    pub name: String,
    pub unit: Unit,
    pub price_per_unit: f64,
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

pub mod converter;
pub use converter::{convert, compatible_units, ConversionResult};

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
            if let Some(ing) = ingredients.iter().find(|i| i.id == recipe_ing.ingredient_id as i64) {
                let cost = recipe_ing.quantity * ing.price_per_unit;
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
            unit: Unit::Gram,
            price_per_unit: 0.01,
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
                unit: Unit::Gram,
            }],
            portions: 2,
            instructions: "Test".to_string(),
        };

        let ingredients = vec![Ingredient {
            id: 1,
            name: "Flour".to_string(),
            unit: Unit::Gram,
            price_per_unit: 0.01,
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
                    unit: Unit::Gram,
                },
                RecipeIngredient {
                    ingredient_id: 2,
                    ingredient_name: "Butter".to_string(),
                    quantity: 100.0,
                    unit: Unit::Gram,
                },
            ],
            portions: 1,
            instructions: "Test".to_string(),
        };

        let ingredients = vec![
            Ingredient {
                id: 1,
                name: "Flour".to_string(),
                unit: Unit::Gram,
                price_per_unit: 0.01,
            },
            Ingredient {
                id: 2,
                name: "Butter".to_string(),
                unit: Unit::Gram,
                price_per_unit: 0.02,
            },
        ];

        let breakdown = cost::calculate_recipe_cost(&recipe, &ingredients);
        assert_eq!(breakdown.total_cost, 4.0);
    }
}
