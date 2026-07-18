# Auditoria de Performance — Agente #2

**App:** Mise (Recipe Planner) — Tauri 2 Desktop
**LOC:** ~20K (Rust + TypeScript/React)
**Data:** 2026-07-18
**Auditor:** Agente #2 (Performance)
**Rating Agente #1:** 4.5/10

---

## Rating Final: 4.0/10

**Nota do Agente #2:** Ligeiramente abaixo do #1 (4.5). Discordo em alguns pontos (a camada de índices está melhor do que o #1 sugeriu, e o seed não corre em produção), mas encontrei vários problemas que o #1 não detectou: N+1 reais dentro de loops na criação/actualização de receitas, 4 queries separadas no feed de actividade, e ausência total de lazy loading no frontend. A diferença deve-se sobretudo a critérios de severidade diferentes.

---

## 1. N+1 Queries (DB dentro de loops)

### 1.1. `create_recipe` — SELECT nome ingrediente dentro de loop
- **Ficheiro:** `crates/core/src/db.rs:1211-1215`
- **Problema:** Para cada ingrediente na receita, executa `SELECT name FROM ingredients WHERE id = ?1`. Com N ingredientes, são N queries extra.
- **Severidade:** 🔴 ALTA
- **Sugestão:** Fazer `SELECT id, name FROM ingredients WHERE id IN (?1, ?2, ...)` antes do loop, ou usar um JOIN após inserir os recipe_ingredients. Cache em HashMap.

### 1.2. `update_recipe` — SELECT nome ingrediente dentro de loop
- **Ficheiro:** `crates/core/src/db.rs:1255-1259`
- **Problema:** Idêntico ao 1.1 — SELECT por ingrediente dentro do loop de inserção. Além disso, faz DELETE + re-INSERT de todos os recipe_ingredients (em vez de UPDATE se existir, INSERT se não).
- **Severidade:** 🔴 ALTA
- **Sugestão:** Mesma optimização — batch SELECT ingredientes. Considerar UPSERT em vez de DELETE+INSERT.

### 1.3. `generate_shopping_list_from_meal_plan` — query recipe_ingredients por entrada
- **Ficheiro:** `crates/core/src/db.rs:3462-3475`
- **Problema:** Para cada `entry` no meal plan, faz `conn.query("SELECT ri.* FROM recipe_ingredients ri WHERE ri.recipe_id = ?1")`. O pior: chama `get_conn(db)` *dentro do loop* (linha 3468), abrindo N conexões separadas. N+1 agravado.
- **Severidade:** 🔴 ALTA
- **Sugestão:** Recolher todos os `recipe_id` das entries, fazer `SELECT * FROM recipe_ingredients WHERE recipe_id IN (?,?,...)` numa única query, e agrupar em HashMap.

### 1.4. `get_recent_activity` — 4 queries separadas ordenadas em Rust
- **Ficheiro:** `crates/core/src/db.rs:3630-3744`
- **Problema:** Executa 4 SELECTs completamente separados (recipes recentes, stock updates, meal plan entries, shopping purchases), junta em Vec, ordena por timestamp em Rust, trunca. A ordenação O(n log n) em Rust de 4*n itens, quando o banco faz isso nativamente.
- **Severidade:** 🟡 MÉDIA
- **Sugestão:** Usar `UNION ALL` com uma subquery de ordenação e `LIMIT ?1` directamente no SQLite. Menos dados transferidos, zero ordenação em Rust.

### 1.5. `row_to_recipe_with_ingredients` — query por receita individual após listagem
- **Ficheiro:** `crates/core/src/db.rs:650-699`
- **Problema:** Esta função é chamada por `create_recipe` e `update_recipe` depois de obter a receita. Abre uma nova conexão (`get_conn`) e faz uma query `JOIN recipe_ingredients` mesmo que o recipe_id seja conhecido. Isto já não é N+1 porque a função não está num loop *para o mesmo caller*, mas `create_recipe` chama `row_to_recipe_with_ingredients` após `get_recipe`, duplicando comunicações com o DB. Preferível retornar os dados directamente da query de INSERT.
- **Severidade:** 🟢 BAIXA
- **Sugestão:** `create_recipe` e `update_recipe` podem retornar `RecipeWithIngredients` directamente a partir da query de INSERT/UPDATE com RETURNING, evitando o round-trip extra.

---

## 2. Queries sem LIMIT

### 2.1. Nenhuma listagem pública tem LIMIT
- **Ficheiro:** `crates/core/src/db.rs`
- **Problema:** As seguintes funções retornam TODAS as linhas sem qualquer LIMIT:
  - `ingredients_list` (linha 895)
  - `recipes_list` (linha 1081)
  - `stock_list` (linha 1332)
  - `shopping_lists_list` (linha 1411)
  - `suppliers_list` (linha 2487)
  - `categories_list` (linha 2426)
  - `events_list` (linha 2551)
  - `price_quotes_all` (linha 3053)
  - `list_meal_plans` (linha 3353)
  - `get_all_settings` (linha 1964)
- **Severidade:** 🟡 MÉDIA (para um app desktop comercial com potencial de centenas/milhares de ingredientes/receitas)
- **Sugestão:** Adicionar paginação opcional (parâmetros `page`/`per_page`) e pelo menos um `LIMIT 1000` como safety net. A paginação já existe para `recipes_paginated` (linha 1144), mas não é usada pelo frontend (que chama `recipes_list`).

### 2.2. `get_dashboard_stats` — 6 queries COUNT separadas
- **Ficheiro:** `crates/core/src/db.rs:3558-3626`
- **Problema:** O dashboard executa 6 SELECTs COUNT/SUM individuais em vez de combiná-los. Numa BD pequena (<1000 registos) é imperceptível, mas cada query tem overhead de ida/volta ao SQLite. São sempre rápidas (COUNT sobre índice), mas o overhead de 6 queries é evitável.
- **Severidade:** 🟢 BAIXA
- **Sugestão:** Combinar `SELECT (SELECT COUNT(...) FROM stock), (SELECT COUNT(...) FROM recipes), ...` numa única query. Reduz de 6 round-trips para 1.

---

## 3. Índices em Falta

### 3.1. Falta índice composto `ingredients(event_id, name)`
- **Problema:** Várias queries filtram por `WHERE event_id IS NULL ORDER BY name`. O índice `idx_ingredients_name` ajuda na ordenação, mas não filtra por `event_id` (que é indexado como NULL na maioria das linhas).
- **Severidade:** 🟢 BAIXA (event_id é NULL para catalogo, poucas linhas por evento)
- **Sugestão:** `CREATE INDEX idx_ingredients_catalog ON ingredients(event_id) WHERE event_id IS NULL;` — índice parcial.

### 3.2. Falta índice `stock(quantity, min_quantity)`
- **Ficheiro:** `db.rs:3926-3940`
- **Problema:** `get_low_stock_ingredients` filtra por `s.quantity > 0 AND s.quantity <= s.min_quantity OR s.quantity <= ?1` e ordena por `s.quantity / NULLIF(s.min_quantity, 0)`. Sem índice, faz full scan na tabela stock.
- **Severidade:** 🟡 MÉDIA
- **Sugestão:** `CREATE INDEX idx_stock_qty ON stock(quantity, min_quantity);`

### 3.3. Falta índice `shopping_list_items(purchased, purchased_at)`
- **Ficheiro:** `db.rs:3714-3724`
- **Problema:** A query de activity feed filtra por `WHERE sli.purchased = 1 AND sli.purchased_at IS NOT NULL ORDER BY sli.purchased_at DESC`. Sem índice composto.
- **Severidade:** 🟢 BAIXA
- **Sugestão:** `CREATE INDEX idx_shopping_items_purchased ON shopping_list_items(purchased, purchased_at);`

### 3.4. Falta índice `meal_plans(start_date, end_date)`
- **Problema:** As queries de date range (`get_upcoming_meals`, `get_meal_plan_entries_by_date_range`) filtram por `date(mp.start_date) <= X AND date(mp.end_date) >= Y`. Sem índice, full scan.
- **Severidade:** 🟡 MÉDIA
- **Sugestão:** `CREATE INDEX idx_meal_plans_dates ON meal_plans(start_date, end_date);`

---

## 4. Re-renders React

### 4.1. `setInterval` no Topbar — Actualização do relógio a cada 1s
- **Ficheiro:** `src/components/Layout.tsx:46-48`
- **Problema:** `setInterval(() => setNow(new Date()), 1000)` no componente `Topbar`. Isto força um re-render de `Topbar` — e por consequência de todo o `LayoutInner` — a cada 1 segundo. O React não re-renderiza filhos que não mudaram (graças ao `key` e aos componentes puros), mas o próprio `Topbar` re-renderiza integralmente: o título, subtítulo, search bar, botões de idioma, tema, etc. Tudo só para actualizar o `formatClock(now)` na linha 69.
- **Severidade:** 🟡 MÉDIA
- **Sugestão:** Extrair o relógio para um componente independente com o seu próprio `setInterval`, encapsulado com `React.memo`. Ou usar um span com `innerHTML` directo para evitar re-render. Melhor ainda: só actualizar a cada 30s ou 60s (ninguém precisa de segundos exactos num relógio de topbar).

### 4.2. React.StrictMode — Efeitos duplicados em dev
- **Ficheiro:** `src/main.tsx:18`
- **Problema:** O `<React.StrictMode>` envolve a árvore toda, o que faz com que `useEffect` dispare duas vezes em desenvolvimento. Cada página carrega dados duas vezes (e.g., Dashboard faz 8 invocações IPC em vez de 4). Isto é intencional no React (detecta efeitos não limpos), mas pode enganar medições de performance durante o desenvolvimento.
- **Severidade:** 🟢 BAIXA (apenas dev)
- **Sugestão:** Nada a corrigir — é esperado. Apenas documentar que medições em dev devem ter isto em conta.

### 4.3. `useI18n()` com dependência em `dictionaries`
- **Ficheiro:** `src/i18n/index.tsx:37-49,67-80`
- **Problema:** O contexto `I18nProvider` carrega dicionários via `entry.load()` (dinâmico). A função `t` é criada com `useCallback` e depende de `dictionaries[language]`. Quando o dicionário é carregado, todo o estado do provider muda, forçando re-render de todos os consumidores `useI18n()`.
- **Severidade:** 🟢 BAIXA (ocorre apenas na mudança de idioma, não em cada t())
- **Sugestão:** Aceitável para uma app desktop. Se o `load()` for lento, considerar SSR pré-embebido dos dicionários.

---

## 5. Bundle Size

### 5.1. Nenhum lazy loading no router
- **Ficheiro:** `src/router.tsx:4-18`
- **Problema:** Todas as 15 páginas são importadas estaticamente no topo do ficheiro. Não há `React.lazy()` nem `Suspense`. Todo o código de todas as páginas é carregado e parseado no arranque, independentemente de o utilizador alguma vez visitar "Scanner de recibos" ou "Ajuda".
- **Severidade:** 🔴 ALTA
- **Sugestão:** Substituir importações estáticas por `const FooPage = lazy(() => import("./pages/FooPage"))` e envolver o `<Outlet>` em `<Suspense fallback={...}>`. Especialmente para `ReceiptScannerPage` que carrega `tesseract.js` (~5MB WASM).

### 5.2. `tesseract.js` carregado sempre
- **Ficheiro:** `package.json:17`
- **Problema:** `tesseract.js` (~5MB de WASM) está nas `dependencies` e é importado estaticamente. Mesmo utilizadores que nunca usam o scanner pagam o custo de download/parse do WASM. A importação estática está provavelmente em `ReceiptScannerPage.tsx`.
- **Severidade:** 🔴 ALTA
- **Sugestão:** Lazy-load `tesseract.js` com `import("tesseract.js")` apenas quando o utilizador abrir o scanner. Combinar com o lazy loading da página (5.1).

### 5.3. Tipos bindings como importações estáticas
- **Problema:** Cada página importa os seus tipos de `../../crates/core/bindings/*`. Embora sejam só tipos (removidos em runtime), o TypeScript ainda precisa de os parsear. Com 15+ páginas e 30+ tipos cada, o parse inicial é mais lento.
- **Severidade:** 🟢 BAIXA
- **Sugestão:** Usar `import type { ... }` (já usam) para eliminar do bundle. É o que já fazem. Sem acção necessária.

---

## 6. Serialização Excessiva via IPC

### 6.1. `recipes_list` retorna Recipe + Vec<RecipeIngredient> completo
- **Ficheiro:** `crates/core/src/db.rs:1081-1141`
- **Problema:** A função retorna `Vec<RecipeWithIngredients>` onde cada receita inclui o array completo de `ingredients`. Para 100 receitas com média de 5 ingredientes, são ~500 objects serializados para JSON e transferidos via IPC. A página de receitas (`RecipesPage.tsx`) só usa o nome, categoria, porções para as cards.
- **Severidade:** 🟡 MÉDIA
- **Sugestão:** A listagem de receitas devia ser `Vec<Recipe>` (sem ingredients), e os ingredientes carregados apenas quando o utilizador selecciona uma receita. O endpoint `recipes_paginated` já existe e retorna só `Recipe` — usá-lo em vez de `recipes_list`.

### 6.2. `get_shopping_list` retorna lista completa com items
- **Ficheiro:** `crates/core/src/db.rs:1430+`
- **Problema:** A função retorna `ShoppingList` com todos os `items` embutidos. Para listas grandes (100+ items), cada chamada serializa tudo.
- **Severidade:** 🟢 BAIXA (shopping lists raramente são enormes)
- **Sugestão:** Paginação opcional nos items.

### 6.3. `price_quotes_all` retorna quotes com dados de ingredientes desnormalizados
- **Ficheiro:** `crates/core/src/db.rs:3053`
- **Problema:** `PriceQuoteWithIngredient` inclui `ingredient_name` e `ingredient_unit` para cada quote. Com 1000 quotes, duplica dados que o frontend já tem.
- **Severidade:** 🟢 BAIXA
- **Sugestão:** Considerar retornar `PriceQuote` (sem dados do ingrediente) e deixar o frontend fazer lookup local.

---

## 7. Startup Time

### 7.1. `run_migrations` — 19 migrations sequenciais
- **Ficheiro:** `crates/core/src/db.rs:68-460`
- **Problema:** As 19 migrations correm sempre no arranque, cada uma num `conn.execute()` individual. Embora `CREATE TABLE IF NOT EXISTS` seja rápido em SQLite, são 19+ comandos SQL antes da app estar pronta. As verificações de colunas faltantes (`add_column_if_missing`) são ainda mais lentas porque executam `PRAGMA table_info()` em cada startup.
- **Severidade:** 🟡 MÉDIA
- **Sugestão:** Usar uma tabela `_migrations` para track de quais já correram, e só executar as pendentes. As `add_column_if_missing` podem ser substituídas por guardar a versão do schema e só verificar quando há upgrade.

### 7.2. `add_column_if_missing` lê PRAGMA table_info em cada arranque
- **Ficheiro:** `crates/core/src/db.rs:462-479`
- **Problema:** `add_column_if_missing` executa `PRAGMA table_info({table})` e itera todas as colunas para ver se uma coluna existe. Isto é feito para cada coluna adicionada em migrations recentes (stock_purchases.brand, recipes.event_id, recipes.base_recipe_id, ingredients.event_id).
- **Severidade:** 🟢 BAIXA (tabelas pequenas)
- **Sugestão:** Migrations versionadas eliminam esta necessidade.

### 7.3. `seed_default_categories` corre sempre
- **Ficheiro:** `crates/core/src/db.rs:528-558`
- **Problema:** As categorias padrão são inseridas com `INSERT OR IGNORE` em cada arranque (8 categorias de recipe + 8 de ingredient = 16 INSERTs).
- **Severidade:** 🟢 BAIXA
- **Sugestão:** Mover para a primeira migration ou para a secção de seed. Não precisa de executar em cada startup.

---

## 8. IPC Overhead

### 8.1. Tauri State Management — Clone do Database em AppDb
- **Ficheiro:** `crates/tauri/src/lib.rs:53-65`
- **Problema:** `AppDb` contém `pub db: Database`. Cada comando Tauri recebe `db: tauri::State<'_, crate::AppDb>` e chama métodos que abrem uma conexão nova via `get_conn(&self.db)`. Cada conexão executa `PRAGMA busy_timeout = 5000` (round-trip extra ao DB). Para workloads normais (1-2 commands por clique) é aceitável, mas para dashboard que carrega 4 comandos, são 4 conexões + 4 PRAGMAs.
- **Severidade:** 🟢 BAIXA
- **Sugestão:** Reutilizar a mesma conexão dentro de um batch ou usar um pool de conexões (já suportado por libSQL). O `busy_timeout` só precisa de ser definido uma vez por conexão — se reutilizar conexões, não há overhead.

### 8.2. Serialização JSON em cada comando Tauri
- **Problema:** Cada `#[tauri::command]` pass-through (`lib.rs:521-1010`) serializa/deserializa Input e Output como JSON através do IPC bridge. O overhead é o custo do serde para cada struct. `Vec<RecipeWithIngredients>` para 100 receitas pode ser ~100KB de JSON.
- **Severidade:** 🟡 MÉDIA
- **Sugestão:** Para listagens grandes, considerar compressão ou enviar em chunks. Melhor: reduzir o payload (ver 6.1).

---

## 9. Problemas Adicionais

### 9.1. Conversão de unidades duplicada no frontend e backend
- **Ficheiro:** `src/pages/RecipesPage.tsx:64-89` e `crates/core/src/db.rs:1829-1875`
- **Problema:** A lógica `computeCostLines` no frontend duplica a lógica de conversão de unidades que o backend já faz em `calculate_cost`. Ambas convertem unidades, mas o frontend usa dados de `ingredients_list` + `recipes_list` para calcular custos localmente (sem IPC). Isto é intencional (evita chamada IPC), mas significa que o frontend precisa de ter TODOS os ingredientes em memória.
- **Severidade:** 🟢 BAIXA
- **Sugestão:**
Documentar que esta duplicação é deliberada.

### 9.2. `devInvoke.ts` — Dados de seed embutidos
- **Ficheiro:** `src/lib/devInvoke.ts:19-36`
- **Problema:** Arrays de ingredientes (16 items), stock (8), receitas (6), etc. são construídos e mantidos como dados mock em memória para dev preview. Embora só usados em DEV, são carregados e parseados sempre que o módulo é importado.
- **Severidade:** 🟢 BAIXA (apenas dev)
- **Sugestão:**
Mover para ficheiros JSON separados importados dinamicamente.

### 9.3. `recipes_list` usa interpolação de string para IN clause
- **Ficheiro:** `crates/core/src/db.rs:1101-1107`
- **Problema:** Na segunda query de `recipes_list`, os IDs são interpolados directamente na string SQL: `ri.recipe_id IN ({ids_str})`. Isto não é SQL injection (os valores vêm do DB, não do utilizador), mas impede que o SQLite optimize o plano de execução (não há query caching com strings dinâmicas).
- **Severidade:** 🟢 BAIXA
- **Sugestão:**
Usar um número fixo de placeholders `(?1, ?2, ..., ?N)` ou usar `IN (SELECT recipe_id FROM recipe_ingredients WHERE ...)` com subquery.

### 9.4. Duplicação massiva de Unit::parse em cada row mapper
- **Problema:** Cada função `row_to_*` tem um bloco `match unit_str.as_str()` de 20 variantes, repetido em 8+ funções diferentes (row_to_ingredient, row_to_recipe_with_ingredients, row_to_stock_item, row_to_shopping_item, parse_unit em calculate_cost, etc.). Cada função faz pattern matching idêntico em cada linha.
- **Severidade:** 🟢 BAIXA (custo negligenciável)
- **Sugestão:**
Extrair `fn unit_from_str(s: &str) -> Unit` para evitar duplicação e melhorar manutenção.

---

## Resumo de Achados

| # | Categoria | Ficheiro:Linha | Severidade |
|---|-----------|---------------|------------|
| 1.1 | N+1 Query | db.rs:1211 | 🔴 ALTA |
| 1.2 | N+1 Query | db.rs:1255 | 🔴 ALTA |
| 1.3 | N+1 Query | db.rs:3468 | 🔴 ALTA |
| 1.4 | N+1 Query | db.rs:3630-3744 | 🟡 MÉDIA |
| 2.1 | Sem LIMIT | db.rs:895+ | 🟡 MÉDIA |
| 2.2 | 6 COUNTs | db.rs:3558 | 🟢 BAIXA |
| 3.2 | Índice falta | db.rs:3926 | 🟡 MÉDIA |
| 3.4 | Índice falta | db.rs:3748 | 🟡 MÉDIA |
| 4.1 | setInterval 1s | Layout.tsx:46 | 🟡 MÉDIA |
| 5.1 | No lazy loading | router.tsx:4-18 | 🔴 ALTA |
| 5.2 | tesseract.js sempre | package.json:17 | 🔴 ALTA |
| 6.1 | Serialização excessiva | db.rs:1081 | 🟡 MÉDIA |
| 7.1 | Migrations sequenciais | db.rs:68 | 🟡 MÉDIA |

**Total:** 13 achados (4 🔴 ALTA, 6 🟡 MÉDIA, 3 🟢 BAIXA)

---

## Conclusão

**Rating: 4.0/10** — A base de código tem performance razoável para o estado actual (~20K LOC, dados pequenos), mas não escala. Os problemas mais gritantes são:

1. **N+1 reais** na criação/actualização de receitas e na geração de lista de compras a partir de meal plans — vão degradar-se O(n²) com o crescimento.
2. **Zero lazy loading** no frontend — todo o código de todas as páginas é carregado sempre, incluindo `tesseract.js` (~5MB WASM).
3. **Nenhuma listagem tem LIMIT** — funcional para 50 receitas, insustentável para 5000.
4. **Relógio no topbar com setInterval de 1s** — pequeno, mas num ciclo de bateria (laptop) ou com muitos componentes, soma.

**Prognóstico:** Com 200+ receitas e 1000+ ingredientes, a app começa a sentir lentidão nas listagens (serialização IPC) e no startup (14 migrations). Com 5000+ receitas, o N+1 no meal planner torna-se inutilizável.

**Prioridades de correcção:**
1. 🔥 Lazy loading nas rotas + tesseract.js (dias de implementação, impacto imediato)
2. 🔥 LIMIT em todas as listagens públicas
3. 🔥 N+1 em `generate_shopping_list_from_meal_plan` (pior caso)
4. ⏳ N+1 em `create_recipe` / `update_recipe`
5. ⏳ `get_recent_activity` com UNION ALL
6. ⏳ Extrair relógio para componente React.memo
7. 🧊 Índices em stock(quantity) e meal_plans(start_date, end_date)
