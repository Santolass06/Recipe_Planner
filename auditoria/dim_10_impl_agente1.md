# Auditoria de Qualidade das Implementações — Agente #1

**Projeto:** Recipe Planner (Mise) · Tauri 2 Desktop · ~20K LOC  
**Data:** 2026-07-18  
**Âmbito:** Qualidade da implementação de cada feature (não a ideia)  
**Ficheiros analisados:** Rust backend (crates/core/src/db.rs, crates/core/src/domain.rs, crates/tauri/src/lib.rs, src-tauri/src/lib.rs) + TypeScript/React frontend (src/pages/*.tsx, src/i18n/*.tsx, src/lib/*.ts, src/router.tsx)

---

## Resumo Geral

| # | Feature | Nota | Completa? | Robusta? | Performance | Limpeza |
|---|---------|------|-----------|----------|-------------|---------|
| 1 | Dashboard | **8/10** | ✅ Sim | ⚠️ Parcial | ✅ Boa | ✅ Limpo |
| 2 | Ingredientes CRUD | **9/10** | ✅ Sim | ✅ Sim | ✅ Boa | ✅ Limpo |
| 3 | Stock Management | **9/10** | ✅ Sim | ✅ Sim | ✅ Boa | ✅ Limpo |
| 4 | Fornecedores CRUD | **9/10** | ✅ Sim | ✅ Sim | ✅ Boa | ✅ Limpo |
| 5 | Cotações | **8/10** | ✅ Sim | ⚠️ Parcial | ✅ Boa | ✅ Limpo |
| 6 | Receitas CRUD | **9/10** | ✅ Sim | ✅ Sim | ✅ Boa | ✅ Limpo |
| 7 | Custos | **8/10** | ✅ Sim | ⚠️ Parcial | ✅ Boa | ✅ Limpo |
| 8 | Shopping List | **9/10** | ✅ Sim | ✅ Sim | ✅ Boa | ✅ Limpo |
| 9 | Meal Planner | **8/10** | ✅ Sim | ⚠️ Parcial | ✅ Boa | ✅ Limpo |
| 10 | Calendário/Eventos | **8/10** | ✅ Sim | ⚠️ Parcial | ✅ Boa | ✅ Limpo |
| 11 | OCR Scanner | **7/10** | ✅ Sim | ⚠️ Parcial | ⚠️ Mediocre | ⚠️ Confuso |
| 12 | Reports | **6/10** | ⚠️ Parcial | ❌ Falhas | ✅ Boa | ✅ Limpo |
| 13 | Settings | **7/10** | ⚠️ Parcial | ⚠️ Parcial | ✅ Boa | ✅ Limpo |
| 14 | Help | **7/10** | ✅ Sim | N/A | ✅ Boa | ✅ Limpo |
| 15 | Import/Export | **8/10** | ✅ Sim | ✅ Sim | ✅ Boa | ✅ Limpo |
| 16 | i18n | **9/10** | ✅ Sim | ✅ Sim | ✅ Boa | ✅ Limpo |

---

## 1. Dashboard (8/10)

### Achados

**db.rs:3551-3627** — `get_dashboard_stats`
- db.rs:3570-3576 — `expiring_soon_count` usa `SELECT COUNT(*) FROM stock WHERE 0 = 1` (placeholder). Não existe coluna de validade. **SEVERIDADE: Média.** Sugestão: adicionar `expiry_date` ao schema ou remover do dashboard até estar implementado.
- db.rs:3579-3591 — `meals_this_week` faz OVERLAP query correta mas usa datas `datetime('now')` do SQLite em vez do fuso horário da app. **SEVERIDADE: Baixa.** Sugestão: passar `start_date`/`end_date` como parâmetros para ser timezone-aware.

**db.rs:3629-3746** — `get_recent_activity`
- db.rs:3633-3635 — Comentário admite que é "for now". Cria uma UNIÃO de queries de receitas, stock, refeições e compras. Funcional mas não tem paginação real — carrega tudo e limita no frontend. **SEVERIDADE: Baixa.** Sugestão: limitar na query SQL com `LIMIT ?1`.
- Nota positiva: usa `UNION ALL` em vez de `UNION`, correto (não precisa deduplicar).

**DashboardPage.tsx**
- Completa: 385 linhas com KPI cards, alertas, week panel, pending shopping, activity feed, quick actions.
- Layout responsivo com grid CSS, loading spinner, empty states.
- i18n completo.
- Cache de `useCallback`/`useEffect` bem gerido.

---

## 2. Ingredientes CRUD (9/10)

### Achados

**db.rs:894-908** — `ingredients_list`
- Filtra `WHERE event_id IS NULL` para mostrar apenas ingredientes do catálogo. Correto.

**db.rs:992-1050** — `create_ingredient`
- Valida input via `validator::Validate`.
- Conversão `Unit -> String` correta.
- Suporta `event_id` para scoping a eventos.

**db.rs:1051-1100** — `update_ingredient`
- Atualiza `updated_at = datetime('now')`.
- Verifica existência antes de atualizar.

**db.rs:1101-1120** — `delete_ingredient`
- Chave estrangeira `ON DELETE RESTRICT` protege contra exclusão de ingredientes em uso.

**IngredientsPage.tsx**
- 301 linhas. CRUD completo com modal, search, confirmação de delete inline.
- Validação: `!form.name.trim()` client-side.
- `parseFloat(e.target.value) || 0` — trata NaN corretamente.
- Acessibilidade: aria-labels, role="dialog", aria-modal.

**Sem issues significativos.** Implementação robusta.

---

## 3. Stock Management (9/10)

### Achados

**db.rs**
- Stock CRUD: `stock_list`, `stock_upsert`, `stock_delete`, `stock_get`, `stock_update_quantity`.
- Stock purchases: `stock_purchase_add`, `stock_purchases_list`, `stock_purchase_delete`.
- Tabelas: `stock` (item atual), `stock_purchases` (histórico lotes).

**db.rs:4900-5100** — `stock_purchase_add`
- Regista compra e ATUALIZA stock atual (`UPDATE stock SET quantity = quantity + ?`).
- Suporta `brand`, `supplier_id`, `discount`, `notes`.

**StockPage.tsx**
- 599 linhas. Tabela com níveis visuais (barra), StatusPill.
- Purchase modal com histórico, brand breakdown, supplier picker, desconto.
- Suporta multi-brand tracking (agrupa por brand no BrandBreakdown).

**Sem issues significativos.** A weighted average cost está implícita (price_per_unit da compra + stock existente) mas não há um endpoint dedicado para calculá-lo — o frontend usa `total_price / quantity` diretamente.

---

## 4. Fornecedores CRUD (9/10)

### Achados

**db.rs**
- `suppliers_list`, `supplier_get`, `create_supplier`, `update_supplier`, `delete_supplier`.
- Migrations criam tabela `suppliers` com `name`, `contact`, `notes`, timestamps.
- `delete_supplier` protege com `ON DELETE SET NULL`.

**SuppliersPage.tsx**
- 576 linhas. Card layout responsivo, search, modal create/edit.
- Quotes inline dentro de cada supplier card.
- CRUD completo com confirmação de delete.
- Integração direta com price_quotes.

**Sem issues significativos.**

---

## 5. Cotações (8/10)

### Achados

**db.rs:2961-2995** — Price quotes CRUD
- `price_quotes_list` (por ingrediente), `price_quotes_all`, `price_quotes_stats`.
- `create_price_quote`, `update_price_quote`, `delete_price_quote`.
- Suporta `valid_from`, `valid_to`, `is_promo`.

**db.rs:4254-4300** — `get_price_trends`
- Query correta, agrupa por mês, calcula média.

**SuppliersPage.tsx**
- Quotes aparecem inline nos cards de fornecedor.
- Editar/quotes funcionais.

**db.rs:3320-3350** — `price_quotes_stats`
- db.rs:3325 — Usa `AVG(price_per_unit)`, `COUNT(*)`, `MIN(price_per_unit)`, `MAX(price_per_unit)`. Correta.

**Falta:** O frontend de reports tem tab de Price Trends que funciona corretamente.

---

## 6. Receitas CRUD (9/10)

### Achados

**db.rs**
- CRUD completo: `recipes_list`, `recipes_paginated`, `get_recipe`, `create_recipe`, `update_recipe`, `delete_recipe`, `toggle_recipe_favorite`, `clone_recipe`.
- Junção `recipe_ingredients` bem modelada com denormalização de nome.

**db.rs:1200-1450** — `create_recipe`
- Transação com BEGIN/COMMIT para inserir receita + ingredientes.
- Valida input, lida com `image_base64`.
- Suporta `event_id` para scoping.

**RecipesPage.tsx**
- 912 linhas (a página mais complexa).
- Lista de receitas com cards, stepper de porções, custo estimado.
- Modal de create/edit com seleção de ingredientes, quantidades, unidades.
- Import de URL integrado (recipe_import_from_url preview).
- Cost line computation client-side (computeCostLines) com flag aproximado.
- Tabs de categorias.

**Achado positivo:** `computeCostLines` tenta converter unidades entre ingrediente e receita usando `convertUnit` — fallback para aproximado quando conversão falha.

---

## 7. Custos (8/10)

### Achados

**db.rs:3993-4093** — `get_cost_report`
- `total_spent` calculado de `shopping_list_items` comprados.
- `by_category` — agrupa por categoria de ingrediente.
- `by_recipe` — db.rs:4048 — Usa heuristic LIKE `%Planeamento%` para relacionar listas de compras a receitas. **SEVERIDADE: Média.** Isto é frágil — se o utilizador renomear a lista, a heurística falha. Sugestão: usar `meal_plan_id FK` na `shopping_lists` para ligação direta.
- `by_supplier` — dados de `stock_purchases`.

**db.rs:4900-4950** — `calculate_cost` e `analyze_cost`
- Calcula custo por ingrediente com conversão de unidade.
- Suporta `approximate_unit_weights` para unidades descritivas (dente, molho, pitada).

**CostsPage.tsx**
- 300 linhas. UI de análise de custos com breakdown, stepper de porções, calculadora de margem.
- Margem e lucro calculados no frontend (backend só devolve CostBreakdown). Decisão consciente (comentário na linha 68-69).

---

## 8. Shopping List (9/10)

### Achados

**db.rs**
- CRUD listas: `shopping_lists_list`, `get_shopping_list`, `create_shopping_list`, `update_shopping_list`, `delete_shopping_list`.
- CRUD items: `shopping_list_add_item`, `shopping_list_update_item`, `shopping_list_toggle_item`, `shopping_list_remove_item`, `shopping_list_reorder_items`, `shopping_list_clear_purchased`.
- Especial: `shopping_list_mark_purchased` — ao marcar como comprado, cria `stock_purchase`.
- `create_shopping_list_from_recipes` — geração automática.
- `shopping_list_group_by_category` — agrupamento.

**ShoppingListPage.tsx**
- 971 linhas. Duas vistas: listas (overview) e detalhe.
- Detail: categorias expansíveis, inline editing, purchase modal.
- Check-off com confirmação de compra (brand, supplier, price).
- Clear purchased, rename, delete.

**db.rs:481-526** — Migration 014: repair de nullable ingredient_id. Boa gestão de schema evolution.

---

## 9. Meal Planner (8/10)

### Achados

**db.rs**
- CRUD planos: `list_meal_plans`, `get_meal_plan`, `create_meal_plan`, `update_meal_plan`, `delete_meal_plan`.
- CRUD entradas: `add_meal_entry`, `update_meal_entry`, `delete_meal_entry`.
- `generate_shopping_list_from_meal_plan`.
- `get_meal_plan_entries_by_date_range`, `get_meal_plan_entries_by_month`.

**MealPlannerPage.tsx**
- 666 linhas. Lista de planos, weekly grid view, entry modal.
- CRUD completo de planos e entradas.
- Gera lista de compras.

**Ausência:** db.rs:246-273 — Schema de `meal_plans` usa `start_date`/`end_date` como TEXT. Quando se faz JOIN com entries por dia da semana, a lógica de filtragem no `get_meal_stats` (db.rs:4197-4198) usa `plan_start + day_index * days` que ignora o `start_date` real se a semana do plano não começar numa segunda-feira. **SEVERIDADE: Média.** Sugestão: usar `date(mp.start_date, '+' || mpe.day_index || ' days')` na query para cálculo correto.

**Ausência:** Não há drag-and-drop para reordenar refeições no grid — usa seleção por dropdown. Isto é uma escolha de UX aceitável (Ponytail: modal mais simples que DnD), mas difere do que é comum em meal planners.

---

## 10. Calendário/Eventos (8/10)

### Achados

**Event CRUD**
- **db.rs** — `events_list`, `create_event`, `update_event`, `delete_event`.
- Eventos com `name`, `event_date`, `notes`.

**Event-scoped features (Fase 3.2/3.3):**
- `recipe_copy_to_event`, `recipe_promote_to_catalog` — gestão de receitas dentro de eventos.
- `ingredient_copy_to_event`, `ingredient_promote_to_catalog` — ingredientes isolados por evento.
- Migrations 017-018: adicionam `event_id` a recipes e ingredients.

**EventDetailPage.tsx**
- 648 linhas. Página completa: listar receitas/ingredientes do evento, copiar do catálogo, criar novo, promover para catálogo, registar compras.
- Purchase modal integrado.

**CalendarPage.tsx**
- 477 linhas. Vista mês e semana, navegação, loading states.
- db.rs:4138-4140 — `get_stock_trends` retorna vazio (placeholder). Não afeta Calendar.
- CalendarPage.tsx:84-88 — Comentário `ponytail: no recipe detail route exists yet`. Handler de clique leva para listagem em vez de detalhe.

**db.rs:422-426** — Migrations usam `add_column_if_missing` para `event_id`. Boa prática de schema evolution.

---

## 11. OCR Scanner (7/10)

### Achados

**ReceiptScannerPage.tsx**
- 608 linhas. Implementação completa com tesseract.js.
- Suporta upload de imagem, OCR progresso, parsing heurístico, confirmação.
- Parsing de linhas de talão com extração de quantidade, unidade, preço, IVA.
- `parseVatSummary` — parsing da tabela "Resumo IVA" (bem documentado).

**Problemas:**
- ReceiptScannerPage.tsx:35-48 — `UNIT_ALIASES` mapeia para unidades que NÃO estão no enum `Unit` do backend (`pack`, `bottle`, `box`, `can`, `jar`, `bag`, `sachet`). O campo `unit` do `ParsedLine` vai conter valores que o backend não reconhece. **SEVERIDADE: Alta.** Sugestão: adicionar estas unidades ao `Unit` enum ou mapear para as existentes antes de enviar ao backend.
- ReceiptScannerPage.tsx:178-181 — O matching de ingredientes existentes é frágil (`includes(name.toLowerCase().split(" ")[0])`). Pode casar "Arroz" com "Arroz de pato" corretamente, ou "Alho" com "Alface" se o split pegar a palavra errada. **SEVERIDADE: Baixa.** Sugestão: melhorar matching para usar similaridade de string (Dice coefficient) ou fuzzy match.
- ReceiptScannerPage.tsx:95-115 — `initWorker` carrega modelo Tesseract em Português. Assets self-hosted em `/tessdata/`. Modelo pode ser grande (~10MB+), afeta primeira inicialização. **SEVERIDADE: Baixa.**
- db.rs:333-354 — Backend `receipt_scan`/`receipt_parse`/`receipt_confirm` existem mas o frontend faz parsing CLIENT-SIDE com tesseract.js — o backend só guarda o resultado. **SEVERIDADE: Média.** Inconsistência: o projeto gasta recursos a criar endpoints que o frontend não usa.

---

## 12. Reports (6/10)

### Achados

**ReportsPage.tsx**
- 759 linhas. Tabs: Costs, Waste, Stock Trends, Meal Stats, Price Trends.
- UI rica: KPI cards, bar lists, mini bar charts, tabs navegáveis.

**db.rs**
- `get_cost_report` — ✅ Funcional (ver Custos).
- `get_meal_stats` — ✅ Funcional.
- `get_price_trends` — ✅ Funcional.
- `get_waste_report` — db.rs:4118-4128 — ❌ Stub. Retorna `WasteReport { total_wasted_value: 0.0, by_ingredient: Vec::new(), by_category: Vec::new() }`. Não existe tracking de desperdício. **SEVERIDADE: Alta.**
- `get_stock_trends` — db.rs:4132-4140 — ❌ Stub. Retorna `Vec::new()`. Não existe tabela de snapshots de stock. **SEVERIDADE: Alta.** Comentário honesto (ponytail) explica que antes fabricava uma variação falsa — corrigiram para retornar vazio em vez de mentir ao utilizador.

**No frontend:**
- ReportsPage.tsx — Os tabs Waste e Stock aparecem mas mostram "Sem dados" porque os backends retornam vazio.

---

## 13. Settings (7/10)

### Achados

**SettingsPage.tsx**
- 841 linhas. Abas: Geral, Unidades, Moeda, Dados, Sincronização, Sobre, Desenvolvedor.
- Language switcher, theme toggle, density, date format.
- Currency, weight/volume/temperature units configuráveis.

**db.rs**
- `settings_get`, `settings_set`, `settings_get_all`, `reset_settings`.

**Turso Sync:**
- SettingsPage.tsx:617-644 — UI para Turso URL + Auth Token.
- SettingsPage.tsx:642-643 — Aviso: `syncInDevelopment` + `syncPlaceholder`. **SEVERIDADE: Alta.** A UI existe mas o sync não está implementado. É config-only, sem lógica de replicação.

**Import/Export:**
- SettingsPage.tsx:533-573 — UI para import/export JSON. ✅ Funcional.

---

## 14. Help (7/10)

### Achados

**HelpPage.tsx**
- 73 linhas. Página estática com seções de ajuda e links úteis.
- Conteúdo i18n-driven via `t('help.sections.${key}.item1')`.
- Links para GitHub, Tauri docs, React docs.

**Avaliação:** Simples mas funcional. Poderia beneficiar de conteúdo mais detalhado (FAQ, screenshots, vídeos).

---

## 15. Import/Export (8/10)

### Achados

**db.rs:2907-2959** — `recipe_import_from_url`
- Fetch HTML, extrai JSON-LD schema.org/Recipe.
- Faz parsing de nome, instruções, porções, ingredientes.
- Match de ingredientes existentes por nome.
- Retorna `RecipeImportPreview` para o frontend.
- db.rs:5698-5700 — Testes unitários (`#[tokio::test] ... recipe_import_from_url_matches_existing_ingredient_by_name`).

**db.rs:3119-3155** — `export_data`
- Exporta `ImportData { version, ingredients, recipes }`.

**db.rs:3158-3250** — `import_data`
- Faz merge: cria ingredientes novos, salta duplicados (por nome).
- Cria receitas com ingredientes mapeados.

**RecipesPage.tsx:727-731** — Integração de `recipe_import_from_url` no frontend com preview modal.

**SettingsPage.tsx:533-545** — UI de export.

---

## 16. i18n (9/10)

### Achados

**i18n/index.tsx**
- 96 linhas. Provider React com lazy loading de dicionários.
- Fallback para `referenceLanguage` (PT).
- `lookup` function com dot-notation.
- Warnings em dev para chaves faltantes.
- Persistência em localStorage.

**i18n/locales/pt.ts** — 989 linhas. Completo.
**i18n/locales/en.ts** — Completo (não lido integralmente, mas a estrutura é a mesma).

**i18n/registry.ts** — Registo de línguas com lazy import dinâmico.

**Uso:** Todas as páginas usam `useI18n()` extensivamente. Nenhuma página tem strings hardcoded.

**Achado positivo:** Provider carrega tanto a língua ativa como a de referência, garantindo fallback funcionando mesmo para chaves em falta.

**Achado menor:** i18n/index.tsx:73 — `console.warn` para chaves em falta apenas em DEV. Em produção a chave é retornada como `key` (string raw). Poderiam beneficiar de um fallback visual.

---

## Problemas Transversais

### 1. Duplicação do parsing de Unit
- `Unit` -> `String` é feito MANUALMENTE em cada `row_to_*` function (db.rs:577-598, 664-686, 704-726, 768-790, etc.). São 5-6 match statements idênticos.
- **SEVERIDADE: Média.** Sugestão: implementar `impl FromStr for Unit` ou uma função `parse_unit(s: &str) -> Unit`.

### 2. Datas como TEXT no SQLite
- Todas as datas são TEXT em vez de usar tipo DATE/DATETIME do SQLite. Isto funciona (com `datetime('now')` e `date()` nas queries) mas é menos performante e pode causar bugs de fuso horário.
- **SEVERIDADE: Baixa.**

### 3. `#[forbid(unsafe_code)]` no core crate
- ✅ Boa prática.

### 4. Falta de testes de integração
- Exceto `recipe_import_from_url_matches_existing_ingredient_by_name`, não há testes automatizados identificados.
- **SEVERIDADE: Média** (fora do scope desta auditoria mas relevante para qualidade geral).

---

## Tabela de Achados Prioritários

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| db.rs:3570-3576 | `expiring_soon_count` é placeholder (query `WHERE 0=1`) | Média | Adicionar coluna `expiry_date` ao stock ou remover métrica do dashboard |
| db.rs:4132-4140 | `get_stock_trends` retorna vazio | Alta | Criar tabela `stock_snapshots` gravada em cada alteração |
| db.rs:4118-4128 | `get_waste_report` retorna zero | Alta | Criar tabela `waste_log` quando houver tracking de desperdício |
| db.rs:4048 | Heurística frágil `LIKE '%Planeamento%'` em cost report | Média | Adicionar FK `meal_plan_id` em `shopping_lists` |
| ReceiptScannerPage.tsx:35-48 | `UNIT_ALIASES` usa unidades que não estão no enum `Unit` do backend | Alta | Mapear para `Unit` existente ou estender o enum |
| SettingsPage.tsx:617-644 | UI de Turso Sync existe mas backend não implementa | Alta | Remover UI ou implementar sync real |
| db.rs:4197-4198 | Cálculo de planned_date assume que plan_start é segunda-feira | Média | Usar `date(mp.start_date, '+' \|\| day_index \|\| ' days')` na query SQL |
| db.rs:577-598 (e 5x mais) | Duplicação do match `unit_str -> Unit` | Média | Extrair para `parse_unit(s: &str) -> Unit` |
| CalendarPage.tsx:84-88 | Clique em refeição não tem rota de detalhe | Baixa | Criar rota `/receitas/:id` |
| i18n/index.tsx:73 | Chave em falta retorna string raw em produção | Baixa | Adicionar fallback visível (ex. `🔤{key}`) |

---

## Notas aos Ficheiros Analisados

- **crates/core/src/domain.rs** (1305 linhas): Modelos de domínio completos com validação, unit conversion, serialização TS. ✅ Bem estruturado.
- **crates/core/src/db.rs** (5825 linhas): Toda a lógica de base de dados num único ficheiro. Funcional mas longo. ⚠️ Poderia beneficiar de divisão em módulos.
- **crates/tauri/src/lib.rs** (1444 linhas): Wrapper de comandos Tauri. Padrão repetitivo (cada função é `db.fn().await.map_err(|e| e.to_string())`). ⚠️ Macro poderia gerar wrappers.
- **src-tauri/src/lib.rs** (164 linhas): Registo de todos os comandos. ✅ Claro.
- **Páginas TSX**: 34 ficheiros. 15 páginas de 16 são implementadas (só "Sugestor" é Placeholder).

---

*Relatório gerado por Agente #1 · Auditoria de Qualidade de Implementações*
