# Project: Mise Recipe Planner Stabilization & Remaster

## Architecture
- **Structure**: Rust Workspace with `crates/core` (libsql database logic & domain models), `crates/tauri` (Tauri commands), and `src-tauri` (tauri launcher). Frontend is a React/TypeScript Single Page Application using Vite.
- **Data Flow**: Frontend invokes Tauri IPC commands -> Tauri backend communicates with the SQLite database via `crates/core` -> Database returns Rust structs mapped into TypeScript types via `ts-rs` bindings.

## Code Layout
- Frontend: `src/` (components, pages, styles, main, app)
- Backend:
  - `crates/core/src/` (database migrations, schemas, helpers, and domain types)
  - `crates/tauri/src/` (app state wrapper and command definitions)
  - `src-tauri/src/` (Tauri main entry point, plugin and command registration)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | DB & Backend Schema Stabilization | Fix stock deadlock and unit mapping; make shopping item ingredient_id nullable in db & domain | None | DONE |
| 2 | Frontend Integration Bug Fixes | Fix costs page loop, quick-add payload, suppliers load concurrency, reports empty state | M1 | DONE |
| 3 | Dev Options & Light Theme | Guard settings category/commands; implement seed_demo_data; fix light theme color contrast variables | M2 | DONE |
| 4 | Phase 0 Status Audit | Perform concluding diagnostic status audit covering 9 specific points | M3 | DONE |

## Interface Contracts
### Frontend ↔ Tauri Backend
- **Shopping Item**: `ShoppingItemInput` and `ShoppingItem` structs support `ingredient_id` as `Option<i64>` (translates to `number | null` in TypeScript).
- **Developer Commands**:
  - `seed_demo_data()`: Seeds the database with mock ingredients, recipes, stock levels, meal plans, lists, suppliers, and price quotes. Protected by `#[cfg(debug_assertions)]`.
  - `delete_all_data()`: Deletes all data from the database. Protected by `#[cfg(debug_assertions)]`.
