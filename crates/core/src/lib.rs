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

pub mod i18n {
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;
    use std::sync::{Arc, RwLock};

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "lowercase")]
    pub enum Language {
        Pt,
        En,
    }

    impl Language {
        pub fn as_str(&self) -> &'static str {
            match self {
                Language::Pt => "pt",
                Language::En => "en",
            }
        }

        pub fn from_str(s: &str) -> Self {
            match s.to_lowercase().as_str() {
                "pt" | "pt-br" | "portuguese" => Language::Pt,
                _ => Language::En,
            }
        }

        pub fn toggle(&self) -> Self {
            match self {
                Language::Pt => Language::En,
                Language::En => Language::Pt,
            }
        }
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Translations {
        pub pt: HashMap<String, String>,
        pub en: HashMap<String, String>,
    }

    impl Translations {
        pub fn new() -> Self {
            let mut pt = HashMap::new();
            let mut en = HashMap::new();

            // UI strings - navigation
            pt.insert("nav.ingredients".into(), "Ingredientes".into());
            en.insert("nav.ingredients".into(), "Ingredients".into());
            pt.insert("nav.recipes".into(), "Receitas".into());
            en.insert("nav.recipes".into(), "Recipes".into());
            pt.insert("nav.costs".into(), "Custos".into());
            en.insert("nav.costs".into(), "Costs".into());
            pt.insert("nav.stock".into(), "Armazém".into());
            en.insert("nav.stock".into(), "Warehouse".into());
            pt.insert("nav.shopping".into(), "Lista de Compras".into());
            en.insert("nav.shopping".into(), "Shopping List".into());
            pt.insert("nav.suggester".into(), "Sugestor".into());
            en.insert("nav.suggester".into(), "Suggester".into());
            pt.insert("nav.settings".into(), "Definições".into());
            en.insert("nav.settings".into(), "Settings".into());
            pt.insert("nav.reports".into(), "Relatórios".into());
            en.insert("nav.reports".into(), "Reports".into());
            pt.insert("nav.suppliers".into(), "Fornecedores".into());
            en.insert("nav.suppliers".into(), "Suppliers".into());
            pt.insert("nav.calendar".into(), "Calendário".into());
            en.insert("nav.calendar".into(), "Calendar".into());
            pt.insert("nav.importer".into(), "Importador".into());
            en.insert("nav.importer".into(), "Importer".into());
            pt.insert("nav.help".into(), "Ajuda".into());
            en.insert("nav.help".into(), "Help".into());

            // Common actions
            pt.insert("action.new".into(), "Novo".into());
            en.insert("action.new".into(), "New".into());
            pt.insert("action.edit".into(), "Editar".into());
            en.insert("action.edit".into(), "Edit".into());
            pt.insert("action.delete".into(), "Eliminar".into());
            en.insert("action.delete".into(), "Delete".into());
            pt.insert("action.save".into(), "Guardar".into());
            en.insert("action.save".into(), "Save".into());
            pt.insert("action.cancel".into(), "Cancelar".into());
            en.insert("action.cancel".into(), "Cancel".into());
            pt.insert("action.search".into(), "Pesquisar".into());
            en.insert("action.search".into(), "Search".into());
            pt.insert("action.add".into(), "Adicionar".into());
            en.insert("action.add".into(), "Add".into());
            pt.insert("action.clear".into(), "Limpar".into());
            en.insert("action.clear".into(), "Clear".into());
            pt.insert("action.refresh".into(), "Actualizar".into());
            en.insert("action.refresh".into(), "Refresh".into());

            // Ingredients page
            pt.insert("ingredients.title".into(), "Ingredientes".into());
            en.insert("ingredients.title".into(), "Ingredients".into());
            pt.insert("ingredients.subtitle".into(), "ingredientes".into());
            en.insert("ingredients.subtitle".into(), "ingredients".into());
            pt.insert("ingredients.new".into(), "Novo ingrediente".into());
            en.insert("ingredients.new".into(), "New ingredient".into());
            pt.insert("ingredients.name".into(), "Nome".into());
            en.insert("ingredients.name".into(), "Name".into());
            pt.insert("ingredients.unit".into(), "Unidade".into());
            en.insert("ingredients.unit".into(), "Unit".into());
            pt.insert("ingredients.price".into(), "Preço por unidade".into());
            en.insert("ingredients.price".into(), "Price per unit".into());

            // Recipes page
            pt.insert("recipes.title".into(), "Receitas".into());
            en.insert("recipes.title".into(), "Recipes".into());
            pt.insert("recipes.new".into(), "Nova receita".into());
            en.insert("recipes.new".into(), "New recipe".into());
            pt.insert("recipes.category".into(), "Categoria".into());
            en.insert("recipes.category".into(), "Category".into());
            pt.insert("recipes.portions".into(), "Porções".into());
            en.insert("recipes.portions".into(), "Portions".into());
            pt.insert("recipes.instructions".into(), "Instruções".into());
            en.insert("recipes.instructions".into(), "Instructions".into());
            pt.insert("recipes.add_ingredient".into(), "Adicionar ingrediente".into());
            en.insert("recipes.add_ingredient".into(), "Add ingredient".into());

            // Costs page
            pt.insert("costs.title".into(), "Custos".into());
            en.insert("costs.title".into(), "Costs".into());
            pt.insert("costs.select_recipe".into(), "Selecionar receita".into());
            en.insert("costs.select_recipe".into(), "Select recipe".into());
            pt.insert("costs.margin".into(), "Margem %".into());
            en.insert("costs.margin".into(), "Margin %".into());
            pt.insert("costs.portions".into(), "Porções".into());
            en.insert("costs.portions".into(), "Portions".into());
            pt.insert("costs.promo_prices".into(), "Preços promocionais".into());
            en.insert("costs.promo_prices".into(), "Promo prices".into());
            pt.insert("costs.total".into(), "Total".into());
            en.insert("costs.total".into(), "Total".into());
            pt.insert("costs.per_portion".into(), "Por porção".into());
            en.insert("costs.per_portion".into(), "Per portion".into());
            pt.insert("costs.suggested_price".into(), "Preço sugerido".into());
            en.insert("costs.suggested_price".into(), "Suggested price".into());
            pt.insert("costs.profit".into(), "Lucro".into());
            en.insert("costs.profit".into(), "Profit".into());

            // Stock page
            pt.insert("stock.title".into(), "Armazém".into());
            en.insert("stock.title".into(), "Warehouse".into());
            pt.insert("stock.current_qty".into(), "Qtd Actual".into());
            en.insert("stock.current_qty".into(), "Current Qty".into());
            pt.insert("stock.min_qty".into(), "Mínimo".into());
            en.insert("stock.min_qty".into(), "Minimum".into());
            pt.insert("stock.status".into(), "Estado".into());
            en.insert("stock.status".into(), "Status".into());
            pt.insert("stock.ok".into(), "OK".into());
            en.insert("stock.ok".into(), "OK".into());
            pt.insert("stock.low".into(), "Baixo".into());
            en.insert("stock.low".into(), "Low".into());
            pt.insert("stock.out".into(), "Esgotado".into());
            en.insert("stock.out".into(), "Out".into());
            pt.insert("stock.partial".into(), "Parcial".into());
            en.insert("stock.partial".into(), "Partial".into());

            // Shopping list page
            pt.insert("shopping.title".into(), "Lista de Compras".into());
            en.insert("shopping.title".into(), "Shopping List".into());
            pt.insert("shopping.new".into(), "Nova lista".into());
            en.insert("shopping.new".into(), "New list".into());
            pt.insert("shopping.estimated".into(), "estimado".into());
            en.insert("shopping.estimated".into(), "estimated".into());
            pt.insert("shopping.purchased".into(), "Comprado".into());
            en.insert("shopping.purchased".into(), "Purchased".into());
            pt.insert("shopping.missing".into(), "Faltando".into());
            en.insert("shopping.missing".into(), "Missing".into());
            pt.insert("shopping.select_recipes".into(), "Selecionar receitas".into());
            en.insert("shopping.select_recipes".into(), "Select recipes".into());
            pt.insert("shopping.multiplier".into(), "Multiplicador de porções".into());
            en.insert("shopping.multiplier".into(), "Portions multiplier".into());

            // Suggester page
            pt.insert("suggester.title".into(), "Sugestor de Receitas".into());
            en.insert("suggester.title".into(), "Recipe Suggester".into());
            pt.insert("suggester.allow_partial".into(), "Incluir parciais".into());
            en.insert("suggester.allow_partial".into(), "Include partial".into());
            pt.insert("suggester.can_make".into(), "Pode fazer".into());
            en.insert("suggester.can_make".into(), "Can make".into());
            pt.insert("suggester.partial".into(), "Parcial".into());
            en.insert("suggester.partial".into(), "Partial".into());
            pt.insert("suggester.missing".into(), "Faltando".into());
            en.insert("suggester.missing".into(), "Missing".into());

            // Settings page
            pt.insert("settings.title".into(), "Definições".into());
            en.insert("settings.title".into(), "Settings".into());
            pt.insert("settings.language".into(), "Idioma".into());
            en.insert("settings.language".into(), "Language".into());
            pt.insert("settings.theme".into(), "Tema".into());
            en.insert("settings.theme".into(), "Theme".into());
            pt.insert("settings.data".into(), "Dados".into());
            en.insert("settings.data".into(), "Data".into());
            pt.insert("settings.export".into(), "Exportar".into());
            en.insert("settings.export".into(), "Export".into());
            pt.insert("settings.import".into(), "Importar".into());
            en.insert("settings.import".into(), "Import".into());
            pt.insert("settings.reset".into(), "Repor".into());
            en.insert("settings.reset".into(), "Reset".into());

            // Units
            pt.insert("unit.gram".into(), "g — Grama".into());
            en.insert("unit.gram".into(), "g — Gram".into());
            pt.insert("unit.kilogram".into(), "kg — Quilograma".into());
            en.insert("unit.kilogram".into(), "kg — Kilogram".into());
            pt.insert("unit.milliliter".into(), "ml — Mililitro".into());
            en.insert("unit.milliliter".into(), "ml — Milliliter".into());
            pt.insert("unit.liter".into(), "l — Litro".into());
            en.insert("unit.liter".into(), "l — Liter".into());
            pt.insert("unit.piece".into(), "pcs — Peça".into());
            en.insert("unit.piece".into(), "pcs — Piece".into());
            pt.insert("unit.teaspoon".into(), "tsp — Colher de chá".into());
            en.insert("unit.teaspoon".into(), "tsp — Teaspoon".into());
            pt.insert("unit.tablespoon".into(), "tbsp — Colher de sopa".into());
            en.insert("unit.tablespoon".into(), "tbsp — Tablespoon".into());

            // Status/Toast messages
            pt.insert("toast.created".into(), "Criado com sucesso".into());
            en.insert("toast.created".into(), "Created successfully".into());
            pt.insert("toast.updated".into(), "Actualizado com sucesso".into());
            en.insert("toast.updated".into(), "Updated successfully".into());
            pt.insert("toast.deleted".into(), "Eliminado com sucesso".into());
            en.insert("toast.deleted".into(), "Deleted successfully".into());
            pt.insert("toast.error".into(), "Erro".into());
            en.insert("toast.error".into(), "Error".into());
            pt.insert("toast.warning".into(), "Atenção".into());
            en.insert("toast.warning".into(), "Warning".into());
            pt.insert("toast.info".into(), "Informação".into());
            en.insert("toast.info".into(), "Info".into());

            // Confirm dialogs
            pt.insert("confirm.delete".into(), "Tem a certeza que quer eliminar?".into());
            en.insert("confirm.delete".into(), "Are you sure you want to delete?".into());
            pt.insert("confirm.reset".into(), "Tem a certeza que quer repor? Esta ação não pode ser desfeita.".into());
            en.insert("confirm.reset".into(), "Are you sure you want to reset? This action cannot be undone.".into());

            Self { pt, en }
        }
    }

    lazy_static::lazy_static! {
        static ref TRANSLATIONS: Arc<RwLock<Translations>> = Arc::new(RwLock::new(Translations::new()));
        static ref CURRENT_LANG: Arc<RwLock<Language>> = Arc::new(RwLock::new(Language::Pt));
    }

    pub fn t(key: &str) -> String {
        let lang = CURRENT_LANG.read().unwrap().clone();
        let trans = TRANSLATIONS.read().unwrap();
        let map = match lang {
            Language::Pt => &trans.pt,
            Language::En => &trans.en,
        };
        map.get(key).cloned().unwrap_or_else(|| key.into())
    }

    pub fn current_language() -> Language {
        CURRENT_LANG.read().unwrap().clone()
    }

    pub fn set_language(lang: Language) {
        *CURRENT_LANG.write().unwrap() = lang;
    }

    pub fn toggle_language() {
        let mut lang = CURRENT_LANG.write().unwrap();
        *lang = lang.toggle();
    }
}

#[cfg(test)]
mod i18n_tests {
    use crate::i18n::{Language, Translations};

    #[test]
    fn test_language_toggle() {
        let pt = Language::Pt;
        let en = Language::En;
        assert_eq!(pt.toggle(), en);
        assert_eq!(en.toggle(), pt);
    }

    #[test]
    fn test_language_from_str() {
        assert_eq!(Language::from_str("pt"), Language::Pt);
        assert_eq!(Language::from_str("en"), Language::En);
        assert_eq!(Language::from_str("PT"), Language::Pt);
        assert_eq!(Language::from_str("EN"), Language::En);
        assert_eq!(Language::from_str("portuguese"), Language::Pt);
        assert_eq!(Language::from_str("english"), Language::En);
        assert_eq!(Language::from_str("unknown"), Language::En);
    }

    #[test]
    fn test_translations() {
        let t = Translations::new();
        assert!(t.pt.contains_key("nav.ingredients"));
        assert!(t.en.contains_key("nav.ingredients"));
        assert_eq!(t.pt.get("nav.ingredients"), Some(&"Ingredientes".to_string()));
        assert_eq!(t.en.get("nav.ingredients"), Some(&"Ingredients".to_string()));
    }
}