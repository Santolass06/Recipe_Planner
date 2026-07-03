use crate::Unit;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConversionResult {
    Ok(f64),
    NeedsDensity,
    Incompatible,
}

pub fn convert(value: f64, from: Unit, to: Unit) -> ConversionResult {
    if from == to { return ConversionResult::Ok(value); }
    match (from, to) {
        (Unit::Celsius, Unit::Fahrenheit) =>
            return ConversionResult::Ok(value * 9.0 / 5.0 + 32.0),
        (Unit::Fahrenheit, Unit::Celsius) =>
            return ConversionResult::Ok((value - 32.0) * 5.0 / 9.0),
        _ => {}
    }
    if from.group() != to.group() {
        return ConversionResult::Incompatible;
    }
    let to_base = |u: Unit| -> Option<f64> {
        Some(match u {
            Unit::Gram => 1.0, Unit::Kilogram => 1000.0,
            Unit::Milligram => 0.001, Unit::Ounce => 28.3495,
            Unit::Pound => 453.592, Unit::Pinch => 0.3,
            Unit::Bunch => 30.0, Unit::Clove => 5.0,
            Unit::Slice => 30.0, Unit::Milliliter => 1.0,
            Unit::Liter => 1000.0, Unit::FluidOunce => 29.5735,
            Unit::Cup => 236.588, Unit::Pint => 473.176,
            Unit::Quart => 946.353, Unit::Gallon => 3785.41,
            Unit::Teaspoon => 4.92892, Unit::Tablespoon => 14.7868,
            Unit::Piece => 1.0, Unit::Dozen => 12.0,
            Unit::Centimeter => 1.0,
            _ => return None,
        })
    };
    match (to_base(from), to_base(to)) {
        (Some(f), Some(t)) =>
            ConversionResult::Ok((value * f / t * 1e6).round() / 1e6),
        _ => ConversionResult::Incompatible,
    }
}

pub fn compatible_units(unit: Unit) -> Vec<Unit> {
    Unit::all().iter().copied()
        .filter(|&u| u.group() == unit.group())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Unit;

    #[test]
    fn kg_to_g() {
        assert_eq!(convert(1.0, Unit::Kilogram, Unit::Gram),
                   ConversionResult::Ok(1000.0));
    }
    #[test]
    fn tbsp_to_ml() {
        match convert(1.0, Unit::Tablespoon, Unit::Milliliter) {
            ConversionResult::Ok(v) =>
                assert!((v - 14.7868).abs() < 0.001),
            _ => panic!("devia converter"),
        }
    }
    #[test]
    fn cup_to_tsp() {
        match convert(1.0, Unit::Cup, Unit::Teaspoon) {
            ConversionResult::Ok(v) =>
                assert!((v - 48.0).abs() < 0.1),
            _ => panic!("devia converter"),
        }
    }
    #[test]
    fn celsius_to_fahrenheit() {
        assert_eq!(convert(100.0, Unit::Celsius, Unit::Fahrenheit),
                   ConversionResult::Ok(212.0));
    }
    #[test]
    fn oz_to_g() {
        match convert(1.0, Unit::Ounce, Unit::Gram) {
            ConversionResult::Ok(v) =>
                assert!((v - 28.3495).abs() < 0.001),
            _ => panic!("devia converter"),
        }
    }
    #[test]
    fn incompatible_groups() {
        assert_eq!(convert(1.0, Unit::Gram, Unit::Milliliter),
                   ConversionResult::Incompatible);
    }
    #[test]
    fn same_unit() {
        assert_eq!(convert(5.0, Unit::Gram, Unit::Gram),
                   ConversionResult::Ok(5.0));
    }
}