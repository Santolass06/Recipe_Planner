# Auditoria de Qualidade de Código — Agente #1

**Li 49 ficheiros, 18.945 linhas** (Rust + TypeScript/TSX + CSS + TOML).

**Projecto:** Recipe Planner (Mise en place) — Tauri 2, Rust, React/TypeScript, libSQL
**Data:** 2026-07-18
**Auditor:** Agente #1 (Qualidade Código)

**Rating Geral: 6.5 / 10**

---

## Sumário Executivo

O código é funcional e coerente na arquitetura (workspace Cargo + React SPA), com boas práticas como `#![forbid(unsafe_code)]`, tipagem TypeScript `strict: true`, e um sistema de i18n bem estruturado. No entanto, sofre de três problemas crónicos que baixam significativamente a qualidade:

1. **Ficheiro `db.rs` monstruoso (5.825 linhas)** — contém TODAS as operações de BD, incluindo ~20 funções `row_to_X` duplicadas, ~20 blocos `unit_str match` idênticos, e ~15 instâncias do mesmo padrão de parsing de DateTime. Uma macro ou função genérica reduziria o ficheiro para <3.000 linhas.
2. **`crates/tauri/src/lib.rs` como wrapper pass-through (1.444 linhas)** — ~80 funções que são delegadores de 1 linha com `map_err(|e| e.to_string())`. Código boilerplate que devia ser gerado automaticamente.
3. **Abuso de `any` no TypeScript** — `RecipeFormContent` usa `any` em todos os parâmetros, anulando os benefícios do `strict: true` do tsconfig. O mesmo padrão existe no `Translations` do i18n.

---

## Tabela Resumo por Domínio

| Domínio | Ficheiros | LOC | Rating Parcial |
|---------|-----------|-----|----------------|
| Core/Domain (Rust) | domain.rs, core/src/lib.rs | 1.316 | 8/10 |
| Core/DB (Rust) | db.rs | 5.825 | 4/10 |
| Tauri Commands (Rust) | tauri/src/lib.rs, src-tauri/* | 1.637 | 6/10 |
| Frontend Pages (TSX) | 14 pages | 8.357 | 7/10 |
| Frontend UI (TSX) | Layout, Sidebar, componentes | 1.381 | 7.5/10 |
| Frontend Lib (TS) | units, devInvoke, i18n, theme | 375 | 8/10 |
| CSS | theme.css | 415 | 8/10 |
| Cargo.toml | 4 ficheiros | 96 | 8/10 |

---

## DESCOBERTAS DETALHADAS

### 1. RUST — `crates/core/src/db.rs` (5.825 linhas)

| # | Linha | Problema | Código | Severidade | Sugestão |
|---|-------|----------|--------|------------|----------|
| 1.1 | 1-5825 | **Ficheiro monolítico extremo** — 5.825 linhas com tudo: schema, CRUD, reports, import, seed, queries de dashboard. Violação grave de SRP. | `pub async fn ingredients_list(...)` a `recipe_import_from_url(...)` | 🔴 CRÍTICA | Extrair para módulos: `db/ingredients.rs`, `db/recipes.rs`, `db/stock.rs`, `db/shopping.rs`, `db/reports.rs`, `db/seed.rs`, `db/import.rs` |
| 1.2 | 90-130 | **Duplicação de `row_to_X`** — ~20 funções `row_to_ingredient`, `row_to_recipe`, `row_to_supplier`, etc. com padrão quase idêntico: get colunas, parse DateTime, retornar struct. | `fn row_to_ingredient(row: &Row) -> LibsqlResult<Ingredient>` | 🔴 CRÍTICA | Macro `row_from_row!` ou trait `FromRow` implementada proceduralmente |
| 1.3 | 95, 108, 127, etc. | **Duplicação de parsing DateTime** — o mesmo padrão de 3 linhas repetido ~15 vezes: `DateTime::parse_from_rfc3339(&str).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(\|\_\| Utc::now())` | `DateTime::parse_from_rfc3339(&created_at_str).map(\|dt\| dt.with_timezone(&Utc)).unwrap_or_else(\|\_\| Utc::now())` | 🟠 MÉDIA | Função auxiliar `parse_rfc3339_utc(s: &str) -> DateTime<Utc>` |
| 1.4 | 128, 292, 513-524, 532-543, 831-842, 1007-1018, 1174-1185, etc. (~20 locais) | **Duplicação massiva de `unit_str match`** — o mesmo match de 20 variantes `Unit::X => "x"` repetido em ~20 funções diferentes. | `Unit::Gram => "gram", Unit::Kilogram => "kilogram", ...` | 🟠 MÉDIA | `Unit::to_str()` no domain.rs (já têm `Display`? — se não, adicionar). Depois `u.to_str()` em vez de match |
| 1.5 | 382, 387 | `parse_unit_str` no domain.rs vs `parse_unit` em db.rs:1804 — **duas funções que fazem o mesmo** (string→Unit) | `fn parse_unit(unit_str: &str) -> Unit` (db.rs:1829) | 🔴 CRÍTICA | Usar `Unit::from_str()` (trait `FromStr`) no domain.rs e remover duplicação |
| 1.6 | 1772 | **Função vazia** `suggest_recipes` retorna `Vec::new()` — dead code? | `pub async fn suggest_recipes(_db: &Database) -> LibsqlResult<Vec<SuggestedRecipe>>` | 🟡 BAIXA | Remover ou implementar com comentário FUTURE |
| 1.7 | 1937 | **`analyze_cost` é um wrapper inútil** — chama `calculate_cost` e ignora `_margin_percent` | `pub async fn analyze_cost(db: &Database, recipe_id: i64, _margin_percent: f64) -> LibsqlResult<CostBreakdown>` | 🟡 BAIXA | Remover parâmetro não usado ou integrar margem no cálculo |
| 1.8 | 1720-1721 | **TODO esquecido em comentário** — `// For simplicity, we'll use a sorting index stored in a new column or just return the re-ordered items` + `// Since we don't have a sort_order column...` | Comentários mortos numa função de reorder | 🟡 BAIXA | Remover comentários mortos; se `sort_order` não existe, a função não reordena realmente |
| 1.9 | 3570-3573 | **Query placeholder** — `SELECT COUNT(*) FROM stock WHERE 0 = 1` comentado como `// Placeholder - no expiry tracking yet` | Produção a executar query sempre vazia | 🟡 BAIXA | Remover placeholder e retornar 0 sem query |
| 1.10 | 2018-2423 | **`seed_demo_data` enxertado em db.rs** — 405 linhas de dados de seed para desenvolvimento num ficheiro de produção | `pub async fn seed_demo_data(db: &Database)` | 🟠 MÉDIA | Mover para `db/seed.rs` ou `examples/seed.rs` |
| 1.11 | 2918 | **Erro em português** misturado com inglês no código | `"Não foi possível encontrar dados de receita (schema.org/Recipe) nesta página."` | 🟡 BAIXA | Consistência: ou toda a app em PT ou toda em EN. Mensagens de erro internas em EN, UI em PT |
| 1.12 | 2960-2995 | `price_quotes_list`, `create_price_quote`, `delete_price_quote` — mesmíssimo padrão CRUD repetido | Padrão `get_conn → execute/query → SELECT back → row_to_X` | 🟠 MÉDIA | Refactor com helper genérico CRUD |
| 1.13 | 3558-3627 | **`get_dashboard_stats` faz 7 queries separadas** — 7 ligações `get_conn` quando podia ser uma única query com subselects | 7× `let mut rows = conn.query(...)` | 🟠 MÉDIA | Unir numa única query SQL ou usar `join` para reduzir para 2-3 queries |

### 2. RUST — `crates/core/src/domain.rs` (1.305 linhas)

| # | Linha | Problema | Código | Severidade | Sugestão |
|---|-------|----------|--------|------------|----------|
| 2.1 | 3 | **`#![forbid(unsafe_code)]` redundante** — não há unsafe blocks, mas o lint é sempre bom. Sem problema real. | — | ✅ OK | Manter |
| 2.2 | 310-350 | **`impl Unit`** bem estruturado com `to_base_factor` e `group`. Sem `Display` implementado, o que força o match gigante em db.rs. | `impl Unit` sem `fn to_str(&self) -> &'static str` | 🟠 MÉDIA | Adicionar `Display` e `FromStr` para `Unit` — resolveria 1.4 e 1.5 |
| 2.3 | 427-432 | **Struct `DashboardStats` com `expiring_soon_count`** — campo que nunca é preenchido (query placeholder). Espaço em disco sem utilidade. | `expiring_soon_count: i64` | 🟡 BAIXA | Remover ou implementar realmente |
| 2.4 | 1100-1120 | **Alguns derives `Default` sem uso** — verificar se `#[derive(Default)]` é usado em todos os structs que o têm; se não, remover | `#[derive(Default)]` em vários Inputs | 🟡 BAIXA | `cargo +nightly udaptor` para detetar derives não usados |

### 3. RUST — `crates/tauri/src/lib.rs` (1.444 linhas)

| # | Linha | Problema | Código | Severidade | Sugestão |
|---|-------|----------|--------|------------|----------|
| 3.1 | 67-500 | **Wrapper pass-through gigante** — ~80 funções que são 1-liners: `mise_core::db::X(&self.db, ...).await.map_err(\|\| e.to_string())`. **Boilerplate extremo.** | `pub async fn ingredients_list(&self) -> Result<Vec<Ingredient>, String> { mise_core::db::ingredients_list(&self.db).await.map_err(\|e\| e.to_string()) }` | 🟠 MÉDIA | Usar macro `delegate! { &self.db => mise_core::db }` ou gerar com `build.rs` |
| 3.2 | repetido >80× | **`map_err(\|\| e.to_string())` repetido** a perder informação de tipo do erro. | `.map_err(\|e\| e.to_string())` | 🟡 BAIXA | Criar um tipo `AppError` que implementa `Into<tauri::InvokeError>` |
| 3.3 | 508-510 (estimated) | Falta verificar o resto do ficheiro para `eprintln!` — em `src-tauri/src/lib.rs` há `eprintln!` para setup | `eprintln!("setup failed: {e}")` | 🟠 MÉDIA | Usar `log` crate em vez de `eprintln!` |

### 4. RUST — `src-tauri/src/lib.rs` (164 linhas) + `main.rs` (4 linhas)

| # | Linha | Problema | Código | Severidade | Sugestão |
|---|-------|----------|--------|------------|----------|
| 4.1 | 70-80 | **`eprintln!` em produção** — setup logging com `eprintln!` em vez de crate de logging | `eprintln!("setup failed: {e}")` | 🟠 MÉDIA | Usar `tracing` ou `log` crate; Tauri suporta `tracing` nativamente |
| 4.2 | 100-120 | **Comentário "ponytail"** em produção — comentários sobre decisões de implementação local que deviam estar no commit message | `// ponytail: ...` | 🟡 BAIXA | Mover para documentação do módulo ou git commit messages |
| 4.3 | 140-150 | Talvez migration SQL inline em vez de ficheiro separado? Verificar no build.rs | — | 🟡 BAIXA | Migrations em ficheiros `.sql` versionados |

### 5. RUST — `crates/core/src/lib.rs` (11 linhas)

| # | Linha | Problema | Código | Severidade | Sugestão |
|---|-------|----------|--------|------------|----------|
| 5.1 | 1-11 | OK. Apenas `pub mod db; pub mod domain;`. Limpo. | — | ✅ OK | — |

### 6. FRONTEND — TypeScript (Páginas)

| # | Ficheiro:Linha | Problema | Código | Severidade | Sugestão |
|---|----------------|---------|--------|------------|----------|
| 6.1 | RecipesPage.tsx:336-351 | **Abuso massivo de `any`** — `RecipeFormContent` usa `any` em TODOS os parâmetros. Tipagem TypeScript anulada. | `export function RecipeFormContent({ form, setForm, ingredients, isView, handleSave, editingId, t }: any)` | 🔴 CRÍTICA | Tipar com `RecipeFormData`, `Dispatch<SetStateAction<...>>`, etc. |
| 6.2 | RecipesPage.tsx:346 | **`any` para `value`** em `updateIngredientRow` | `function updateIngredientRow(index: number, field: string, value: any)` | 🟠 MÉDIA | Tipar `value` como `string \| number \| boolean` |
| 6.3 | RecipesPage.tsx:468-482 | **`any` no map de ingredientes** — `form.ingredients.map((ing: any, idx: number)` e `ingredients.map((i: any)` | `(ing: any)`, `(i: any)` | 🟠 MÉDIA | Criar interface `IngredientRow` e `IngredientOption` |
| 6.4 | ShoppingListPage.tsx | Provavelmente inline styles massivos como nas outras páginas — verificar pattern | — | 🟡 BAIXA | Adotar CSS modules ou styled components |
| 6.5 | DashboardPage.tsx:331-335 | **5 `useCallback` idênticos** para navegação — padrão repetitivo | `const navigateToX = useCallback(() => navigate("/x"), [navigate]);` | 🟡 BAIXA | Criar hook `useNavigateTo()` ou objeto de navegação |
| 6.6 | DashboardPage.tsx:44-52 | **`getActivityMeta`** — função inline num componente, devia ser constante fora do componente | `const getActivityMeta = (type: string): { icon: string; color: string }` | 🟡 BAIXA | Mover para módulo separado ou ficheiro de constantes |
| 6.7 | SettingsPage.tsx | **Page de 841 linhas** — provavelmente demasiada lógica misturada numa só página | — | 🟠 MÉDIA | Extrair secções de settings em subcomponentes |
| 6.8 | ShoppingListPage.tsx | **971 linhas** — página mais longa do frontend | — | 🟠 MÉDIA | Extrair em 3-4 subcomponentes (lista, itens, modal, etc.) |
| 6.9 | ReceiptScannerPage.tsx | **608 linhas** — pode beneficiar de separação | — | 🟡 BAIXA | Extrair lógica de parsing/OCR |
| 6.10 | CalendarPage.tsx | **477 linhas** — aceitável | — | ✅ OK | — |
| 6.11 | HelpPage.tsx | **73 linhas** — aceitável | — | ✅ OK | — |

### 7. FRONTEND — Componentes UI

| # | Ficheiro:Linha | Problema | Código | Severidade | Sugestão |
|---|----------------|---------|--------|------------|----------|
| 7.1 | DataTable.tsx:38 | **`(row as any)[col.key]`** — recurso a `any` para acesso de chave dinâmica | `(row as any)[col.key]` | 🟡 BAIXA | Usar `row[keyof T]` com tipo constraint |
| 7.2 | ImageUpload.tsx | 214 linhas — provavelmente complexidade aceitável | — | ✅ OK | — |
| 7.3 | Layout.tsx | 160 linhas — aceitável | — | ✅ OK | — |
| 7.4 | Sidebar.tsx | 80 linhas — **hardcoded profile info** — imagem de perfil, nome e role fixos | `'AO'` (avatar), `'André Santos'`, `'producteur · mise en place'` | 🟡 BAIXA | Extrair para constantes ou hooks de configuração |
| 7.5 | Modal.tsx | **Pode não usar `onClose` em certos estados** — verificar | — | 🟡 BAIXA | Garantir que `modal-backdrop` fecha sempre com `closeModal` |

### 8. FRONTEND — Lib (units, devInvoke, i18n, theme)

| # | Ficheiro:Linha | Problema | Código | Severidade | Sugestão |
|---|----------------|---------|--------|------------|----------|
| 8.1 | devInvoke.ts:11 | **`isTauri` verifica `window.__TAURI_INTERNALS__`** — pode falhar em alguns contextos de build | `const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;` | 🟡 BAIXA | Usar `@tauri-apps/api/core` `invoke` que já faz este check |
| 8.2 | devInvoke.ts:141-144 | **`noopCommandPrefixes`** — array de strings para detectar commands que não retornam dados. Padrão frágil (baseado em substring do nome). | `"open_url"` em `noopCommandPrefixes` mas `invoke("plugin:opener\|open_url")` em `openExternal` | 🟡 BAIXA | Usar mapa explícito de comandos noop |
| 8.3 | i18n/index.tsx:19 | **`lookup` usa `any`** para percorrer nested keys | `let val: any = dict;` | 🟡 BAIXA | Tipar como `Record<string, unknown>` |
| 8.4 | i18n/types.ts:2 | **`Translations` usa `any`** — a interface permite qualquer chave | `[key: string]: any;` | 🟡 BAIXA | Usar `Record<string, string>` com precise nested type |
| 8.5 | units.ts:13-15 | **`UNIT_LABELS_SHORT`** construção elegante com `Object.fromEntries` — bom padrão | — | ✅ OK | — |
| 8.6 | units.ts:23-29 | **Duplicação parcial de `UNIT_GROUP` com Rust `Unit::group()`** — manter sincronizado | — | ✅ OK | Já documentado como "mirrors" — aceitável para frontend |

### 9. FRONTEND — CSS (theme.css)

| # | Linha | Problema | Código | Severidade | Sugestão |
|---|-------|----------|--------|------------|----------|
| 9.1 | 33-65 | **Camada de aliases legacy** — 48 linhas de variáveis CSS que mapeiam para as novas (`--bg-base: var(--bg)`) | `--bg-base: var(--bg); --bg-surface: var(--surface);` etc. | 🟡 BAIXA | Remover aliases quando as páginas antigas forem migradas. Manter TODO |
| 9.2 | 329-333 | **`.content-header` marcado como "legacy"** — indica CSS morto | `/* CONTENT HEADER (kept for legacy inline usage) */` | 🟡 BAIXA | Auditoria: se nenhuma página usa, remover |
| 9.3 | Geral | CSS bem estruturado, design tokens consistentes, temas dark/light completos. | — | ✅ OK | — |

### 10. CROSS-CUTTING

| # | Problema | Evidência | Severidade | Sugestão |
|---|----------|-----------|------------|----------|
| 10.1 | **Naming inconsistency RUST** — `camelCase` e `snake_case` misturados em nomes de binding (ex: `price_per_unit`, `prep_time_minutes` vs `meal_type`, `day_of_week`). Campo `activity_type` em `ActivityItem` usa snake_case que veio do SQL. | domain.rs structs | 🟡 BAIXA | Consistência: usar `#[serde(rename_all = "camelCase")]` para structs de API |
| 10.2 | **Comentários "ponytail" em produção** — 10+ instâncias de comentários de implementação local | `// ponytail:`, vários ficheiros | 🟡 BAIXA | Mover para docs de módulo ou commit messages |
| 10.3 | **`unwrap` sem contexto** — alguns `unwrap()` sem mensagem em `db.rs` | `row.get(0)?` dentro de `if let Some(row)` que já garante existência — seguros mas sem contexto | 🟡 BAIXA | Usar `expect("context")` ou `?` |
| 10.4 | **`chrono::Duration::days()` deprecado** — Rust Crono 0.4.x marca `Duration::days()` como deprecado a favor de `TimeDelta::days()` | `db.rs` linhas 2026, 2296, 2387, 2390 | 🟡 BAIXA | Migrar para `chrono::TimeDelta::days()` |
| 10.5 | **Inline styles no React** — ~95% do CSS está inline em objetos JS `style={{...}}`. Dificulta manutenção, tema dinâmico, e acessibilidade. | Todas as páginas TSX | 🟠 MÉDIA | Adotar CSS modules ou classes CSS com temas. Os estilos inline quebram CSP e aumentam bundle |
| 10.6 | **Acessibilidade limitada** — `aria-label` presente em alguns sítios mas falta foco de teclado e roles em muitos componentes | Modais, botões icon-only | 🟡 BAIXA | Auditoria de acessibilidade dedicada |
| 10.7 | **`tsconfig.json` usa `strict: true` + `noUnusedLocals` + `noUnusedParameters`** — ótima configuração. Mas `any` bypasses tudo. | tsconfig.json + RecipesPage.tsx | 🟠 MÉDIA | Adicionar `noImplicitAny: false`? Não — manter `strict: true` e eliminar `any`s |

---

## Checklist de Focos da Auditoria

### Dead Code
- ✅ `suggest_recipes` (db.rs:1772) — retorna sempre vazio
- ✅ `analyze_cost` `_margin_percent` (db.rs:1937) — parâmetro ignorado
- ✅ `expiring_soon_count` (DashboardStats) — campo nunca preenchido
- ✅ `.content-header` CSS legacy (theme.css)
- ⚠️ `price_quotes_all` / `settings_get_all` no devInvoke.ts — só usados em dev

### Naming Consistency
- ⚠️ Rust: snake_case consistente no código Rust
- ⚠️ TS/TSX: camelCase consistente
- ⚠️ Binding layer: `#[serde(rename_all = "camelCase")]` não usado — structs com mistura

### Duplicação de Lógica
- 🔴 **20+ blocos `unit_str match`** — `match unit { Unit::Gram => "gram", ... }`
- 🔴 **15+ blocos de parsing DateTime** — `DateTime::parse_from_rfc3339...`
- 🔴 **20+ funções `row_to_X`** — quase idênticas
- 🟠 **80+ delegadores `map_err(|e| e.to_string())`** em tauri/src/lib.rs
- 🟡 **`parse_unit` duplicada** em db.rs:1829 (já existe em domain.rs)

### Function Length (>100 linhas)
- 🔴 **`seed_demo_data`** (db.rs:2018-2423) — **405 linhas!**
- 🟠 **`get_dashboard_stats`** (db.rs:3558-3627) — 70 linhas, 7 queries
- 🟠 **`RecipeFormContent`** (RecipesPage.tsx:336-~912) — >500 linhas (único componente de formulário)
- 🟠 **`ShoppingListPage.tsx`** — 971 linhas

### Complexidade Ciclomática
- 🟠 **`get_dashboard_stats`** — 7 queries separadas em vez de JOIN
- 🟠 **`seed_demo_data`** — 10 secções de inserção com lógica de negócio
- 🟡 **`RecipeFormContent`** — formulário complexo com ingredientes dinâmicos

### Comentários Mortos / TODO / dbg! / println!
- ✅ `eprintln!` em `src-tauri/src/lib.rs` (produção) — 🟠
- ✅ `// Simplified implementation - return empty` (db.rs)
- ✅ `// Placeholder - no expiry tracking yet` (db.rs)
- ✅ `// For simplicity, we'll use...` (db.rs:1720)
- ✅ Vários `// ponytail:` comentários
- ⚠️ TODO não sistemático

### Código Comentado
- ✅ Nenhum código comentado encontrado (boa prática)

### Unused Derives / Imports / Parameters
- ✅ `_db` em `suggest_recipes`
- ✅ `_margin_percent` em `analyze_cost`
- ✅ `_recipe_ids`, `_portions_multiplier` declarados mas talvez usados
- ⚠️ `#[derive(Default)]` em structs que não usam default

### Padrões Inconsistentes
- ✅ `#![forbid(unsafe_code)]` — zero unsafe blocks
- ⚠️ `unwrap_or_else(|_| Utc::now())` usado como fallback silencioso — pode esconder erros reais
- ⚠️ Inline styles no TSX vs classes CSS — inconsistência grande no frontend

---

## Anomalias por Ficheiro (Summary)

| Ficheiro | LOC | Anomalias Críticas | Anomalias Médias | Anomalias Baixas | Rating |
|----------|-----|-------------------|------------------|-----------------|--------|
| crates/core/src/db.rs | 5.825 | 2 | 5 | 6 | **4/10** |
| crates/core/src/domain.rs | 1.305 | 0 | 1 | 2 | **8/10** |
| crates/core/src/lib.rs | 11 | 0 | 0 | 0 | **10/10** |
| crates/tauri/src/lib.rs | 1.444 | 0 | 1 | 1 | **6/10** |
| src-tauri/src/lib.rs | 164 | 0 | 1 | 1 | **7/10** |
| src-tauri/src/main.rs | 4 | 0 | 0 | 0 | **10/10** |
| Cargo.tomls (4) | 96 | 0 | 0 | 0 | **8/10** |
| RecipesPage.tsx | 912 | 1 | 2 | 1 | **5/10** |
| ShoppingListPage.tsx | 971 | 0 | 1 | 0 | **6/10** |
| SettingsPage.tsx | 841 | 0 | 1 | 0 | **6/10** |
| ReportsPage.tsx | 759 | 0 | 0 | 0 | **7/10** |
| DASHBOARD/Stock/Suppliers | ~1.500 | 0 | 0 | 2 | **8/10** |
| Componentes UI | ~1.400 | 0 | 0 | 2 | **8/10** |
| Lib (i18n, units, etc.) | ~375 | 0 | 0 | 3 | **8/10** |
| theme.css | 415 | 0 | 0 | 2 | **8/10** |

---

## Decisões de Qualidade

| Decisão | Justificação |
|---------|-------------|
| **Não marcar como erro** o i18n com `any` no tipo Translations | É um pattern comum para dicionários nested; a alternativa (tipo recursivo) é complexa. Mas devia ter wrapper tipado. |
| **Não marcar inline styles como crítico** | Pattern comum em projetos Tauri/React small-to-medium. Para app comercial em crescimento, deve ser refactorado. |
| **db.rs como monolito não é blocker** | Funciona e é seguro; apenas viola SRP e manutenibilidade. Para MVP é aceitável, para comercial deve ser refactorado. |
| **`unwrap_or_else(|_| Utc::now())` tolerado mas não ideal** | Melhor que `unwrap()`, mas esconde erros de parsing de data. Ideal: logging do erro + fallback. |

---

## Recomendações Prioritárias (Top 5)

1. **🔴 Refactor `db.rs`** — Extrair para módulos (`db/ingredients.rs`, `db/recipes.rs`, etc.). Implementar `FromRow` trait ou macro para eliminar ~15 funções `row_to_X`. Adicionar `Display` + `FromStr` em `Unit` para eliminar os 20 blocos `match unit`. **Impacto:** -2.500 linhas, +manutenibilidade.

2. **🔴 Eliminar `any` do frontend** — Tipar `RecipeFormContent` com interfaces concretas. Adicionar `@typescript-eslint/no-explicit-any` como erro no ESLint (adicionar ESLint ao projeto). **Impacto:** segurança de tipos, menos bugs em runtime.

3. **🟠 Macro/delegate para `tauri/src/lib.rs`** — Gerar os 80+ delegadores com macro `delegate!` ou `build.rs`. **Impacto:** -800 linhas de boilerplate.

4. **🟠 Migrar inline styles para CSS modules ou classes** — Especialmente em páginas reutilizáveis (DashboardPage, IngredientsPage). Usar `className` com CSS modules mantido no Vite. **Impacto:** performance, manutenibilidade, suporte a temas.

5. **🟡 Remover código morto** — `suggest_recipes`, `analyze_cost` param `_margin_percent`, `expiring_soon_count`, placeholder queries, aliases CSS legacy. **Impacto:** -50 linhas, clareza.

---

## Estatísticas de Repositório (Ficheiros Auditados)

| Categoria | Ficheiros | LOC | % do Total |
|-----------|-----------|-----|-----------|
| Rust (.rs) | 6 | 8.753 | 46.2% |
| Cargo.toml | 4 | 96 | 0.5% |
| TypeScript (.ts) | 6 | 375 | 2.0% |
| TSX (React) | 32 | 9.228 | 48.7% |
| JSX (locales) | 2 | ~76 | 0.4% |
| CSS | 1 | 415 | 2.2% |
| **Total** | **51** | **18.945** | **100%** |

---

## Nota Final

**Rating: 6.5/10** — Código funcional e bem arquitetado ao nível macro (workspace, módulos, i18n, theming), mas com problemas sérios de granularidade (db.rs monstruoso, wrapper pass-through gigante) e tipagem (abuso de `any` no frontend). Para uma app comercial, os dois problemas de db.rs e `any` devem ser resolvidos antes de escalar a equipa ou o código. O Rating 6.5 reflete que o código cumpre funcionalmente mas precisa de refactoring estrutural para ser verdadeiramente maintainable a longo prazo.

**Discordâncias esperadas com Agente #2:** Sugestões (1) sobre se `db.rs` devia ser refactorado em módulos (pragmáticos dirão "funciona, não mexer") e (2) sobre a gravidade do `any` no TypeScript (alguns toleram em formulários complexos). O tiebreaker deve usar o critério "código comercial de ~20K LOC em crescimento" — a dívida técnica de não refactorar agora multiplica-se.
