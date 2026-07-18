# Auditoria de Qualidade — Implementações das Features

**Projeto:** Recipe Planner (Mise) · Tauri 2 Desktop  
**Ficheiros analisados:** `crates/core/src/db.rs` (5825 linhas), `crates/core/src/domain.rs` (1305 linhas),  
`crates/tauri/src/lib.rs` (1444 linhas), `src-tauri/src/lib.rs`, `src/` (TS frontend + i18n)  
**Agente:** #2 — Qualidade Implementações Features  
**Data:** 2026-07-18

---

## Resumo Global

| Feature | Nota | Completude | Robustez | Perf | Clean |
|---------|------|------------|----------|------|-------|
| 1. Dashboard | **7/10** | ✅ Quase completa | ⚠️ Expiração é placeholder | ✅ OK | ✅ OK |
| 2. Ingredientes CRUD | **9/10** | ✅ Completa | ✅ Boa | ✅ OK | ✅ OK |
| 3. Stock (multi-brand) | **9/10** | ✅ Completa (c/ testes) | ✅ Muito boa | ✅ OK | ✅ OK |
| 4. Fornecedores CRUD | **8/10** | ✅ Completa | ✅ Boa | ✅ OK | ✅ OK |
| 5. Cotações | **8/10** | ✅ Completa | ✅ Boa | ✅ OK | ✅ OK |
| 6. Receitas CRUD | **9/10** | ✅ Completa | ✅ Muito boa | ✅ OK | ✅ OK |
| 7. Custos | **6/10** | ⚠️ Funcional, mas frágil | ⚠️ Fragilidades | ✅ OK | ⚠️ OK |
| 8. Shopping List | **9/10** | ✅ Muito completa | ✅ Excelente | ✅ OK | ✅ OK |
| 9. Meal Planner | **8/10** | ✅ Completa | ✅ Boa | ✅ OK | ✅ OK |
| 10. Calendário/Eventos | **9/10** | ✅ Completa (c/ testes) | ✅ Excelente | ✅ OK | ✅ OK |
| 11. OCR Scanner | **5/10** | ⚠️ Parcial | ❌ Heurística frágil | ✅ OK | ✅ OK |
| 12. Reports | **5/10** | ⚠️ 2/4 stubs | ❌ Waste/Trends vazios | ✅ OK | ✅ OK |
| 13. Settings (Sync) | **6/10** | ⚠️ Turso sync é placeholder | ✅ Resto OK | ✅ OK | ✅ OK |
| 14. Help | **6/10** | ⚠️ Só textos i18n | N/A | N/A | ✅ OK |
| 15. Import/Export | **8/10** | ✅ Completa (c/ testes) | ✅ Boa | ✅ OK | ✅ OK |
| 16. i18n (EN/PT) | **8/10** | ✅ Cobertura extensa | N/A | N/A | ✅ OK |

**NOTA GLOBAL AGENTE #2: 7.4/10**

---

## 1. Dashboard (7/10)

### Completude: ✅ Quase completa

Implementação em `db.rs` (linhas 3558-3745): `get_dashboard_stats` e `get_recent_activity`.

**O que existe:**
- 7 métricas no DashboardStats (low_stock_count, meals_this_week, total_stock_value, total_recipes, total_ingredients, pending_shopping_items, expiring_soon_count)
- Activity feed combina 4 fontes (recipes, stock, meal plan entries, shopping purchases)
- Upcoming meals query (`get_upcoming_meals`)
- Low stock query (`get_low_stock_ingredients`)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:3573` | `expiring_soon_count` usa query `WHERE 0 = 1` | **Média** | Adicionar coluna `expiry_date` a `stock` e migração, depois query real |
| `db.rs:3639-3660` | Activity feed faz 4 queries separadas + sort em memória | **Baixa** | Usar UNION ALL no SQL com ORDER BY + LIMIT |
| `db.rs:3663-3687` | Stock activity assume `stock_updated` como tipo — sem timestamp de actualização fiável | **Baixa** | Usar trigger para `updated_at` automático |

### Robustez ⚠️
- A query `WHERE 0 = 1` para expiração é honesta (não inventa dados) mas a feature dashboard mostra "A expirar (7d)" como KPI vazio — confuso para o utilizador.
- Activity sorting em Rust é aceitável para cargas pequenas, mas não escala.

### NOTA: **7/10**

---

## 2. Ingredientes CRUD (9/10)

### Completude: ✅ Completa

**Operações em `db.rs`:**
- `ingredients_list` (linha 155) — JOIN com categories
- `ingredients_paginated` (linha 196) — com LIMIT/OFFSET
- `get_ingredient` (linha 240)
- `create_ingredient` (linha 257)
- `update_ingredient` (linha 275)
- `delete_ingredient` (linha 300)
- `toggle_ingredient_favorite` (linha 310)
- `ingredients_search` (linha 330)

**Comandos Tauri em `crates/tauri/src/lib.rs`:** Todos exportados corretamente.

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:333` | `ingredients_search` não usa FTS5 — faz `LIKE '%term%'` | **Baixa** | Migrar para FTS5 se a base de ingredientes crescer >500 itens |
| `db.rs:257` | `create_ingredient` não valida unidade contra enum — aceita string arbitrária | **Baixa** | Validar com `IngredientInput` que usa `Unit` enum |

### NOTA: **9/10**

---

## 3. Stock Management — Multi-Brand, Weighted Avg Cost (9/10)

### Completude: ✅ Completa

**Operações em `db.rs`:**
- `stock_list` (linha 345) — com JOIN a ingredients, filtro `event_id IS NULL`
- `get_stock` (linha 385)
- `upsert_stock` (linha 398)
- `update_stock_quantity` (linha 420) — ajuste manual
- `delete_stock` (linha 449)
- `weighted_avg_stock_price` (linha 460) — multi-brand weighted average cost
- Stock purchases CRUD: `stock_purchase_add` (linha 4760), `stock_purchases_list` (linha 4848), `stock_purchase_delete` (linha 4871)
- `stock_purchase_add` actualiza stock + weighted avg
- `shopping_list_mark_purchased` (linha 2786) cria stock purchase e actualiza stock

**Testes em `db.rs`:**
- `stock_purchase_round_trips_brand_and_supplier` (linha 5285)
- `recipe_cost_uses_weighted_average_across_brands` (linha 5319)
- `marking_shopping_item_purchased_creates_a_lot` (linha 5347)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:460` | `weighted_avg_stock_price` calcula média apenas das compras, não considera stock actual não comprado (ex: stock inicial) | **Baixa** | Considerar stock inicial com preço_per_unit do ingrediente |
| `db.rs:4871` | `stock_purchase_delete` NÃO reverte stock (documentado no comentário) | **Média** | Adicionar reversão opcional ou aviso ao utilizador |
| `db.rs:4760` | `stock_purchase_add` faz 4 queries sequenciais dentro da função | **Baixa** | Agrupar ou usar transacção |

### NOTA: **9/10** — Melhor feature do sistema. Multi-brand com weighted average cost está correcto e testado.

---

## 4. Fornecedores CRUD (8/10)

### Completude: ✅ Completa

**Operações em `db.rs`:**
- `suppliers_list` (linha 530)
- `get_supplier` (linha 560)
- `create_supplier` (linha 575)
- `update_supplier` (linha 593)
- `delete_supplier` (linha 615)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| N/A | Implementação simples e correcta. Sem surpresas. | — | — |

### NOTA: **8/10** — Simples, funcional, sem problemas.

---

## 5. Cotações — Price Tracking (8/10)

### Completude: ✅ Completa

**Operações em `db.rs`:**
- `price_quotes_list` (linha 670)
- `create_price_quote` (linha 685)
- `update_price_quote` (linha 3009)
- `delete_price_quote` (linha 720)
- `price_quotes_stats` (linha 3024) — AVG/MIN/MAX/COUNT por ingrediente
- `price_quotes_all` (linha 3053) — JOIN com ingredient details
- `get_price_trends` (linha 4256) — histórico de preços por ingrediente

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:685` | `create_price_quote` não valida se supplier existe na BD | **Baixa** | Adicionar FK check antes de inserir |
| `db.rs:3024` | `price_quotes_stats` não junta supplier name— só ingredient_id | **Baixa** | Adicionar JOIN a suppliers para nome do fornecedor |

### NOTA: **8/10**

---

## 6. Receitas CRUD — Custo por Porção (9/10)

### Completude: ✅ Completa

**Operações em `db.rs`:**
- `recipes_list` (linha 756) — com ingredients JOIN + denormalized ingredient_name
- `recipes_paginated` (linha 853)
- `get_recipe` (linha 891)
- `create_recipe` (linha 901) — insere recipe + recipe_ingredients em transacção
- `update_recipe` (linha 915) — remove e reinsere ingredients
- `delete_recipe` (linha 941)
- `toggle_recipe_favorite` (linha 949)
- `clone_recipe` (linha 959) — duplica recipe + ingredients
- `calculate_cost` (linha 989) — custo por porção usando `weighted_avg_stock_price`

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:915` | `update_recipe` faz DELETE + INSERT dos ingredients — perde histórico e IDs | **Média** | Fazer UPDATE ou DELETE apenas dos ingredientes removidos |
| `db.rs:989` | `calculate_cost` calcula `cost_per_portion` como `total_cost / portions` — usa weighted avg stock price mas não considera ingredientes sem stock | **Baixa** | Fallback para `price_per_unit` do ingrediente quando não há stock |

### NOTA: **9/10**

---

## 7. Custos — Cost Reports (6/10)

### Completude: ⚠️ Funcional, mas frágil

**Implementação em `db.rs`:**
- `get_cost_report` (linha 3994) — total_spent, by_category, by_recipe, by_supplier, daily_avg

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:4002` | Cálculo `COALESCE(SUM(sli.to_buy_quantity * sli.estimated_cost / NULLIF(sli.to_buy_quantity, 0)), 0.0)` — divide pela quantidade para obter preço unitário? `estimated_cost` parece já ser o total | **Alta** | `estimated_cost` deve ser usado directamente se é o total, ou a fórmula está errada |
| `db.rs:4040-4067` | "By recipe" filtra por nome da lista (`LIKE '%Compras%'`) — heuristic frágil que quebra se o nome da lista mudar | **Alta** | Ligar via `meal_plan_id` em vez de heuristic de nome |
| `db.rs:4060-4066` | `RecipeCost` com `recipe_id: 0` — não liga a nenhuma recipe real | **Média** | JOIN com recipe_ingredients para obter recipe_id real |
| `db.rs:3994` | Report só usa compras confirmadas — não inclui custos de ingredientes não comprados | **Baixa** | Considerar também custo teórico (price_per_unit * quantity) |

### NOTA: **6/10** — Funciona para o básico mas com fragilidades na agregação por recipe e fórmula ambígua.

---

## 8. Shopping List (9/10)

### Completude: ✅ Muito completa

**Operações em `db.rs`:**
- `shopping_lists_list` (linha 1095)
- `get_shopping_list` (linha 1135) — com items + total
- `create_shopping_list` (linha 1170)
- `update_shopping_list` (linha 1210)
- `delete_shopping_list` (linha 1235)
- `shopping_list_add_item` (linha 1246)
- `shopping_list_update_item` (linha 1275)
- `shopping_list_toggle_item` (linha 1305)
- `shopping_list_mark_purchased` (linha 1330) — actualiza stock + cria purchase
- `shopping_list_remove_item` (linha 1404)
- `shopping_list_reorder_items` (linha 1423)
- `shopping_list_group_by_category` (linha 1430)
- `shopping_list_clear_purchased` (linha 1450)
- `shopping_list_delete_items` (linha 1475)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:1080` | `create_shopping_list_from_recipes` é um stub — cria lista vazia, faz log warning | **Média** | Implementar agregação de ingredientes das recipes |
| `db.rs:2786` | `shopping_list_mark_purchased` usa `estimated_cost` como `total_price` mesmo quando `price_per_unit` é fornecido | **Baixa** | Calcular `total_price = quantity * price_per_unit` quando `price_per_unit` é dado |

### NOTA: **9/10**

---

## 9. Meal Planner (8/10)

### Completude: ✅ Completa

**Operações em `db.rs`:**
- `create_meal_plan` (linha 3310)
- `get_meal_plan` (linha 3328) — com entries
- `list_meal_plans` (linha 3353)
- `update_meal_plan` (linha 3368)
- `delete_meal_plan` (linha 3385) — cascade
- `add_meal_entry` (linha 3393) — denormaliza recipe_name
- `update_meal_entry` (linha 3421)
- `delete_meal_entry` (linha 3448)
- `generate_shopping_list_from_meal_plan` (linha 3455)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:3393` | `add_meal_entry` faz query extra para recipe_name — desnecessário se o frontend já tem o nome | **Baixa** | Passar recipe_name como parâmetro opcional |
| `db.rs:3468-3475` | `generate_shopping_list_from_meal_plan` faz query DB dentro do loop por entry — N+1 queries | **Média** | Fazer batch query com `WHERE recipe_id IN (...)` |
| `db.rs:3455` | `portions_multiplier: u32` — se for 0, gera lista vazia sem erro | **Baixa** | Validar > 0 |

### NOTA: **8/10** — Completa mas com N+1 query pattern na geração de lista.

---

## 10. Calendário / Eventos (9/10)

### Completude: ✅ Completa (com testes de regressão)

**Operações em `db.rs`:**
- `events_list` (linha 1495)
- `get_event` (linha 1530)
- `create_event` (linha 1570)
- `update_event` (linha 1595)
- `delete_event` (linha 1615)
- `event_recipes_list` (linha 1635)
- `recipe_copy_to_event` (linha 1665)
- `recipe_promote_to_catalog` (linha 1725)
- `ingredient_copy_to_event` (linha 1775)
- `ingredient_promote_to_catalog` (linha 1835)
- `event_ingredients_list` (linha 1895)
- `get_meal_plan_entries_by_date_range` (linha 3823)
- `get_meal_plan_entries_by_month` (linha 3909)

**Testes em `db.rs`:**
- `event_recipe_copy_is_isolated_from_catalog` (linha 5377)
- `event_exclusive_recipe_can_be_promoted_to_catalog` (linha 5427)
- `promoting_recipe_with_duplicate_name_appends_event_name` (linha 5461)
- `event_ingredient_copy_is_stock_isolated_from_catalog` (linha 5494)
- `event_exclusive_ingredient_can_be_promoted_to_catalog` (linha 5546)
- `promoting_ingredient_with_duplicate_name_appends_event_name` (linha 5574)
- `seed_demo_data_includes_event_and_reset_clears_it` (linha 5596)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:3823` | `get_meal_plan_entries_by_date_range` calcula `planned_date` em memória — não pode ser filtrado no SQL | **Baixa** | Adicionar `planned_date` calculado no SQL ou como coluna |

### NOTA: **9/10** — Excelente implementação com isolamento evento/catálogo, testes de regressão, e edge cases cobertos.

---

## 11. OCR Scanner — Tesseract (5/10)

### Completude: ⚠️ Parcial

**Implementação em `db.rs`:**
- `receipt_scan` (linha 4905) — executa tesseract CLI
- `parse_receipt_text` (linha 4969) — regex heuristics
- `receipt_confirm` (linha 5101) — confirma parsed items → stock purchases
- `create_or_find_ingredient` (linha 5227)
- `receipt_parse` (linha 5095) — reparse

**Dependências:** `tesseract` CLI instalado no sistema.

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:5072` | `matched_ingredient_id` é hardcoded `None` — fuzzy matching com ingredientes existentes não implementado | **Alta** | Fazer fuzzy match por nome contra tabela de ingredientes |
| `db.rs:4969-5092` | Parsing de texto do recibo é regex heurística básica — frágil contra formatos diferentes | **Média** | Considerar LLM-based extraction ou template-based parsing |
| `db.rs:4922` | Depende de `tesseract` CLI instalado globalmente — sem fallback | **Média** | Adicionar verificação de disponibilidade + mensagem de erro clara |
| `db.rs:4969` | Função puramente Rust sem async real (`await` logo no início) | **Baixa** | Manter como está, o overhead é do tokio::process |
| `db.rs:5060-5065` | Limpeza do nome do ingrediente remove tudo — pode deixar nomes irreconhecíveis | **Média** | Melhorar lógica de extracção do nome |
| `db.rs:4980-4981` | Regex assume formato monetário com 2 casas decimais — falha noutros formatos | **Média** | Usar parser mais flexível |

### NOTA: **5/10** — Funcional para o básico mas com parsing frágil, sem fuzzy matching, e dependência externa não verificada.

---

## 12. Reports (5/10)

### Completude: ⚠️ 2 de 4 são stubs

**Operações em `db.rs`:**
- `get_cost_report` (linha 3994) — funcional (ver feature 7)
- `get_meal_stats` (linha 4143) — funcional
- `get_waste_report` (linha 4122) — **STUB**: retorna zeros sempre
- `get_stock_trends` (linha 4138) — **STUB**: retorna array vazio sempre

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:4122-4128` | `get_waste_report` é placeholder honesto mas a UI mostra relatório vazio | **Alta** | Adicionar tabela `waste_log` para rastrear desperdício |
| `db.rs:4138-4140` | `get_stock_trends` vazio — sem tabela de snapshots | **Alta** | Adicionar trigger que guarda snapshot do stock nas alterações |
| `db.rs:4122` | Comentário `ponytail: waste estimation...` documenta mas não resolve | **Baixa** | Documentação honesta, mas feature incompleta |

### NOTA: **5/10** — Cost report funcional, meal stats funcional, waste e trends são stubs.

---

## 13. Settings — Turso Sync (6/10)

### Completude: ⚠️ Turso sync é placeholder

**Operações em `db.rs`:**
- `settings_get_all` (linha 1935)
- `settings_get` (linha 1955)
- `settings_set` (linha 1975)
- `settings_reset` (linha 2005)
- `delete_all_data` (linha 2033)
- `seed_demo_data` (linha 2067)

**Comandos Tauri em `crates/tauri/src/lib.rs`:**
- `get_setting`, `set_setting`, `get_all_settings`, `reset_settings`
- `delete_all_data_cmd`
- `get_system_theme`
- `seed_demo_data_cmd`

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `src/i18n/locales/en|pt.ts` sync section | Turso sync é texto placeholder: _"Under development: Sync is under development."_ | **Alta** | Implementar sync real ou remover da UI até estar pronto |
| `db.rs:1935-2067` | Settings guardados como key-value em tabela — sem schema tipado | **Baixa** | Usar structs com validação em vez de generic key-value |
| N/A | `delete_all_data` apaga TUDO sem confirmação no backend | **Média** | Já tem confirmação no frontend, mas adicionar safety check |

### NOTA: **6/10** — CRUD de settings funcional, mas sync é fachada. Demo data existe.

---

## 14. Help (6/10)

### Completude: ⚠️ Só textos i18n

**O que existe:**
- Textos de ajuda em `en.ts` e `pt.ts` (secção `help`)
- Secções para Ingredients, Recipes, Stock, Shopping, Planning, CostsReports

**O que falta:**
- Sem comando Rust para conteúdo de ajuda
- Sem página de ajuda dedicada (provavelmente frontend estático)
- Textos são descrições mínimas, sem guia interativo

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| N/A | Help é puramente estático — nenhuma lógica backend | **Baixa** | Aceitável para v1 se for frontend-only |
| `en.ts:347-381` / `pt.ts:347-381` | Descrições muito genéricas — "use clone" mas clone existe | **Baixa** | Expandir com links para docs e exemplos |

### NOTA: **6/10** — Serve o propósito básico mas é mínimo.

---

## 15. Import / Export (8/10)

### Completude: ✅ Completa (com testes)

**Operações em `db.rs`:**
- `export_data` (linha 3120) — exporta ingredients + recipes em JSON
- `import_data` (linha 3158) — importa com resolução por nome de ingrediente
- `export_usage_data` (linha 4474) — exporta problem reports + usage events para Markdown

**Testes em `db.rs`:**
- `recipe_ingredients_round_trip_through_export_and_import` (linha 5792)
- `problem_report_with_image_appears_in_export` (linha 5757)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `db.rs:3120-3155` | `export_data` só exporta ingredients + recipes — não stock, fornecedores, cotações, settings | **Média** | Exportar todas as entidades |
| `db.rs:3158-3237` | `import_data` resolve ingredientes por nome — colisões tratadas com skip, mas sem merge | **Média** | Oferecer opção de merge vs skip |
| `db.rs:3124-3129` | Import/Export usa `ImportIngredient` que perde `id` — re-import cria duplicados | **Média** | Manter IDs ou usar hash por nome |

### NOTA: **8/10** — Funcional e testado, mas exporta apenas subconjunto de dados.

---

## 16. i18n (EN/PT) (8/10)

### Completude: ✅ Cobertura extensa

**Ficheiros:**
- `src/i18n/types.ts` — interface `Translations` (genérica)
- `src/i18n/registry.ts` — lazy loading com 2 entradas (pt + en)
- `src/i18n/locales/en.ts` — EN translations (~500 linhas)
- `src/i18n/locales/pt.ts` — PT translations (~500 linhas)

**Cobertura:**
- `common` (básicos: save, edit, delete, cancel, etc.)
- `nav` (menu de navegação completo)
- `settings` (extenso ~20 subsecções)
- `dashboard` (KPIs, alerts, week, activity, quick actions, time)
- `stock` (modal, purchase modal, confirm delete, status, brand)
- `ingredients` (modal, unit groups, CRUD messages)
- `help` (welcome, sections)
- `suppliers` (modal, form, quote modal, confirm delete, CRUD messages)
- `events` (modal, form, detail, recipe ops, CRUD messages)

### Problemas encontrados

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| `types.ts:1-6` | `Translations` é `Record<string, any>` — sem type safety | **Média** | Gerar tipos a partir do schema real das traduções |
| N/A | Não há `currency`, `reports`, `calendar`, `shopping` sections — algumas usam `common` genérico | **Baixa** | Adicionar secções específicas |
| `registry.ts:11` | `referenceLanguage: "pt"` — PT como referência é incomum para app com EN default | **Baixa** | Documentar decisão ou usar EN como referência |

### NOTA: **8/10** — Boa cobertura, lazy loading, mas sem type safety nas translations.

---

## Problemas Transversais (Cross-Cutting)

| Ficheiro:Linha | Problema | Severidade | Sugestão |
|---|---|---|---|
| Vários | Duplicação massiva do match `unit_str -> Unit` em ~15 locais (db.rs + domain.rs) | **Média** | Extrair função `parse_unit` partilhada (já existe `parse_unit_str` na linha 4692 mas não é usada em todo o lado) |
| `domain.rs` | `Unit` enum serializado como string — 20 variantes | **Baixa** | Considerar usar `#[serde(rename_all = "snake_case")]` |
| Vários | `DateTime::parse_from_rfc3339().unwrap_or_else(|_| Utc::now())` repetido dezenas de vezes | **Média** | Extrair helper `parse_datetime` |
| `db.rs` | Quase todas as funções abrem nova conexão com `get_conn(db)` — overhead de conexão | **Baixa** | Passar conn como argumento ou usar pool |
| `crates/tauri/src/lib.rs` | ~30 comandos Tauri todos no mesmo ficheiro (1444 linhas) | **Média** | Separar por domínio (ingredients, stock, recipes, etc.) |
| `db.rs:1-5825` | Ficheiro monolítico de 5825 linhas | **Média** | Dividir em módulos (db/ingredients.rs, db/stock.rs, etc.) |
| `db.rs:2174-2176` | `create_shopping_list_from_recipes` é stub com log warning | **Média** | Implementar ou remover da API |

---

## Pontuações-chave por Critério

### Completude
- ✅ **Completa:** Ingredientes, Stock, Fornecedores, Cotações, Receitas, Shopping List, Meal Planner, Eventos
- ⚠️ **Quase completa:** Dashboard (expiração), Custos (fórmula frágil), Import/Export (parcial)
- ⚠️ **Parcial:** OCR (sem fuzzy match), Reports (2/4 stubs), Settings (sync placeholder), Help (só texto)

### Robustez
- ✅ **Excelente:** Stock (multi-brand weighted avg + testes), Eventos (isolamento + testes)
- ✅ **Boa:** Ingredientes, Fornecedores, Cotações, Receitas, Shopping List, Meal Planner, Import/Export
- ⚠️ **Fragilidades:** Dashboard (expiração), Custos (fórmula by recipe), OCR (parsing regex)
- ❌ **Problemática:** Reports (waste/trends vazios), OCR (sem fuzzy match)

### Performance
- ✅ Geralmente boa para ~500-1000 items
- ⚠️ N+1 query em `generate_shopping_list_from_meal_plan`
- ⚠️ Activity feed faz 4 queries separadas

### Clean Code
- ✅ Nomes descritivos, tipos bem definidos, documentação `///` e comentários `ponytail`
- ✅ Comentários honestos sobre limitações (expiração, waste, trends)
- ⚠️ Ficheiro db.rs demasiado grande (5825 linhas)
- ⚠️ Duplicação de código (parsing de unidades, parsing de datas)

---

## Conclusão

O Recipe Planner Mise tem uma base de código **sólida e bem estruturada** no backend Rust. As features core (Ingredientes, Stock, Receitas, Shopping List, Eventos) estão **implementadas com qualidade profissional**, incluindo testes de regressão. O sistema de weighted average cost multi-brand é particularmente notável.

**Áreas de melhoria prioritárias:**
1. **OCR Scanner** — fuzzy matching de ingredientes e parsing mais robusto
2. **Reports** — implementar waste tracking e stock trends
3. **Import/Export** — exportar todas as entidades, não só ingredients + recipes
4. **Custos report** — corrigir fórmula ambígua e by recipe heuristic

**Nota global Agente #2: 7.4/10**
