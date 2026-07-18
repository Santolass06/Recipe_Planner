# Auditoria de Testes — Dimensão 04 — Agente #1

**Projeto:** Recipe Planner (Mise) — Tauri 2 (Rust + React/TypeScript + libSQL)
**Data:** 2026-07-18
**Rating:** **1.5 / 10**

---

Li **1 ficheiro de teste, 562 linhas** (1 módulo `#[cfg(test)]` inline em `crates/core/src/db.rs`, linhas 5263–5825).

---

## Sumário Executivo

O projecto **não tem testes a sério**. O que existe são **testes de integração inline** (BD real em ficheiro temporário) apenas na crate `mise-core`, e unicamente para as Fases 3–4 (eventos, stock, export/import). **Não há:**

- Testes unitários Rust para o domínio
- Testes para Tauri commands (`mise-tauri`)
- Testes para o frontend (React/TypeScript)
- Ficheiros de teste dedicados (`.test.ts`, `.spec.ts`, `tests/`, `__tests__/`)
- Configuração de CI/CD (`.github/workflows/`)
- Framework de teste frontend (vitest, jest, testing-library, playwright, cypress)
- Testes de snapshot, E2E, ou de componente

---

## 1. Inventário de Ficheiros de Teste

### 1.1 Rust (único ficheiro)

**`crates/core/src/db.rs`** — módulo `#[cfg(test)] mod fase3_stock_tests`
- 562 linhas
- 21 testes: 14 `#[tokio::test]` (integração DB) + 7 `#[test]` (unitários síncronos)
- 1 função auxiliar `test_db()` que cria DB temporário com migrações

### 1.2 Ficheiros que deviam existir mas não existem

| Ficheiro | Estado | Impacto |
|----------|--------|---------|
| `src/**/*.test.ts(x)` | ❌ | Zero cobertura frontend |
| `src/**/__tests__/` | ❌ | Zero testes de componente/página |
| `crates/core/tests/` | ❌ | Sem testes de integração dedicados |
| `crates/tauri/tests/` | ❌ | Sem testes de Tauri commands |
| `src-tauri/tests/` | ❌ | Sem testes de binário |
| `vitest.config.ts` / `jest.config.*` | ❌ | Sem framework de teste frontend |
| `.github/workflows/ci.yml` | ❌ | Sem CI/CD com testes |
| `package.json` → script "test" | ❌ | Apenas `dev`, `build`, `preview`, `tauri` |

---

## 2. Análise Detalhada dos Testes Existentes

### 2.1 `crates/core/src/db.rs:5263` — módulo `fase3_stock_tests`

#### O que está testado (domínios cobertos):

| Domínio | Testes | Cobertura |
|---------|--------|-----------|
| **Stock / Purchases** | `stock_purchase_round_trips_brand_and_supplier`, `marking_shopping_item_purchased_creates_a_lot` | Parcial — só o fluxo "comprar → stock aumenta" |
| **Recipe Cost** | `recipe_cost_uses_weighted_average_across_brands` | 1 cenário de weighted average |
| **Eventos (Fase 3.2)** | `event_recipe_copy_is_isolated_from_catalog`, `event_exclusive_recipe_can_be_promoted_to_catalog`, `promoting_recipe_with_duplicate_name_appends_event_name` | Cobre cópia, isolamento, promoção, colisão de nomes |
| **Ingredientes evento (Fase 3.3)** | `event_ingredient_copy_is_stock_isolated_from_catalog`, `event_exclusive_ingredient_can_be_promoted_to_catalog`, `promoting_ingredient_with_duplicate_name_appends_event_name` | Cobre cópia, isolamento stock, promoção, colisão |
| **Seed/Reset** | `seed_demo_data_includes_event_and_reset_clears_it` | 1 cenário feliz |
| **Parsing ingredientes** | `parse_ingredient_line_*` (5 testes) | Cobre frações vulgares, unidades após nome, cláusulas descritivas, quantidades parentéticas, parsing ISO8601 |
| **JSON-LD extraction** | `extract_recipe_json_ld_finds_recipe_node_and_fields_parse` | 1 fixture |
| **Import URL** | `recipe_import_from_url_matches_existing_ingredient_by_name` | Match por nome (sem network) |
| **Imagens** | `image_round_trips_through_the_given_data_dir` | Upload/read/delete |
| **Problem reports** | `problem_report_with_image_appears_in_export` | Export com imagem |
| **Export/Import** | `recipe_ingredients_round_trip_through_export_and_import` | Round-trip ingredientes |

#### O que NÃO está testado (gaps críticos):

| Domínio | Funções (exemplos) | Testes |
|---------|-------------------|--------|
| **Ingredientes CRUD** | `create_ingredient`, `update_ingredient`, `delete_ingredient`, `toggle_ingredient_favorite` | 0 |
| **Receitas CRUD** | `create_recipe`, `update_recipe`, `delete_recipe`, `clone_recipe`, `toggle_recipe_favorite` | 0 |
| **Receitas list/paginate** | `recipes_list`, `recipes_paginated`, `get_recipe` | 0 |
| **Stock CRUD** | `upsert_stock`, `update_stock_quantity`, `delete_stock` | 0 |
| **Shopping lists** | `create_shopping_list`, `create_shopping_list_from_recipes`, `update_shopping_list_item`, `delete_shopping_list`, `shopping_list_add_item`, `shopping_list_update_item`, `shopping_list_toggle_item`, `shopping_list_remove_item`, `shopping_list_reorder_items`, `shopping_list_group_by_category`, `shopping_list_clear_purchased` | 0 |
| **Suggest recipes** | `suggest_recipes` | 0 |
| **Cost analysis** | `calculate_cost` (só 1 cenário), `analyze_cost` | Parcial |
| **Settings** | `get_setting`, `set_setting`, `get_all_settings`, `reset_to_defaults` | 0 |
| **Categories** | `categories_list`, `create_category`, `update_category`, `delete_category` | 0 |
| **Suppliers** | `suppliers_list`, `supplier_get`, `create_supplier`, `update_supplier`, `delete_supplier` | 0 |
| **Price quotes** | `create_price_quote`, `update_price_quote`, `delete_price_quote`, `price_quotes_list`, `price_quotes_all`, `price_quotes_stats` | 0 |
| **Meal planner** | `create_meal_plan`, `update_meal_plan`, `delete_meal_plan`, `add_meal_entry`, `update_meal_entry`, `delete_meal_entry`, `generate_shopping_list_from_meal_plan` | 0 |
| **Dashboard** | `get_dashboard_stats`, `get_recent_activity`, `get_upcoming_meals`, `get_low_stock_ingredients` | 0 |
| **Reports** | `get_cost_report`, `get_waste_report`, `get_stock_trends`, `get_meal_stats`, `get_price_trends` | 0 |
| **Calendar** | `get_meal_plan_entries_by_date_range`, `get_meal_plan_entries_by_month` | 0 |
| **Receipt OCR** | `receipt_scan`, `receipt_parse`, `receipt_confirm` | 0 |
| **Images** | `image_set_primary`, `image_get`, `image_search_proxy` | 0 |
| **Domain models** | `Unit::convert_to`, `Unit::to_base_factor`, `StockItem::status` | 0 |

### 2.2 Qualidade dos Testes Existentes

#### Positivo:
- ✅ Testes de integração com BD real (temp file) — melhor que mocks
- ✅ Testes nomeados descritivamente (`event_recipe_copy_is_isolated_from_catalog`)
- ✅ Alguns testes têm comentários a explicar o bug que regressam
- ✅ Usam `assert!` com mensagens descritivas
- ✅ Usam constantes reais (ex: `base64_1x1_png`) em vez de strings arbitrárias

#### Negativo:
- ❌ **Testam implementação, não comportamento** — chamam funções internas da `db.rs` em vez de comandos Tauri
- ❌ **Duplicação massiva de setup** — `test_db()` + `create_ingredient()` em 14 de 21 testes, sem fixture reutilizável
- ❌ **Sem test isolation failures** — testes correm em paralelo mas usam nomes de ficheiro únicos (nanos timestamp) — potencial race em sistemas rápidos
- ❌ **Sem arrange/act/assert** — a estrutura dos testes é plana, sem separação de fases
- ❌ **Zero testes de edge cases** — os testes só cobrem "happy path"
- ❌ **Hardcoded `unwrap()` em todo o lado** — falha de setup causa panic, sem mensagem clara

## 3. Gaps por Categoria

### 3.1 Testes Unitários (Rust)
**Rating: 0/10**

- `domain.rs` (1305 linhas) — **zero testes**. `Unit::convert_to()`, `Unit::to_base_factor()`, `StockItem::status()` são lógica pura sem IO que devia ter testes unitários. Erro crítico: `to_base_factor()` tem factores hardcoded sem verificação.
- `lib.rs` do core — apenas re-exports, sem lógica para testar.

### 3.2 Testes de Integração (Rust)
**Rating: 2/10**

- Só existe 1 módulo (`fase3_stock_tests`) para uma crate core com 5825 linhas.
- Cobre apenas Fases 3–4 (eventos, stock, export). Fases 1–2 (CRUD básico, listagens, cost) sem testes.
- Setup imperativo repetido 14x — ninguém vai manter isto quando adicionar mais testes.

### 3.3 Testes de Tauri Commands
**Rating: 0/10**

- `crates/tauri/src/lib.rs` (1444 linhas) — **zero testes**. O `AppDb` wrapper e todos os Tauri commands (70+ commands registados em `src-tauri/src/lib.rs`) não têm um único teste.
- Os commands são chamados via Tauri invoke handler e dependem de `tauri::State<AppDb>` — sem testes de integração porque exigiriam inicializar o Tauri runtime.

### 3.4 Testes Frontend (React/TypeScript)
**Rating: 0/10**

- 0 ficheiros `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`.
- 0 ficheiros `__tests__/`.
- `package.json` devDependencies: `@tauri-apps/cli`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `typescript`, `vite`. **Nenhuma biblioteca de teste**.
- `vite.config.ts`: sem configuração de teste.
- 15 páginas React + 10 componentes UI + router + i18n + libraries = **zero testes**.

### 3.5 CI/CD
**Rating: 0/10**

- Directório `.github/workflows/` não existe.
- Sem scripts de teste em `package.json`.
- Sem Makefile/Justfile/script de CI.

### 3.6 Mocks & Fixtures
**Rating: 0/10**

- Único fixture: HTML inline com JSON-LD no teste `extract_recipe_json_ld`.
- Sem mocks para Tauri commands, sem mocks HTTP, sem mocks de filesystem.
- `image_round_trips_through_the_given_data_dir` usa filesystem real (temp dir) — aceitável para teste de integração mas sem isolamento.

### 3.7 Testes E2E / Snapshot
**Rating: 0/10**

- Zero.

---

## 4. Achados Detalhados

| # | Ficheiro | Linha | Problema | Severidade | Sugestão |
|---|----------|-------|----------|------------|----------|
| 1 | `crates/core/src/db.rs` | 5263 | Módulo de testes apenas para Fase 3, todo o CRUD base (Fases 1–2) sem testes | CRÍTICA | Criar módulo `crates/core/tests/` com testes organized por domínio |
| 2 | `crates/core/src/domain.rs` | 76–122 | `Unit::to_base_factor()` e `Unit::convert_to()` com factores hardcoded, sem testes unitários | ALTA | Adicionar `#[cfg(test)] mod tests` com testes para cada factor de conversão |
| 3 | `crates/core/src/domain.rs` | 282–288 | `StockItem::status()` sem testes unitários | MÉDIA | Testar os 3 estados (Ok, Low, Out) com diferentes quantidades |
| 4 | `crates/core/src/db.rs` | 5267–5277 | `test_db()` cria temp file por teste, mas não faz cleanup — ficheiros acumulam | MÉDIA | Adicionar `Drop` ou `remove_dir_all` no teardown, ou usar `:memory:` se possível |
| 5 | `crates/core/src/db.rs` | 5274 | `unwrap()` no setup do DB — se falhar, o panic não distingue qual teste | BAIXA | Adicionar `.expect("failed to create test db")` |
| 6 | `crates/core/src/db.rs` | 5286 | Setup repetido: `let db = test_db().await; let ingredient = create_ingredient(...)` padrão repete-se 14x | MÉDIA | Extrair fixtures reutilizáveis (ex: `setup_ingredient()`, `setup_recipe_with_ingredients()`) |
| 7 | `crates/core/src/db.rs` | 5346 | `marking_shopping_item_purchased_creates_a_lot` — testa 1 fluxo feliz, sem edge cases (e.g. marca vazia, supplier nulo) | MÉDIA | Adicionar testes para inputs nulos/parciais |
| 8 | `crates/core/src/db.rs` | 5595 | `seed_demo_data_includes_event_and_reset_clears_it` — só 1 cenário, não verifica conteúdo dos dados de seed | BAIXA | Verificar nomes/queries específicos dos dados seed |
| 9 | `crates/core/src/db.rs` | 5609 | Testes de parsing: só texto em inglês, sem caracteres acentuados (português) | BAIXA | Adicionar testes com ingredientes em português (ex: "½ chávena de azeite") |
| 10 | `crates/tauri/src/lib.rs` | 1–1444 | Zero testes para AppDb wrapper e Tauri commands | CRÍTICA | Adicionar módulo de testes com `tauri::test::mock_app()` ou testar lógica delegada directamente |
| 11 | `src-tauri/src/lib.rs` | 30–162 | 70+ Tauri commands registados, zero testados | CRÍTICA | Pelo menos smoke tests para cada command |
| 12 | `package.json` | 7–11 | Script "test" ausente | ALTA | Adicionar `"test": "vitest run"` e instalar vitest |
| 13 | `package.json` | 19–26 | devDependencies sem testing-library, vitest, ou qualquer framework de teste | CRÍTICA | Adicionar `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` |
| 14 | N/A | N/A | Sem `.github/workflows/ci.yml` | ALTA | Adicionar workflow: `cargo test --all`, `vitest run`, `cargo clippy` |
| 15 | N/A | N/A | Frontend (15 páginas + 10 componentes) sem qualquer teste | CRÍTICA | Adicionar pelo menos smoke tests de render para cada página |
| 16 | N/A | N/A | Sem testes de `recipes_paginated` (consulta SQL com paginação) | ALTA | Testar página 1, página vazia, ordenação |
| 17 | N/A | N/A | Sem testes para `suggest_recipes` (lógica de match stock/recipe) | ALTA | Testar: 100% match, partial match, sem stock |
| 18 | N/A | N/A | Sem testes para `calculate_cost` com diferentes unidades de ingrediente | ALTA | Testar conversão entre unidades, aprox notes |
| 19 | N/A | N/A | Sem testes para `export_data` / `import_data` (só 1 round-trip de ingredientes) | MÉDIA | Testar export com dados vazios, categorias, suppliers |
| 20 | N/A | N/A | Sem testes de `receipt_scan`/`receipt_parse` (OCR) | ALTA | Testar parse de texto simulado, sem depender de Tesseract |

---

## 5. Análise de Cobertura por Domínio

### Cobertura estimada de linhas de código (Rust backend)

| Domínio | LOC aprox | Linhas testadas | Cobertura estimada |
|---------|-----------|-----------------|-------------------|
| DB setup/migrations | ~200 | ~10 (test_db) | ~5% |
| Ingredientes CRUD | ~250 | 0 | 0% |
| Receitas CRUD | ~400 | 0 | 0% |
| Stock | ~300 | ~150 | ~50% |
| Shopping lists | ~500 | ~50 | ~10% |
| Eventos | ~600 | ~200 | ~33% |
| Suggester | ~100 | 0 | 0% |
| Cost analysis | ~200 | ~20 | ~10% |
| Settings | ~100 | 0 | 0% |
| Categories | ~150 | 0 | 0% |
| Suppliers | ~150 | 0 | 0% |
| Price quotes | ~200 | 0 | 0% |
| Meal planner | ~400 | 0 | 0% |
| Dashboard | ~200 | 0 | 0% |
| Reports | ~300 | 0 | 0% |
| Images | ~200 | ~40 | ~20% |
| Receipts/OCR | ~300 | 0 | 0% |
| Import/Export | ~200 | ~100 | ~50% |
| Domain models | ~300 | 0 | 0% |
| **Total core** | **~4850** | **~570** | **~12%** |
| Tauri commands | ~950 | 0 | **0%** |
| Frontend (TSX/TS) | ~3000 | 0 | **0%** |
| **Total** | **~21304** | **~570** | **~2.7%** |

---

## 6. Rating Final: 1.5 / 10

| Critério | Peso | Nota | Ponderado |
|----------|------|------|-----------|
| Cobertura de código (Rust backend) | 25% | 1.0 | 0.25 |
| Cobertura de código (Frontend) | 25% | 0.0 | 0.00 |
| Qualidade dos testes existentes | 20% | 4.0 | 0.80 |
| Testes de Tauri commands | 10% | 0.0 | 0.00 |
| CI/CD + configuração de teste | 10% | 0.0 | 0.00 |
| Mocks, fixtures, isolamento | 10% | 1.0 | 0.10 |
| **Total** | **100%** | | **1.5 / 10** |

### Justificação:
- **1.0 em cobertura backend**: 12% cobertura, apenas 1 módulo de testes inline, CRUD base sem testes
- **0.0 em frontend**: zero absoluto
- **4.0 em qualidade**: o que existe é bom (testes de integração reais, bem nomeados, com comentários de regressão), mas falta estrutura, repetição excessiva de setup, sem edge cases
- **0.0 em commands**: Tauri commands totalmente por testar
- **0.0 em CI/CD**: sem workflows, sem framework de teste frontend
- **1.0 em mocks**: fixture JSON-LD bem feito, mas único; sem mocks reutilizáveis

---

## 7. Recomendações Prioritárias

### Imediatas (Para um projecto comercial, isto é urgente):

1. **Adicionar framework de teste frontend** — `vitest` + `@testing-library/react` + `jsdom`
2. **Adicionar CI/CD** — `.github/workflows/ci.yml` com `cargo test` e `vitest run`
3. **Testes unitários para `domain.rs`** — `Unit::convert_to()`, `to_base_factor()`, `StockItem::status()` são bugs à espera de acontecer
4. **Testes para Tauri commands** — pelo menos smoke tests no `AppDb` wrapper

### Curto prazo:

5. **Testes CRUD** — `create_ingredient` → `get_ingredient` → `update_ingredient` → `delete_ingredient` para cada entidade
6. **Refactor dos testes de integração** — extrair fixtures reutilizáveis, adicionar cleanup
7. **Testes de edge cases** — strings vazias, quantidades zero/negativas, valores nulos

### Médio prazo:

8. **Testes de snapshot ou E2E** — pelo menos 1 teste E2E com Tauri driver (webdriver)
9. **Cobertura de reports/dashboard** — as queries agregadas são as mais propensas a bugs
10. **Testes de parsing de ingredientes em português**
