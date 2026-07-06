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

    /// Factor to convert one unit of `self` into its group's base unit
    /// (gram for weight, milliliter for volume, piece for count). Returns
    /// `None` for descriptive units with no fixed physical size (pinch,
    /// bunch, clove, slice) — those can't be converted against another
    /// unit in the same group without knowing the specific ingredient.
    pub fn to_base_factor(self) -> Option<f64> {
        match self {
            Unit::Gram => Some(1.0),
            Unit::Kilogram => Some(1000.0),
            Unit::Milligram => Some(0.001),
            Unit::Ounce => Some(28.3495),
            Unit::Pound => Some(453.592),
            Unit::Milliliter => Some(1.0),
            Unit::Liter => Some(1000.0),
            Unit::FluidOunce => Some(29.5735),
            Unit::Cup => Some(236.588),
            Unit::Pint => Some(473.176),
            Unit::Quart => Some(946.353),
            Unit::Gallon => Some(3785.41),
            Unit::Teaspoon => Some(4.92892),
            Unit::Tablespoon => Some(14.7868),
            Unit::Piece => Some(1.0),
            Unit::Dozen => Some(12.0),
            Unit::Pinch | Unit::Bunch | Unit::Clove | Unit::Slice => None,
        }
    }

    /// Convert a quantity expressed in `self` into the equivalent quantity
    /// expressed in `target`. Returns `None` if the units aren't in the
    /// same group or either has no fixed conversion factor — callers
    /// should fall back to treating the quantity as already being in
    /// `target`'s unit in that case.
    pub fn convert_to(self, target: Unit, quantity: f64) -> Option<f64> {
        if self == target {
            return Some(quantity);
        }
        if self.group() != target.group() {
            return None;
        }
        let from_factor = self.to_base_factor()?;
        let to_factor = target.to_base_factor()?;
        Some(quantity * from_factor / to_factor)
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
    #[ts(type = "number")]
    pub ingredient_id: i64,
    pub quantity: f64,
    pub unit: Unit,
}

/// Recipe ingredient (stored, denormalized name for display)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeIngredient {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
    pub recipe_id: i64,
    #[ts(type = "number")]
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
    /// Set on create to scope a brand-new recipe to an event (Fase 3.2).
    /// `#[serde(default)]` so existing catalog create/update callers that
    /// never send this field keep working.
    #[serde(default)]
    pub event_id: Option<i64>,
}

/// Recipe (stored)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Recipe {
    #[ts(type = "number")]
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
    #[ts(type = "number")]
    pub id: i64,
    pub name: String,
    pub unit: Unit,
    pub price_per_unit: f64,
    #[ts(type = "number | null")]
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
    #[ts(type = "number")]
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
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
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

/// Shopping list item input (for create/update)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ShoppingItemInput {
    #[validate(range(min = 1))]
    #[ts(type = "number | null")]
    pub ingredient_id: Option<i64>,
    #[validate(length(min = 1, max = 200))]
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
    #[validate(range(min = 0.0))]
    pub needed_quantity: f64,
    #[validate(range(min = 0.0))]
    pub stock_quantity: f64,
    #[validate(range(min = 0.0))]
    pub to_buy_quantity: f64,
    #[validate(length(max = 100))]
    pub category: String,
    #[validate(range(min = 0.0))]
    pub estimated_cost: f64,
    pub purchased: bool,
    pub notes: Option<String>,
}

/// Marks a shopping list item as purchased and, when it has a linked
/// ingredient, records the real lot bought (brand/supplier/price) as a
/// stock_purchase — the single event that raises stock (Fase 3.1).
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ShoppingListMarkPurchasedInput {
    #[validate(range(min = 1))]
    #[ts(type = "number")]
    pub list_id: i64,
    #[validate(range(min = 1))]
    #[ts(type = "number")]
    pub item_id: i64,
    #[validate(range(min = 0.001))]
    pub quantity: f64,
    #[validate(range(min = 0.0))]
    pub price_per_unit: f64,
    pub brand: Option<String>,
    #[ts(type = "number | null")]
    pub supplier_id: Option<i64>,
    pub notes: Option<String>,
}

/// Shopping list item (stored)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ShoppingItem {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number | null")]
    pub ingredient_id: Option<i64>,
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
    pub needed_quantity: f64,
    pub stock_quantity: f64,
    pub to_buy_quantity: f64,
    pub category: String,
    pub estimated_cost: f64,
    pub purchased: bool,
    pub notes: Option<String>,
    #[ts(type = "string")]
    pub purchased_at: Option<DateTime<Utc>>,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
}

/// Shopping list
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ShoppingList {
    #[ts(type = "number | null")]
    pub id: Option<i64>,
    pub name: String,
    pub items: Vec<ShoppingItem>,
    pub total_estimated_cost: f64,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
}

/// Shopping list with items (for detail view)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ShoppingListWithItems {
    #[serde(flatten)]
    pub list: ShoppingList,
    // items is already part of ShoppingList
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
    #[ts(type = "number")]
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
    /// True when total_cost relied on an approximate unit-weight lookup
    /// (e.g. "clove" -> grams) rather than an exact unit conversion.
    pub is_approximate: bool,
    pub approximation_note: Option<String>,
}

/// Price quote (for supplier prices)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct PriceQuoteInput {
    #[validate(range(min = 1))]
    #[ts(type = "number")]
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
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
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

/// Settings category for grouping
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "bindings/")]
pub enum SettingsCategory {
    General,
    Units,
    Currency,
    Data,
    Sync,
    About,
}

impl SettingsCategory {
    pub fn all() -> &'static [SettingsCategory] {
        &[
            SettingsCategory::General,
            SettingsCategory::Units,
            SettingsCategory::Currency,
            SettingsCategory::Data,
            SettingsCategory::Sync,
            SettingsCategory::About,
        ]
    }

    pub fn label(self) -> &'static str {
        match self {
            SettingsCategory::General => "Geral",
            SettingsCategory::Units => "Unidades",
            SettingsCategory::Currency => "Moeda",
            SettingsCategory::Data => "Dados",
            SettingsCategory::Sync => "Sincronização",
            SettingsCategory::About => "Sobre",
        }
    }

    pub fn label_en(self) -> &'static str {
        match self {
            SettingsCategory::General => "General",
            SettingsCategory::Units => "Units",
            SettingsCategory::Currency => "Currency",
            SettingsCategory::Data => "Data",
            SettingsCategory::Sync => "Sync",
            SettingsCategory::About => "About",
        }
    }
}

/// Settings input for batch operations
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SettingsInput {
    pub key: String,
    pub value: String,
    pub category: SettingsCategory,
}

/// Categories (for ingredients/recipes)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Category {
    #[ts(type = "number")]
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
    #[ts(type = "number")]
    pub id: i64,
    pub name: String,
    pub contact: Option<String>,
    pub notes: Option<String>,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Event input (create/update)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct EventInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    pub event_date: Option<String>,
    pub notes: Option<String>,
}

/// Event (stored) — an isolated planning context that recipes can be copied into
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Event {
    #[ts(type = "number")]
    pub id: i64,
    pub name: String,
    pub event_date: Option<String>,
    pub notes: Option<String>,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Meal Planner — Meal Type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "bindings/")]
pub enum MealType {
    Breakfast,
    Lunch,
    Dinner,
    Snack,
}

impl MealType {
    pub fn label(self) -> &'static str {
        match self {
            MealType::Breakfast => "Pequeno-almoço",
            MealType::Lunch => "Almoço",
            MealType::Dinner => "Jantar",
            MealType::Snack => "Lanche",
        }
    }

    pub fn all() -> &'static [MealType] {
        &[MealType::Breakfast, MealType::Lunch, MealType::Dinner, MealType::Snack]
    }
}

/// Meal Planner — Day of Week enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "bindings/")]
pub enum DayOfWeek {
    Monday,
    Tuesday,
    Wednesday,
    Thursday,
    Friday,
    Saturday,
    Sunday,
}

impl DayOfWeek {
    pub fn label(self) -> &'static str {
        match self {
            DayOfWeek::Monday => "Segunda",
            DayOfWeek::Tuesday => "Terça",
            DayOfWeek::Wednesday => "Quarta",
            DayOfWeek::Thursday => "Quinta",
            DayOfWeek::Friday => "Sexta",
            DayOfWeek::Saturday => "Sábado",
            DayOfWeek::Sunday => "Domingo",
        }
    }

    pub fn short_label(self) -> &'static str {
        match self {
            DayOfWeek::Monday => "Seg",
            DayOfWeek::Tuesday => "Ter",
            DayOfWeek::Wednesday => "Qua",
            DayOfWeek::Thursday => "Qui",
            DayOfWeek::Friday => "Sex",
            DayOfWeek::Saturday => "Sáb",
            DayOfWeek::Sunday => "Dom",
        }
    }

    pub fn all() -> &'static [DayOfWeek] {
        &[
            DayOfWeek::Monday,
            DayOfWeek::Tuesday,
            DayOfWeek::Wednesday,
            DayOfWeek::Thursday,
            DayOfWeek::Friday,
            DayOfWeek::Saturday,
            DayOfWeek::Sunday,
        ]
    }

    pub fn index(self) -> usize {
        match self {
            DayOfWeek::Monday => 0,
            DayOfWeek::Tuesday => 1,
            DayOfWeek::Wednesday => 2,
            DayOfWeek::Thursday => 3,
            DayOfWeek::Friday => 4,
            DayOfWeek::Saturday => 5,
            DayOfWeek::Sunday => 6,
        }
    }
}

/// Meal Plan input (create/update)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealPlanInput {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[ts(type = "string")]
    pub start_date: DateTime<Utc>,
    #[ts(type = "string")]
    pub end_date: DateTime<Utc>,
}

/// Meal Plan (stored)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealPlan {
    #[ts(type = "number")]
    pub id: i64,
    pub name: String,
    #[ts(type = "string")]
    pub start_date: DateTime<Utc>,
    #[ts(type = "string")]
    pub end_date: DateTime<Utc>,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Meal Plan Entry input (create/update)
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealEntryInput {
    #[validate(range(min = 1))]
    #[ts(type = "number")]
    pub recipe_id: i64,
    pub day_of_week: DayOfWeek,
    pub meal_type: MealType,
    #[validate(range(min = 1, max = 100))]
    pub portions: u32,
}

/// Meal Plan Entry (stored)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealPlanEntry {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
    pub meal_plan_id: i64,
    #[ts(type = "number")]
    pub recipe_id: i64,
    pub recipe_name: String, // denormalized for display
    pub day_of_week: DayOfWeek,
    pub meal_type: MealType,
    pub portions: u32,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Meal Plan with entries (for API responses)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealPlanWithEntries {
    // SEM #[serde(flatten)] — o frontend espera { meal_plan: {...}, entries: [...] }
    // (aninhado). Com flatten, os campos de MealPlan serializam ao nível de topo
    // e o frontend crasha com "undefined is not an object (evaluating
    // 'selectedPlan.meal_plan.name')".
    pub meal_plan: MealPlan,
    pub entries: Vec<MealPlanEntry>,
}

/// Shopping list generation result from meal plan
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealPlanShoppingList {
    pub shopping_list: ShoppingList,
    pub total_portions: u32,
    #[ts(type = "Array<number>")]
    pub recipes_used: Vec<i64>,
}

/// Pagination
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Paginated<T> {
    pub items: Vec<T>,
    #[ts(type = "number")]
    pub total: i64,
    pub page: u32,
    pub per_page: u32,
    pub total_pages: u32,
}

/// Dashboard statistics
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct DashboardStats {
    #[ts(type = "number")]
    pub low_stock_count: i64,
    #[ts(type = "number")]
    pub expiring_soon_count: i64,
    #[ts(type = "number")]
    pub meals_this_week: i64,
    pub total_stock_value: f64,
    #[ts(type = "number")]
    pub total_recipes: i64,
    #[ts(type = "number")]
    pub total_ingredients: i64,
    #[ts(type = "number")]
    pub pending_shopping_items: i64,
}

/// Activity item for recent activity feed
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ActivityItem {
    #[ts(type = "number")]
    pub id: i64,
    pub activity_type: String, // "recipe_created", "stock_updated", "meal_planned", "shopping_purchased", etc.
    pub description: String,
    #[ts(type = "number | null")]
    pub entity_id: Option<i64>,
    pub entity_type: Option<String>, // "recipe", "ingredient", "meal_plan", "shopping_list"
    #[ts(type = "string")]
    pub timestamp: DateTime<Utc>,
}

/// Meal plan entry with recipe details (for dashboard upcoming meals)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealPlanEntryWithRecipe {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
    pub meal_plan_id: i64,
    #[ts(type = "number")]
    pub recipe_id: i64,
    pub recipe_name: String,
    pub day_of_week: DayOfWeek,
    pub meal_type: MealType,
    pub portions: u32,
    #[ts(type = "string")]
    pub planned_date: DateTime<Utc>, // The actual date this meal is planned for
}

/// Stock item with ingredient details (for dashboard low stock)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct StockItemWithIngredient {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
    pub quantity: f64,
    pub min_quantity: f64,
    pub price_per_unit: f64,
    #[ts(type = "string")]
    pub updated_at: DateTime<Utc>,
}

/// Price quote stats for an ingredient (avg, min, max)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct PriceQuoteStats {
    #[ts(type = "number")]
    pub ingredient_id: i64,
    pub avg_price: f64,
    pub min_price: f64,
    pub max_price: f64,
    #[ts(type = "number")]
    pub quote_count: i64,
}

/// Price quote with denormalized ingredient info
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct PriceQuoteWithIngredient {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub ingredient_unit: Unit,
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

/// =====================================================================
/// REPORTS
/// =====================================================================

/// Cost report for a date range
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct CostReport {
    pub total_spent: f64,
    pub by_category: Vec<CategoryCost>,
    pub by_recipe: Vec<RecipeCost>,
    pub by_supplier: Vec<SupplierCost>,
    pub daily_avg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct CategoryCost {
    pub category: String,
    pub total: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeCost {
    #[ts(type = "number")]
    pub recipe_id: i64,
    pub recipe_name: String,
    pub total_cost: f64,
    pub portions: u32,
    pub cost_per_portion: f64,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SupplierCost {
    pub supplier: String,
    pub total: f64,
    pub percentage: f64,
}

/// Waste report for a date range
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct WasteReport {
    pub total_wasted_value: f64,
    pub by_ingredient: Vec<IngredientWaste>,
    pub by_category: Vec<CategoryWaste>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct IngredientWaste {
    #[ts(type = "number")]
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub unit: Unit,
    pub wasted_quantity: f64,
    pub wasted_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct CategoryWaste {
    pub category: String,
    pub total_wasted_value: f64,
    pub percentage: f64,
}

/// Stock snapshot for trend analysis
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct StockSnapshot {
    #[ts(type = "string")]
    pub date: DateTime<Utc>,
    #[ts(type = "number")]
    pub ingredient_id: i64,
    pub ingredient_name: String,
    pub quantity: f64,
    pub value: f64,
}

/// Meal statistics for a date range
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealStats {
    pub total_meals: u32,
    pub avg_portions: f64,
    pub by_meal_type: Vec<MealTypeStat>,
    pub by_recipe: Vec<RecipeMealStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct MealTypeStat {
    pub meal_type: MealType,
    pub count: u32,
    pub total_portions: u32,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeMealStat {
    #[ts(type = "number")]
    pub recipe_id: i64,
    pub recipe_name: String,
    pub count: u32,
    pub total_portions: u32,
    pub avg_portions: f64,
}

/// Price trend point for an ingredient
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct PricePoint {
    #[ts(type = "string")]
    pub date: DateTime<Utc>,
    pub price: f64,
    pub supplier: String,
}

/// =====================================================================
/// IMAGES
/// =====================================================================

/// Entity type for images
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "bindings/")]
pub enum ImageEntityType {
    Recipe,
    Ingredient,
    Supplier,
    Receipt,
    Profile,
}

impl ImageEntityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ImageEntityType::Recipe => "recipe",
            ImageEntityType::Ingredient => "ingredient",
            ImageEntityType::Supplier => "supplier",
            ImageEntityType::Receipt => "receipt",
            ImageEntityType::Profile => "profile",
        }
    }
}

/// Image record
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct Image {
    #[ts(type = "number")]
    pub id: i64,
    pub entity_type: ImageEntityType,
    #[ts(type = "number")]
    pub entity_id: i64,
    pub path: String,
    pub mime_type: String,
    pub is_primary: bool,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
}

/// Image upload input
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ImageUploadInput {
    pub entity_type: ImageEntityType,
    #[ts(type = "number")]
    pub entity_id: i64,
    #[validate(length(min = 1))]
    pub base64: String,
    pub mime_type: String,
}

/// Proxy search result from Unsplash/Pexels
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ProxyImageResult {
    pub id: String,
    pub url: String,
    pub thumb_url: String,
    pub width: u32,
    pub height: u32,
    pub alt: Option<String>,
    pub photographer: Option<String>,
    pub source: String, // "unsplash" | "pexels"
}

/// =====================================================================
/// STOCK PURCHASES
/// =====================================================================

/// Stock purchase input
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct StockPurchaseInput {
    #[validate(range(min = 1))]
    #[ts(type = "number")]
    pub ingredient_id: i64,
    #[validate(range(min = 0.001))]
    pub quantity: f64,
    pub unit: Unit,
    #[validate(range(min = 0.0))]
    pub price_per_unit: f64,
    #[validate(range(min = 0.0))]
    pub total_price: f64,
    pub is_discount: bool,
    #[validate(range(min = 0.0, max = 100.0))]
    pub discount_percent: f64,
    #[ts(type = "string")]
    pub purchase_date: DateTime<Utc>,
    #[ts(type = "number | null")]
    pub supplier_id: Option<i64>,
    pub brand: Option<String>,
    pub notes: Option<String>,
}

/// Stock purchase record
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct StockPurchase {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
    pub ingredient_id: i64,
    pub ingredient_name: String, // denormalized
    pub ingredient_unit: Unit,
    pub quantity: f64,
    pub unit: Unit,
    pub price_per_unit: f64,
    pub total_price: f64,
    pub is_discount: bool,
    pub discount_percent: f64,
    #[ts(type = "string")]
    pub purchase_date: DateTime<Utc>,
    #[ts(type = "number | null")]
    pub supplier_id: Option<i64>,
    pub supplier_name: Option<String>, // denormalized
    pub brand: Option<String>,
    pub notes: Option<String>,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
}

/// =====================================================================
/// RECEIPT OCR
/// =====================================================================

/// Receipt import status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export, export_to = "bindings/")]
pub enum ReceiptStatus {
    Pending,
    Scanned,
    Parsed,
    Confirmed,
    Failed,
}

/// Receipt import record
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ReceiptImport {
    #[ts(type = "number")]
    pub id: i64,
    pub image_path: String,
    pub raw_text: Option<String>,
    pub parsed_json: Option<String>, // JSON array of ParsedReceiptItem
    pub status: ReceiptStatus,
    #[ts(type = "string")]
    pub created_at: DateTime<Utc>,
}

/// Parsed item from receipt OCR
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ParsedReceiptItem {
    pub ingredient_name: String,
    pub quantity: f64,
    pub unit: Unit,
    pub price_per_unit: f64,
    pub total_price: f64,
    pub is_discount: bool,
    pub discount_percent: f64,
    #[ts(type = "number | null")]
    pub matched_ingredient_id: Option<i64>,
    pub confidence: f64, // 0.0 - 1.0
    pub brand: Option<String>,
    pub notes: Option<String>,
}

/// Receipt scan input
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ReceiptScanInput {
    #[validate(length(min = 1))]
    pub base64_image: String,
}

/// Receipt parse result
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ReceiptParseResult {
    #[ts(type = "number")]
    pub import_id: i64,
    pub raw_text: String,
    pub items: Vec<ParsedReceiptItem>,
}

/// Receipt confirm input
#[derive(Debug, Clone, Serialize, Deserialize, Validate, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ReceiptConfirmInput {
    #[validate(range(min = 1))]
    #[ts(type = "number")]
    pub import_id: i64,
    pub items: Vec<ParsedReceiptItem>, // User-corrected items
    #[ts(type = "number | null")]
    pub supplier_id: Option<i64>, // one supplier per receipt (single store visit)
}

/// Ingredient line parsed from an imported recipe's schema.org `recipeIngredient` array (Fase 3.4)
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeImportIngredient {
    pub raw_text: String,
    pub quantity: f64,
    pub unit: Unit,
    pub name_guess: String,
    #[ts(type = "number | null")]
    pub matched_ingredient_id: Option<i64>,
}

/// Recipe extracted from a URL's schema.org/Recipe JSON-LD, for the user to review
/// before saving it as an actual recipe (Fase 3.4) — never written to the DB by itself.
#[derive(Debug, Clone, Serialize, Deserialize, Type, TS)]
#[ts(export, export_to = "bindings/")]
pub struct RecipeImportPreview {
    pub name: String,
    pub portions: Option<u32>,
    pub instructions: String,
    pub prep_time_minutes: Option<u32>,
    pub cook_time_minutes: Option<u32>,
    pub image_url: Option<String>,
    pub ingredients: Vec<RecipeImportIngredient>,
}