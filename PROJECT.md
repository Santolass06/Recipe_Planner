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
decisão do André, não é algo a decidir autonomamente:

- **Migração de OCR** — a escolha entre nativo (Rust `ocrs`/`rten`) e
  Vision LLM local está documentada como "por fechar" em
  [[OCR — Digitalização de recibos]], à espera de teste com recibos reais.
  Implementar qualquer uma agora seria decidir por ele.
- **Refactor dos god-components** — puramente estrutural, sem mudança de
  comportamento, em 4 componentes grandes sem testes de frontend; o maior
  risco é regressão silenciosa (stale closures, effects, handlers mal
  religados) que só um teste visual exaustivo apanharia. Prioridade
  combinada: ter a app estável para a madrinha testar vem primeiro.
  Retomar depois da Fase 3, ou antes se o feedback da madrinha apontar
  para uma das páginas grandes especificamente.

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
  acontecer. Durante a validação (`cargo tauri dev`, confirmação visual
  do André) descoberto e corrigido um bug real, não relacionado com CSP
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
- [ ] **Adiado, decisão do André.** Migrar OCR de `tesseract.js` (client-side)
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
  visual do André (Ingredientes/Receitas/Stock/Compras).

---

## Fase 3 — Features estruturantes

### 3.1 — Marca + stock multi-nível

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

**Decisões a fechar antes de implementar:**
1. Qual preço/lote usar ao calcular o custo de uma receita quando há várias
   marcas em stock? Opções: média ponderada pela quantidade em stock, mais
   barato primeiro, mais caro primeiro, ou tirar proporcionalmente de todos
   os lotes (nota: esta última é também uma política de *consumo* de stock,
   decrementa vários lotes ao mesmo tempo, ao contrário das outras três).
2. Âmbito da escolha da estratégia — sugestão: global (Settings) como
   default na primeira versão, com possível override por ingrediente
   depois. Evitar seletor por-cálculo já na primeira versão.
3. Onde vive a marca: confirmado — liga-se ao preço/compra
   (`price_quote`/`purchase`), não é um campo simples no ingrediente, porque
   precisa de suportar o cruzamento marca × fornecedor × preço × stock.
   Ver [[Purchase sources architecture]] — hoje `shopping_list_items` e
   `stock_purchases` não partilham `supplier_id`, o relatório `by_supplier`
   usa só `stock_purchases` e não reconcilia com `total_spent`; este desenho
   tem de resolver essa divergência, não empilhar-lhe em cima.

**Impacto:** Ingredientes, Stock, Compras, Custos, Fornecedores, Relatórios.

### 3.2 — Event mode (modo Evento/Ocasião)

**Modelo escolhido:** híbrido:
- Base = catálogo partilhado; quantidades e preços do evento isolados da
  base principal.
- + Capacidade de criar variantes de receita dentro do evento (marca
  diferente e/ou quantidades diferentes) sem alterar a receita do catálogo
  principal.
- + Ao criar o evento, o utilizador escolhe que receitas copiar para dentro
  dele, em vez de copiar tudo ou nada automaticamente.
- Opt-in explícito — a app arranca sempre no contexto principal; entrar num
  evento é uma ação deliberada.

**Modelo de dados (esboço):** receitas de evento precisam de
`base_recipe_id` (de que receita do catálogo nasceu a variante) e `event_id`
(a que evento pertence; NULL = catálogo principal).

**Decisão a fechar antes de implementar:** quando uma receita do catálogo
principal é editada enquanto um evento está ativo, o evento deve ver essa
mudança ao vivo, ou ficar congelado como estava quando foi copiada?

**Dependência:** desenhar depois da feature de marca (3.1) — as variantes de
evento também vão lidar com marcas.

**Feature relacionada, iteração posterior:** "promover" conteúdo do evento
de volta para o catálogo principal.

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
  chamada). Opção a explorar: modelo de tradução neural leve local via
  ONNX (ex. família OPUS-MT/Helsinki-NLP, ~300MB), reaproveitando o
  runtime ONNX já introduzido na exploração de OCR nativo. Alternativa:
  motor de tradução por regras offline (Apertium, par PT↔EN). Não
  decidido se vale a pena face ao esforço — avaliar depois das duas
  branches anteriores fechadas.

---

## Workflow

A partir da sessão de i18n (2026-07-04): cada tarefa/feature nova segue este
fluxo, sem exceções:

1. `git checkout -b feature/<nome>` a partir de `main` atualizado.
2. Implementar.
3. Validar: `cargo check --workspace`, `cargo test --workspace` (quando
   aplicável), `npx tsc --noEmit`, `npm run build`, teste visual via
   `cargo tauri dev`.
4. Confirmação visual do André.
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
