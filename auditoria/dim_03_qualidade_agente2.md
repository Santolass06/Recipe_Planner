# Auditoria de Qualidade de Código — Agente #2

**Projecto:** Recipe Planner (Mise) — Tauri 2 (Rust + React/TypeScript + libSQL)
**Data:** 2026-07-18
**Auditor:** Agente #2 (Qualidade Código)
**Total:** Li **48 ficheiros**, **~21.300 linhas** (~8.750 Rust + ~12.470 TS/TSX/CSS + ~65 Cargo.toml)

---

## Rating Global: **5/10**

**Justificação:** O código é funcional e tem uma estrutura de domínio clara, mas sofre de duplicação massiva de lógica de conversão de unidades (12+ match blocks idênticos), funções monstruosas num único ficheiro de 5.825 linhas, dead code (struct nunca usada, placeholders não implementados), `unwrap()` em produção, debug output via `eprintln!`, e duplicação manual de dados de domínio entre Rust e TypeScript. A base está sólida; os problemas são de maturidade e refactoring, não de concepção.

---

## Índice

1. [Rust: crates/core/src/lib.rs](#1-rust-cratescoresrclibrs)
2. [Rust: crates/core/src/db.rs](#2-rust-cratescoresrcdbrs)
3. [Rust: crates/core/src/domain.rs](#3-rust-cratescoresrclibrs)
4. [Rust: crates/tauri/src/lib.rs](#4-rust-cratestaurisrclibrs)
5. [Rust: src-tauri/src/lib.rs & src-tauri/src/main.rs](#5-rust-src-taurisrclibrs--src-taurisrcmainrs)
6. [Cargo.toml (workspace + crates)](#6-cargotoml-workspace--crates)
7. [Frontend: src/ (TS/TSX geral)](#7-frontend-src-tstsx-geral)
8. [Frontend: src/lib/](#8-frontend-srclib)
9. [Frontend: src/pages/](#9-frontend-srcpages)
10. [Frontend: src/components/](#10-frontend-srccomponents)
11. [Frontend: src/styles/theme.css](#11-frontend-srcstylesthemecss)
12. [Frontend: src/i18n/](#12-frontend-srci18n)
13. [Resumo por Severidade](#13-resumo-por-severidade)

---

## 1. Rust: `crates/core/src/lib.rs`

**Total:** 11 linhas. Ficheiro limpo, apenas re-exports.

| Linha | Problema | Código | Severidade | Sugestão |
|-------|----------|--------|-----------|----------|
| 6 | Bom: `#![forbid(unsafe_code)]` | `#![forbid(unsafe_code)]` | ✅ (Boas práticas) | Manter |

**Sem achados negativos.**

---

## 2. Rust: `crates/core/src/db.rs`

**Total:** 5.825 linhas. **O maior foco de problemas de qualidade.**

### 2.1 — Duplicação Massiva de Match Blocks (STRING ↔ UNIT)

Este é o problema mais grave do código. A conversão entre `Unit::Gram` e `"gram"` está duplicada dezenas de vezes.

#### Caso A: Unit → string (`Unit::Gram => "gram"`)

O mesmo match block de 20 branches aparece **10 vezes** em produção:

| # | Linha | Contexto |
|---|-------|----------|
| 1 | 995 | `create_ingredient` |
| 2 | 1027 | `update_ingredient` |
| 3 | 1201 | `create_shopping_list` (dentro de `create_recipe` path) |
| 4 | 1246 | `create_shopping_list_from_recipes` |
| 5 | 1463 | `shopping_list_add_item` |
| 6 | 1529 | `shopping_list_update_item` |
| 7 | 1577 | `shopping_list_mark_purchased` |
| 8 | 4764 | `stock_purchase_add` |
| 9 | 5159 | `stock_purchase_add` (repetido) |
| 10 | 5234 | `receipt_confirm` |

**Problema:** 10 match blocks idênticos — qualquer adição de unidade (ex.: `Unit::FluidOunce`) obriga a 10 edições.

**Severidade:** 🔴 CRÍTICA

**Sugestão de fix:** Implementar `impl Display for Unit` ou `impl Unit { fn as_str(&self) -> &'static str }` em `domain.rs`. Já existe `Unit::label()` (L47) que devolve símbolos curtos ("g", "kg") — criar `Unit::to_snake_case()` que devolva `"gram"`, `"kilogram"`, etc.

#### Caso B: string → Unit (`"gram" => Unit::Gram`)

O match block inverso aparece **12+ vezes**:

| # | Linha | Contexto |
|---|-------|----------|
| 1 | 578 | `row_to_ingredient` |
| 2 | 665 | `row_to_recipe_with_ingredients` |
| 3 | 705 | `row_to_recipe_with_ingredients` (2º) |
| 4 | 769 | `row_to_stock_item` |
| 5 | 1113 | `recipes_list` |
| 6 | 1831 | `calculate_cost` (função local `parse_unit`) |
| 7 | 3069 | `stock_purchases_list` |
| 8 | 3486 | `generate_shopping_list_from_meal_plan` |
| 9 | 3946 | `get_low_stock_ingredients` |
| 10 | 4694 | `parse_unit_str` (standalone) |
| 11 | 4782 | `stock_purchase_add` |
| 12 | 5147 | `receipt_confirm` |

**Problema:** Além das 12 repetições, **existem duas funções distintas** que fazem a mesma coisa:
- `fn parse_unit()` dentro de `calculate_cost` (L1829) — lida com TODAS as unidades
- `fn parse_unit_str()` standalone (L4692) — lida com um subconjunto

Ambas deviam ser a mesma função pública em `domain.rs`.

**Severidade:** 🔴 CRÍTICA

**Sugestão de fix:** Extrair para `impl FromStr for Unit` ou `impl Unit { fn from_str(s: &str) -> Option<Unit> }` em `domain.rs`. Substituir todos os match blocks por `unit.parse().ok()?` ou `Unit::from_str(&unit_str)?`.

### 2.2 — Funções Monstro (Function Length)

| Função | Linhas | Linhas (início-fim) | Justificação |
|--------|--------|--------------------|--------------|
| `run_migrations` | 394 | L68-L461 | Aceitável (DDL schema) |
| `seed_demo_data` | 408 | L2018-L2425 | Aceitável (dados demo hardcoded) |
| `generate_shopping_list_from_meal_plan` | 103 | L3455-L3557 | ❌ Deveria ser refactorada |
| `get_recent_activity` | 118 | L3630-L3747 | ❌ Deveria ser refactorada |
| `get_meal_plan_entries_by_date_range` | 86 | L3823-L3908 | ⚠️ Borderline |
| `get_cost_report` | 128 | L3994-L4121 | ❌ Deveria ser refactorada |
| `get_meal_stats` | 113 | L4143-L4255 | ❌ Deveria ser refactorada |
| `stock_purchase_add` | 88 | L4760-L4847 | ⚠️ Borderline |
| `parse_receipt_text` | 126 | L4969-L5094 | ❌ Deveria ser refactorada |
| `receipt_confirm` | 126 | L5101-L5226 | ❌ Deveria ser refactorada |
| `import_data` | 82 | L3158-L3239 | ⚠️ Borderline |
| `export_data` | ~70 | L3074-L3150 | ⚠️ Borderline |

**Severidade:** 🟡 ALTA (5 funções > 100 linhas sem justificação)

**Sugestão de fix:** Extrair helpers de formatação/queries internas. Ex.: `get_cost_report` (L3994-4121) mistura 3 responsabilidades (construção SQL, cálculo, formatação).

### 2.3 — `unwrap()` em Código de Produção

O ficheiro tem **~50 chamadas `unwrap()`** no total. A maioria está em testes (`#[cfg(test)]`), mas várias estão em produção:

| Linha | Código | Risco |
|-------|--------|-------|
| 2252 | `.find(...).unwrap().2` | 🟡 ALTO — acede a índice 2 dum tuple sem verificar existência |
| 2282 | `.map(...).unwrap()` | 🟡 ALTO — mesmo padrão |
| 2362 | `.map(...).unwrap()` | 🟡 ALTO — mesmo padrão |
| 2883 | `unit_from_ingredient_word(words[idx]).unwrap()` | 🟡 ALTO — assume que o idx do `position()` ainda é válido |
| 5272-5486 | Restantes em testes | ✅ Aceitável em código de teste |

**Severidade:** 🟡 ALTA

**Sugestão de fix:** Substituir por `ok_or_else(|| format!("..."))?` ou `expect("contexto")`.

### 2.4 — `std::mem::drop()` Desnecessário

| Linha | Código |
|-------|--------|
| 2646 | `drop(rows);` |
| 2667 | `drop(rows);` |
| 2685 | `drop(rows);` |

**Problema:** Rust faz scope-based drop automaticamente. `drop()` só é necessário para evitar borrow checker em casos específicos (ex.: borrows ativos). Aqui não há conflito — é noise.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Remover os 3 `drop()`.

### 2.5 — `HashMap` Importado Localmente

| Linha | Código |
|-------|--------|
| 2019 | `use std::collections::HashMap;` (dentro de `seed_demo_data`) |

**Problema:** O `use` está dentro da função, não no topo do ficheiro. Inconsistente com o resto do código.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Mover para o topo com os restantes imports.

### 2.6 — Código Comentado / Placeholders

| Linha | Problema |
|-------|----------|
| L432-433 | Comentário sobre tabelas `usage_events` que seriam criadas "no futuro" — planeamento embutido em comentário |
| L1720-1724 | 5 linhas de código comentado sobre `sort_order` |
| L1773 | `"Simplified implementation - return empty"` — placeholder não implementado |
| L4120 | Comentário: "dead work removed" (códio removido, comentário sobrevivente) |
| L4984 | `"This would need DB access - for now we just parse without matching"` — funcionalidade incompleta |
| L5071-5072 | `"This would require DB access - placeholder for now"` — funcionalidade incompleta |

**Severidade:** 🟡 ALTA (placeholders em produção)

**Sugestão de fix:** Criar tickets/issues em vez de comentários. Placeholders devem ser marcados com `TODO(#issue)`.

---

## 3. Rust: `crates/core/src/domain.rs`

**Total:** 1.305 linhas. Código de domínio bem estruturado.

### 3.1 — Dead Struct: `ShoppingListWithItems`

| Linha | Problema | Código |
|-------|----------|--------|
| 373-379 | Struct definida mas **NUNCA USADA** em Rust | `pub struct ShoppingListWithItems { #[serde(flatten)] pub list: ShoppingList }` |

**Problema:** Esta struct faz `#[serde(flatten)]` de `ShoppingList` que já contém `items: Vec<ShoppingItem>`. O comentário na L378 diz "items is already part of ShoppingList". A struct é exportada para TS via `ts_rs` mas nunca referenciada por nenhuma função em Rust. É dead code.

**Severidade:** 🟡 ALTA

**Sugestão de fix:** Remover a struct. Se for necessária para TS bindings, adicionar `#[allow(dead_code)]` ou `pub(crate)` com justificação.

### 3.2 — Duplicação de Lógica com Frontend

Comparar `domain.rs` (Rust) com `units.ts` (TS):

| Dado | Rust (domain.rs) | TS (units.ts) |
|------|------------------|---------------|
| Factor base | `Unit::to_base_factor()` (L76-96) | `UNIT_BASE_FACTOR` (L31-37) |
| Grupo | `Unit::group()` (L37-45) | `UNIT_GROUP` (L23-29) |
| Conversão | `Unit::convert_to()` (L103-113) | `convertUnit()` (L40-47) |

**Problema:** Os dados de conversão de unidades estão **duplicados manualmente** em Rust e TypeScript. Uma alteração (ex.: precisão do `ounce: 28.3495`) exige editar 2 ficheiros em sincronia. Não há teste de regressão que detecte a divergência.

**Severidade:** 🟡 ALTA

**Sugestão de fix:** Gerar `units.ts` a partir de `domain.rs` via macro ou script de build. Ou pelo menos ter um teste que compare os valores.

### 3.3 — Outros Achados Menores

| Linha | Problema | Sugestão |
|-------|----------|----------|
| L7 | `use validator::Validate;` importado mas só algumas structs usam `#[derive(Validate)]` | Verificar se é usado em todas — acceptable waste |
| L130 | `#[validate(range(min = 1))]` em `ingredient_id: i64` (min=1 num signed i64) | ✅ Correcto (IDs começam em 1) |

**Sem achados críticos negativos.**

---

## 4. Rust: `crates/tauri/src/lib.rs`

**Total:** 1.444 linhas. Maioria é boilerplate de delegação (60+ métodos que só chamam `mise_core::db::*`).

### 4.1 — Duplicação de `apply_native_theme`

| Linhas | Problema |
|--------|----------|
| L41-49 | `fn apply_native_theme()` — implementação Linux (usa `gsettings`) |
| L50 | `fn apply_native_theme() {}` — stub para non-Linux |

**Problema:** O stub para non-Linux está vazio e é unreachable em produção (Tauri só corre num SO). A presença de ambas gera confusão — não há `#[cfg(target_os = "linux")]`.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Juntar com `#[cfg(target_os = "linux")]` no mesmo bloco.

### 4.2 — `.map_err(|e| e.to_string())` = Perda de Tipo

Todas as funções de comando fazem:
```rust
db.some_method().await.map_err(|e| e.to_string())
```

**Problema:** Converter `LibsqlResult` para `String` perde informação de tipo. O frontend recebe uma string opaca.

**Severidade:** 🟢 BAIXA (padrão aceite em Tauri, mas subótimo)

**Sugestão de fix:** Usar `#[tauri::command]` com `Result<T, String>` e implementar `From<LibsqlError>` para `String` centralizado.

---

## 5. Rust: `src-tauri/src/lib.rs` & `src-tauri/src/main.rs`

### 5.1 — `eprintln!` em Produção

| Ficheiro | Linha | Código |
|----------|-------|--------|
| `src-tauri/src/lib.rs` | 26 | `eprintln!("Failed to initialize app state: {}", e);` |

**Problema:** `eprintln!` escreve para stderr e não permite controlo de verbosidade, níveis de log, nem formatação estruturada. Em produção, num Tauri app, isto aparece no terminal do utilizador ou no console do sistema.

**Severidade:** 🟡 ALTA

**Sugestão de fix:** Usar `log::error!()` e configurar `env_logger` ou `tracing-subscriber`. Tauri já suporta plugins de logging.

### 5.2 — `main.rs` Exemplar

✅ 4 linhas, limpo, sem problemas.

---

## 6. Cargo.toml (workspace + crates)

### 6.1 — Workspace Cargo.toml

```toml
[workspace.dependencies]
libsql = { version = "0.6" }
...
```

**Problema:** A versão `0.6` do `libsql` está fixa. Verificar se `crates/core/Cargo.toml` usa `libsql.workspace` ou versão directa.

| Ficheiro | Usa workspace? |
|----------|---------------|
| `crates/core/Cargo.toml` | ✅ `libsql.workspace = true` |
| `crates/tauri/Cargo.toml` | N/A (não depende de libsql directamente) |
| `src-tauri/Cargo.toml` | N/A |

✅ Tudo consistente.

---

## 7. Frontend: `src/` (TS/TSX geral)

### 7.1 — `console.warn` / `console.error` / `console.debug` em Produção

| Ficheiro | Linha | Código |
|----------|-------|--------|
| `main.tsx` | 12 | `console.warn("theme init failed", e);` |
| `i18n/index.tsx` | 73 | `console.warn(\`[i18n] missing key "${key}"...\`)` — só em DEV ✅ |
| `devInvoke.ts` | 160 | `console.debug(\`[devInvoke]\`)` — só em DEV ✅ |
| `devInvoke.ts` | 171 | `console.error("Error opening link:", e);` |
| `ImageUpload.tsx` | 67 | `console.error("Error loading image:", e);` |
| `ReceiptScannerPage.tsx` | 242 | `console.error("[camera]", e);` |
| `ShoppingListPage.tsx` | 94, 223, 253, 458, 797, 806 | 6× `console.error(e);` |

**Problema:** `console.error` e `console.warn` em produção (não guardados por `if (import.meta.env.DEV)`). Em Tauri, estes aparecem no WebView console e são invisíveis ao utilizador — mas poluem e não são persistidos.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Envolver em `if (import.meta.env.DEV)` ou implementar um logger leve que possa ser desligado.

### 7.2 — `router.tsx` — Rota "sugestor" com Placeholder

| Linha | Problema |
|-------|----------|
| 36 | `{ path: "sugestor", element: <PlaceholderPage name="sugestor" /> }` |

**Problema:** Rota funcional mas sem implementação real — mostra um placeholder genérico.

**Severidade:** 🟢 BAIXA (rota menor)

### 7.3 — `theme.ts` — `systemPrefersDark` exportada mas só usada internamente

| Linha | Problema |
|-------|----------|
| 8 | `export async function systemPrefersDark()` |

**Problema:** Função exportada mas não importada por nenhum outro ficheiro. Só é usada dentro de `applyTheme()` (L21). O export é desnecessário.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Remover `export` ou manter como API pública documentada.

---

## 8. Frontend: `src/lib/`

### 8.1 — `devInvoke.ts` (173 linhas)

| Linha | Problema |
|-------|----------|
| 160 | `console.debug` — aceitável porque guardado por `if (import.meta.env.DEV)` ✅ |
| 171 | `console.error` — NÃO guardado por DEV check ❌ |

**Problema:** L171 chama `console.error` sem guarda de ambiente DEV.

### 8.2 — `units.ts` (47 linhas)

✅ Código bem escrito e limpo. A duplicação de dados com `domain.rs` já foi reportada em [3.2].

---

## 9. Frontend: `src/pages/`

### 9.1 — `ShoppingListPage.tsx` (971 linhas)

**Problema:** Componente excessivamente grande. Mistura:
- Lógica de estado (useState, useEffect)
- Renderização de modal (criação de lista)
- Renderização de modal (editar item)
- Lista de compras
- Histórico de compras
- Marcar como comprado

**Severidade:** 🟡 ALTA

**Sugestão de fix:** Extrair sub-componentes: `ShoppingListHeader`, `ShoppingListItem`, `PurchaseHistory`, `AddItemModal`.

### 9.2 — `RecipesPage.tsx` (912 linhas)

**Problema:** Também muito grande, mas bem estruturado com secções visuais claras. Ainda assim, >900 linhas num componente é um code smell.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Extrair `RecipeForm`, `RecipeCard`, `IngredientRow`.

### 9.3 — `SettingsPage.tsx` (841 linhas)

**Problema:** A página de definições com 841 linhas para o que é essencialmente um formulário com várias abas.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Extrair cada aba para componente separado.

### 9.4 — Padrão de Import de Bindings

Várias páginas importam tipos de `../../crates/core/bindings/`:

```
import type { DashboardStats } from "../../crates/core/bindings/DashboardStats";
```

**Problema:** Caminhos relativos que sobem pela estrutura do projecto Tauri. Se a estrutura de diretórios mudar (ex.: separar frontend), todos os imports partem.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Configurar path alias no `tsconfig.json` (ex.: `@bindings/*`).

---

## 10. Frontend: `src/components/`

### 10.1 — `PageHeaderContext.tsx` — Contexto vs Props

| Linha | Problema |
|-------|----------|
| L9-29 | `PageHeaderProvider` e `usePageHeaderContext` |

**Problema:** O `PageHeaderContext` permite que qualquer página defina o título/actions sem props — padrão aceitável mas discutível. O `Layout` lê o contexto (L32) que é populado por `PageHeader` que cada página renderiza. Isto cria um acoplamento implícito.

**Severidade:** 🟢 BAIXA (padrão React, questão de preferência)

### 10.2 — `ImageUpload.tsx` — `console.error` sem guarda

Remete para [7.1].

### 10.3 — Componentes UI (geral)

| Componente | Linhas | Problema |
|-----------|--------|----------|
| `Toast.tsx` | 68 | ✅ Limpo |
| `Modal.tsx` | 41 | ✅ Limpo |
| `ConfirmDialog.tsx` | 45 | ✅ Limpo |
| `DataTable.tsx` | 47 | ✅ Limpo |
| `SearchBar.tsx` | 37 | ✅ Limpo |
| `PageHeader.tsx` | 27 | ✅ Limpo |
| `EmptyState.tsx` | 21 | ✅ Limpo |
| `StatusPill.tsx` | 13 | ✅ Limpo |
| `Avatar.tsx` | 34 | ✅ Limpo |

**Sem achados críticos.** Componentes UI pequenos e bem focados.

---

## 11. Frontend: `src/styles/theme.css`

**Total:** 415 linhas. CSS bem organizado com design tokens.

### 11.1 — Legacy Alias Layer

| Linhas | Problema |
|--------|----------|
| L33-58 | `--bg-base: var(--bg); --bg-surface: var(--surface); ...` |

**Problema:** ~25 variáveis CSS são meros aliases para outras variáveis. O comentário diz "legacy alias layer — bridges older component code". Isto é dívida técnica: componentes antigos usam os aliases, componentes novos usam os tokens directos. Quando todos os componentes forem migrados, estas 25 linhas são dead code.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Aceitável como camada de transição. Criar tarefa para remover quando os componentes antigos forem migrados.

---

## 12. Frontend: `src/i18n/`

### 12.1 — `types.ts` — Interface Muito Solta

| Linha | Código |
|-------|--------|
| 2 | `[key: string]: any;` |

**Problema:** `Translations` permite qualquer chave com qualquer tipo. As listagens reais (`theme_dark`, `theme_light`) são apenas sugestões. Perde-se type safety nas traduções.

**Severidade:** 🟢 MÉDIA

**Sugestão de fix:** Gerar tipos a partir de um locale canónico ou usar um sistema de tradução com tipos fortes (ex.: `typesafe-i18n`).

### 12.2 — `locales/en.ts` e `locales/pt.ts` (989 linhas cada)

✅ Estrutura de tradução completa. Os ficheiros são grandes mas a natureza de ficheiros de tradução justifica.

### 12.3 — `index.tsx` (96 linhas)

✅ Boa implementação de `I18nProvider` com lazy loading, fallback para idioma de referência e cache. Detalhe positivo: carrega o locale de referência mesmo quando o activo é diferente (L56).

---

## 13. Resumo por Severidade

### 🔴 CRÍTICOS

| # | Ficheiro | Linha | Problema |
|---|----------|-------|----------|
| 1 | `db.rs` | 10× (995-5234) | Duplicação match Unit→string |
| 2 | `db.rs` | 12× (578-5147) | Duplicação match string→Unit |
| 3 | `db.rs` | L1829 vs L4692 | Duas funções `parse_unit*` separadas |

### 🟡 ALTOS

| # | Ficheiro | Linha | Problema |
|---|----------|-------|----------|
| 4 | `db.rs` | L3455, L3630, L3994, L4143, L4969, L5101 | 6 funções > 100 linhas |
| 5 | `db.rs` | L2252, L2282, L2362, L2883 | `unwrap()` em produção |
| 6 | `domain.rs` | L375 | Dead struct `ShoppingListWithItems` |
| 7 | `domain.rs`/`units.ts` | Duplicado | Conversão de unidades duplicada manualmente |
| 8 | `src-tauri/lib.rs` | 26 | `eprintln!` em produção |
| 9 | `ShoppingListPage.tsx` | 971 | Componente excessivamente grande |
| 10 | `db.rs` | L1773, L4984, L5071 | Placeholders não implementados |

### 🟢 MÉDIOS

| # | Ficheiro | Linha | Problema |
|---|----------|-------|----------|
| 11 | `db.rs` | 2646, 2667, 2685 | `std::mem::drop()` desnecessário |
| 12 | `db.rs` | 2019 | `use HashMap` dentro de função |
| 13 | `crates/tauri/lib.rs` | 41-50 | `apply_native_theme` sem `#[cfg]` |
| 14 | `src/` (vários) | 7× | `console.error/warn` sem guarda DEV |
| 15 | `theme.css` | 33-58 | Legacy alias layer (dívida técnica) |
| 16 | `i18n/types.ts` | 2 | `[key: string]: any` — type safety fraca |
| 17 | `RecipesPage.tsx` | 912 | Componente grande |
| 18 | `SettingsPage.tsx` | 841 | Componente grande |
| 19 | `theme.ts` | 8 | Export não usado (`systemPrefersDark`) |

### 🟢 BAIXOS

| # | Ficheiro | Linha | Problema |
|---|----------|-------|----------|
| 20 | `crates/tauri/lib.rs` | todos | `.map_err(e|e.to_string())` — perda de tipo |
| 21 | `router.tsx` | 36 | Rota "sugestor" com Placeholder |
| 22 | `PageHeaderContext.tsx` | todo | Acoplamento implícito (padrão discutível) |

---

## Achados Positivos

| Item | Ficheiro | Detalhe |
|------|----------|---------|
| ✅ | `lib.rs` (core) | `#![forbid(unsafe_code)]` |
| ✅ | `domain.rs` | Tipos bem modelados com validação |
| ✅ | `domain.rs` | `Unit::convert_to()` bem implementado com fallback para `None` |
| ✅ | `i18n/index.tsx` | Lazy loading + fallback a idioma de referência |
| ✅ | `theme.css` | Design tokens bem organizados |
| ✅ | `devInvoke.ts` | Fixtures de desenvolvimento isoladas |
| ✅ | `db.rs` (testes) | Testes de integração abrangentes para eventos, stocks, promoção |
| ✅ | Geral | Nenhum uso de `unsafe` |

---

## Conclusão

**Rating: 5/10**

O código base do Recipe Planner está funcional e tem uma arquitectura de domínio sólida. Os dois problemas dominantes são:

1. **Duplicação massiva (nota -3):** Os match blocks de conversão de unidades estão replicados 22+ vezes. Isto é o tipo de problema que um refactor de 30 minutos resolve e que previne bugs de esquecimento quando uma nova unidade é adicionada.

2. **Falta de refactoring em db.rs (nota -1,5):** Com 5.825 linhas, este ficheiro acumulou demasiadas responsabilidades. Funções com >100 linhas, placeholders, e dead code indicam que o ficheiro não foi partido à medida que crescia.

3. **Remanescentes de debug/placeholder (nota -0,5):** `eprintln!`, `console.error` sem guarda DEV, placeholders em produção.

Com um refactor focado na extracção de `parse_unit` para domain.rs e na quebra de `db.rs` em módulos (ex.: `db/ingredients.rs`, `db/recipes.rs`, `db/shopping.rs`), o rating subiria para 7-8/10.
