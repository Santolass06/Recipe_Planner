//! Domain models with validation and type-safe serialization

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;
use ts_rs::TS;
use validator::Validate;

/// Unit of measurement
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "bindings/")]
pub enum Unit {
    Gram,
    Kilogram,
    Milligram,
    Ounce,
    Pound,
    Milliliter,
    Liter,
    FluidOunce,
    Cup,
    Pint,
    Quart,
    Gallon,
    Teaspoon,
    Tablespoon,
    Piece,
    Dozen,
    Pinch,
    Bunch,
    Clove,
    Slice,
}

impl Unit {
    pub fn group(self) -> UnitGroup {
        match self {
            Unit::Gram | Unit::Kilogram | Unit::Milligram | Unit::Ounce | Unit::Pound
            | Unit::Pinch | Unit::Bunch | Unit::Clove | Unit::Slice => UnitGroup::Weight,
            Unit::Milliliter | Unit::Liter | Unit::FluidOunce | Unit::Cup | Unit::Pint
            | Unit::Quart | Unit::Gallon | Unit::Teaspoon | Unit::Tablespoon => UnitGroup::Volume,
            Unit::Piece | Unit::Dozen => UnitGroup::Count,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Unit::Gram => "g", Unit::Kilogram => "kg", Unit::Milligram => "mg",
            Unit::Ounce => "oz", Unit::Pound => "lb",
            Unit::Milliliter => "ml", Unit::Liter => "l", Unit::FluidOunce => "fl oz",
            Unit::Cup => "cup", Unit::Pint => "pt", Unit::Quart => "qt", Unit::Gallon => "gal",
            Unit::Teaspoon => "tsp", Unit::Tablespoon => "tbsp",
            Unit::Piece => "pcs", Unit::Dozen => "dz",
            Unit::Pinch => "pitada", Unit::Bunch => "molho", Unit::Clove => "dente", Unit::Slice => "fatia",
        }
    }

    pub fn name_pt(self) -> &'static str {
        match self {
            Unit::Gram => "Grama", Unit::Kilogram => "Quilograma", Unit::Milligram => "Miligrama",
            Unit::Ounce => "Onça", Unit::Pound => "Libra",
            Unit::Milliliter => "Mililitro", Unit::Liter => "Litro", Unit::FluidOunce => "Fluid Ounce",
            Unit::Cup => "Chávena", Unit::Pint => "Pint", Unit::Quart => "Quart", Unit::Gallon => "Galão",
            Unit::Teaspoon => "Colher de chá", Unit::Tablespoon => "Colher de sopa",
            Unit::Piece => "Peça", Unit::Dozen => "Dúzia",
            Unit::Pinch => "Pitada", Unit::Bunch => "Molho", Unit::Clove => "Dente", Unit::Slice => "Fatia",
        }
    }

    pub fn all() -> &'static [Unit] {
        &[
            Unit::Gram, Unit::Kilogram, Unit::Milligram, Unit::Ounce, Unit::Pound,
            Unit::Milliliter, Unit::Liter, Unit::FluidOunce, Unit::Cup, Unit::Pint,
            Unit::Quart, Unit::Gallon, Unit::Teaspoon, Unit::Tablespoon,
            Unit::Piece, Unit::Dozen, Unit::Pinch, Unit::Bunch, Unit::Clove, Unit::Slice,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub enum UnitGroup { Weight, Volume, Count }

/// Recipe ingredient (input)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeIngredientInput {
    #[validate(range(min = 1))]
    pub ingredient_id: i64,
    pub quantity: f64,
    pub unit: Unit,
}

/// Recipe ingredient (stored, denormalized name for display)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeIngredient {
    pub id: i64,
    pub recipe_id: i64,
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub quantity: f64,
    pub unit: Unit,
}

/// Recipe input (create/update)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[validate(length(min = 1, max = 100))]
    pub category: String,
    #[validate(range(min = 1, max = 1000))]
    pub portions: u32,
    pub instructions: String,
    #[validate(length(min = 1))]
    pub ingredients: Vec<RecipeIngredientInput>,
    pub prep_time_minutes: Option<u32>,
    pub cook_time_minutes: Option<u32>,
    pub tags: Vec<String>,
    pub image_base64: Option<String>,
}

/// Recipe (stored)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Recipe {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub portions: u32,
    pub instructions: String,
    pub favorite: bool,
    pub prep_time_minutes: Option<u32>,
    pub cook_time_minutes: Option<u32>,
    pub tags: String, // JSON array
    pub image_path: Option<String>,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Recipe with nested ingredients (for API responses)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeWithIngredients {
    #[serde(flatten)]
    pub recipe: Recipe,
    pub ingredients: Vec<RecipeIngredient>,
}

/// Ingredient input
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct IngredientInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub unit: Unit,
    #[validate(range(min = 0.0))]
    pub price_per_unit: f64,
    pub category: Option<String>,
}

/// Ingredient (stored)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Ingredient {
    pub id: i64,
    pub name: String,
    pub unit: Unit,
    pub price_per_unit: f64,
    pub category_id: Option<i64>,
    pub favorite: bool,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Stock item input
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct StockInput {
    #[validate(range(min = 1))]
    pub ingredient_id: i64,
    #[validate(range(min = 0.0))]
    pub quantity: f64,
    #[validate(range(min = 0.0))]
    pub min_quantity: f64,
}

/// Stock item (stored, with denormalized name/unit)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct StockItem {
    pub id: i64,
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
    pub quantity: f64,
    pub min_quantity: f64,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Stock status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub enum StockStatus {
    Ok,
    Low,
    Out,
}

impl StockItem {
    pub fn status(&self) -> StockStatus {
        if self.quantity <= 0.0 { StockStatus::Out }
        else if self.quantity <= self.min_quantity { StockStatus::Low }
        else { StockStatus::Ok }
    }
}

/// Shopping list item
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ShoppingItem {
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
    pub needed_quantity: f64,
    pub stock_quantity: f64,
    pub to_buy_quantity: f64,
    pub category: String,
    pub estimated_cost: f64,
    pub purchased: bool,
}

/// Shopping list
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ShoppingList {
    pub id: Option<i64>,
    pub name: String,
    pub items: Vec<ShoppingItem>,
    pub total_estimated_cost: f64,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
}

/// Suggested recipe (from stock)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SuggestedRecipe {
    pub recipe: Recipe,
    pub missing_ingredients: Vec<MissingIngredient>,
    pub can_make: bool,
    pub match_percentage: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MissingIngredient {
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub needed: f64,
    pub available: f64,
    pub unit: Unit,
}

/// Cost breakdown
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct CostBreakdown {
    pub total_cost: f64,
    pub cost_per_portion: f64,
    pub ingredient_costs: Vec<IngredientCost>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct IngredientCost {
    pub name: String,
    pub quantity: f64,
    pub unit: Unit,
    pub price_per_unit: f64,
    pub total_cost: f64,
}

/// Price quote (for supplier prices)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct PriceQuoteInput {
    #[validate(range(min = 1))]
    pub ingredient_id: i64,
    #[validate(length(min = 1, max = 200))]
    pub supplier: String,
    #[validate(range(min = 0.0))]
    pub price_per_unit: f64,
    #[ts(type = "string")]
    pub valid_from: Option<DateTime<Utc>>,
    #[ts(type = "string")]
    pub valid_to: Option<DateTime<Utc>>,
    pub is_promo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct PriceQuote {
    pub id: i64,
    pub ingredient_id: i64,
    pub supplier: String,
    pub price_per_unit: f64,
    #[ts(type = "string")]
    pub valid_from: Option<DateTime<Utc>>,
    #[ts(type = "string")]
    pub valid_to: Option<DateTime<Utc>>,
    pub is_promo: bool,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
}

/// Import/Export formats
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ImportData {
    pub version: u32,
    pub ingredients: Vec<ImportIngredient>,
    pub recipes: Vec<ImportRecipe>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ImportIngredient {
    pub name: String,
    pub unit: Unit,
    pub price_per_unit: f64,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ImportRecipe {
    pub name: String,
    pub category: String,
    pub portions: u32,
    pub instructions: String,
    pub prep_time_minutes: Option<u32>,
    pub cook_time_minutes: Option<u32>,
    pub tags: Vec<String>,
    pub ingredients: Vec<ImportRecipeIngredient>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ImportRecipeIngredient {
    pub ingredient_name: String,
    pub quantity: f64,
    pub unit: Unit,
}

/// Import result
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ImportResult {
    pub ingredients_created: usize,
    pub ingredients_skipped: usize,
    pub recipes_created: usize,
    pub recipes_skipped: usize,
    pub errors: Vec<String>,
}

/// App settings (key-value)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Setting {
    pub key: String,
    pub value: String, // JSON
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Categories (for ingredients/recipes)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub kind: CategoryKind, // "ingredient" | "recipe"
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub enum CategoryKind { Ingredient, Recipe }

/// Suppliers
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SupplierInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub contact: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub contact: Option<String>,
    pub notes: Option<String>,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Pagination
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Paginated<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub per_page: u32,
    pub total_pages: u32,
}