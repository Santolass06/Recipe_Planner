# Auditoria de Testes — Agente #2

> **Projeto:** Recipe Planner (Mise) — Tauri 2, Rust + React/TypeScript + libSQL  
> **Data:** 2026-07-18  
> **Auditor:** Agente #2  
> **Rating global:** **2/10**

---

Li **1 ficheiro de teste, 563 linhas** (21 testes num único módulo `#[cfg(test)]` dentro de `crates/core/src/db.rs:5263-5825`).

---

## Sumário Executivo

O projecto tem **cobertura de testes gravemente insuficiente** para uma aplicação comercial de ~20K LOC. Existe **exactamente 1 módulo de teste**, Rust apenas, focado exclusivamente em integração DB. **Zero testes no frontend** (TypeScript/React). **Zero testes de unidade** no Rust (todos os 21 testes são de integração DB com base de dados SQLite real). **Zero testes Tauri commands**. **Zero CI** (sem `.github/workflows/`). **Zero teste script** no `package.json`. **Nenhuma dependência de teste** em qualquer `Cargo.toml` (nem `[dev-dependencies]`). **Nenhum ficheiro de configuração** vitest/jest.

Os 21 testes existentes são **tecnicamente bem escritos**: testam comportamento real contra uma DB `:memory:`, têm nomes descritivos, algumas doc-strings explicam o cenário, e alguns são regressões a bugs reais. Contudo, cobrem **menos de 5%** do código total e deixam **domínios inteiros** por testar.

---

## 1. Ficheiros de Teste Encontrados

### 1.1 Rust

| Ficheiro | Tipo | Funções Teste | Linhas |
|----------|------|---------------|--------|
| `crates/core/src/db.rs` (linhas 5263–5825) | Integração DB (inline `#[cfg(test)]`) | 21 | 563 |

**Não existem** integração tests (`tests/`), nem testes unitários noutros módulos.

### 1.2 Frontend

**Nenhum.** Zero ficheiros `*.test.ts`, `*.spec.ts`, `__tests__/`.

### 1.3 CI / Config

| Ficheiro | Existe? | Notas |
|----------|---------|-------|
| `.github/workflows/` | ❌ | Sem CI |
| `vitest.config.ts` | ❌ | Não existe |
| `jest.config.*` | ❌ | Não existe |
| `package.json` → `scripts.test` | ❌ | Não existe script de teste |
| `Cargo.toml` → `[dev-dependencies]` | ❌ | Nenhum crate tem dev-dependencies |
| `package.json` → `devDependencies` (vitest, testing-library, etc.) | ❌ | Não existem |

---

## 2. Análise dos Testes Existentes (Rust)

### 2.1 Testes de Integração DB (`crates/core/src/db.rs:5263-5825`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  #[cfg(test)]                                                       │
│  mod fase3_stock_tests {                                            │
│      use super::*;                                                  │
│                                                                     │
│      fn test_db() -> Database { ... cria temp file, corre migrações │
│                                                                     │
│      // 21 funções #[tokio::test] e #[test] abaixo                  │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Lista completa de testes:

| # | Nome | Async? | O que testa | Domínio |
|---|------|--------|-------------|---------|
| 1 | `stock_purchase_round_trips_brand_and_supplier` | ✅ | Round-trip brand/supplier após bug de column-index | Stock |
| 2 | `recipe_cost_uses_weighted_average_across_brands` | ✅ | Weighted average cost com 2 compras (1L×4€ + 3L×8€ → 7€/L) | Custos |
| 3 | `marking_shopping_item_purchased_creates_a_lot` | ✅ | Mark purchased → stock aumenta + purchase é criada | Stock/Shopping |
| 4 | `event_recipe_copy_is_isolated_from_catalog` | ✅ | Cópia de receita para evento isola edições + não aparece no catálogo | Eventos/Receitas |
| 5 | `event_exclusive_recipe_can_be_promoted_to_catalog` | ✅ | Receita exclusiva do evento → promote ao catálogo | Eventos/Receitas |
| 6 | `promoting_recipe_with_duplicate_name_appends_event_name` | ✅ | Nome duplicado → append "(Event Name)" | Eventos/Receitas |
| 7 | `event_ingredient_copy_is_stock_isolated_from_catalog` | ✅ | Cópia de ingrediente para evento isolada stock + cascade delete | Eventos/Ingredientes |
| 8 | `event_exclusive_ingredient_can_be_promoted_to_catalog` | ✅ | Ingrediente exclusivo do evento → promote | Eventos/Ingredientes |
| 9 | `promoting_ingredient_with_duplicate_name_appends_event_name` | ✅ | Nome duplicado → append "(Event Name)" | Eventos/Ingredientes |
| 10 | `seed_demo_data_includes_event_and_reset_clears_it` | ✅ | Seed demo + delete_all_data round-trip | Setup/Teardown |
| 11 | `parse_ingredient_line_splits_quantity_unit_and_name` | ❌ | Parsing "3 tablespoons extra-virgin olive oil" | Parsing |
| 12 | `parse_ingredient_line_handles_vulgar_fractions` | ❌ | "½ cup" → 0.5 Cup, "1 ½ cups" → 1.5 Cup | Parsing |
| 13 | `parse_ingredient_line_finds_unit_after_the_name_too` | ❌ | "5 garlic cloves, thinly sliced" → Clove | Parsing |
| 14 | `parse_ingredient_line_strips_descriptive_clauses_from_name` | ❌ | "½ cup grated Parmesan, divided..." → nome limpo | Parsing |
| 15 | `parse_ingredient_line_ignores_parenthetical_quantities` | ❌ | Parenthesis "about 8 ounces" ignorado | Parsing |
| 16 | `parse_iso8601_duration_minutes_handles_hours_and_minutes` | ❌ | "PT1H30M" → 90, "garbage" → None | Parsing |
| 17 | `extract_recipe_json_ld_finds_recipe_node_and_fields_parse` | ❌ | Extrair JSON-LD Recipe de HTML real | Parsing |
| 18 | `recipe_import_from_url_matches_existing_ingredient_by_name` | ✅ | Matching de ingredient name_guess contra DB (sem network) | Parsing/DB |
| 19 | `image_round_trips_through_the_given_data_dir` | ✅ | Upload/read/delete imagem com data_dir explícito | Imagens |
| 20 | `problem_report_with_image_appears_in_export` | ✅ | Problem report + imagem → export Markdown autónomo | Instrumentação |
| 21 | `recipe_ingredients_round_trip_through_export_and_import` | ✅ | Export → import numa DB limpa preserva ingredientes | Import/Export |

### 2.2 Qualidade dos Testes — Achados

| FICHEIRO:LINHA | PROBLEMA | SEVERIDADE | SUGESTÃO |
|----------------|----------|------------|----------|
| `db.rs:5263` | Único módulo de teste no projecto inteiro | 🔴 Crítico | Criar módulo de testes em cada ficheiro Rust; adicionar tests/ integration |
| `db.rs:5267-5278` | `test_db()` cria ficheiro temp único por teste (sem isolation entre testes) | 🟡 Médio | Usar transações ou db limpa por teste; ficheiros temp não são limpos em panic (apenas no final feliz se carnudas) |
| `db.rs:5272` | `unwrap()` em `SystemTime::now()` — pode falhar em relógios bizarros | 🟢 Baixo | Usar `expect()` ou fallback a `0` |
| `db.rs:5274` | `unwrap()` em `path.to_str()` — falha se o path não for UTF-8 | 🟢 Baixo | Usar `.to_string_lossy()` |
| `db.rs:5326-5333` | Stock purchase hardcoded — podia usar uma fixture factory | 🟢 Baixo | Criar helper `add_purchase()` (DRY) |
| `db.rs:5610-5667` | 5 testes sync de `parse_ingredient_line` mas **zero testes para `parse_ingredient_line` com linhas vazias, null, whitespace-only** | 🟡 Médio | Adicionar edge cases |
| `db.rs:5678-5697` | `extract_recipe_json_ld` testado só com HTML feliz — sem teste para JSON malformado, script tag vazio, HTML sem JSON-LD | 🟡 Médio | Adicionar casos negativos |
| `db.rs:5699-5716` | `recipe_import_from_url_matches_existing_ingredient_by_name` — testa só o match de nome, não a importação real via URL | 🟡 Médio | Usar mock HTTP ou testar a função de parsing isolada |
| `db.rs:5724-5750` | `image_round_trips_through_the_given_data_dir` — testa PNG 1×1 mas não testa JPEG, GIF, ficheiros grandes | 🟢 Baixo | Expandir formatos |
| `db.rs:5757-5785` | `problem_report_with_image_appears_in_export` — não limpa temp dirs se algum assert falhar | 🟡 Médio | Usar `Drop` ou `catch_unwind` |

### 2.3 O que NÃO está testado no Rust

Domínios completamente sem cobertura:

| Domínio | Funções Exportadas (db.rs) | Testadas? |
|---------|---------------------------|-----------|
| **Ingredientes CRUD** | `ingredients_list`, `create_ingredient`, `update_ingredient`, `delete_ingredient`, `toggle_ingredient_favorite` | ❌ Nenhum |
| **Receitas CRUD** | `recipes_list`, `recipes_paginated`, `get_recipe`, `create_recipe`, `update_recipe`, `delete_recipe`, `toggle_recipe_favorite`, `clone_recipe` | ❌ Nenhum (excepto em cenários de evento) |
| **Stock CRUD** | `stock_list`, `get_stock`, `upsert_stock`, `update_stock_quantity`, `delete_stock` | ❌ Nenhum (apenas via compras) |
| **Stock Purchases CRUD** | `stock_purchase_add`, `stock_purchases_list`, `stock_purchase_delete` | ✅ 1 (round-trip) |
| **Shopping Lists CRUD** | 19+ funções de shopping list | ❌ 1 (mark_purchased) |
| **Fornecedores CRUD** | `suppliers_list`, `create_supplier`, `update_supplier`, `delete_supplier`, `supplier_get` | ❌ Nenhum |
| **Categorias CRUD** | `categories_list`, `create_category`, `update_category`, `delete_category` | ❌ Nenhum |
| **Cotações Preço CRUD** | `price_quotes_list`, `create_price_quote`, `delete_price_quote`, `update_price_quote`, `price_quotes_stats`, `price_quotes_all` | ❌ Nenhum |
| **Eventos CRUD** | 8+ funções de eventos | ✅ 3 (copy, promote, delete) |
| **Meal Planner CRUD** | 10+ funções de meal plan | ❌ Nenhum |
| **Dashboard** | `get_dashboard_stats`, `get_recent_activity`, `get_upcoming_meals`, `get_low_stock_ingredients` | ❌ Nenhum |
| **Reports** | `get_cost_report`, `get_waste_report`, `get_stock_trends`, `get_meal_stats`, `get_price_trends` | ❌ Nenhum |
| **Settings** | `get_setting`, `set_setting`, `get_all_settings`, `reset_to_defaults` | ❌ Nenhum |
| **Import/Export** | `export_data`, `import_data` | ✅ 1 (recipe ingredients round-trip) |
| **Imagens** | `image_upload`, `image_delete`, `image_read_base64`, `image_set_primary`, `image_get`, `image_search_proxy` | ✅ 1 (round-trip) |
| **Problem Reports** | `problem_report_create`, `export_usage_data` | ✅ 1 (com image) |
| **Units/Domain** | `Unit::convert_to`, `Unit::to_base_factor`, `StockItem::status` | ❌ Nenhum (só parsing) |

### 2.4 Testes Tauri Commands — Não Existem

Há **~80+ Tauri commands** registados em `src-tauri/src/lib.rs` e implementados em `crates/tauri/src/lib.rs` (com wrapper `AppDb`). **Zero testes.** Não há:

- Testes de unidade para os command handlers
- Testes de integração Tauri (ex: `tauri::test::mock_builder` ou `tauri-driver`)
- Testes de mock IPC

---

## 3. Análise Frontend (TypeScript/React)

### 3.1 Cobertura

**Zero.** Literalmente nenhum teste.

- `package.json` não tem `scripts.test` nem dependências de teste
- Nem `vitest`, nem `jest`, nem `@testing-library/react`, nem `cypress`, nem `playwright`
- Nenhum ficheiro `*.test.ts`, `*.spec.ts`, ou `__tests__/`
- Nenhum `vitest.config.ts` ou `jest.config.*`
- Nenhum teste de snapshot, E2E, ou componente

### 3.2 O que deveria estar testado

| Ficheiro | LOC | Risco | O que testar |
|----------|-----|-------|-------------|
| `src/lib/units.ts` | 47 | 🟡 Médio | `convertUnit()` — mesmos casos que o Rust mas no frontend |
| `src/lib/devInvoke.ts` | 173 | 🟢 Baixo | Fallbacks dev |
| `src/pages/RecipesPage.tsx` | 912 | 🔴 Alto | CRUD, filtering, navegação |
| `src/pages/ShoppingListPage.tsx` | 971 | 🔴 Alto | Mark purchased, criação, edição |
| `src/pages/MealPlannerPage.tsx` | 666 | 🔴 Alto | Calendar, entries, geração shopping |
| `src/pages/StockPage.tsx` | 599 | 🔴 Alto | Listagem, ajuste stock, purchases |
| `src/pages/EventsPage.tsx` | 242 | 🟡 Médio | CRUD eventos |
| `src/pages/CostsPage.tsx` | 300 | 🟡 Médio | Cálculo custos |
| `src/pages/DashboardPage.tsx` | 384 | 🟡 Médio | Stats, activity, low stock |
| `src/pages/SettingsPage.tsx` | 841 | 🟡 Médio | Configurações |
| `src/pages/SuppliersPage.tsx` | 576 | 🟡 Médio | CRUD fornecedores |
| `src/components/` (13 ficheiros) | ~796 | 🟡 Médio | Sidebar, ImageUpload, UI components |

---

## 4. Gaps por Prioridade

### 4.1 🔴 Críticos (impedem confiança no software)

1. **Zero testes frontend** — toda a lógica React (11.6K LOC) sem verificação
2. **Zero testes Tauri commands** — 80+ commands IPC não testados
3. **Zero CI** — sem `.github/workflows/`, nada corre em PR nem push
4. **Zero teste script** — não há `npm test` nem `cargo test` integrado
5. **Nenhum `[dev-dependencies]`** — Rust sem tokio-test, rstest, ou mockall

### 4.2 🟡 Médios (qualidade e cobertura)

1. **Cobertura DB < 10%** — 21 testes para ~100+ funções públicas
2. **Sem testes de unidade Rust** — `#[cfg(test)]` só no módulo DB; `domain.rs`, `lib.rs`, `crates/tauri/src/lib.rs` sem qualquer teste
3. **Sem fixtures reutilizáveis** — cada teste constrói ingredientes manualmente
4. **Sem testes negativos/edge cases** — excepções, validação, erros de DB
5. **Sem testes de snapshot** — nada para evitar regressões visuais

### 4.3 🟢 Baixos (melhorias)

1. `test_db()` criar ficheiros temp sem cleanup explícito
2. `unwrap()` em paths e timestamps nos testes
3. Cobertura de parsing só inglesa — sem testes com texto português

---

## 5. Mocks e Fixtures

- **Mocks:** Zero. Nenhum uso de `mockall`, `mockito`, `httpmock`, ou substitutes
- **Fixtures:** Apenas `test_db()` (cria DB temp com schema). Dados de ingredientes/fornecedores são criados manualmente em cada teste (duplicação massiva de código)
- **Dev fixtures frontend:** `devInvoke.ts` tem dados hardcoded de ingredientes, stock, receitas — mas são para dev preview, não para testes

---

## 6. Rating Final

| Categoria | Peso | Nota | Comentário |
|-----------|------|------|------------|
| Cobertura Rust backend | 30% | 2/10 | 21 testes para milhares de linhas DB |
| Cobertura Frontend | 30% | 0/10 | Zero |
| Cobertura Tauri commands | 15% | 0/10 | Zero |
| Qualidade dos testes existentes | 15% | 6/10 | Bem escritos, focam comportamento, mas sem edge cases |
| CI/Config/Infra | 10% | 0/10 | Sem CI, sem script, sem dev-deps |
| **Rating global** | **100%** | **2/10** | |

**Rating 2/10** — projecto comercial sem testes equivalentes a muito baixa confiança. Os 21 testes existentes são **corretos mas insuficientes**. Para uma aplicação de gestão de receitas com stock, custos, fornecedores, e dados financeiros, é um risco operacional não ter testes automatizados.

---

## 7. Recomendações Prioritárias

### Imediatas (1–2 semanas)
1. Adicionar `cargo test` a um script CI mínimo (GitHub Actions com `cargo test --workspace`)
2. Adicionar `vitest` + `@testing-library/react` ao frontend
3. Criar `[dev-dependencies]` com `tokio-test`, `rstest`, `tempfile`
4. Testar Tauri commands via `tauri::test::mock_builder` (pelo menos os comandos críticos: recipes CRUD, shopping list mark_purchased, stock purchase add)

### Curto prazo (1 mês)
5. Testes de integração DB para cada domínio não coberto (ingredientes, receitas, stock, shopping, fornecedores, preços, meal planner)
6. Testes unitários para `domain.rs` (Unit::convert_to, StockItem::status)
7. Testes de componente para as páginas mais críticas (RecipesPage, ShoppingListPage, StockPage)
8. Substituir `test_db()` por `tempfile::TempDir` para cleanup garantido

### Médio prazo (3 meses)
9. Testes E2E com Tauri driver ou Playwright
10. Testes de snapshot para regressões visuais
11. Property-based testing para parsing de ingredientes
12. Cobertura mínima: >50% Rust backend, >30% frontend

---

## 8. Notas Finais

- A qualidade dos 21 testes existentes é **boa**: nomes descritivos, doc-strings a explicar o cenário, regressões documentadas, uso de DB real em vez de mocks
- O padrão `fase3_stock_tests` (módulo temático inline) é adequado — deveria ser replicado para cada domínio
- O facto de `#[cfg(debug_assertions)]` proteger `delete_all_data` e `seed_demo_data` mostra consciência de segurança, mas não substitui testes
- **Ponto crítico**: sem CI, ninguém sabe se os testes compilam ou passam

---

*Rating: 2/10 — Cobertura insuficiente para software comercial.*
