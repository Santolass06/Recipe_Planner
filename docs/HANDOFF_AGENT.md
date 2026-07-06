# Handoff — Recipe Planner (Mise) · `project/remaster`

> ⚠️ **DOCUMENTO DESATUALIZADO.** Escrito antes do merge de `project/remaster` para `main` (ver `cb0ec4a`). Para o estado atual do projeto, roadmap e workflow, consultar **`PROJECT.md`** na raiz do repo.
> Mantido apenas como referência histórica — contém detalhe valioso sobre bugs Tauri v2/libSQL resolvidos nessa altura.

> Documento de transferência de contexto para o próximo agente que continuar este projeto.
> Autor: Cline (agente anterior). Última atualização: sessão de 2026-07-01.
> Branch: `project/remaster` · Repo: `git@github.com:Santolass06/Recipe_Planner.git`

---

## 1. O que é a aplicação

**Mise (Recipe Planner)** — app desktop nativa (Tauri 2) de gestão profissional de cozinha: receitas, ingredientes, custos, stock, listas de compras, planeamento semanal de refeições, relatórios, fornecedores/cotações, scanner de recibos (OCR) e definições.

Stack:
- **Backend Rust:** workspace Cargo com 3 crates — `crates/core` (domínio + DB), `crates/tauri` (comandos Tauri), `src-tauri` (entry point/binário).
- **DB:** libSQL (SQLite) local, modo WAL, ficheiro em `<AppData>/com.recipe-planner.app/mise/mise/mise.db`.
- **Frontend:** React 19 + TypeScript + Vite 6, em `src/`. Router: `react-router-dom` (`src/router.tsx`).
- **Build/dev:** Tauri 2 (`cargo tauri dev`), dentro de `nix-shell` (Ubuntu não-NixOS).

---

## 2. Estrutura do repositório (relevantes)

```
Cargo.toml              # workspace (crates core, tauri, src-tauri)
shell.nix               # ambiente Nix (nixGL + glib-networking + cacert) — VER secção 3
index.html              # entry HTML (PWA removido)
src/
  main.tsx              # entry React
  router.tsx            # rotas (index=Dashboard, /dashboard, /ingredientes, ...)
  pages/                # 12 páginas (Dashboard, Ingredients, Recipes, Costs, Stock,
                        #   ShoppingList, MealPlanner, Calendar, Reports, Suppliers,
                        #   ReceiptScanner, Settings)
  components/           # Layout, Sidebar, ui/Toast, ui/Modal, ImageUpload, ...
  i18n/                 # PT/EN (src/i18n/pt.ts, en.ts, types.ts)
  styles/theme.css      # design system (variáveis CSS, dark/light)
crates/
  core/
    src/domain.rs       # structs/enum do domínio (Recipe, Ingredient, Unit, MealPlan, ...)
    src/db.rs           # ~3850 linhas: open_db, migrations, todas as queries
    bindings/           # gerado por ts-rs (tipos TS)
  tauri/
    src/lib.rs          # struct AppDb (métodos) + mod commands (#[tauri::command])
src-tauri/
  src/lib.rs            # run() — Builder, setup(), invoke_handler (REGISTO de comandos)
  Cargo.toml            # binário mise
  tauri.conf.json       # identifier=com.recipe-planner.app, devUrl=localhost:1420
```

**⚠️ Ficheiros antigos/sobra (NÃO fazer merge, provavelmente lixo):** `orig.tsx`, `rewrite.py`, `scratch.py`, `test-recipe.tsx` na raiz. São artefactos de uma reescrita do frontend. Podem ser apagados numa limpeza futura.

---

## 3. Ambiente Nix — CRÍTICO (já configurado em `shell.nix`)

O `shell.nix` resolve **3 problemas** de correr Tauri/WebKitGTK em Ubuntu não-NixOS. NÃO regressar aos workarounds antigos.

1. **nixGL (Mesa/EGL → driver Intel iris):** sem nixGL, WebKitGTK aborta com `EGL_BAD_PARAMETER` (eglinfo mostrava strings vazias). Fixado ao commit `b6105297e6f0cd041670c3e8628394d4ee247ed5` do nixGL via `builtins.fetchTarball` (reprodutível). O `shellHook` faz `eval "$(sed '/^exec /d' ${nixGLIntel}/bin/nixGLIntel)"` para injectar `GBM_BACKENDS_PATH`, `LIBGL_DRIVERS_PATH`, `LIBVA_DRIVERS_PATH`, `__EGL_VENDOR_LIBRARY_FILENAMES`, `LD_LIBRARY_PATH`.
   - **Importante:** foram REMOVIDOS `LIBGL_ALWAYS_SOFTWARE=1` e `EGL_PLATFORM=surfaceless` (forçavam swrast, derrotavam o iris). Mantidos `WEBKIT_DISABLE_COMPOSITING_MODE=1` e `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

2. **TLS (glib-networking + cacert):** sem isto, WebKitGTK mostra "TLS support is not available" e fontes https falham. `shell.nix` adiciona `glib-networking cacert` e exporta `SSL_CERT_FILE`, `NIX_SSL_CERT_FILE` (cacert bundle) e **`GIO_EXTRA_MODULES`** (aponta para `libgiognutls.so` — sem esta var, o módulo TLS não é carregado pelo GIO).

3. **Dependências GTK/webkit:** `pkg-config glib gtk3 webkitgtk_4_1 librsvg libayatana-appindicator xdotool openssl gdk-pixbuf cairo pango atk mesa`.

**Validação do ambiente:** `nix-shell --run 'eglinfo 2>&1 | grep "driver name"'` → deve mostrar `iris` em todas as plataformas.

---

## 4. Estado do Git

```
Branch: project/remaster (criada de project/hermes/full)
Commits já em origin/project/remaster:
  60a6dcf fix(export): alinhar export_data à shape aninhada de RecipeWithIngredients
  99ef5d1 chore: remover resíduos PWA (sw.js, manifest.json) e CI Android
  6a8e576 fix(shell.nix): integrar nixGL (iris) e remover workarounds EGL supérfluos
```

**Mudanças NÃO commitadas (working tree, 7 ficheiros):**
```
 M crates/core/src/db.rs          # PRAGMA WAL fix + COALESCE 0.0 fix
 M shell.nix                      # glib-networking + cacert + GIO_EXTRA_MODULES
 M src-tauri/Cargo.toml           # ⚠️ ANOMALIA: só newline final (NÃO MINHA — não commitar)
 M src-tauri/src/lib.rs           # setup() block_on + registo de 24 comandos
 M src/pages/IngredientsPage.tsx  # wrapper input (ingredient_create/update)
 M src/pages/MealPlannerPage.tsx  # wrapper input + datas RFC3339 (plan/entry CRUD)
 M src/pages/SuppliersPage.tsx    # wrapper input (supplier/price_quote CRUD)
```

> ⚠️ `src-tauri/Cargo.toml` tem alteração cosmética (newline final) **não feita por mim**. Em commits usar `git add <ficheiros-específicos>` e NUNCA `git add -A`.

---

## 5. Log completo do trabalho feito (por sessão)

### Sessão 1 — Branch + fix export_data
- Criou `project/remaster` de `project/hermes/full`.
- `crates/core/src/db.rs` `export_data`: 7 acessos a campos achatados (`r.name`) → forma aninhada (`r.recipe.name`) de `RecipeWithIngredients` (que tem `#[serde(flatten)] pub recipe: Recipe`). Commit `60a6dcf`.

### Sessão 2 — Remover bagagem PWA/Android
- Apagou `public/sw.js`, `public/manifest.json`, `.github/workflows/android.yml`.
- `index.html`: removeu `<link rel="manifest">` e o bloco `<script>` do service worker. Commit `99ef5d1`.

### Sessão 3 — nixGL (EGL/iris) no shell.nix
- Integrado nixGL fixado a commit + sha256. Commit `6a8e576`.

### Sessão 4 — TLS no shell.nix
- Adicionado `glib-networking`, `cacert`, `GIO_EXTRA_MODULES`. (NÃO commitado — aguarda confirmação visual.)

### Sessão 5 — Destravar o backend (`.manage()` + PRAGMA + integração frontend)
A sessão grande. Descobriu que **a app nunca tinha sido testada contra o backend** — o frontend foi reescrito (branch hermes, PWA/mobile-first) e ficou desalinhado do Rust.

**5a. Bug do `.manage(db)` (race condition):**
- `src-tauri/src/lib.rs` `setup()` usava `tauri::async_runtime::spawn(async move { initialize_app_state(...).await; })` — task não-bloqueante, `Result` descartado. O frontend fazia `invoke()` antes de `.manage()` correr → "state not managed for field `db`".
- Fix: `spawn` → `block_on` (síncrono/bloqueante) + `.map_err(|e| { eprintln!(...); Box::<dyn Error>::from(e) })` (propaga erro → Tauri aborta arranque em limpo em vez de abrir janela sem estado).

**5b. Bug do PRAGMA WAL (causa raiz real, escondida pelo 5a):**
- `crates/core/src/db.rs:31` `db.connect()?.execute("PRAGMA journal_mode = WAL;", ())` → libsql 0.6.0 rejeita instruções que devolvem linhas → "Execute returned rows". Isto fazia `open_db` falhar → `.manage()` nunca corria → mas o erro era engolido pelo `spawn` (5a).
- Fix: `.execute()` → `.query()` com `let _ = ...` (o PRAGMA devolve uma linha com o modo). Depois disto, `open_db` + migrations passaram a correr (mise.db cresceu de 4096 → 172032 bytes).

**5c. Bug do COALESCE (libsql panic):**
- `get_dashboard_stats` lia `COALESCE(SUM(...), 0)` como `f64`, mas com stock vazio o SQLite devolve `0` como INTEGER → libsql panic "invalid value type".
- Fix: `0` → `0.0` (força REAL). Padrão a ter em conta: qualquer `SUM`/`COUNT` lido como `f64` pode panicar com tabela vazia — usar `0.0` no COALESCE.

**5d. Classes de bugs de integração frontend↔backend (3 classes):**

> **CLASSE A — comandos DEFINIDOS mas NÃO REGISTADOS no `invoke_handler`.**
> O módulo `commands` em `crates/tauri/src/lib.rs` define ~85 `#[tauri::command]`. O `invoke_handler` em `src-tauri/src/lib.rs` só tinha 45. Cada comando não-registado → Tauri "command not found" → `Promise.all` rejeita → toast "Erro ao carregar/guardar".

> **CLASSE B — frontend envia args SEM o wrapper `input` (+ camelCase).**
> Tauri v2 EXIGE que um parâmetro struct seja passado dentro da chave do parâmetro: `invoke("cmd", { input: { snake_case_fields } })`. O frontend espalhava os campos: `invoke("cmd", { name, unit, pricePerUnit })` → "missing required key input". O Tauri v2 **não converte** camelCase↔snake_case por defeito.

> **CLASSE C — UI/CSS/UX** (não-backend): dashboard sem link na sidebar, contraste dark mode, dark mode toggle, links "Sobre", página Ajuda vazia.

**5e. Lote 1 aplicado (Planeamento + Relatórios + Fornecedores):**
- Registados 24 comandos no `invoke_handler` (11 planeamento + 5 relatórios + 4 fornecedores extras + 4 dashboard).
- Corrigidos 8 call sites de args (4 SuppliersPage + 4 MealPlannerPage) com wrapper `input` + snake_case + datas RFC3339 (`"2026-07-01T00:00:00Z"`) para `MealPlanInput`.
- Enums `DayOfWeek`/`MealType` têm `#[serde(rename_all = "snake_case")]` → `"monday"`/`"lunch"` do frontend funcionam.
- Validação: `cargo check` ✅, `tsc --noEmit` ✅, `cargo tauri dev` ✅ (0 erros/panics).

---

## 6. O que JÁ ESTÁ FUNCIONAL (após Lote 1, por testar visualmente)

- ✅ App arranca (sem "state not managed", sem panic).
- ✅ DB abre + migrations correm (16 tabelas).
- ✅ Dashboard carrega (4 comandos registados + COALESCE fix).
- ✅ Ingredientes: criar/listar/actualizar/eliminar (testado pelo user — "arroz" funcionou).
- ✅ Fornecedores: listar/criar/actualizar + cotações (Lote 1, por testar).
- ✅ Planeamento: listar planos/criar plano/entradas (Lote 1 — criar entradas precisa de receita, que ainda falha).
- ✅ Relatórios: todas as tabs (Lote 1, por testar).
- ✅ Calendário: `meal_plan_entries_by_month` registado (Lote 1 bónus).

---

## 7. O que FALTA (trabalho remanescente)

### 7a. Lote 2 — Compras + Armazém + Scanner (Classe A + B)
Comandos **#[tauri::command] definidos mas ainda NÃO registados** (~21):
- **Shopping list items (8):** `shopping_list_add_item`, `shopping_list_remove_item`, `shopping_list_toggle_item`, `shopping_list_clear_purchased`, `shopping_list_reorder_items`, `shopping_list_update`, `shopping_list_update_item_full`, `shopping_list_group_by_category`
- **Stock purchases (3):** `stock_purchase_add`, `stock_purchase_delete`, `stock_purchases_list`
- **Images (5):** `image_upload`, `image_delete`, `image_get`, `image_set_primary`, `image_search_proxy`
- **Receipts (3):** `receipt_scan`, `receipt_parse`, `receipt_confirm`
- **Settings extras (2):** `settings_get_all`, `settings_reset`

Classe B (args) por corrigir (confirmados):
- `recipe_create` / `recipe_update` (RecipesPage:468/481 — sem wrapper `input`) ← **BLOQUEIA testes de receitas/custos/planeamento**
- `stock_upsert` (StockPage:405 — sem wrapper `input` + camelCase `ingredientId`/`minQuantity`)
- `stock_delete` (StockPage:423 — camelCase `ingredientId` → `ingredient_id`)
- `shopping_list_add_item`, `category_create`, etc.

### 7b. Lote 3 — Definições + UI (Classe A/C)
- `settings_get_all`, `settings_reset` (registar) → destrava "Erro ao carregar definições" + "repor definições".
- **Dark mode toggle:** `invoke("settings_set")` funciona mas a página falha a carregar (`settings_get_all` não registado). Após registar, verificar CSS `data-theme="light"` em `theme.css`.
- **Dashboard sem link na sidebar:** `src/components/Sidebar.tsx` não tem `NavItem` para `/` ou `/dashboard`. Adicionar (ex.: `<NavItem to="/" icon={I.home} label={t("nav.dashboard")} />` no grupo "Cozinha"). Resolve "depois de sair da dashboard não dá para voltar".
- **Dashboard contraste dark mode:** texto usa cores fixas em vez de `var(--text-*)`. Rever `DashboardPage.tsx` + `theme.css`.
- **Links "Sobre":** `<a href="https://...">` bloqueados pelo WebKitGTK. Usar `tauri-plugin-opener` (`opener.openUrl()`) — plugin JÁ inicializado (`tauri_plugin_opener::init()`), só falta usar no frontend (`@tauri-apps/plugin-opener`).
- **Página Ajuda:** `/ajuda` é `PlaceholderPage` — precisa de conteúdo.

### 7c. Funcionalidades placeholder/não implementadas
- **Sincronização** (tab em Definições) — placeholder, README menciona "Sync structure ready".
- **Scanner/câmara:** `tesseract.js` + permissões WebKitGTK — assunto separado (NÃO tocar sem substituto nativo, per instrução do user).

### 7d. Padrão de bugs libsql a vigiar
Quando uma página deixa de falhar por "command not found", podem aflorar panics libsql em queries que leiam `f64` de `SUM`/`COUNT`/`AVG` com tabelas vazias. Solução: `COALESCE(x, 0.0)` (não `0`). Verificar proativamente todas as queries com `SUM`/`COUNT` lidas como `f64`.

---

## 8. Convenções e regras do projeto (do user)

- **Sem `unwrap()`/`expect()` novos** (exceto testes). Usar `.map_err(|e| e.to_string())` ou `?`.
- **Validar tudo dentro de `nix-shell`** onde aplicável: `cargo check`, `cargo test`, `tsc --noEmit`, `npm run build`.
- **Não fazer merge para `main`.** Tudo em `project/remaster`.
- **Não usar `git add -A`** (inclui a anomalia do `Cargo.toml`). Usar `git add <ficheiros>`.
- **Confirmar causa-raiz antes de corrigir** (o user quer diagnóstico antes do fix).
- **Não mexer em `tesseract.js`/`ReceiptScannerPage`** sem substituto nativo planeado.
- **Mensagens de commit:** prefixadas por tipo (`fix(...)`, `chore(...)`, `feat(...)`).
- **Working tree deve estar limpa** antes de começar (`git status --porcelain`); se não, PARAR e reportar.

---

## 9. Comandos úteis

```bash
# Entrar no ambiente
nix-shell

# Validar
nix-shell --run "cargo check --workspace 2>&1 | tail -15"
nix-shell --run "cargo test --workspace 2>&1 | tail -5"
npx tsc --noEmit
npm run build

# Correr a app (dev)
nix-shell --run "cargo tauri dev"
# (dev server de fundo: nohup nix-shell --run "cargo tauri dev" > /tmp/tauri_dev.log 2>&1 &)

# Verificar EGL
nix-shell --run 'eglinfo 2>&1 | grep "driver name"'   # deve dar iris

# Inspecionar a BD (sqlite3 não está no shell; usar Python)
python3 -c "import sqlite3; c=sqlite3.connect('$HOME/.local/share/com.recipe-planner.app/mise/mise/mise.db'); print([r[0] for r in c.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")])"

# Listar comandos registados vs definidos
grep -oE 'mise_tauri::commands::[a-z_]+' src-tauri/src/lib.rs | sed 's/mise_tauri::commands:://' | sort -u
grep -oE 'pub async fn [a-z_]+' crates/tauri/src/lib.rs | sed 's/pub async fn //' | sort -u

# Porta 1420 ocupada? libertar
fuser -k 1420/tcp
```

---

## 10. TASK DESIGNADA (a fazer a seguir)

O user pediu **duas coisas** na última interação:

### Task 10a — Funcionalidade "Aleatorizar dados" (developer options)
> "gostava de adicionar a opção para que, de forma a analisar os gráficos e a sua funcionalidade, se pudesse aleatorizar tudo da aplicação, isto é, ingredientes, receitas, stock, planos, listas de compras, essas coisas. mete nas definições em developer options"

**Implementação proposta:**
1. Criar um comando Rust `seed_demo_data` (em `crates/tauri/src/lib.rs` mod commands) que chame uma nova função `crates/core/src/db.rs` `seed_demo_data(db) -> LibsqlResult<()>`.
2. A função `seed_demo_data` insere dados fictícios coerentes: ~20 ingredientes (arroz, açúcar, sal, óleo, etc. com unidades/preços realistas), ~8 receitas com ingredientes, stock para alguns, 1-2 planos semanais com entradas, 1 lista de compras com items, fornecedores + cotações, categorias. Usar `INSERT OR IGNORE` ou limpar primeiro se preferido. Respeitar FKs (criar categorias/ingredientes antes de receitas, etc.).
3. Registar `seed_demo_data` no `invoke_handler` (`src-tauri/src/lib.rs`).
4. Em `src/pages/SettingsPage.tsx`, adicionar uma secção "Developer Options" com um botão "Gerar dados de demonstração" que chama `invoke("seed_demo_data")` e faz reload.
   - Nota: `settings_get_all`/`settings_reset` ainda não estão registados (Lote 3) — a página de definições vai continuar a falhar ao carregar até isso ser feito. Pode fazer-se o Lote 3 primeiro, ou ignorar o erro de load e adicionar só o botão (o `settings_set` já está registado).
5. Validar: `cargo check`, `tsc`, e testar visualmente (depois de gerar dados, os gráficos/relatórios/dashboard devem mostrar números).
   - Bónus útil: também um comando `clear_demo_data` (truncate das tabelas) ao lado do botão, para reset entre testes.

### Task 10b — (concluída) este documento de handoff
Concluído com este ficheiro (`docs/HANDOFF_AGENT.md`).

---

## 11. Sugestões para a aplicação (opinião do agente)

### Tem sentido e deveria existir
1. **"Aleatorizar dados" / seed demo** (Task 10a) — **essencial para testar**. Sem dados, nenhum gráfico/relatório/dashboard é validável. Recomendo também um "Limpar dados" (truncate) ao lado.
2. **Dashboard na sidebar** — bug de UX óbvio (não há como voltar à dashboard). 1 linha em `Sidebar.tsx`.
3. **Padronizar a convenção de args Tauri v2 em TODO o frontend** — os bugs Classe B são sistemáticos. Considerar `#[serde(rename_all = "camelCase")]` nos structs de input Rust, ou padronizar o frontend para `{ input: { snake_case } }`. Documentar a convenção.
4. **Importar bindings TypeScript do Rust** (`ts-rs` já gera `crates/core/bindings/`). O frontend redefine interfaces à mão (ex.: `IngredientsPage.tsx` `interface Ingredient`) — devia importar os tipos gerados, eliminando desalinhamentos.
5. **Página de Ajuda com conteúdo** — placeholder não serve para uma app "profissional".
6. **Links externos via `tauri-plugin-opener`** — plugin já inicializado, só falta usar (`@tauri-apps/plugin-opener`, `opener.openUrl()`).

### Provavelmente NÃO vale a pena (ou adiar)
1. **Sincronização cloud** — placeholder. Para app desktop local de cozinha, sync é complexidade alta com pouco valor. Adiar até haver procura real.
2. **Scanner OCR com tesseract.js** — pesado (wasm), frágil em WebKitGTK, e o user disse para não tocar sem substituto nativo. Considerar API externa de OCR ou remover a feature se não for central.
3. **Redesign completo da dashboard** — o user disse "está feia", mas é polish. Prioridade: destravar funcionalidade (Lotes 2/3) > polish.
4. **Mobile/PWA** — bagagem PWA removida (Sessão 2). O `remaster` volta a desktop. Não reintroduzir PWA sem decisão explícita.

### Dívida técnica a limpar
1. Apagar `orig.tsx`, `rewrite.py`, `scratch.py`, `test-recipe.tsx` (sobra da reescrita).
2. Resolver a anomalia do `src-tauri/Cargo.toml` (newline) — commitar intencionalmente ou descartar.
3. Os 468 warnings de `missing_docs` em `mise-core` — documentar ou relaxar o lint (`#![allow(missing_docs)]`).
4. Os `unused import` warnings em `src-tauri/src/lib.rs` (`mise_core::*`, `mise_tauri::AppDb`, `tauri::Manager`) — limpar.
5. Os `unused manifest key` warnings (`workspace.dependencies.libsql.workspace` etc.) em `Cargo.toml` — chaves mal-formadas no workspace deps.

---

## 12. Checklist para o próximo agente continuar

- [ ] Confirmar que está em `project/remaster` e que a working tree tem as 7 alterações não-commitadas (secção 4).
- [ ] Entrar em `nix-shell` e validar `eglinfo | grep iris` + `cargo check` + `tsc`.
- [ ] **Task 10a:** implementar `seed_demo_data` (comando Rust + registo + botão em Settings Developer Options).
- [ ] **Lote 2:** registar ~21 comandos em falta + corrigir args (`recipe_create/update`, `stock_upsert/delete`, shopping items, etc.).
- [ ] **Lote 3:** registar `settings_get_all`/`settings_reset` + UI fixes (sidebar dashboard, dark mode, links, ajuda).
- [ ] Testar visualmente cada página após cada lote (o user valida).
- [ ] Quando o user der luz verde final, commitar (ficheiros específicos, NÃO `git add -A`) e `git push origin project/remaster`.

**Estado do dev server no fim da última sessão:** estava a correr em background (PID pode já ter expirado). Se a porta 1420 estiver ocupada, `fuser -k 1420/tcp` antes de relançar `cargo tauri dev`.

---

## 13. Práticas e metodologia de trabalho (workflow)

Estas são as práticas que têm guiado o trabalho e **devem ser mantidas** pelo próximo agente para preservar a qualidade e a relação de confiança com o user.

### A. Antes de começar qualquer task
- Confirmar a branch: `git branch --show-current` → tem de ser `project/remaster`.
- Confirmar working tree limpa: `git status --porcelain`. **Se não estiver limpa, PARAR e reportar** (o user é explícito: "se não, PÁRA e reporta"). Excepção: as 7 alterações não-commitadas conhecidas (secção 4) são o estado "normal" de meio-trabalho.
- Entrar em `nix-shell` para tudo o que envolva Rust/build/validação.

### B. Diagnóstico primeiro (regra de ouro)
- **Investigar e REPORTAR a causa-raiz antes de aplicar qualquer fix.** O user quer confirmar a causa real antes de decidir o fix ("Reporta o que encontraste ANTES de corrigir").
- Não avançar para o fix sem confirmação do user ("prossegue" / luz verde).
- Durante o diagnóstico, usar ferramentas **não-invasivas**: `grep`, `read_files`, Python `sqlite3` para inspectar a BD, testes na consola do WebKit. **Não mexer em código durante a fase de diagnóstico.**
- Confirmar a causa-raiz com **evidência** (logs do dev server, output da consola do WebKit, ficheiros no disco, contagem de tabelas/rows). Se a evidência contradisser a suspeita inicial (aconteceu na Sessão 5: "a BD abre" estava errado), corrigir o diagnóstico e ser transparente sobre isso.

### C. Ao aplicar fixes
- **Fix mínimo** — não refatorar além do necessário para resolver o bug.
- **Preservar convenções existentes** — usar padrões já presentes no codebase (ex: `.query()` já usado em `db.rs` quando corrigi o PRAGMA; `.map_err(|e| e.to_string())` em todos os comandos Tauri).
- **Sem `unwrap()`/`expect()` novos** (exceto em testes).
- **Adicionar comentários a explicar o PORQUÊ**, não o o quê (ex: o comentário do PRAGMA explica que libsql rejeita instruções que devolvem linhas; o do nixGL explica o EGL_BAD_PARAMETER em Ubuntu não-NixOS).
- **Reprodutibilidade** — pinnar versões/commits com hash (ex: nixGL via `fetchTarball` + `sha256` fixado a commit).
- **Não tocar em coisas fora do scope** da task (ex: "NÃO tocas em tesseract.js nem ReceiptScannerPage"; "Nada mais nesta corrida").

### D. Validação (ritual obrigatório após cada alteração)
Correr e **reportar ✅/❌ de CADA uma**:
1. `nix-shell --run "cargo check --workspace 2>&1 | tail -15"`
2. `nix-shell --run "cargo test --workspace 2>&1 | tail -5"`
3. `npx tsc --noEmit 2>&1 | tail -10`
4. `npm run build 2>&1 | tail -10`
5. Para a app: `cargo tauri dev` em **background** (`nohup nix-shell --run "cargo tauri dev" > /tmp/tauri_devN.log 2>&1 &`), esperar ~25s, depois verificar:
   - `kill -0 $PID` → `RUNNING` (app não abortou)
   - `grep -ciE "panic|failed to initialize|state not managed|missing required key|invalid value type"` → `0` = clean
- **Se a porta 1420 estiver ocupada** (vite antigo): `fuser -k 1420/tcp` antes de relançar.

### E. Commits
- **NÃO commitar sem confirmação visual do user** — só ele pode validar que a UI funciona ("NÃO faças commit ainda — aguarda a minha confirmação visual").
- Usar `git add <ficheiros-específicos>`, **NUNCA `git add -A`** (inclui a anomalia do `src-tauri/Cargo.toml`).
- Mensagens prefixadas por tipo: `fix(...)`, `chore(...)`, `feat(...)`.
- **Não fazer merge para `main`.** Push só para `origin project/remaster`.

### F. Comunicação com o user
- **Reportar diffs exactos** de cada ficheiro alterado (colar o `git diff`).
- **Reportar o resultado de cada validação** em tabela ✅/❌.
- Quando há decisão/bloqueio, usar `ask_question` com **2-5 opções concretas** (nunca pedir permissão aberta; oferecer caminhos).
- **Ser proativo**: se descobrir algo relevante (ex: causa-raiz real diferente da suspeita, ou um bug extra como o COALESCE panic), reportar imediatamente em vez de seguir o plano cegamente.
- **Testes visuais**: o user é quem valida a UI. Pedir ✅/❌ por página/funcionalidade e dar passos concretos para testar (ex: "cria o ingrediente 'arroz' e confirma se aparece na lista").

### G. Abordagem por lotes
- Fixes grandes (ex: integração frontend↔backend) **divididos em sub-conjuntos (lotes)**, testar cada lote visualmente antes de avançar para o seguinte.
- Reportar o que cada lote vai alterar **antes** de aplicar, e aguardar luz verde se houver risco.

### H. Verificação final de cada ronda
- **Ler de volta os ficheiros editados** para confirmar a estrutura (ex: confirmar que o wrapper `input` ficou bem aninhado, que não sobraram marcadores).
- **Verificar `git status --porcelain`** mostra só os ficheiros esperados — se aparecer algo não-intencional (ex: o Cargo.toml), não o incluir no commit.
- Confirmar que não ficaram **processos órfãos** (dev server em background) a ocupar a porta.

### I. Princípio geral
> **Transparência sobre pressa.** É preferível parar, reportar um estado inesperado e pedir decisão, do que assumir e introduzir um erro. O user valoriza ser informado (ex: a anomalia do Cargo.toml, o ficheiro não-rastreado AUDIT_REMASTER.md na Sessão 1) — mesmo quando a decisão óbvia é prosseguir, **pergunta antes** se há dúvida.

---

*Fim do handoff. Boa continuação.*
