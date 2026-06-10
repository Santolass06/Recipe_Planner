use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AccountType {
    Individual,
    Family,
    Business,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Feature {
    BasicRecipes,
    AdvancedCostAnalysis,
    MultiUser,
    SupplierManagement,
    CalendarPlanning,
    RecipeSuggestions,
    PriceLookup,
    OCRRecognition,
    CloudSync,
    AIChat,
}

pub fn is_allowed(account: AccountType, feature: Feature) -> bool {
    match (account, feature) {
        (AccountType::Individual, Feature::BasicRecipes) => true,
        (AccountType::Individual, Feature::AdvancedCostAnalysis) => true,
        (AccountType::Individual, Feature::CalendarPlanning) => true,
        (AccountType::Individual, Feature::RecipeSuggestions) => true,
        (AccountType::Individual, Feature::PriceLookup) => true,
        (AccountType::Individual, Feature::OCRRecognition) => true,
        (AccountType::Individual, Feature::CloudSync) => true,
        (AccountType::Individual, Feature::AIChat) => true,
        (AccountType::Individual, Feature::MultiUser) => false,
        (AccountType::Individual, Feature::SupplierManagement) => false,

        (AccountType::Family, Feature::BasicRecipes) => true,
        (AccountType::Family, Feature::AdvancedCostAnalysis) => true,
        (AccountType::Family, Feature::MultiUser) => true,
        (AccountType::Family, Feature::CalendarPlanning) => true,
        (AccountType::Family, Feature::RecipeSuggestions) => true,
        (AccountType::Family, Feature::PriceLookup) => true,
        (AccountType::Family, Feature::OCRRecognition) => true,
        (AccountType::Family, Feature::CloudSync) => true,
        (AccountType::Family, Feature::AIChat) => true,
        (AccountType::Family, Feature::SupplierManagement) => false,

        (AccountType::Business, Feature::BasicRecipes) => true,
        (AccountType::Business, Feature::AdvancedCostAnalysis) => true,
        (AccountType::Business, Feature::MultiUser) => true,
        (AccountType::Business, Feature::SupplierManagement) => true,
        (AccountType::Business, Feature::CalendarPlanning) => true,
        (AccountType::Business, Feature::RecipeSuggestions) => true,
        (AccountType::Business, Feature::PriceLookup) => true,
        (AccountType::Business, Feature::OCRRecognition) => true,
        (AccountType::Business, Feature::CloudSync) => true,
        (AccountType::Business, Feature::AIChat) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_individual_basic_recipes() {
        assert!(is_allowed(AccountType::Individual, Feature::BasicRecipes));
    }

    #[test]
    fn test_individual_no_supplier() {
        assert!(!is_allowed(
            AccountType::Individual,
            Feature::SupplierManagement
        ));
    }

    #[test]
    fn test_business_all_features() {
        assert!(is_allowed(AccountType::Business, Feature::BasicRecipes));
        assert!(is_allowed(
            AccountType::Business,
            Feature::SupplierManagement
        ));
        assert!(is_allowed(AccountType::Business, Feature::MultiUser));
    }
}
