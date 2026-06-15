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
            Unit::Teaspoon => "Colher de chá", Unit::Tablespoon => "Colher de sopa",
            Unit::Piece => "Peça", Unit::Dozen => "Dúzia",
            Unit::Pinch => "Pitada", Unit::Bunch => "Molho",
            Unit::Clove => "Dente", Unit::Slice => "Fatia",
            Unit::Centimeter => "Centímetro", Unit::Celsius => "Celsius",
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
    pub category: String,
    pub portions: u32,
    pub instructions: String,
    pub ingredients: Vec<RecipeIngredient>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockItem {
    pub id: i64,
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
    pub quantity: f64,
    pub min_quantity: f64,
}

pub mod converter;
pub use converter::{compatible_units, convert, ConversionResult};

pub mod cost {
    use super::*;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct IngredientCost {
        pub name: String,
        pub quantity: f64,
        pub unit: Unit,
        pub price_per_unit: f64,
        pub total_cost: f64,
        pub promo_price_per_unit: Option<f64>,
        pub promo_total_cost: Option<f64>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CostBreakdown {
        pub total_cost: f64,
        pub cost_per_portion: f64,
        pub ingredient_costs: Vec<IngredientCost>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct CostAnalysis {
        pub breakdown: CostBreakdown,
        pub breakdown_with_promo: Option<CostBreakdown>,
        pub margin_percent: f64,
        pub suggested_price_per_portion: f64,
        pub suggested_price_total: f64,
        pub profit_per_portion: f64,
        pub profit_total: f64,
    }

    pub fn calculate_recipe_cost(
        recipe: &Recipe,
        ingredients: &[Ingredient],
        promo_prices: &[(u64, f64)],
    ) -> CostBreakdown {
        let mut total_cost = 0.0;
        let mut ingredient_costs = Vec::new();

        for recipe_ing in &recipe.ingredients {
            if let Some(ing) = ingredients
                .iter()
                .find(|i| i.id == recipe_ing.ingredient_id as i64)
            {
                let cost = recipe_ing.quantity * ing.price_per_unit;
                total_cost += cost;

                let promo_price = promo_prices
                    .iter()
                    .find(|(id, _)| *id == recipe_ing.ingredient_id)
                    .map(|(_, p)| *p);

                let promo_total = promo_price.map(|pp| recipe_ing.quantity * pp);

                ingredient_costs.push(IngredientCost {
                    name: recipe_ing.ingredient_name.clone(),
                    quantity: recipe_ing.quantity,
                    unit: recipe_ing.unit,
                    price_per_unit: ing.price_per_unit,
                    total_cost: cost,
                    promo_price_per_unit: promo_price,
                    promo_total_cost: promo_total,
                });
            }
        }

        CostBreakdown {
            total_cost,
            cost_per_portion: total_cost / recipe.portions as f64,
            ingredient_costs,
        }
    }

    pub fn analyze_recipe_cost(
        recipe: &Recipe,
        ingredients: &[Ingredient],
        promo_prices: &[(u64, f64)],
        margin_percent: f64,
    ) -> CostAnalysis {
        let breakdown = calculate_recipe_cost(recipe, ingredients, &[]);
        let breakdown_with_promo = if !promo_prices.is_empty() {
            Some(calculate_recipe_cost(recipe, ingredients, promo_prices))
        } else {
            None
        };

        let cost_per_portion = breakdown.cost_per_portion;
        let suggested_price_per_portion = cost_per_portion * (1.0 + margin_percent / 100.0);
        let suggested_price_total = suggested_price_per_portion * recipe.portions as f64;
        let profit_per_portion = suggested_price_per_portion - cost_per_portion;
        let profit_total = profit_per_portion * recipe.portions as f64;

        CostAnalysis {
            breakdown,
            breakdown_with_promo,
            margin_percent,
            suggested_price_per_portion,
            suggested_price_total,
            profit_per_portion,
            profit_total,
        }
    }
}

pub mod shopping {
    use super::*;
    use std::collections::HashMap;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ShoppingItem {
        pub ingredient_id: u64,
        pub ingredient_name: String,
        pub ingredient_unit: Unit,
        pub needed_quantity: f64,
        pub stock_quantity: f64,
        pub category: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
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
            let stock_qty = stock
                .iter()
                .find(|s| s.ingredient_id == ingredient_id as i64)
                .map(|s| s.quantity)
                .unwrap_or(0.0);

            if needed_qty > stock_qty {
                let to_buy = needed_qty - stock_qty;
                let (name, unit, category) = ingredient_info
                    .get(&ingredient_id)
                    .cloned()
                    .unwrap_or_else(|| ("Desconhecido".to_string(), Unit::Gram, String::new()));

                let price = ingredients
                    .iter()
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

        items.sort_by(|a, b| {
            a.category
                .cmp(&b.category)
                .then_with(|| a.ingredient_name.cmp(&b.ingredient_name))
        });

        ShoppingList {
            items,
            total_estimated_cost,
        }
    }
}

pub mod suggester {
    use super::*;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct SuggestedRecipe {
        pub recipe: Recipe,
        pub missing_ingredients: Vec<String>,
        pub can_make: bool,
    }

    pub fn suggest_recipes_by_stock(
        recipes: &[Recipe],
        stock: &[StockItem],
        ingredients: &[Ingredient],
        allow_partial: bool,
    ) -> Vec<SuggestedRecipe> {
        let mut results = Vec::new();

        for recipe in recipes {
            let mut missing = Vec::new();
            let mut can_make = true;

            for recipe_ing in &recipe.ingredients {
                let stock_item = stock
                    .iter()
                    .find(|s| s.ingredient_id == recipe_ing.ingredient_id as i64);
                let stock_qty = stock_item.map(|s| s.quantity).unwrap_or(0.0);

                if stock_qty < recipe_ing.quantity {
                    can_make = false;
                    let ing_name = ingredients
                        .iter()
                        .find(|i| i.id == recipe_ing.ingredient_id as i64)
                        .map(|i| i.name.clone())
                        .unwrap_or_else(|| recipe_ing.ingredient_name.clone());
                    missing.push(format!(
                        "{} (precisa: {}, tem: {})",
                        ing_name, recipe_ing.quantity, stock_qty
                    ));
                }
            }

            if can_make || (allow_partial && !missing.is_empty()) {
                results.push(SuggestedRecipe {
                    recipe: recipe.clone(),
                    missing_ingredients: missing,
                    can_make,
                });
            }
        }

        results.sort_by(|a, b| {
            b.can_make
                .cmp(&a.can_make)
                .then_with(|| {
                    a.missing_ingredients
                        .len()
                        .cmp(&b.missing_ingredients.len())
                })
                .then_with(|| a.recipe.name.cmp(&b.recipe.name))
        });

        results
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
            category: "Bakery".to_string(),
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
            category: "Test".to_string(),
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

        let breakdown = cost::calculate_recipe_cost(&recipe, &ingredients, &[]);
        assert_eq!(breakdown.total_cost, 5.0);
        assert_eq!(breakdown.cost_per_portion, 2.5);
    }

    #[test]
    fn test_recipe_multiple_ingredients() {
        let recipe = Recipe {
            id: 1,
            name: "Multi Ingredient".to_string(),
            category: "Test".to_string(),
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

        let breakdown = cost::calculate_recipe_cost(&recipe, &ingredients, &[]);
        assert_eq!(breakdown.total_cost, 4.0);
    }
}