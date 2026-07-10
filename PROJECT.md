# Project: mise — Recipe Planner

Documento vivo de referência do projeto. Substitui o "Plano Estruturado" solto
(não commitado, gerado em 2026-07-01) e o `docs/HANDOFF_AGENT.md` (mantido como
log histórico técnico, ver banner no topo desse ficheiro).

## Arquitetura

- **Estrutura**: Rust Workspace com `crates/core` (lógica de base de dados
  libSQL & modelos de domínio), `crates/tauri` (comandos Tauri), e `src-tauri`
  (launcher Tauri). Frontend é uma SPA React/TypeScript com Vite.
- **Fluxo de dados**: Frontend invoca comandos Tauri IPC -> backend Tauri
  comunica com a base de dados via `crates/core` -> a BD devolve structs Rust
  mapeados em tipos TypeScript via bindings `ts-rs`.

## Estrutura de código

- Frontend: `src/` (components, pages, i18n, styles, main, router)
- Backend:
  - `crates/core/src/` (migrações, schemas, helpers, tipos de domínio)
  - `crates/tauri/src/` (wrapper de estado da app e definições de comandos)
  - `src-tauri/src/` (entry point Tauri, registo de plugins e comandos)

---

## Ordem de execução (revisão de 2026-07-06)

Sequência decidida após rever o plano contra o estado real do código:

1. **3.3 — Stock isolado por evento** — modelo (a) fechado, plano de
   implementação detalhado na secção 3.3.
2. **Decisão de OCR** com recibos reais (ver [[OCR — Digitalização de
   recibos]]). Tem um acoplamento de segurança que sobe a prioridade:
   fechar o OCR fecha também o buraco temporário da CSP
   (`cdn.jsdelivr.net` em `connect-src`, ver Fase 2).
3. **Fase 4 — Distribuição** (secção nova abaixo) — empacotamento, fix do
   path `mise/mise/mise.db` com migração de dados, teste em máquina limpa
   (que também resolve ou descarta o bug da câmara da Fase 0).
4. **Utilizadores reais a testar** → só depois, **Fase de Polishing**.

God-components (adiado na Fase 2) e i18n de vocabulário só entram se o
feedback de utilização real apontar para lá.

---

## Fase 0 — Estabilização

Objetivo: a app funciona de ponta a ponta em Linux nativo, sem bugs
bloqueantes, antes de qualquer feature nova.

- [x] Auditoria de todos os branches → `project/hermes/full` escolhido como
  base de `project/remaster`.
- [x] Fix do bug `export_data` (7× E0609, shape aninhada de
  `RecipeWithIngredients`).
- [x] Remoção de bagagem PWA/Android (`sw.js`, `manifest.json`, workflow
  Android).
- [x] Fix EGL/renderização (`nixGL` — Mesa do Nix não ligava ao driver Intel
  `iris` do sistema em Ubuntu não-NixOS).
- [x] Fix TLS (`glib-networking` + `cacert` + `GIO_EXTRA_MODULES`).
- [x] Fix condição de corrida no arranque (`.manage(db)` bloqueante dentro do
  `setup()`).
- [x] Fix `PRAGMA journal_mode = WAL` (`.execute()` → `.query()`).
- [x] Fix contrato de API Tauri v2 em `IngredientsPage` (wrapper `input`).
- [x] Fix comandos do Dashboard não registados (`dashboard_stats`,
  `dashboard_recent_activity`, `dashboard_upcoming_meals`,
  `dashboard_low_stock`).
- [x] Commit dos fixes validados, separados em commits lógicos por bug.
- [x] Teste manual dos módulos e correções (Receitas, Custos, Armazém,
  Compras, Planeamento, Relatórios, Fornecedores, Scanner, Definições).
- [x] Botão "gerar dados random" (seed demo) e "Limpar dados" em Developer
  Options, atrás de `#[cfg(debug_assertions)]` (`seed_demo_data` /
  `delete_all_data`, `SettingsPage.tsx`).
- [x] Dashboard na navegação/sidebar principal.
- [x] Ficheiros órfãos da reescrita (`orig.tsx`, `rewrite.py`, `scratch.py`,
  `test-recipe.tsx`) — já não existem no repo.
- [x] Newline final em `src-tauri/Cargo.toml` — já presente.
- [x] **Padronizar a convenção de argumentos Tauri v2 em todo o frontend.**
  Auditoria dedicada (2026-07-05): as 36 chamadas `invoke()` em `src/` foram
  comparadas uma a uma contra as assinaturas reais em
  `crates/tauri/src/lib.rs`. Todas já seguem a convenção corretamente
  (chaves top-level `listId`/`itemId`/`mealPlanId`/`ingredientId`/`input`
  em camelCase, campos aninhados dentro de `input` em snake_case). A
  estimativa de "~31-34 violações" do grep anterior era falso positivo —
  contava chaves snake_case dentro do `input`, que estão corretas por
  definição da convenção. Nada para corrigir.
- [x] **Importar os bindings TypeScript gerados pelo `ts-rs`
  (`crates/core/bindings/`) em vez de o frontend redefinir interfaces à
  mão.** Feito em 2026-07-05, em duas partes:
  1. Descoberta durante a auditoria: os bindings declaravam `bigint` para
     todos os campos `i64` (comportamento por omissão do `ts-rs`), mas o
     IPC do Tauri serializa sempre como JSON `number` — o tipo nunca batia
     com o valor real em runtime. Corrigido anotando `i64`/`Option<i64>`/
     `Vec<i64>` em `domain.rs` com `#[ts(type = "...")]` (`number`,
     `number | null`, `Array<number>`) e regenerando os 74 bindings via
     `cargo test -p mise-core export_bindings`.
  2. Substituídas as interfaces duplicadas manualmente em 11 ficheiros
     (`IngredientsPage`, `ImageUpload`, `SuppliersPage`, `StockPage`,
     `MealPlannerPage`, `ShoppingListPage`, `RecipesPage`, `CostsPage`,
     `ReportsPage`, `DashboardPage`, `CalendarPage`, `ReceiptScannerPage`)
     por `import type` dos bindings. Ficaram de fora, propositadamente,
     tipos sem equivalente real no backend: `CostAnalysis`/`CostLine`
     (cálculo de margem só no frontend, sem endpoint), `ParsedLine`
     (parsing heurístico de OCR), `BarListRow`/`SupplierWithQuotes`
     (composição de UI). Corrigidos dois usos de um campo `category`
     inexistente em `Ingredient` (sempre `undefined` em runtime,
     mascarado por fallback `|| "Outros"`) descobertos pelo type-check ao
     trocar o tipo. Validado com `cargo check -p mise-core -p mise-tauri`,
     `npx tsc --noEmit` e `npm run build`, todos limpos.
- [x] **Limpeza do `mise.db` órfão.** Encontrados dois ficheiros nesta
  máquina: `~/.local/share/com.recipe-planner.app/mise.db` (10 de junho,
  órfão, path de antes da resolução atual) e
  `.../mise/mise/mise.db` (ativo, escrito durante esta sessão). Renomeado
  o órfão para `mise.db.orphan-2026-07-05.bak` em vez de apagado
  (reversível). **Achado à parte, não corrigido aqui:** o path ativo tem
  `mise` duplicado (`.../mise/mise/mise.db`) porque `open_db()`
  (`crates/core/src/db.rs`) faz `dir.join("mise")` sobre um
  `app_data_dir` que o Tauri já resolve para `.../mise` — bug real, mas
  corrigi-lo agora mudaria o path que a app já usa em produção nesta
  máquina, haveria de vir com migração dos dados existentes. Fica para
  Fase 2, não é bloqueante.
- [ ] **Bug: câmara não abre no Scanner de recibos** (sessão de 2026-07-05,
  máquina de desenvolvimento Ubuntu + Nix misturados — mesma família de
  problema que o fix de EGL/TLS acima). Sintoma: `getUserMedia` falha
  sempre, WebKitGTK reporta no terminal `GStreamer element appsink not
  found` e `Video capture was requested but no device was found amongst 0
  devices`, apesar de `/dev/video0` existir e `gst-inspect-1.0` encontrar
  `appsink`/`v4l2src` normalmente a partir do shell. Já testado sem
  resolver: `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` (elimina o erro de
  sandbox mas não este), instalar `libssl-dev` +
  `libwebkit2gtk-4.1-dev`/`libgtk-3-dev` via apt (resolveu erros de
  compilação `openssl-sys`/`glib-sys` em separado, não o da câmara), e
  apontar `PKG_CONFIG_PATH` manualmente (o `pkg-config` ativo por omissão
  nesta máquina é o do Nix, que não vê os `.pc` instalados pelo apt em
  `/usr/lib/x86_64-linux-gnu/pkgconfig` — mistura Nix/apt torna o ambiente
  de build inconsistente, à parte do bug da câmara em si). Hipótese por
  confirmar: sandbox do WebKitGTK bloqueia o *device discovery* do
  GStreamer mesmo com `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` (essa
  flag pode não cobrir o processo GStreamer/pipewire), ou falta o portal
  `xdg-desktop-portal` para concessão de câmara em apps sandboxed. Não
  bloqueante para o resto da app — o resto do Scanner (upload manual de
  imagem + OCR) não depende disto.
  **Decisão (revisão 2026-07-06): não gastar mais depuração nesta
  máquina.** O ambiente Nix/apt misturado é o suspeito principal e não é
  representativo de utilizadores finais. A validação passa para a Fase 4 —
  Distribuição: testar o build empacotado numa máquina limpa; se a câmara
  funcionar lá, este item fecha-se como "ambiente de dev", sem fix; se não
  funcionar, ganha finalmente um diagnóstico num ambiente representativo.

---

## Fase 1 — Redesign de UI — ✅ CONCLUÍDA

Fundida para `main` nesta sessão (branch `project/remaster` → `main`, merge
`--no-ff`, validado com `cargo check`/`test --workspace`, `tsc --noEmit`,
`npm run build`, tudo verde). Mantido o design system pro-kitchen (dark,
denso, amber `#f5a524`, tabular numbers) como base.

---

## Fase 2 — Higiene técnica — encerrada com 2 itens adiados (2026-07-06)

Dos 5 itens, 3 fechados (warnings, CSP, dedup de unidades). Os 2 restantes
foram deliberadamente adiados, não esquecidos — cada um depende de uma
decisão de produto, não é algo a decidir autonomamente:

- **Migração de OCR** — a escolha entre nativo (Rust `ocrs`/`rten`) e
  Vision LLM local está documentada como "por fechar" em
  [[OCR — Digitalização de recibos]], à espera de teste com recibos reais.
  Implementar qualquer uma agora seria decidir prematuramente.
- **Refactor dos god-components** — puramente estrutural, sem mudança de
  comportamento, em 4 componentes grandes sem testes de frontend; o maior
  risco é regressão silenciosa (stale closures, effects, handlers mal
  religados) que só um teste visual exaustivo apanharia. Prioridade
  combinada: ter a app estável para utilizadores finais testarem vem
  primeiro. Retomar depois da Fase 3, ou antes se feedback de utilização
  apontar para uma das páginas grandes especificamente.

- [x] **Limpar os ~466 warnings do Rust.** 441 eram `missing_docs`
  (`#![warn(missing_docs)]` em `crates/core/src/lib.rs`) sobre campos
  triviais de DTOs (`id`, `name`, `price_per_unit`...) — lint nunca
  honrado, removido em vez de forçar comentários sem valor. Os ~25
  restantes eram reais: `cargo fix` tratou imports/variáveis não usados
  automaticamente; removidas à mão duas funções mortas nunca chamadas
  (`row_to_setting`, `row_to_receipt_import`) e um acumulador morto
  (`total_estimated_cost` em `generate_shopping_list_from_meal_plan`,
  calculado mas nunca devolvido — `MealPlanShoppingList` não tem campo de
  custo total, cada `ShoppingItem` já traz o seu `estimated_cost`).
  `cargo check --workspace` limpo (0 warnings), `cargo test --workspace`
  (74 testes) e `npx tsc --noEmit` sem erros.
- [x] **Definir uma CSP no `tauri.conf.json`.** Antes `null`. Definida:
  `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src
  'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src
  'self' ipc: http://ipc.localhost https://cdn.jsdelivr.net`. O
  `cdn.jsdelivr.net` em `connect-src` é temporário — o `tesseract.js`
  descarrega dali o worker script e os dados de língua por omissão;
  remover quando a migração de OCR para crate Rust nativo (item abaixo)
  acontecer. Durante a validação (`cargo tauri dev`, confirmação visual)
  descoberto e corrigido um bug real, não relacionado com CSP
  mas que a CSP obrigou a resolver para poder escrever `img-src`
  corretamente: `ImageUpload.tsx` construía a pré-visualização de imagem
  com `http://localhost:8080/${image.path}` — não existe (nem nunca
  existiu) nenhum servidor a ouvir na porta 8080 nesta app, pelo que a
  pré-visualização de imagens em Receitas/Ingredientes estava
  permanentemente partida. Corrigido com um novo comando Tauri
  `image_read_base64` (lê o ficheiro do disco, devolve base64) e o
  frontend monta um `data:` URL — evita depender de qualquer protocolo
  externo e mantém a CSP restrita a `img-src 'self' data:`.
- [x] **`tauri-plugin-opener` para links externos.** Confirmado: chamar
  `invoke("plugin:opener|open_url", { url })` diretamente é a forma
  correta e suportada (é a mesma chamada que a API oficial
  `@tauri-apps/plugin-opener` faria por baixo; não instalado o pacote
  JS extra só por preferência cosmética). O que estava mesmo por
  resolver era a duplicação: `openExternal()` estava definida
  identicamente em `SettingsPage.tsx` e `HelpPage.tsx`. Movida para
  `src/lib/devInvoke.ts` (já é o módulo partilhado de `invoke`), ambas
  as páginas importam de lá agora.
- [ ] **Adiado, decisão de produto pendente.** Migrar OCR de `tesseract.js` (client-side)
  para crate Rust nativo. Não substituir por API externa sem decisão
  explícita (privacidade/local-first) — ver [[OCR — Digitalização de
  recibos]] para as duas abordagens já exploradas.
- [ ] **Adiado, depois da Fase 3.** Refatorar god-components:
  `ShoppingListPage` (~835 linhas), `RecipesPage` (~794 linhas),
  `MealPlannerPage` (~666 linhas), `ReportsPage` (~785 linhas).
- [x] Página de Ajuda com conteúdo real — `HelpPage.tsx` já tem conteúdo
  próprio (secções por módulo + links úteis), não é placeholder.
- [x] **Duplicação de `UNIT_LABELS`/`UNIT_SHORT`.** Consolidada em
  `src/lib/units.ts` (`UNIT_LABELS_FULL` "símbolo — nome" para
  dropdowns, `UNIT_LABELS_SHORT` derivado para células de tabela),
  importado em `CostsPage`, `DashboardPage`, `IngredientsPage`,
  `RecipesPage`, `ReportsPage`, `ShoppingListPage`, `StockPage`.
  `ReceiptScannerPage` ficou de fora — usa um vocabulário diferente
  (pack/bottle/box/can/jar/sachet) que não corresponde ao enum `Unit`
  real do backend, é heurística de parsing de OCR, fora do âmbito desta
  limpeza. Dois achados reais durante a consolidação:
  1. `IngredientsPage.tsx` e `RecipesPage.tsx` tinham um grupo "Outro"
     no seletor de unidade com `centimeter`/`celsius`/`fahrenheit` —
     nenhum destes existe no enum `Unit` do backend (só 20 variantes,
     de `Gram` a `Slice`); escolher qualquer um deles falharia ao
     guardar (`serde` rejeita variante desconhecida). Grupo removido,
     chave de tradução `ingredients.unitGroups.other` removida de
     `en.ts`/`pt.ts`.
  2. `RecipesPage.tsx` mostrava `piece` como `"un"` enquanto todas as
     outras páginas mostravam `"pcs"` — inconsistência real entre
     páginas, escondida pela duplicação. Uniformizado para `"pcs"`.
  Validado com `npx tsc --noEmit`, `npm run build`, e confirmação
  visual (Ingredientes/Receitas/Stock/Compras).

---

## Fase 3 — Features estruturantes

### 3.1 — Marca + stock multi-nível — ✅ CONCLUÍDA (2026-07-06)

**Problema a resolver:** hoje, stock e preço vivem ao nível do ingrediente. É
preciso descer um nível: o mesmo ingrediente (arroz) pode ter várias marcas
(Cigala, Continente), a mesma marca pode vir de vários fornecedores com
preços diferentes, e o stock físico existe por essa combinação (marca ×
fornecedor).

**Modelo de dados (esboço):**
- **Ingrediente** (arroz) — nível de receita e de alerta de stock mínimo. As
  receitas continuam a pedir "300g de arroz", sem saber de marca.
- **Lote de stock** (arroz Cigala, fornecedor A, preço, quantidade) — nível
  físico. Um ingrediente tem vários lotes.
- **Alerta de stock baixo** — soma o total de todos os lotes do ingrediente
  (evita falsos alertas), com possibilidade de ver o detalhe por
  marca/fornecedor.

**Decisões fechadas (2026-07-06):**
1. **Política de custo:** média ponderada pela quantidade em stock. Reflete o
   custo real do mix guardado; mais barato/mais caro primeiro distorcem o
   custo real, e a política proporcional confunde cálculo de custo com
   política de *consumo* de stock (decrementa vários lotes ao mesmo tempo).
   → Comparação com dados reais das outras 3 políticas fica para
   [[#Fase de Polishing]].
2. **Âmbito:** global (Settings) como default, override por ingrediente
   fica para depois. Sem seletor por-cálculo na v1.
3. **Onde vive a marca e caminho único para o stock subir:** confirmado —
   auditoria ao código (2026-07-06) mostrou que a divergência é maior do que
   documentado antes: `price_quotes.supplier` é texto livre (sem FK),
   `shopping_list_toggle_item` só liga uma flag (não cria stock_purchase,
   não atualiza stock, não regista fornecedor), e o único INSERT em
   `stock_purchases` vindo da confirmação de importação de recibo
   (`db.rs:4383`) nem preenche `supplier_id` — fica sempre NULL. Só o
   caminho manual (`stock_purchase_add`) faz tudo corretamente hoje.
   **Decisão: convergir em `stock_purchases` como único evento que sobe
   stock** — já tem a forma certa (ingrediente + quantidade + preço +
   `supplier_id` + data = lote), evita empilhar uma terceira representação
   sobre as duas já divergentes. `price_quotes.supplier` mantém-se texto
   livre por agora (catálogo de referência solto, não um lote real) —
   não é bloqueador do 3.1.
   Ao implementar: corrigir o `supplier_id` NULL na importação de recibo;
   ligar `shopping_list_toggle_item` a criar um lote real (deixa de ser só
   flag, passa a pedir/confirmar marca+fornecedor+preço, pré-preenchido com
   a estimativa); e definir convenção para evitar duplicar stock quando a
   mesma compra é registada por dois caminhos (lista de compras vs. recibo
   da mesma ida às compras) — por agora, convenção de utilização (usar um
   ou outro por compra, não os dois), sem reconciliação automática.
   → Comparar com dados reais as alternativas descartadas (manter dois
   caminhos separados / reconciliação automática lista↔recibo) fica para
   [[#Fase de Polishing]].

**Impacto:** Ingredientes, Stock, Compras, Custos, Fornecedores, Relatórios.

**Implementado (branch `feature/fase3-brand-stock`, merge `9d194d6`):**
- Migração 016: coluna `brand TEXT` em `stock_purchases`. O "lote físico"
  é a própria linha de `stock_purchases` (ingrediente + marca + fornecedor
  + preço + quantidade + data) — sem tabela nova de lotes.
- Convergência dos caminhos que sobem stock em `stock_purchases`
  (`7f3a4ac`), conforme a decisão 3: compra manual (`stock_purchase_add`),
  confirmação de recibo (`receipt_confirm`, agora com `supplier_id` e
  `brand` preenchidos — o INSERT que deixava `supplier_id` NULL foi
  corrigido), e `shopping_list_mark_purchased` (deixou de ser só flag —
  cria um lote real com marca/fornecedor/preço).
- Custo por média ponderada pela quantidade em stock
  (`weighted_avg_stock_price` → `calculate_cost`), conforme a decisão 1.
- Frontend multi-marca (`b6769ec`): marca nos formulários e listagens de
  compras de stock.
- Nota de higiene do plano: esta secção esteve por marcar como concluída
  desde o merge — corrigido na revisão de 2026-07-06. A comparação de
  políticas de custo alternativas e o caminho lista↔recibo alternativo
  continuam em [[#Fase de Polishing]] (com âmbito revisto, ver lá).

### 3.2 — Event mode (modo Evento/Ocasião) — ✅ CONCLUÍDA

**Modelo implementado:**
- Base = catálogo partilhado; `recipes.event_id` (NULL = catálogo principal)
  + `recipes.base_recipe_id` (de que receita do catálogo nasceu a variante,
  quando copiada).
- Congelado, não ao vivo: copiar uma receita do catálogo para um evento tira
  um snapshot independente — editar a receita-base depois não propaga para
  a variante do evento, e vice-versa.
- Nova secção "Eventos" na sidebar (grupo Planeamento), `EventsPage` +
  `EventDetailPage`, para gerir vários eventos em paralelo.
- Dentro de um evento: copiar uma receita existente do catálogo (linha
  inteira clicável no seletor), ou criar uma receita nova exclusiva ao
  evento (nunca aparece no catálogo principal).
- "Tornar receita global" (`recipe_promote_to_catalog`): qualquer receita de
  evento — copiada ou criada de raiz — pode ser promovida ao catálogo
  principal (limpa `event_id` e `base_recipe_id`).
- Apagar um evento apaga em cascata (manual, não FK — ver nota em
  Migration 017 no `db.rs`) todas as suas receitas e ingredientes de receita.

**Adiado para depois (ver 3.3):** stock/ingredientes isolados por evento.

---

### 3.3 — Stock isolado por evento — decidido: modelo (a) (2026-07-06)

Requisito levantado após teste do 3.2: um evento poder ter também ingredientes
exclusivos e stock isolado do catálogo principal — e ao confirmar um recibo
(scanner ou manual) poder escolher se a compra alimenta o stock normal ou o
stock de um evento específico.

**Contexto da escolha:** hoje `stock` e `stock_purchases` assumem uma linha
por ingrediente (`stock.ingredient_id` é `UNIQUE`). Dois modelos estavam em
cima da mesa: **(a)** ingrediente exclusivo ao evento (mesmo padrão do
`event_id` já usado em `recipes` — nada muda em `stock`/`stock_purchases`,
que já isolam por `ingredient_id`); **(b)** chave composta
`(ingredient_id, event_id)` em `stock`/`stock_purchases`, para o mesmo
ingrediente do catálogo poder ter stock do evento contado à parte.

**Decisão (2026-07-06): modelo (a), completado com uma operação "copiar
ingrediente do catálogo para o evento".** O modelo (b) foi descartado:

- O único caso que o (b) resolvia e o (a) puro não — "é a mesma Farinha do
  catálogo, mas quero a quantidade do evento contada à parte" — fica
  coberto pela cópia: copiar a Farinha para o evento cria uma linha própria
  com stock, compras e custo próprios. Consistente com a semântica já
  decidida no 3.2: snapshot congelado, não partilha viva.
- O que se perde vs. (b) é identidade agregada (relatórios que somam
  Farinha-catálogo + Farinha-evento) — marginal para o caso de uso real,
  enquanto o (b) custa mudar a chave `UNIQUE` de `stock`, o
  `weighted_avg_stock_price`, a geração de lista de compras, o scanner e o
  mark-purchased. Se o uso real mostrar falta da agregação, o (b) continua
  implementável por cima — nenhuma porta se fecha.
- As decisões abertas 2 e 3 da proposta original dissolvem-se com o (a):
  - Contexto de evento no scanner/compra manual = só "que lista de
    ingredientes alimenta o matching e o seletor" — escolha manual por
    recibo/compra, sem estado global de "evento ativo".
  - `calculate_cost`/`weighted_avg_stock_price` ficam intocados: uma
    receita de evento custa pelo stock dos `ingredient_id` a que as suas
    linhas apontam, sejam do catálogo ou do evento.

**Plano de implementação (branch `feature/fase3-event-stock`):**

1. **Migração 018** — `add_column_if_missing(&conn, "ingredients",
   "event_id", "INTEGER")` (NULL = catálogo principal). Sem FK real para
   `events`, mesma convenção da Migration 017: cascata manual em
   `delete_event`.
2. **Domínio** — `event_id: Option<i64>` em `Ingredient` e
   `IngredientInput`, anotado `#[ts(type = "number | null")]`; regenerar
   bindings com `cargo test -p mise-core export_bindings`.
3. **Queries de catálogo** — `ingredients_list` (db.rs, hoje SELECT sem
   filtro) passa a `WHERE event_id IS NULL`. A maioria das páginas de
   catálogo que a chamam (Ingredientes, Custos, Stock, Relatórios,
   Fornecedores, Lista de Compras, Scanner) continua a ver apenas o
   catálogo, sem tocar no frontend. Novo `event_ingredients_list(db,
   event_id)` (`WHERE event_id = ?1`), espelho de `event_recipes_list`.
   **Exceção que precisa de mudança no frontend:** `EventDetailPage.tsx`
   reutiliza `RecipeFormContent` (importado de `RecipesPage.tsx`) para
   editar receitas do evento, e hoje carrega o picker de ingredientes desse
   formulário com `ingredients_list()` simples (linha ~42). Assim que essa
   query passar a catálogo-only, o formulário de receita de evento deixa de
   conseguir selecionar ingredientes do próprio evento. `EventDetailPage`
   tem de combinar `ingredients_list()` + `event_ingredients_list(eventId)`
   (client-side, um `Promise.all` + concat) antes de passar a lista ao
   `RecipeFormContent`. `RecipesPage.tsx` (catálogo puro) não precisa desta
   mudança. (Verificado 2026-07-10 via advisory do Opus — ponto que
   bloqueava o passo 3 tal como estava escrito.)
4. **Cópia e promoção** — espelhar o par já existente para receitas:
   - `ingredient_copy_to_event(ingredient_id, event_id)`: nova linha com
     `name`/`unit`/`price_per_unit`/`category_id` copiados e `event_id` do
     evento. Guard de nome duplicado no âmbito do evento. Stock e compras
     da linha original NÃO são copiados — o evento começa a zero (é esse o
     ponto do isolamento).
   - `ingredient_promote_to_catalog(id)`: limpa `event_id`, com guard de
     nome duplicado contra o catálogo (mesmo padrão do guard de
     `recipe_promote_to_catalog`). Comportamento intencional: ao promover,
     o stock e o histórico de compras viajam com o ingrediente (mesmo
     `id`) — o que sobrou do evento passa a stock normal.
5. **Cascata de `delete_event`** — estender a cascata manual existente,
   por esta ordem (há FK `ON DELETE RESTRICT` de `stock_purchases` para
   `ingredients`): `recipe_ingredients` das receitas do evento (já existe)
   → `recipes` do evento (já existe) → `stock` dos ingredientes do evento
   → `stock_purchases` dos ingredientes do evento → `ingredients WHERE
   event_id = ?1` → `events`.
6. **Entradas de stock — revisto (2026-07-10):** verificado que
   `stock_purchase_add` já é inteiramente `ingredient_id`-scoped (upsert em
   `stock`/`stock_purchases` por esse id) — no modelo (a) o próprio
   `ingredient_id` escolhido **é** o destino, catálogo ou evento, sem
   precisar de campo "Destino" nem mudança de schema/backend. O plano
   original de um seletor "Destino: Catálogo / Evento X" era mais pesado do
   que o modelo exige; descartado.
   - **Compra manual para ingrediente de evento:** entrada dedicada em
     `EventDetailPage`, junto à secção "Ingredientes" — botão "Registar
     compra" por linha que abre um formulário pequeno (quantidade, preço,
     unidade, fornecedor opcional, data) e chama `stock_purchase_add` com o
     `ingredient_id` do evento. Mantém stock de evento fora da `StockPage`
     de catálogo, consistente com a intenção de isolamento. `StockPage`
     não muda.
   - **Scanner de recibos:** cortado por agora — a peça mais especulativa,
     sem pedido real de utilizador; o scanner continua a alimentar só o
     catálogo. Revisitar só com pedido concreto de uso real.
   - Lista de compras (`shopping_list_mark_purchased`): fica fora do
     âmbito do 3.3 — listas de compras não são event-scoped hoje; listas
     por evento seriam item novo, só com pedido de uso real.
7. **Comandos Tauri** — registar `event_ingredients_list`,
   `ingredient_copy_to_event` e `ingredient_promote_to_catalog` em
   `crates/tauri/src/lib.rs` E no launcher `src-tauri` (lembrar o bug da
   Fase 0: comandos implementados mas não registados no launcher).
8. **Frontend** — `EventDetailPage` ganha secção "Ingredientes" espelhando
   a de receitas: listar, copiar do catálogo (linha inteira clicável no
   seletor, mesmo padrão), criar novo exclusivo ao evento, promover a
   global, apagar. Seletor de destino no `ReceiptScannerPage` e no
   formulário de compra do `StockPage`. Chaves i18n novas em PT e EN.
9. **Testes** — espelhar os testes de event recipes: cópia começa a zero;
   promoção com colisão de nome; cascata de `delete_event` apaga stock e
   compras do evento sem violar o RESTRICT; `ingredients_list` não devolve
   ingredientes de evento; matching do scanner respeita o destino.
10. **Validação** — workflow standard: `cargo check --workspace`,
    `cargo test --workspace`, `npx tsc --noEmit`, `npm run build`, teste
    visual via `cargo tauri dev`, confirmação explícita antes do merge
    `--no-ff` para `main`.

**Fora de âmbito (deliberado):** modelo (b); agregação catálogo+evento em
relatórios; listas de compras por evento; estado global de "evento ativo".
Revisitar qualquer um apenas com pedido concreto de uso real.

**Verificações pré-implementação (2026-07-10, advisory do Opus):**
confirmado por grep que não existe `UNIQUE(name)` em `ingredients` nem em
`recipes` (nenhum `CREATE UNIQUE INDEX` no schema) — a Migração 018
mantém-se um simples `add_column_if_missing`, sem reconstrução de tabela.
Confirmado também que `delete_event` já corre num único `conn` sequencial
sem `get_conn()` aninhados — seguro estender a cascata do passo 5. O ponto
que de facto precisava de correção foi o picker de ingredientes partilhado
do passo 3, já corrigido acima.

---

### 3.4 — Importar receita por URL — ✅ CONCLUÍDA (2026-07-06)

**Motivação:** paridade com aplicações de referência do setor
que permitem colar o URL de uma receita (ex. NYT Cooking) e importá-la
diretamente, sem transcrição manual. Avaliado antes de planear: exequível.

**Viabilidade confirmada (2026-07-06):** testado com uma página real da NYT
Cooking (`cooking.nytimes.com/recipes/1020044-vegetable-paella-with-chorizo`).
O HTML público (sem login) contém um bloco `<script type="application/ld+json"
data-next-head="">` com `"@type":"Recipe"` (schema.org, o mesmo standard que
motores de busca leem) com nome, `recipeIngredient` (array de linhas em texto
livre), `recipeInstructions` (array de `HowToStep`, cada um com `.text`),
`recipeYield`, imagem. É o standard de facto do setor (usado por
AllRecipes, Serious Eats, Bon Appétit, etc., e pela lib Python
`recipe-scrapers`). `reqwest` e `regex` já são dependências do workspace
(usadas hoje no scanner de recibos, `db.rs:4109` e `db.rs:4509`) — nenhuma
dependência nova necessária.

**Alcance do MVP proposto:**
- Novo comando Tauri `recipe_import_from_url(url) -> RecipeImportPreview`,
  **read-only** — nunca grava na BD diretamente.
- Extração: `reqwest` com User-Agent de browser (alguns sites bloqueiam UAs
  de bot), localizar o(s) `<script type="application/ld+json" ...>` cujo
  conteúdo tem `"@type":"Recipe"` (pode vir solto ou dentro de um array/
  `@graph`), `serde_json` para os campos: `name`, `recipeIngredient[]`,
  `recipeInstructions[]` (concatenar `.text` de cada `HowToStep`),
  `recipeYield` (parse heurístico do nº de porções), `image` (1º URL),
  `prepTime`/`cookTime` (duração ISO 8601 → minutos, quando presente).
- Ingredientes: cada linha de `recipeIngredient` devolvida como texto bruto +
  tentativa de parse por regex ("quantidade + unidade conhecida + resto =
  nome"), mapeando para o enum `Unit` só quando a unidade bate certo (ex.
  "tablespoon" → `Tablespoon`, "cup" → `Cup`). Tentativa de correspondência
  automática a um ingrediente já existente no catálogo por nome exato
  (case-insensitive); sem correspondência, o `ingredient_id` fica por
  preencher e o texto original aparece para o utilizador escolher/criar à
  mão. Reaproveita o seletor de ingredientes que já existe no formulário de
  Receitas — sem UI nova de matching.
- Frontend: botão "Importar de URL" em Receitas → input de URL → chama o
  comando → pré-preenche o formulário de criação de receita já existente
  (nome, porções, instruções, tempo); ingredientes ficam por confirmar antes
  de gravar (nunca grava automaticamente).

**Fora de âmbito do MVP:**
- Conversão de frações/unidades imperiais complexas — só regex simples
  para os casos comuns.
- Sites sem `schema.org/Recipe` em JSON-LD: erro claro, sem scraping de
  HTML ad-hoc por site (frágil, quebra a cada redesign do site).
- Download automático da imagem para `image_base64` — fica só o URL de
  referência na primeira iteração.

**Implementado:**
- `recipe_import_from_url(url) -> RecipeImportPreview` em `db.rs`, read-only.
  Localiza o nó `Recipe` no JSON-LD (lida com `@graph`/array), extrai nome,
  instruções (junta `.text` de cada `HowToStep`), porções (regex sobre
  `recipeYield`), imagem, `prepTime`/`cookTime` (ISO 8601 → minutos).
- Parser de linha de ingrediente (`parse_ingredient_line`): quantidade +
  unidade (vocabulário inglês próprio, `unit_from_ingredient_word` —
  deliberadamente separado do `parse_unit_str` que lê os valores snake_case
  já guardados na BD) + nome. Corresponde automaticamente a um ingrediente
  existente por nome exato (case-insensitive); falha aberta (fica por
  escolher manualmente) quando não há correspondência.
- Achado real durante teste contra uma página real (não hipotético — apanhado
  ao correr o comando com a URL da NYT usada na investigação inicial): sites
  de receita em inglês usam glifos de fração vulgar (`½`, `¼`, `¾`...) em vez
  de ASCII; sem normalizar isso primeiro, mais de metade dos ingredientes de
  uma receita típica caíam no fallback. Corrigido com
  `normalize_vulgar_fractions` antes do parse de quantidade. Coberto por
  teste de regressão (`parse_ingredient_line_handles_vulgar_fractions`).
- Frontend: botão "Importar de URL" em Receitas abre um modal de URL;
  sucesso pré-preenche e abre o formulário de criação de receita existente
  (nome, porções, instruções, tempo de preparação/cozedura — estes dois
  campos não tinham UI antes, adicionados porque já eram aceites por
  `RecipeInput`/exibidos como "—" fixo em `RecipeDetail`); linhas de
  ingrediente sem correspondência mostram o texto original por baixo do
  seletor para o utilizador escolher/criar manualmente. Nada é gravado sem
  confirmação explícita do utilizador no formulário.
- Validado: `cargo check --workspace`, `cargo test --workspace`, `npx tsc
  --noEmit`, `npm run build`, e teste real de ponta a ponta contra a página
  da NYT Cooking usada na investigação inicial (ad-hoc, removido depois de
  confirmado — não é teste de rede permanente no repositório).

**Correções pós-teste visual (2026-07-06), a partir de feedback real:**
- **Bug: modal sem scroll.** `.modal` não tinha `max-height`/`overflow-y` —
  qualquer modal mais alto que a janela (não só o de importação; qualquer
  receita com muitos ingredientes) ficava sem forma de chegar ao rodapé
  (Guardar/Cancelar). Corrigido em `theme.css`
  (`max-height: calc(100vh - 48px); overflow-y: auto`).
- **Parsing de ingrediente mais esperto, âmbito limitado deliberadamente.**
  Consultado o Opus (advisor) antes de decidir o alcance. Implementado:
  1. `strip_descriptive_clauses` — corta cláusulas depois da 1ª vírgula e
     parênteses antes de procurar unidade/nome (ex. "grated Parmesan,
     divided, more for garnish" → "grated Parmesan").
  2. `parse_ingredient_line` agora procura a unidade em qualquer posição das
     palavras já limpas, não só na primeira — cobre "quantidade unidade
     nome" e "quantidade nome unidade" (ex. "5 garlic cloves" → Clove +
     "garlic"). Testado contra a página real da NYT: 12 de 13 ingredientes
     ficaram limpos (antes: 7 de 13).
  **Deliberadamente fora de âmbito** (risco identificado pelo advisor,
  confirmado pelo próprio exemplo do André): tentar recuperar quantidade de
  dentro de parênteses (ex. "(about 8 ounces)" dentro de uma linha sem
  quantidade inicial) — são aproximações, não a medida principal, e não há
  regra fiável para distinguir uma da outra; e mover texto descritivo a
  mais para os passos da receita — sem regra fiável de "isto é um passo",
  mexeria num campo que o utilizador não escreveu. Estes casos continuam a
  cair no fallback manual (esperado, não é bug).

---

## Roadmap i18n

Implementado agora (branch `feature/i18n-full-translation`): PT/EN completos
em todas as 12 páginas + componentes partilhados, arquitetura com
`registry.ts` e `import()` dinâmico por língua (code-splitting confirmado —
`en.js`/`pt.js` são chunks separados no build de produção), fallback para a
língua de referência (`pt`) em chaves em falta, dev-only warning na consola
para chaves sem tradução.

Documentado aqui, **não implementado ainda**:

- **Onboarding na 1ª entrada da app**: pergunta que língua nativa o
  utilizador quer, de uma lista extensível via `registry.ts`.
- **Toggle rápido no topbar** mostra "língua nativa ↔ inglês" em vez do
  seletor PT/EN atual.
- Se a língua nativa escolhida for inglês → não há 2ª língua, o toggle fica
  escondido; em Definições, "língua secundária" fica "Nenhuma" com opção de
  escolher mais tarde (o que faz o toggle reaparecer).
- Se a língua nativa não for inglês → 2ª língua default = inglês, toggle
  visível desde o início.
- Variantes regionais (`pt-BR`, `en-GB`, etc.) — códigos de língua ficam
  simples (`"pt"`, `"en"`) por agora.

---

## OCR — Digitalização de recibos

Duas abordagens exploradas em branches separadas (sessão de 2026-07-05),
ambas substituindo o `tesseract.js` + fallback mock anterior. Nenhuma
integrada em `main` ainda — branches de exploração apagadas depois de
documentado aqui; para retomar, reimplementar a partir desta descrição.

- **Nativa (Rust, `ocrs` + `rten`)**: motor de OCR neural embutido no
  binário, sem processo externo. Descarrega os modelos de deteção/
  reconhecimento automaticamente para o diretório de dados da app no
  primeiro uso, depois corre 100% offline. Usa `strsim` para fuzzy matching
  na fase de parsing dos itens do recibo. Contra: `ocrs` só extrai texto
  bruto — os campos estruturados (nome, quantidade, preço) continuam a
  depender de heurísticas de parsing escritas à mão.
- **Vision LLM local (Ollama + modelo `moondream`)**: arranca um daemon
  Ollama em background automaticamente, garante o modelo descarregado, e
  pede extração estruturada (JSON com nome/quantidade/unidade/preço/
  desconto) diretamente ao modelo a partir da imagem do recibo. A favor:
  mais robusto a variação de layout de recibo, não precisa de parsing
  manual. Contra: depende de runtime externo (Ollama) instalado e a
  correr, download de modelo maior, inferência mais lenta e mais pesada em
  RAM que a opção nativa.

**Decisão:** por fechar. Nenhuma das duas foi validada visualmente ainda.
Critério sugerido para decidir: se a precisão de parsing da opção nativa
for aceitável nos recibos reais de teste, preferir essa (sem dependência
externa); caso contrário, avaliar o custo de exigir Ollama instalado.

## Tradução de vocabulário (unidades, ingredientes, passos)

Problema: dados semeados/inseridos ficam fixos na língua em que foram
escritos independentemente do toggle PT/EN (ex.: `Unit::name_pt()` e os
dicionários de unidade duplicados em `StockPage`/`IngredientsPage`/
`RecipesPage`/`CostsPage` devolvem sempre PT; `suppliers.notes` é texto
livre semeado em PT). Discussão de 2026-07-05 dividiu o problema em três
níveis de dificuldade, cada um numa branch de exploração própria (mesmo
padrão do OCR):

- **Unidades** (`feature/i18n/units-dict`) — vocabulário fechado (~20
  valores do enum `Unit`). Trivial: um único dicionário PT/EN
  (`src/i18n/units.ts`) consumido via `useI18n()`, substituindo os 4
  dicionários duplicados hardcoded.
- **Ingredientes** (`feature/i18n/ingredients-dict`) — vocabulário
  quase-fechado (algumas centenas de nomes comuns). Dicionário PT↔EN
  curado para os casos comuns + fallback para o texto original quando o
  ingrediente não está no dicionário (não forçar tradução de texto livre
  do utilizador).
- **Passos de receita** (`feature/i18n/steps-onnx-mt`) — texto livre em
  frases completas, um dicionário palavra-a-palavra não produz gramática
  correta. Rejeitado: tradução via LLM de chat (custo/latência por
  chamada). Opção explorada: modelo de tradução neural leve local via
  ONNX (ex. família OPUS-MT/Helsinki-NLP, ~300MB), reaproveitando o
  runtime ONNX já introduzido na exploração de OCR nativo. Alternativa:
  motor de tradução por regras offline (Apertium, par PT↔EN).
  **Cortado na revisão de 2026-07-06:** peso (~300MB de modelo)
  desproporcional ao valor; não retomar sem pedido explícito de
  utilizador real.

Prioridade relativa (revisão 2026-07-06): **unidades sobe** — é um bug
visível hoje (unidades sempre em PT independentemente do toggle) e é
trivial (vocabulário fechado de ~20 valores); ingredientes fica a avaliar
depois do feedback real; passos está cortado (acima).

---

## Fase 4 — Distribuição (nova na revisão de 2026-07-06)

A Fase de Polishing depende de "utilizadores finais testarem", mas o plano
não tinha nenhum item sobre como a app chega até eles. Esta fase fecha esse
buraco e é pré-requisito do Polishing.

- [ ] **Empacotamento Linux** — `cargo tauri build` com bundles `.deb` e
  AppImage; verificar ícone, nome e categoria de menu. O build de release
  deve ser produzido/validado num ambiente limpo — a máquina de dev tem
  Nix/apt misturados (ver os fixes de EGL/TLS/pkg-config na Fase 0), o que
  a torna má referência para o que os utilizadores vão receber.
- [ ] **Fix do path `mise/mise/mise.db` + migração de dados.** Achado na
  Fase 0 (ver nota no item da limpeza do `mise.db` órfão): `open_db()` em
  `crates/core/src/db.rs` faz `dir.join("mise")` sobre um `app_data_dir`
  que o Tauri já resolve para `.../mise`, pelo que a BD ativa vive em
  `.../mise/mise/mise.db`. Estava "para a Fase 2", mas a Fase 2 foi
  encerrada sem ele — re-alojado aqui deliberadamente: corrigir ANTES de
  existirem instalações reais (depois o custo de migração multiplica por
  utilizador). Fix: remover o `join` redundante + lógica de arranque que,
  se `.../mise/mise/mise.db` existir e o path novo não, move o ficheiro
  (incluindo WAL/journal ao lado, com a app fechada — fazer no arranque
  antes de abrir a BD).
- [ ] **Teste em máquina limpa** — instalar o pacote numa máquina sem Nix
  e validar o essencial de ponta a ponta (criar ingrediente/receita,
  compra de stock, scanner por upload, evento). Inclui o teste da câmara
  do Scanner: se funcionar aí, o bug pendente da Fase 0 fecha-se como
  "ambiente de dev, sem fix"; se não, passa a ter um diagnóstico num
  ambiente representativo.
- [ ] **Primeira execução** — decidir se o onboarding de língua (ver
  [[Roadmap i18n]]) entra aqui ou fica para depois do primeiro feedback.

---

## Fase de Polishing

Depois da Fase 3 (features estruturantes) e com a app estável para
utilizadores finais testarem, esta fase serve para decidir com dados reais
e casos de uso reais o que hoje ficou decidido "no papel" ou por
heurística. Não é trabalho novo — é validar/comparar decisões já tomadas.

- **Política de custo alternativa (3.1)** — 3.1 implementa média ponderada.
  **Âmbito revisto (2026-07-06): NÃO implementar as outras 3 políticas na
  app para comparar.** Uma análise pontual (query SQL ad-hoc sobre os
  `stock_purchases` reais) calcula os 4 números — média ponderada, mais
  barato primeiro, mais caro primeiro, proporcional — de uma vez, sem
  código de produto. Só se essa análise mostrar um caso concreto a pedir
  outra política é que ela vira feature (aí sim, com seletor em Settings,
  como previsto na decisão 2 do 3.1).
- **Caminho lista↔recibo alternativo (3.1)** — 3.1 converge tudo em
  `stock_purchases` com convenção de "um caminho por compra" (sem
  reconciliação automática). Testar com uso real se isto basta, ou se
  aparecem casos de duplicação/perda de stock que justifiquem manter dois
  caminhos separados com `supplier_id` próprio, ou implementar
  reconciliação automática lista↔recibo.
- **Tradução de vocabulário** (unidades, ingredientes, passos de receita) —
  ver [[Tradução de vocabulário (unidades, ingredientes, passos)]]. Unidades
  ainda aparecem em PT independentemente do toggle de língua.
- **Escolha de motor de OCR** — ver [[OCR — Digitalização de recibos]].
  Precisa de teste com recibos reais para decidir entre nativo (Rust) e
  Vision LLM local. **Nota (2026-07-06): promovido para antes da Fase 4
  na ordem de execução** — fechar o OCR fecha também o `cdn.jsdelivr.net`
  temporário na CSP (ver Fase 2), ou seja, é um item de segurança, não só
  de qualidade de OCR.

---

## Workflow

A partir da sessão de i18n (2026-07-04): cada tarefa/feature nova segue este
fluxo, sem exceções:

1. `git checkout -b feature/<nome>` a partir de `main` atualizado.
2. Implementar.
3. Validar: `cargo check --workspace`, `cargo test --workspace` (quando
   aplicável), `npx tsc --noEmit`, `npm run build`, teste visual via
   `cargo tauri dev`.
4. Confirmação visual da funcionalidade.
5. `git merge --no-ff` para `main` → push.

Nunca trabalhar diretamente em `main`.

---

## Interface Contracts

### Frontend ↔ Tauri Backend

- **Shopping Item**: `ShoppingItemInput` e `ShoppingItem` suportam
  `ingredient_id` como `Option<i64>` (`number | null` em TypeScript).
- **Developer Commands** (atrás de `#[cfg(debug_assertions)]`):
  - `seed_demo_data()`: popula a BD com ingredientes, receitas, stock,
    planos, listas, fornecedores e cotações de demonstração.
  - `delete_all_data()`: apaga todos os dados da BD.
- **i18n**: `useI18n()` devolve `{ language, setLanguage, t }`. `t(key,
  params?)` faz lookup por chave aninhada (`"nav.dashboard"`), suporta
  interpolação `{param}`, cai para a língua de referência (`pt`) e depois
  para a própria chave se não encontrar tradução.

## Backlog / Deferido (sem data)

- Export para PDF/CSV.
- Recipe Suggester — UI (backend `suggester_suggest` já existe).
- Suporte macOS desktop (build/assinatura/notarização Apple).
- Suporte iPad/iOS (Tauri iOS) — decisão de arquitetura adiada até Fase 0
  estar concluída.
- Modo servidor / multi-user (branch `origin/project/hermes/pi-server`
  preservado, não integrado).
- Supplier price comparison — pode tornar-se redundante com 3.1, reavaliar
  depois de 3.1 estar desenhada.

## Princípios que se mantêm em todas as fases

- Cumulativo, uma feature de cada vez — sem features meio-implementadas em
  qualquer branch.
- Fixes validados são comitados antes de acumular mais trabalho por cima.
- Decisões de modelação de dados (marca, event mode) fecham-se em desenho
  *antes* de código, não durante.
- Ferramentas de debug/teste nunca chegam a build de produção sem flag
  explícita.
