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
- [ ] **Padronizar a convenção de argumentos Tauri v2 em todo o frontend.**
  Um grep rápido (2026-07) encontrou ~31-34 chamadas `invoke()` sem o padrão
  `{ input: ... }` esperado — precisa de auditoria dedicada (o grep foi só
  uma estimativa grosseira, não confiar sem verificar caso a caso). Ver regra
  já confirmada em memória de sessão: `Tauri v2 arg convention` — chaves
  top-level de `invoke()` em camelCase, campos de structs aninhados
  mantêm-se em snake_case.
- [ ] Importar os bindings TypeScript gerados pelo `ts-rs`
  (`crates/core/bindings/`) em vez de o frontend redefinir interfaces à mão.
  Ainda não usado em `src/` (confirmado 2026-07).
- [ ] Limpeza do `mise.db` órfão (ficheiro antigo num path diferente do
  atual).
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

## Fase 2 — Higiene técnica

- [ ] Limpar os ~466 warnings do Rust (maioria `missing_docs` por
  `#![warn(missing_docs)]`, imports não usados — mecânico, baixo risco).
- [ ] Definir uma CSP no `tauri.conf.json` (ainda `null`).
- [ ] `tauri-plugin-opener` para links externos — plugin já inicializado;
  falta chamar `opener.openUrl()` onde há links para fora da app (nota:
  `SettingsPage.tsx` e `HelpPage.tsx` já usam `invoke("plugin:opener|open_url")`
  diretamente — confirmar se isto conta como "já resolvido" ou se deve
  migrar para a API `@tauri-apps/plugin-opener` antes de fechar este ponto).
- [ ] Migrar OCR de `tesseract.js` (client-side) para crate Rust nativo. Não
  substituir por API externa sem decisão explícita (privacidade/local-first).
- [ ] Refatorar god-components: `ShoppingListPage` (~858 linhas), `RecipesPage`
  (~824 linhas), `MealPlannerPage` (~719 linhas), `ReportsPage` (~871 linhas).
- [x] Página de Ajuda com conteúdo real — `HelpPage.tsx` já tem conteúdo
  próprio (secções por módulo + links úteis), não é placeholder.
- [ ] Duplicação de `UNIT_LABELS`/`UNIT_SHORT` (mapas de unidade→abreviatura)
  repetida em ~8 páginas — candidato a módulo partilhado.

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
