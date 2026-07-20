# mise (Recipe Planner) — Full Audit Report

**Date:** 2026-07-20  
**Scope:** Holistic audit — architecture, domain, product, UX/i18n, security, tests, build/distribution  
**Method:** Static evidence from the repository (code, configs, docs). No clean-machine install smoke; no multi-chain receipt OCR campaign.  
**Out of scope:** Performance & DX; implementing fixes; formal legal/RGPD review.

**Severity**

| Level | Meaning |
|-------|---------|
| **P0** | Blocks real use or risks data loss/corruption |
| **P1** | Critical feature degraded or high regression risk |
| **P2** | Material debt/gap, non-blocking |
| **P3** | Polish / nice-to-have |

**ID prefixes:** `ARC` architecture · `DOM` domain · `FUN` product · `UX` UX/i18n · `SEC` security · `QA` tests · `BLD` build

---

## Checklist (re-audit)

- [ ] P0/P1 from matrix addressed or explicitly deferred in `PROJECT.md`
- [ ] DB path migration shipped + documented
- [ ] Camera verified on clean desktop package
- [ ] OCR validated on ≥3 PT retail chains
- [ ] CI: `cargo test --workspace` + `npm run build` on PR
- [ ] Keystore not in VCS; release signing secrets external
- [ ] Export/import covers stock, events, purchases (or documented limits)
- [ ] Minimum domain tests for units, receipt confirm, cost

---

## Executive summary

### Overall state

**mise** is a substantial local-first kitchen app (Tauri 2 + Rust + React 19 + libSQL) with a real end-to-end product surface: ingredients/stock, recipes/costs, meal planner, shopping lists, event-scoped catalogs, receipt OCR (offline tesseract), suppliers, reports (partial), settings, and PT/EN i18n. Architecture is intentionally thin (domain+db in `mise-core`, IPC wrappers in `mise-tauri`, SPA pages). Type safety FE↔BE is largely good after ts-rs bindings adoption.

The app is **close to “useful for a motivated single user on Linux”**, but **not yet “ready to hand to strangers as a release”** without addressing distribution path/camera checkpoints, a few data-correctness edges, release hygiene (keystore), and a minimal safety net of automated tests.

### Top risks (ordered)

1. **[BLD-001 / DOM-001]** Nested app data path (`resolve("mise", AppData)` → `…/mise/mise.db`) and lack of an upgrade migration — user data location is confusing and easy to orphan on “fix”.
2. **[SEC-001]** `mise-release.keystore` is tracked in git and not gitignored — release signing material in the repo.
3. **[FUN-001 / BLD-002]** Desktop camera for receipt scanner still unverified on a clean machine; primary Scanner interaction remains upload-only in practice on the documented dev setup.
4. **[DOM-002]** `receipt_confirm` adds quantity to stock **without unit conversion** when receipt unit ≠ ingredient unit — silent stock corruption.
5. **[DOM-003 / FUN-002]** Export/import only round-trips ingredients + recipes — stock, purchases, events, suppliers, lists, settings are lost on “backup”.
6. **[QA-001]** Almost no automated tests (~9 Rust unit tests, no FE tests, no CI) against ~5.7k LOC `db.rs` and ~105 commands — high regression cost.
7. **[FUN-003]** OCR multi-chain accuracy unproven (PROJECT priority); waste/stock-trend reports intentionally empty; Suggester is a dead route + empty backend.
8. **[SEC-002]** `recipe_import_from_url` has no scheme allowlist, timeout, or body size cap (SSRF / hang risk).
9. **[ARC-001]** Monolithic `db.rs` + god pages (900+ LOC) — maintenance and review risk, already deferred in roadmap (acceptable if conscious).
10. **[SEC-003]** `validator` derives exist but `.validate()` is never called — validation is documentation-only.

### Quick wins (≤1 day each)

| Win | Finding | Effort |
|-----|---------|--------|
| Gitignore + untrack keystore; rotate if ever published | SEC-001 | Hours |
| Call `.validate()` on `Validate` inputs in commands (or drop dead derives) | SEC-003 | Hours |
| Block non-`http(s)` URLs + timeout on recipe import | SEC-002 | Hours |
| Unit-convert (or reject) on `receipt_confirm` stock bump | DOM-002 | ≤1 day |
| Document export limits in Settings UI + README | DOM-003 / FUN-002 | Hours |
| Add GitHub Actions: `cargo test --workspace` + `npm run build` | QA-002 | Hours |
| Hide or remove `/sugestor` route until implemented | FUN-004 | Minutes |
| Size limit on base64 image upload | SEC-004 | Hours |

### What is in good shape

- Layering is clear: React → Tauri commands → `mise-core` → libSQL; bindings generated to `crates/core/bindings/` (~81 TS types).
- Event-isolated ingredients/recipes with promote-to-catalog and manual cascade delete are implemented and tested in part (`fase3_stock_tests`).
- Cost-per-portion uses backend unit conversion (`Unit::convert_to`) + approximate weights; FE margin math is explicit on Custos.
- OCR assets self-hosted under `public/tessdata/` (~37M); CSP no longer depends on jsDelivr.
- Debug wipe/seed gated with `#[cfg(debug_assertions)]` in both definition and `generate_handler!`.
- i18n PT/EN key sets appear parity-complete at leaf-key level (~698 keys each).
- README honesty on waste/stock-over-time reports (empty by design).

---

## Inventory baseline

### Workspace

| Area | Path | Notes |
|------|------|-------|
| Domain + DB | `crates/core` | `db.rs` ~5698 LOC, `domain.rs` ~1355 LOC |
| IPC | `crates/tauri` | `lib.rs` ~1444 LOC, ~105 registered commands |
| Launcher | `src-tauri` | Tauri 2, plugins opener/dialog/fs/shell |
| Frontend | `src/` | 15 page modules, UI kit, i18n PT/EN |
| Bindings | `crates/core/bindings/` | ~81 generated `.ts` files |
| Docs | `README.md`, `PROJECT.md`, `docs/HANDOFF_AGENT.md` | |

### Routes (`src/router.tsx`)

| Path | Page | Status |
|------|------|--------|
| `/`, `/dashboard` | DashboardPage | Live |
| `/ingredientes` | IngredientsPage | Live |
| `/receitas` | RecipesPage | Live |
| `/custos` | CostsPage | Live |
| `/armazem` | StockPage | Live |
| `/compras` | ShoppingListPage | Live |
| `/eventos`, `/eventos/:id` | EventsPage, EventDetailPage | Live |
| `/planeamento` | MealPlannerPage | Live |
| `/calendario` | CalendarPage | Live |
| `/sugestor` | PlaceholderPage | **Stub UI** |
| `/relatorios` | ReportsPage | Partial (waste/stock empty) |
| `/fornecedores` | SuppliersPage | Live |
| `/scanner` | ReceiptScannerPage | Live (camera flaky on dev) |
| `/definicoes` | SettingsPage | Live |
| `/ajuda` | HelpPage | Thin but real |

### Tables (migrations in `run_migrations`)

`settings`, `categories`, `ingredients`, `recipes`, `recipe_ingredients`, `stock`, `shopping_lists`, `shopping_list_items`, `suppliers`, `price_quotes`, `meal_plans`, `meal_plan_entries`, `images`, `stock_purchases`, `receipt_imports`, `approximate_unit_weights`, `events`, `usage_events`, `problem_reports`.

**Missing for promised future reports:** waste log, stock history/snapshots.

### Commands

~105 handlers registered in `src-tauri` `generate_handler!`. Debug-only: `seed_demo_data`, `delete_all_data`. Notable stubs: `suggester_suggest` → `suggest_recipes` returns `[]`; `report_waste` / `report_stock_trends` return empty structures.

---

## 1. Architecture & code

### [ARC-001] Monolithic `db.rs` (~5.7k LOC)
- **Severidade:** P2
- **Dimensão:** Architecture
- **Evidência:** `crates/core/src/db.rs` (~5698 lines) holds migrations, all queries, receipt parse, image I/O, export/import, URL import, image proxy, seed, and tests.
- **Impacto:** Hard to review, high merge conflict risk, slow navigation; any change touches a god-file. Already deferred in `PROJECT.md` (god-components / structure).
- **Recomendação:** Split by domain modules when next feature forces touch (e.g. `db/{migrations,ingredients,recipes,stock,receipts,images}.rs`) — no big-bang rewrite.
- **Roadmap:** Deferred polish / post-real-users; align with PROJECT “god-components adiados”.

### [ARC-002] God pages on the frontend
- **Severidade:** P2
- **Dimensão:** Architecture
- **Evidência:** LOC: `ShoppingListPage` 971, `RecipesPage` 912, `SettingsPage` 841, `ReportsPage` 759, `MealPlannerPage` 666, `EventDetailPage` 648, `ReceiptScannerPage` 608.
- **Impacto:** Duplicated modal/list patterns; harder i18n/a11y sweeps; regression-prone edits.
- **Recomendação:** Extract only when editing a page (form modal, list row, filter bar). Do not schedule a pure refactor phase.
- **Roadmap:** PROJECT explicit deferral until user feedback.

### [ARC-003] Thin but noisy Tauri command layer
- **Severidade:** P3
- **Dimensão:** Architecture
- **Evidência:** `crates/tauri/src/lib.rs` — `AppDb` methods + `commands` module mirror almost 1:1; ~105 `#[tauri::command]`s; errors mapped with `.map_err(|e| e.to_string())`.
- **Impacto:** Boilerplate; error strings lose typed structure; fine for local app size today.
- **Recomendação:** Keep thin wrappers; optionally introduce a small `AppError` enum later if FE needs stable error codes.
- **Roadmap:** None required.

### [ARC-004] Duplicated unit conversion FE/BE
- **Severidade:** P2
- **Dimensão:** Architecture
- **Evidência:** `Unit::convert_to` / `to_base_factor` in `crates/core/src/domain.rs`; mirror in `src/lib/units.ts` (`convertUnit`, `UNIT_BASE_FACTOR`) with comment “Mirrors `Unit::to_base_factor`”.
- **Impacto:** Factor drift risk (labels already mix PT hardcoding in both). Cost path correctly uses BE; FE path used for display/helpers.
- **Recomendação:** Single comment checklist in PR template when touching units; or generate factors from one source later. Prefer BE for any money/stock math.
- **Roadmap:** Related to unit/cost correctness work already done in Fase 3.3.

### [ARC-005] Dead / half-wired surface: Suggester
- **Severidade:** P3
- **Dimensão:** Architecture
- **Evidência:** Route `sugestor` → `PlaceholderPage`; `suggest_recipes` in `db.rs` returns `Ok(Vec::new())`; command `suggester_suggest` still registered. Sidebar may not link it (route still reachable).
- **Impacto:** Dead code and false expectation if discovered.
- **Recomendação:** Remove route + command until product definition exists, or implement minimal “recipes you can cook from stock”.
- **Roadmap:** Cross-ref FUN-004.

### [ARC-006] IPC types mostly generated; residual `as any`
- **Severidade:** P3
- **Dimensão:** Architecture
- **Evidência:** Bindings under `crates/core/bindings/`; `SettingsPage.tsx` uses `(DEFAULTS[category] as any)[key]`; intentional FE-only types (`CostAnalysis`, `ParsedLine`) per PROJECT.
- **Impacto:** Low; Settings defaults are weakly typed.
- **Recomendação:** Type `DEFAULTS` with a mapped settings type when next editing Settings.
- **Roadmap:** Follow-up to bindings migration (done 2026-07-05).

### [ARC-007] Inconsistent page patterns (modals, loading)
- **Severidade:** P3
- **Dimensão:** Architecture
- **Evidência:** Shared `Modal` in `src/components/ui/Modal.tsx`, but `IngredientsPage` implements its own `modal-backdrop` dialog markup; loading/toast usage density varies (Shopping/Stock heavy, Help none).
- **Impacto:** UX inconsistency (see UX dimension); harder shared a11y fixes.
- **Recomendação:** Prefer shared `Modal`/`ConfirmDialog` on touch.
- **Roadmap:** Polishing phase.

---

## 2. Domain & data

### [DOM-001] App data path nests an extra `mise` segment
- **Severidade:** P1
- **Dimensão:** Domain & data (canonical; cross-ref BLD-001)
- **Evidência:** `initialize_app_state` in `crates/tauri/src/lib.rs`:
  `app.path().resolve("mise", BaseDirectory::AppData)` then `open_db(Some(app_data_dir))` joins `mise.db`.  
  Fallback in `resolve_data_dir` uses `dirs::data_dir().join("mise")` when no Tauri dir — **different root** than identifier-based AppData (`com.recipe-planner.app`).  
  PROJECT documents historical `…/mise/mise/mise.db` orphan issue.
- **Impacto:** Confusing backup paths; easy to lose data when “fixing” path; dual roots if anything calls `open_db(None)`.
- **Recomendação:** Use `BaseDirectory::AppData` **without** extra `"mise"` (identifier already namespaces); one-time migrate: copy old `mise.db` (+ WAL/SHM + `images/`) to new path; document in README.
- **Roadmap:** Fase 4 — Distribuição.

### [DOM-002] Receipt confirm updates stock without unit conversion
- **Severidade:** P1
- **Dimensão:** Domain & data
- **Evidência:** `receipt_confirm` in `db.rs` (~4848+): inserts `stock_purchases` with `item.unit`, then:
  `ON CONFLICT DO UPDATE SET quantity = quantity + ?4` using `item.quantity` and ingredient’s stored unit string for display fields — **no `convert_to`**.  
  Contrast: `calculate_cost` (~1650+) correctly converts recipe line units to ingredient units.
- **Impacto:** Confirming “1 kg” against an ingredient stored in `gram` adds `1` instead of `1000` → silent understock; reverse overstocks.
- **Recomendação:** Convert quantity into ingredient unit before stock upsert; if conversion fails, reject line with clear error (same policy as cost).
- **Roadmap:** OCR / stock correctness; before trusting Scanner in production.

### [DOM-003] Export/import omits most domain data
- **Severidade:** P1
- **Dimensão:** Domain & data
- **Evidência:** `ImportData` in `domain.rs` only: `version`, `ingredients`, `recipes` (+ recipe ingredient lines).  
  `export_data` / `import_data` in `db.rs` (~2937+). No stock, purchases, suppliers, quotes, meal plans, shopping lists, events, images, settings, receipt history.
- **Impacto:** Users who “backup/restore” via Settings lose operational state; false sense of full portability.
- **Recomendação:** Short term: label UI “Export recipes & ingredients only”. Medium: versioned full dump (SQLite file copy is simplest full backup).
- **Roadmap:** Fase 4 / data portability; Settings copy.

### [DOM-004] Foreign keys never enabled
- **Severidade:** P2
- **Dimensão:** Domain & data
- **Evidência:** Comment in migrations: codebase never enables `PRAGMA foreign_keys`; cascades manual (`delete_event` deletes recipes/ingredients/stock/purchases for event). Schema still declares `FOREIGN KEY` clauses (inert without pragma).
- **Impacto:** Orphan rows possible on ad-hoc deletes; relies on every delete path being correct. Event delete path is careful; not all paths audited line-by-line.
- **Recomendação:** Enable `PRAGMA foreign_keys = ON` per connection in `get_conn` after a pass verifying ON DELETE behavior, **or** keep manual and add integration tests for delete cascades (ingredient with stock/recipes/quotes).
- **Roadmap:** Quality / domain hardening.

### [DOM-005] Migrations are idempotent DDL without version table
- **Severidade:** P2
- **Dimensão:** Domain & data
- **Evidência:** `run_migrations` runs ordered `CREATE IF NOT EXISTS` + `add_column_if_missing` + one table rebuild (`repair_shopping_list_items_nullable_ingredient`). No `schema_version` / `user_version` accounting.
- **Impacto:** Works for additive evolution; hard to ship data backfills that must run once; harder to detect drift.
- **Recomendação:** Introduce `PRAGMA user_version` or `schema_migrations` before first data-moving migration (path fix, full export).
- **Roadmap:** Before Fase 4 path migration.

### [DOM-006] Unit conversion & cost-per-portion generally sound
- **Severidade:** P3 (positive / residual edge)
- **Dimensão:** Domain & data
- **Evidência:** `Unit::convert_to` rejects cross-group and factor-less units; `calculate_cost` converts and uses `approximate_unit_weights` for clove/etc.; tests in `fase3_stock_tests` include weighted average across brands; domain `unit_parse_tests` round-trip Display/FromStr.
- **Impacto:** Residual: descriptive units and missing approx weights still yield imperfect costs; FE margin is not persisted server-side (OK).
- **Recomendação:** Keep expanding `approximate_unit_weights` from real kitchen use; add unit tests for `convert_to` matrix.
- **Roadmap:** Continuidade Fase 3.3 fix.

### [DOM-007] Event stock isolation model implemented
- **Severidade:** P3 (positive)
- **Dimensão:** Domain & data
- **Evidência:** `ingredients.event_id` / `recipes.event_id`; list filters `event_id IS NULL` for catalog; copy/promote helpers; dashboard aggregates filter catalog only.
- **Impacto:** Matches PROJECT model (a). Promote renames on collision with event suffix — OK.
- **Recomendação:** None beyond tests for promote collision and delete_event completeness.
- **Roadmap:** Fase 3.3 done.

### [DOM-008] Receipt confirm is status-idempotent, not transactional
- **Severidade:** P2
- **Dimensão:** Domain & data
- **Evidência:** Rejects if status already `confirmed`; loop inserts purchases + stock updates then sets status. No explicit single transaction wrapper visible around the whole confirm.
- **Impacto:** Mid-loop failure can leave partial purchases/stock with import still unconfirmed → retry may duplicate if status not set. (Depends on libSQL auto-commit per statement.)
- **Recomendação:** Wrap confirm body in an explicit transaction; set status last.
- **Roadmap:** Scanner hardening.

### [DOM-009] No waste log / stock history — blocks report features
- **Severidade:** P2
- **Dimensão:** Domain & data
- **Evidência:** `get_waste_report` / `get_stock_trends` return zeros/empty by design (comments in `db.rs` ~3908–3925). README discloses this.
- **Impacto:** Honest empty tabs; cannot deliver waste/stock-over-time without schema.
- **Recomendação:** Only add tables when product prioritizes those reports; don’t fake charts.
- **Roadmap:** After real-user signal (PROJECT polishing).

### [DOM-010] `usage_events` table with no writers
- **Severidade:** P3
- **Dimensão:** Domain & data
- **Evidência:** Migration 019 creates `usage_events`; comments say emitters deferred; `export_usage_data` reads empty table + problem_reports.
- **Impacto:** Dead schema until Instrumentation phase.
- **Recomendação:** Keep as shell; wire emitters when Instrumentation starts.
- **Roadmap:** Fase de Instrumentação.

---

## 3. Functional / product

### Feature parity: README vs code

| Promise | Status | Evidence |
|---------|--------|----------|
| Ingredient catalog, 20 units, categories, favorites | **Done** | domain `Unit::all`, IngredientsPage |
| Stock min qty, OK/Low/Out | **Done** | StockPage, dashboard_low_stock |
| Suppliers + quotes | **Done** | SuppliersPage, price_quotes_* |
| Recipes CRUD, cost/portion, photo | **Done** | RecipesPage, calculate_cost, images |
| Margin analysis (Custos) | **Done** (FE margin) | CostsPage + cost_calculate |
| Import recipe from URL | **Done** (preview) | recipe_import_from_url |
| Weekly meal planner DnD | **Done** | MealPlannerPage |
| Calendar | **Done** | CalendarPage |
| Shopping lists | **Done** | ShoppingListPage + generate from plan |
| Events isolated + promote | **Done** | Events*, copy/promote commands |
| Receipt OCR offline + IVA PT | **Partial** | FE IVA parse; backend parse; camera issue; multi-chain unproven |
| Reports cost/meal/price | **Done** | report_* live queries |
| Waste + stock-over-time | **Empty by design** | stubs + README |
| Dashboard cards + links | **Done** | DashboardPage |
| Suggester | **Missing** | Placeholder + empty API |
| Android build | **Documented only** | README commands; no `gen/android` in tree from init |

### [FUN-001] Desktop camera not production-verified
- **Severidade:** P1
- **Dimensão:** Functional (cross-ref BLD-002)
- **Evidência:** `ReceiptScannerPage` `getUserMedia`; PROJECT open bug; upload path works; `console.error("[camera]", e)` added.
- **Impacto:** Scanner UX degrades to file upload on affected Linux/WebKitGTK setups; mobile will use different API later.
- **Recomendação:** Mandatory checkpoint on clean AppImage/deb; document “upload always supported”.
- **Roadmap:** Fase 4 PRIORIDADE ALTA.

### [FUN-002] Backup/restore does not match user expectation
- **Severidade:** P1
- **Dimensão:** Functional
- **Evidência:** See DOM-003; Settings exposes export/import without full-data caveat in code paths reviewed.
- **Impacto:** Perceived data loss after restore.
- **Recomendação:** UI copy + prefer DB file export for full backup.
- **Roadmap:** Fase 4 / Settings.

### [FUN-003] OCR accuracy only validated on limited real receipts
- **Severidade:** P1
- **Dimensão:** Functional
- **Evidência:** PROJECT 3.5-bis: Pingo Doce samples; Continente/Lidl/Auchan not proven. FE has Resumo IVA segregation logic in `ReceiptScannerPage`.
- **Impacto:** Core differentiator may fail on common PT chains → user distrust.
- **Recomendação:** Build a fixture corpus (images + expected lines); manual scorecard before calling Scanner “done”.
- **Roadmap:** PROJECT priority before Polishing.

### [FUN-004] Suggester is a product dead-end
- **Severidade:** P2
- **Dimensão:** Functional
- **Evidência:** ARC-005.
- **Impacto:** Route/command clutter; README does not promise it (good) but in-app route exists.
- **Recomendação:** Remove from router until scoped.
- **Roadmap:** Optional / experiment.

### [FUN-005] Reports waste/stock tabs empty — correctly disclosed
- **Severidade:** P3
- **Dimensão:** Functional
- **Evidência:** README + backend stubs; ReportsPage still shows tabs.
- **Impacto:** Minor confusion if UI doesn’t repeat README honesty.
- **Recomendação:** EmptyState text citing “not tracked yet”.
- **Roadmap:** Polishing.

### [FUN-006] Help is introductory, not task-oriented
- **Severidade:** P3
- **Dimensão:** Functional
- **Evidência:** `HelpPage.tsx` — short section blurbs + external links (GitHub, Tauri, React).
- **Impacto:** Limited for kitchen onboarding (e.g. first receipt, event workflow).
- **Recomendação:** Add 3–4 “how to” flows when polishing.
- **Roadmap:** Polishing / real users.

### [FUN-007] Critical flows — static assessment

| Flow | Assessment |
|------|------------|
| Ingredients → stock → dashboard low stock | Connected via commands; catalog filters exclude event-scoped |
| Recipe → cost → margin | Backend cost + FE margin; unit conversion present |
| Planner → shopping list | `meal_plan_generate_shopping_list` / create_from_recipes exist |
| Scanner → confirm → stock | Works if OCR+units OK; DOM-002 risk; camera optional |
| Event isolate → promote | Implemented |
| Suppliers → quotes → costs | Quotes stored; cost path uses ingredient price / purchases (brand average tested) |
| Settings language / export / devtools | Language i18n; export partial; devtools debug-gated |

### [FUN-008] Open PROJECT bugs still code-relevant
- **Severidade:** P1–P2 (as filed)
- **Dimensão:** Functional
- **Evidência:** Open checkboxes in PROJECT: camera; OCR engine decision deferred; god-components deferred; clean machine test; instrumentation emitters; multi-platform.
- **Impacto:** Roadmap still accurate vs code.
- **Recomendação:** Keep PROJECT as source of truth; this audit should not reopen deferred structure work without user pain.
- **Roadmap:** n/a

---

## 4. UX / UI / i18n

### [UX-001] Design system exists and is mostly consistent
- **Severidade:** P3 (positive / residual)
- **Dimensão:** UX
- **Evidência:** `src/styles/theme.css`, `src/theme.ts`; UI kit: Modal, PageHeader, SearchBar, ConfirmDialog, StatusPill, EmptyState, Toast, Avatar; Layout/Sidebar.
- **Impacto:** Cohesive “pro-kitchen” look; residual inline styles and one-off modals (Ingredients).
- **Recomendação:** Converge on kit components opportunistically.
- **Roadmap:** Polishing.

### [UX-002] Empty/loading/error coverage uneven
- **Severidade:** P2
- **Dimensão:** UX
- **Evidência:** `EmptyState` / toast usage counts higher on Stock/Shopping/MealPlanner; Help/Costs lighter; PlaceholderPage generic.
- **Impacto:** Some failures only toast; dense flows (Scanner confirm, planner DnD) need clear recovery copy.
- **Recomendação:** Standardize: load error → inline retry; empty → EmptyState + primary action.
- **Roadmap:** Polishing.

### [UX-003] Dense flows: Scanner, Planner, Shopping
- **Severidade:** P2
- **Dimensão:** UX
- **Evidência:** ReceiptScanner multi-step (capture/OCR/edit/confirm); MealPlanner DnD; ShoppingList ~971 LOC with grouping/purchased.
- **Impacto:** Power-user capable but easy to make costly mistakes (confirm wrong lines → stock). No undo for receipt confirm.
- **Recomendação:** Confirm summary counts + total € before commit; optional “dry run”.
- **Roadmap:** Scanner + Polishing.

### [UX-004] Accessibility basic gaps
- **Severidade:** P2
- **Dimensão:** UX
- **Evidência:** Shared `Modal` has `role="dialog"`, `aria-modal`, Escape closes; **no focus trap / initial focus restore** observed. Icons often `aria-hidden`. Mix of native buttons and clickable divs in places. Min window width 1200px (`tauri.conf.json`) — poor for small laptop / future tablet.
- **Impacto:** Keyboard users and tight screens suffer; mobile port will need layout rethink.
- **Recomendação:** Focus trap in Modal; ensure icon-only buttons have `aria-label`; plan responsive shell before mobile.
- **Roadmap:** Multi-plataforma + Polishing.

### [UX-005] i18n PT/EN key parity is good; vocabulary still mixed
- **Severidade:** P3
- **Dimensão:** UX / i18n
- **Evidência:** `pt.ts` / `en.ts` both 989 lines; automated key token parity ~698/698. Unit labels hardcoded PT in `units.ts` and `domain.rs` (`name_pt`, pinch “pitada”) even in EN UI. Some backend error strings in Portuguese (`recipe_import_from_url`).
- **Impacto:** EN locale still shows PT unit long names / some errors.
- **Recomendação:** Route unit display through i18n keys; map backend errors to codes or English-neutral messages.
- **Roadmap:** PROJECT defers vocabulary i18n until feedback.

### [UX-006] Help page utility
- **Severidade:** P3
- **Dimensão:** UX
- **Evidência:** FUN-006.
- **Impacto:** Low support burden today; weak for first-run.
- **Recomendação:** Link Help sections to routes (deep links).
- **Roadmap:** Polishing.

### [UX-007] Kitchen-use fitness
- **Severidade:** P3
- **Dimensão:** UX
- **Evidência:** Status pills for stock; dashboard low stock; large touch targets inconsistent; desktop-first density.
- **Impacto:** Fine for back-office laptop use; less ideal for greasy-finger tablet on the pass.
- **Recomendação:** When doing Android, increase hit areas and contrast for status.
- **Roadmap:** Multi-plataforma.

---

## 5. Security & privacy

### [SEC-001] Release keystore committed to repository
- **Severidade:** P0
- **Dimensão:** Security
- **Evidência:** `mise-release.keystore` present at repo root; `git ls-files` tracks it; **not** in `.gitignore`.
- **Impacto:** Anyone with repo access can sign malware as the app if keystore password is weak/leaked/elsewhere; rotation pain if public.
- **Recomendação:** Immediately: add to `.gitignore`, remove from git history or at least `git rm --cached`, store in secret manager; **rotate** keystore if the repo was ever pushed remotely; document signing in private runbook.
- **Roadmap:** Fase 4 prerequisite.

### [SEC-002] Recipe URL import: SSRF / resource exhaustion
- **Severidade:** P1
- **Dimensão:** Security
- **Evidência:** `recipe_import_from_url` — `reqwest::Client::new().get(&url)` with no scheme check, no timeout, no max body size, browser-like User-Agent. Runs from privileged Rust side (not browser CORS).
- **Impacto:** Local app can be pointed at `http://127.0.0.1` / cloud metadata / large files → hang or internal network probe. Threat model is mostly local user, but still a footgun and bad if UI ever accepts untrusted links.
- **Recomendação:** Allow only `http`/`https`; set connect/read timeouts; limit bytes; optional block private IP ranges.
- **Roadmap:** Hardening anytime; before wider distribution.

### [SEC-003] `validator` never enforced
- **Severidade:** P2
- **Dimensão:** Security
- **Evidência:** `validator` in workspace; multiple `#[derive(Validate)]` + field attributes in `domain.rs` / `db.rs`; **zero** `.validate()` call sites in crates/src.
- **Impacto:** Empty names, overlong strings, out-of-range numbers depend on SQL/UI only.
- **Recomendação:** `input.validate().map_err(...)` at command boundary for mutated entities; or remove dead derives to avoid false confidence.
- **Roadmap:** Quality quick win.

### [SEC-004] Image upload size unbounded
- **Severidade:** P2
- **Dimensão:** Security
- **Evidência:** `save_base64_image` decodes full base64 to bytes and writes under `data_dir/images/` with server-generated filename (good — no path traversal on upload). No max length check.
- **Impacto:** Huge paste/upload can fill disk / memory.
- **Recomendação:** Cap decoded size (e.g. 8–15 MB) and dimensions policy.
- **Roadmap:** Hardening.

### [SEC-005] Image read/delete trusts DB path strings
- **Severidade:** P3
- **Dimensão:** Security
- **Evidência:** `image_read_base64` / `image_delete` do `data_dir.join(&path)` from DB. Paths normally `images/…`. Local DB attacker could store `../` paths.
- **Impacto:** Low on single-user trusted DB; relevant if import ever accepts external image path metadata.
- **Recomendação:** Resolve + `starts_with(images_dir)` check before read/remove.
- **Roadmap:** Defense in depth.

### [SEC-006] CSP residual for OCR is justified
- **Severidade:** P3
- **Dimensão:** Security
- **Evidência:** `tauri.conf.json` CSP: `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval' blob:`; `worker-src 'self' blob:`; `connect-src 'self' ipc: http://ipc.localhost`; img data:. Tessdata local under `public/tessdata`.
- **Impacto:** `wasm-unsafe-eval` required for tesseract WASM — acceptable tradeoff; CDN removed (Fase 4 item done).
- **Recomendação:** Keep offline OCR; revisit if switching native engine.
- **Roadmap:** OCR engine decision deferred.

### [SEC-007] Capabilities minimal; extra plugins registered
- **Severidade:** P2
- **Dimensão:** Security
- **Evidência:** `capabilities/default.json`: `core:default`, `opener:default` only. `src-tauri/Cargo.toml` also depends on `tauri-plugin-dialog`, `fs`, `shell` and inits dialog in `src-tauri/src/lib.rs`.
- **Impacto:** Plugins without granted capabilities may be inert (good) or partially available depending on Tauri defaults — worth confirming. Dead dependencies increase supply chain surface.
- **Recomendação:** Remove unused plugins **or** add least-privilege permissions if Settings file pickers need them; audit opener usage (`openExternal`).
- **Roadmap:** Fase 4 packaging pass.

### [SEC-008] Debug data destruction correctly cfg-gated
- **Severidade:** P3 (positive)
- **Dimensão:** Security
- **Evidência:** `delete_all_data` / `seed_demo_data` behind `#[cfg(debug_assertions)]` on AppDb, commands, and handler registration in `src-tauri`.
- **Impacto:** Should be absent from release binaries if built with `--release`.
- **Recomendação:** Confirm with `strings` on release artifact in clean build checklist.
- **Roadmap:** Fase 4 smoke.

### [SEC-009] Privacy: local-first; instrumentation shell only
- **Severidade:** P3
- **Dimensão:** Security / privacy
- **Evidência:** No telemetry senders found; `problem_report_create` stores locally; `export_usage_data` writes under app `exports/`. Image search uses Unsplash/Pexels **only if** env API keys set (empty key → skip).
- **Impacto:** Good default privacy. Future Instrumentation must stay opt-in / local-first per PROJECT.
- **Recomendação:** Keep exports user-triggered; never auto-upload problem reports.
- **Roadmap:** Fase de Instrumentação.

### [SEC-010] Network surface summary
- **Severidade:** P2
- **Dimensão:** Security
- **Evidência:** (1) recipe URL fetch (2) optional Unsplash/Pexels image search via env keys (3) opener for external docs links.
- **Impacto:** App is mostly offline; network features should degrade cleanly without keys (image search does).
- **Recomendação:** Document env vars; don’t ship keys in binary.
- **Roadmap:** n/a

---

## 6. Tests & quality

### [QA-001] Critical lack of automated coverage
- **Severidade:** P1
- **Dimensão:** Tests
- **Evidência:** Rust: ~7 `#[test]` in `db.rs` (ingredient line parse, some async stock/cost/image/problem_report) + 2 unit parse tests in `domain.rs`. **No** frontend test runner/deps in `package.json`. No Playwright/Cypress. Bindings exported via `cargo test -p mise-core export_bindings` pattern (historical).
- **Impacto:** Regressions in cost, receipt confirm, migrations, and 105 commands rely on manual testing — unsustainable for distribution.
- **Recomendação:** Minimal pyramid (below) before Fase 4 feature freeze.
- **Roadmap:** Quality gate alongside Distribuição.

### [QA-002] No CI workflows
- **Severidade:** P1
- **Dimensão:** Tests
- **Evidência:** No `.github/workflows` directory.
- **Impacto:** Broken `main` possible without local discipline.
- **Recomendação:** PR CI: `cargo test --workspace`, `cargo check --workspace`, `npm ci && npm run build`. Optional clippy later.
- **Roadmap:** Immediate quick win.

### [QA-003] TypeScript strictness is good
- **Severidade:** P3 (positive)
- **Dimensão:** Tests
- **Evidência:** `tsconfig.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`. Build script `tsc && vite build`. Few `as any` escapes.
- **Impacto:** FE refactors are relatively safe at compile time.
- **Recomendação:** Keep strict; avoid new `any`.
- **Roadmap:** n/a

### [QA-004] Domain logic is testable but under-tested
- **Severidade:** P2
- **Dimensão:** Tests
- **Evidência:** Pure `Unit::convert_to`; receipt text parsers; import JSON-LD extractors — good unit seams. Async DB tests use in-memory/temp patterns in `fase3_stock_tests`.
- **Impacto:** Missed chances for fast tests on P1 domain bugs (DOM-002).
- **Recomendação:** Priority tests: (1) convert_to matrix (2) receipt_confirm unit alignment (3) calculate_cost cross-unit (4) delete_event cascade (5) migrate path once exists.
- **Roadmap:** With QA-001.

### [QA-005] Recommended minimal test pyramid

| Layer | What | Tooling |
|-------|------|---------|
| Unit | Units, parsers (ingredient line, IVA split pure FE extract if moved), money rounding | `cargo test`, optional vitest later |
| Integration | Migrations on temp DB, receipt_confirm, export subset, event promote | `cargo test` + libSQL temp files |
| Smoke | `npm run build`, `cargo tauri build` on CI/nightly | GitHub Actions |
| E2E | Defer — WebKitGTK not Playwright-friendly; manual checklist for Scanner/Planner | Manual / later mobile |

Avoid over-engineering: no full Jest mirror of every page.

### [QA-006] Manual validation remains primary
- **Severidade:** P2
- **Dimensão:** Tests
- **Evidência:** PROJECT Fase 0 manual module testing checklist; seed_demo_data for demos.
- **Impacto:** OK for solo dev; insufficient alone for multi-platform.
- **Recomendação:** Maintain a one-page smoke checklist in `docs/` for clean-machine passes.
- **Roadmap:** Fase 4.

---

## 7. Build & distribution

### [BLD-001] DB path + migration (canonical with DOM-001)
- **Severidade:** P1
- **Dimensão:** Build
- **Evidência:** See DOM-001; PROJECT Fase 4 open item.
- **Impacto:** Upgrades can “empty” the app if path changes without migrate.
- **Recomendação:** Fix path + migrate old files + log resolved path once at startup (debug).
- **Roadmap:** Fase 4.

### [BLD-002] Camera checkpoint on clean machine
- **Severidade:** P1
- **Dimensão:** Build
- **Evidência:** FUN-001; PROJECT priority.
- **Impacto:** Blocks calling desktop Scanner “complete”.
- **Recomendação:** Test AppImage/deb on stock Ubuntu without Nix; record pass/fail.
- **Roadmap:** Fase 4.

### [BLD-003] Linux packaging posture vs macOS/Windows
- **Severidade:** P2
- **Dimensão:** Build
- **Evidência:** README: Releases AppImage/deb; “No installer for macOS/Windows yet”. `bundle.targets: "all"`. Icons present for icns/ico.
- **Impacto:** README claim of desktop platforms overstates shipping reality for non-Linux.
- **Recomendação:** Keep README honest (already mostly); only claim tested targets.
- **Roadmap:** Multi-plataforma desktop follow-up.

### [BLD-004] OCR assets inflate bundle (~37MB tessdata)
- **Severidade:** P2
- **Dimensão:** Build
- **Evidência:** `du -sh public/tessdata` → 37M; por+eng traineddata + wasm cores.
- **Impacto:** Larger downloads; acceptable for offline promise.
- **Recomendação:** Ensure vite/tauri packs `public/` correctly in release; consider lang subset if size bites.
- **Roadmap:** Fase 4 artifact review.

### [BLD-005] Reproducible dev shell is Nix-specific
- **Severidade:** P2
- **Dimensão:** Build
- **Evidência:** `shell.nix` pins nixGL commit; heavy LD_LIBRARY_PATH/EGL workarounds; README documents apt packages for non-Nix.
- **Impacto:** Contributor friction; dev bugs (camera/EGL) may not match user installs — PROJECT already separates these.
- **Recomendação:** Treat clean deb/AppImage as source of truth for bugs; keep shell.nix for maintainers.
- **Roadmap:** DX optional dimension.

### [BLD-006] Android/iOS not initialized in tree
- **Severidade:** P2
- **Dimensão:** Build
- **Evidência:** README android commands; no committed Android project under `src-tauri/gen` beyond schemas; keystore name suggests Android signing intent.
- **Impacto:** Multi-platform phase still greenfield (plugins, camera native, paths, UI width 1200).
- **Recomendação:** Don’t block Linux release on mobile; when starting mobile, budget camera plugin + responsive layout separately from desktop WebKit bug.
- **Roadmap:** Fase Multi-plataforma.

### [BLD-007] Bundle identity
- **Severidade:** P3
- **Dimensão:** Build
- **Evidência:** `productName`: "Recipe Planner"; `identifier`: `com.recipe-planner.app`; version `0.1.0`. Branding “mise” in UI/README title.
- **Impacto:** Mild brand/identifier mismatch for paths and OS menus.
- **Recomendação:** Decide display name vs id once before store listing; changing identifier later is painful.
- **Roadmap:** Fase 4.

### [BLD-008] Clean-machine checklist (recommended)

1. Install `.deb` or AppImage on stock Ubuntu (no Nix).  
2. First launch: DB created; UI PT/EN.  
3. Seed not available (release).  
4. Create ingredient → stock → appears dashboard.  
5. Recipe + cost.  
6. Scanner upload + confirm (camera try).  
7. Export note limitations.  
8. Upgrade install: data preserved (after path migration).  
9. `strings` release bin: no `delete_all_data`.  
10. Offline OCR (airplane mode).

---

## Prioritization matrix

| ID | Sev | Dimension | Title |
|----|-----|-----------|-------|
| SEC-001 | P0 | Security | Keystore in git |
| DOM-001 / BLD-001 | P1 | Domain/Build | DB path + migration |
| DOM-002 | P1 | Domain | Receipt stock unit conversion |
| DOM-003 / FUN-002 | P1 | Domain/Product | Export incomplete |
| FUN-001 / BLD-002 | P1 | Product/Build | Camera clean-machine |
| FUN-003 | P1 | Product | OCR multi-chain proof |
| QA-001 | P1 | Tests | Near-zero tests |
| QA-002 | P1 | Tests | No CI |
| SEC-002 | P1 | Security | URL import SSRF/timeouts |
| DOM-004 | P2 | Domain | FKs off |
| DOM-005 | P2 | Domain | No schema version |
| DOM-008 | P2 | Domain | receipt_confirm transaction |
| DOM-009 | P2 | Domain | No waste/history schema |
| ARC-001 | P2 | Architecture | db.rs monolith |
| ARC-002 | P2 | Architecture | God pages |
| ARC-004 | P2 | Architecture | Units duplicated |
| SEC-003 | P2 | Security | validator unused |
| SEC-004 | P2 | Security | Image size cap |
| SEC-007 | P2 | Security | Plugin/capability drift |
| SEC-010 | P2 | Security | Network surface docs |
| UX-002 | P2 | UX | Empty/error uneven |
| UX-003 | P2 | UX | Dense flows / no undo |
| UX-004 | P2 | UX | a11y + min width |
| FUN-004 | P2 | Product | Suggester dead |
| QA-004 | P2 | Tests | Under-tested seams |
| QA-006 | P2 | Tests | Manual-only process |
| BLD-003 | P2 | Build | Non-Linux weak |
| BLD-004 | P2 | Build | OCR bundle size |
| BLD-005 | P2 | Build | Nix vs user env |
| BLD-006 | P2 | Build | Mobile not started |
| *(P3 cluster)* | P3 | various | ARC-003/005/006/007, DOM-006/007/010, FUN-005/006/007, UX-001/005/006/007, SEC-005/006/008/009, QA-003, BLD-007 |

---

## Map to `PROJECT.md` phases

| Phase / item | Audit findings to fold in |
|--------------|---------------------------|
| **3.5 / OCR multi-chain** | FUN-003; keep IVA FE logic; corpus tests (QA) |
| **Fase 4 — Distribuição** | BLD-001/002/003/004/007/008, DOM-001/003/005, SEC-001/007/008, FUN-001/002, QA-002 smoke |
| **Instrumentação** | DOM-010, SEC-009 — wire emitters; keep local export |
| **Multi-plataforma** | BLD-006, UX-004/007, FUN-001 (native camera ≠ WebKit) |
| **Polishing (after real users)** | ARC-001/002, UX-*, FUN-005/006, DOM-009 features if demanded |
| **Experimentação (Vision LLM)** | Out of scope now; depends on OCR gap evidence |
| **Deferred god-components / i18n vocab** | ARC-002, UX-005 — audit agrees: don’t front-load |

---

## Explicit non-findings / limits

- **Performance & DX** not scored (excluded dimension): cold start, query plans on large `db.rs`, Vite bundle, Nix ergonomics.
- **No clean-machine run** in this audit — camera and packaging conclusions remain “risk/open” not “failed in CI”.
- **No receipt corpus** re-run — OCR quality not re-scored beyond PROJECT statements + code presence of IVA heuristics.
- **Not a line-by-line proof** of all 105 commands’ authorization (local trust model).
- **Legal RGPD** not assessed; technical privacy defaults look local-first.

---

## Suggested next actions (for a future fix plan — not part of this audit)

1. **P0 today:** keystore hygiene + rotation decision.  
2. **P1 pack for Fase 4:** path migrate, CI, export labeling or full DB backup, receipt unit fix, clean-machine camera/OCR smoke.  
3. **P1 product:** multi-chain OCR fixtures.  
4. **P2 backlog:** transactions on confirm, FK strategy, plugin cleanup, Modal a11y, remove suggester stub.  
5. **Only then** god-file splits if still painful.

---

*End of report. Edit freely: add/remove findings or dimensions before any implementation plan.*
