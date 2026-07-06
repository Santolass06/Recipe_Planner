//! mise-core — Domain models, database, and type-safe Tauri commands
//!
//! Single crate: domain + data access. No repository traits, no async-trait.
//! Uses libSQL directly with connection pooling.

#![forbid(unsafe_code)]

pub mod db;
pub mod domain;

pub use db::*;
pub use domain::*;