# Project: mise — Recipe Planner

**O plano.** O que falta fazer e por que ordem. O que já foi feito, com as
decisões e as dificuldades de cada etapa, está em [`CHANGELOG.md`](CHANGELOG.md)
— este ficheiro tinha 1800 linhas e 80 % eram histórico, o que tornava
impossível ver o que faltava.

Onde procurar o quê:

| Procuras | Está em |
|---|---|
| O que fazer a seguir | [[#Sprints]], aqui |
| Porque é que algo ficou como está | `CHANGELOG.md` |
| O desenho de uma feature por construir | [[#Desenhos fechados]], aqui |
| Estado dos achados de auditoria | `CHANGELOG.md`, secções de auditoria |
| O relatório de auditoria completo | `docs/AUDIT-2026-07.md` |
| Documentos arquivados | `legacy/` |

---

## Arquitetura

- **Estrutura**: Rust Workspace com `crates/core` (lógica de base de dados
  libSQL & modelos de domínio), `crates/tauri` (comandos Tauri), e `src-tauri`
  (launcher Tauri). Frontend é uma SPA React/TypeScript com Vite.
- **Fluxo de dados**: Frontend invoca comandos Tauri IPC → backend Tauri
  comunica com a base de dados via `crates/core` → a BD devolve structs Rust
  mapeados em tipos TypeScript via bindings `ts-rs`.
- **`crates/core` não depende de Tauri.** É o que torna o alvo host (S8) um
  segundo consumidor do mesmo crate em vez de uma reescrita.

## Estrutura de código

- Frontend: `src/` (components, pages, i18n, styles, main, router)
- Backend:
  - `crates/core/src/` (migrações, schemas, helpers, tipos de domínio)
  - `crates/tauri/src/` (wrapper de estado da app e definições de comandos)
  - `src-tauri/src/` (entry point Tauri, registo de plugins e comandos)

---

## Onde estamos

**2026-07-28.** A app funciona de ponta a ponta em Linux nativo. Depois da
auditoria de 2026-07-26 (ver secção própria), as fundações de dados estão
sãs: as escritas multi-tabela são transacionais, as compras ficam sempre
gravadas na unidade do ingrediente, há slot de versão de schema com
migrações que transformam dados, o backup é mesmo um backup, e o relatório de
custos soma dinheiro realmente pago. 117 testes, 0 ignorados.

**O que a app faz hoje:** ingredientes, receitas, stock com marca e
fornecedor, compras, listas de compras, planeamento de refeições, eventos com
receitas e stock isolados, scanner de recibos com segregação por código de
IVA, importação de receita por URL, relatórios de custo, e backup/restauro.

**A lacuna estrutural, numa frase:** a app modela **aquisição** e nunca modela
**consumo**. Todos os caminhos que escrevem em `stock` são de entrada; o único
que desce é o utilizador a corrigir o número à mão. É a causa única das duas
tabs de relatório vazias, do Recipe Suggester sem base de decisão, e de o
stock divergir da realidade ao fim de uma semana de uso. É o que os sprints
**S2 e S3** fecham.

**Alvos de distribuição decididos (2026-07-28):** Linux nativo, Windows
nativo, Android nativo, e **Linux host** — um PC AMD A10 dedicado, com SSD, a
correr o mise como serviço e acedido por browser a partir de outros
dispositivos. macOS e iOS/iPad saem do âmbito. Ver
[[#Alvos de distribuição]].

**Categorias de ingrediente decididas (2026-08-09):** `IngredientInput` passa a
`category_id`, com seletor no formulário. O campo chamava-se `category` e era
lido como id, portanto nada lhe chegava e os dois `by_category` agrupavam tudo
num balde vazio.

**DOM-05 decidido (2026-08-09):** o preço de receita usa uma **janela de 90
dias**, não FIFO — FIFO exige rastreio de esgotamento por lote, que não existe.
Fallback em três degraus: janela → histórico todo → catálogo.

**Fonte única de preço (2026-08-09):** todo o `Ingredient` entregue ao frontend
carrega `effective_price_per_unit`, e é esse o número com que o frontend
custeia. Antes, a página de Receitas usava o preço de catálogo e a de Custos o
médio ponderado — dois números para a mesma receita.

**Edições decididas (2026-07-28):** constrói-se a funcionalidade toda e a flag
que separa Family de Pro é a última camada, não a primeira. Ver
[[#Edições — Family e Pro]] — a consequência prática é que `stock_movements`
nasce com os seis tipos de movimento (S2.1).

---

## Sprints

Cada sprint é **fechado por âmbito, não por tempo** — acaba quando os seus
issues acabam, não ao fim de duas semanas. No fim de cada um: relatório do que
mudou e teste da app inteira antes de abrir o seguinte.

**Os 52 issues estão no GitHub**, um milestone por sprint:
[milestones](https://github.com/Santolass06/Recipe_Planner/milestones). Esta
secção é o resumo e o porquê; o detalhe de cada issue está lá. Se os dois
divergirem, o GitHub é a verdade sobre o estado e este ficheiro é a verdade
sobre a ordem.

**Exceção ao critério de «testar a app no fim»:** o S2 é schema e escrita sem
UI. Se estiver correto, o ecrã fica exatamente igual — o teste manual serve
para confirmar que **nada** mudou, e a prova real está nos testes automáticos.

A ordem é por dependência. Onde não há dependência, está dito.

| | Sprint | Estado | Depende de |
|---|---|---|---|
| **S0** | Confirmar a base | ⏳ Em ti | — |
| **S1** | Lista de compras a partir de receitas | ✅ `a087dfc` | — |
| **S2** | Movimentos de stock — schema e registo | ✅ `4635b11` (S2.3 adiado) | — |
| **S3** | Movimentos de stock — consumo, produção, perda, venda | ✅ `f7c88e3` | S2 |
| **S4** | Os relatórios que os movimentos desbloqueiam | ✅ `12eeb24` | S3 |
| **S5** | Instrumentação e flag de edição | ✅ | S4 |
| **S6** | Windows nativo | ⬜ | S0 |
| **S7** | Android nativo | ⬜ | S0, S4 |
| **S8** | Host no servidor | ⬜ | S2 |

---

### S0 — Confirmar a base ⏳

**Não tem código.** Está à cabeça porque o S0.1 é pré-requisito do S6 e do S7:
Linux é o alvo de referência de que os outros herdam, e enquanto não estiver
confirmado, empacotar para Windows e Android é construir sobre não-verificado.

- **S0.1** **Cortar release nova de `main` primeiro** — o `.deb` publicado
  era de 2026-07-20, anterior às auditorias de rondas 2 e 3 e ao merge do
  Traycer. Decidido 2026-08-15: eu corto e publico o `.deb`, o utilizador
  instala numa máquina sem Nix e testa. Checklist completa no
  [issue #3](https://github.com/Santolass06/Recipe_Planner/issues/3).
- **S0.2** ✅ Fechado por decisão (2026-08-15): câmara só faz sentido em
  telemóvel/tablet (Android, iOS/iPad) — em desktop o Scanner passa a
  oferecer só upload de ficheiro. `isMobileDevice()` em
  `src/lib/platform.ts` faz o gate. Detalhe do diagnóstico WebKitGTK
  abandonado (nunca chegou a fix) em `CHANGELOG.md` §Fase 0.
- **S0.3** Reunir recibos de Continente, Lidl e Auchan e correr o OCR contra
  eles. **Despriorizado (2026-08-15):** sem máquina capaz de correr um LLM
  local, o OCR melhora de forma incremental, não de uma vez — deixa de
  bloquear o release, fica como trabalho contínuo de fundo.
- **S0.4** Rodar o PAT do GitHub exposto num commit local a 2026-07-28.
  **Ainda por fazer** — requer ação do utilizador (gerar novo token,
  revogar o antigo nas definições do GitHub); não bloqueia o release do
  `.deb`, mas continua exposto enquanto não for feito.

**Feito quando:** Linux confirmado como alvo de referência (S0.1) e o PAT
rodado (S0.4). O bug da câmara fechou-se por decisão (S0.2); o OCR melhora
em contínuo, sem gate (S0.3).

---

### S1 — Lista de compras a partir de receitas ✅

**Fechado em `a087dfc`.** Sete issues (#7–#13), mais um oitavo (#55) que não
estava previsto: o `generate_shopping_list_from_meal_plan` já fazia 90 % do
mesmo trabalho e tinha o defeito do DOM-01 — agregava linhas de receita sem
converter a unidade e comparava o total contra um stock guardado noutra
unidade. Uma receita a pedir 1 kg contra 500 g em stock saía como «não falta
nada», e a lista omitia o ingrediente em silêncio. Numa feature já em uso.

Em vez de uma segunda agregação ao lado, os dois caminhos passaram a partilhar
`needed_ingredients_for` + `to_shopping_items`. O `create_shopping_list` ficou
transacional, o que cobriu os três produtores de listas de uma vez.

124 testes, 0 ignorados. Falta o teste manual, acumulado no
[#3](https://github.com/Santolass06/Recipe_Planner/issues/3) até haver acesso
à outra máquina.

<details>
<summary>Âmbito original</summary>


**Livre** — não depende de nada nem bloqueia nada. É a única funcionalidade
prometida na superfície da app que não faz o que o nome diz, e é a mais
pequena que resta. Desenho em [[#Desenho — Lista de compras a partir de receitas]].

- **S1.1** Implementar `create_shopping_list_from_recipes` a sério: expandir
  as receitas escolhidas em linhas de ingrediente (quantidade ×
  multiplicador), converter para a unidade canónica do ingrediente, somar as
  linhas do mesmo ingrediente, descontar o stock existente, criar a lista só
  com o que falta.
- **S1.2** Transacional desde o primeiro commit — é escrita multi-tabela
  (`shopping_lists` + `shopping_list_items`), a mesma classe das cinco
  corrigidas em TRX-01.
- **S1.3** Unidade inconvertível é rejeitada com o nome do ingrediente na
  mensagem, nunca adivinhada. Reutilizar `to_ingredient_unit`, não escrever
  conversão nova.
- **S1.4** `portions_multiplier`: `u32` → `f64`. Meia receita não é
  exprimível hoje, e o S2 vai precisar do mesmo para o multiplicador de
  produção — alinhar os dois de uma vez, não duas.
- **S1.5** Frontend: ponto de entrada em Receitas e no Planeador de refeições.
- **S1.6** Chaves i18n em PT e EN, com paridade.
- **S1.7** Testes: ingrediente repetido em duas receitas soma em vez de
  duplicar; stock existente é descontado; unidade inconvertível é rejeitada.

**Feito quando:** escolher duas receitas com um ingrediente comum produz uma
lista com esse ingrediente somado uma só vez e já descontado do stock.

</details>

---

### S2 — Movimentos de stock: schema e registo ✅ `4635b11` (S2.3 adiado)

O item estruturante, primeira metade: a tabela e a escrita, sem UI nova.
Desenho completo em [[#Desenho — Movimentos de stock]].

- **S2.1** Migração da tabela `stock_movements` com **os seis tipos**
  (`purchase`, `production`, `consumption`, `sale`, `loss`, `adjustment`) e
  preço de venda no movimento, por decisão de edições.
- **S2.2** Coluna `created_by` desde já, nullable e sem uso. **Custa uma
  coluna hoje e poupa uma migração numa tabela grande no S8** — o servidor
  precisa de saber quem registou cada movimento, e adicioná-la depois com
  dados reais lá dentro é exatamente o erro que a auditoria de 2026-07-26
  apanhou.
- **S2.3** `f64` → cêntimos: 73 ocorrências em `domain.rs`, as colunas `REAL`
  e as conversões de display. **É aqui que se faz**, porque ainda há poucos
  dados; com dados reais passa de meio dia a uma semana.
- **S2.4** Backfill: cada linha de `stock_purchases` existente gera o seu
  movimento `purchase`. Idempotente — corre duas vezes sem duplicar.
- **S2.5** `stock.quantity` passa a cache do somatório dos movimentos, com
  função de reconciliação. Event sourcing puro pagaria dez vezes o preço pelo
  mesmo resultado.
- **S2.6** API de escrita de movimento, transacional.
- **S2.7** Testes: o somatório bate com a cache; o backfill é idempotente; a
  reconciliação corrige uma cache adulterada à mão.

**Feito quando:** os testes passam e o stock visível na app não mudou — este
sprint não deve alterar um único número no ecrã. **Nota sobre o teste da app
inteira:** aqui ele serve para confirmar que **nada** mudou visualmente. A
prova real está nos testes.

---

### S3 — Movimentos de stock: consumo, produção, perda, venda ✅ `f7c88e3`

Segunda metade: é aqui que o stock passa a saber descer.

- **S3.1** «Cozinhei isto» — botão na receita que gera N movimentos de
  consumo (ingredientes × multiplicador, convertidos), atomicamente.
- **S3.2** Produção: receita + multiplicador → N consumos + 1 entrada de
  produto. A receita continua canónica («rende 40 bolachas»); a flexibilidade
  vive no multiplicador.
- **S3.3** Perda a dois níveis: produto acabado não vendido, e ingrediente
  estragado.
- **S3.4** Venda, com o preço praticado gravado no movimento — nunca
  consultado depois, senão o histórico reescreve-se a cada alteração de preço.
  Vender algo que não é receita aponta para um ingrediente, na mesma forma
  polimórfica que `shopping_list_items.ingredient_id: Option<i64>` já usa.
- **S3.5** Stock insuficiente **avisa e deixa passar**. Numa cozinha real o
  stock registado está quase sempre errado; uma app que se recusa a aceitar
  «eu fiz as bolachas» é abandonada ao fim de uma semana.
- **S3.6** i18n PT/EN e testes por tipo de movimento.

**Feito quando:** cozinhar uma receita faz o stock descer, e registar uma
perda aparece no histórico.

---

### S4 — Os relatórios que os movimentos desbloqueiam ✅ `12eeb24`

Tudo o que estava vazio por falta de dados passa a ter dados.

- **S4.1** Tab de desperdício, a sério.
- **S4.2** Tendências de stock, a sério.
- **S4.3** DOM-05 decidido e implementado: janela temporal vs. FIFO no custo
  de receita. **É aqui que ganha motivo concreto** — antes dos movimentos não
  havia sobre o que aplicar FIFO.
- **S4.4** Recipe Suggester — backend e UI. O `suggester_suggest` antigo era
  um stub e foi apagado; volta com base de decisão real.
- **S4.5** Orçamento por evento: previsto vs. real, usando os movimentos do
  evento.
- **S4.6** Alerta de validade com ação directa: consumir, descontar, ou
  registar perda.
- **S4.7** PERF-01.

**Feito quando:** nenhuma tab da página de Relatórios está vazia por falta de
modelo de dados.

---

### S5 — Instrumentação e flag de edição ✅

- **S5.1** Emissores automáticos de `usage_events`. A tabela existe desde
  2026-07-10 e está vazia de propósito; **só agora** há eventos com
  significado para registar (o que se cozinhou, o que se perdeu). Antes disto
  registaria navegação.
- **S5.2** Flag de edição Family/Pro, em runtime — valor em `settings`, não
  feature de Cargo. Ver [[#Edições — Family e Pro]].
- **S5.3** Matriz de gating: que ecrã, que relatório, que comando pertence a
  que edição.
- **S5.4** `README.md` e este ficheiro alinhados com o que passou a existir.

**Feito quando:** trocar a edição em Definições esconde e mostra o que deve.

---

### S6 — Windows nativo ⬜

**Depende do S0.** Sem UI nova a desenhar — o trabalho é build e teste.

- **S6.1** Runner Windows no `release.yml`, bundle `.msi`/`.exe`.
- **S6.2** `resolve_data_dir` em `AppData` — já está namespaced pelo
  identifier, mas nunca correu lá.
- **S6.3** Câmara do Scanner no WebView2. O bug pendente é específico do
  WebKitGTK e provavelmente não existe aqui — **confirmar, não assumir**.
- **S6.4** Teste numa máquina Windows real.

---

### S7 — Android nativo ⬜

**Depende do S0 e beneficia do S4** — não vale a pena desenhar ecrãs touch
para relatórios ainda vazios.

- **S7.1** Repor `bundle.android.signingConfig` e o workflow Android,
  apontados ao keystore rodado a 2026-07-28 (removidos em `99ef5d1`).
- **S7.2** UI para touch. **Não é esticar o layout**: tabelas de stock,
  formulário de compra e revisor de recibos precisam de desenho próprio.
- **S7.3** Telemóvel e tablet são duas classes de ecrã. Validar nas duas.
- **S7.4** Permissões de câmara nativas (plugin, não `getUserMedia`).
- **S7.5** Decisão sobre os ~37 MB de assets do `tesseract.js` no APK:
  embutir ou descarregar na primeira utilização.
- **S7.6** Teste em dispositivo real.

---

### S8 — Host no servidor ⬜

**Último, por decisão.** Depende do S2 (a coluna `created_by`, que o S2 já
deixa criada). Desenho e hardware em [[#Alvos de distribuição]].

- **S8.1** **Decidir a rede antes de escrever código**: privada (WireGuard/
  Tailscale) ou exposta com proxy. Define quanta segurança a app tem de
  carregar sozinha. Recomendação: privada.
- **S8.2** `crates/server` — HTTP sobre `crates/core`, ao lado de
  `crates/tauri`. Não é reescrita: `crates/core` não tem uma única
  dependência de Tauri.
- **S8.3** A camada que hoje chama `invoke()` ganha implementação HTTP. É o
  único ponto do frontend que precisa de saber em que modo corre.
- **S8.4** Autenticação: argon2, cookies `HttpOnly`/`Secure`/`SameSite`, rate
  limiting no login. Um conjunto de dados, N utilizadores — não multi-tenant.
- **S8.5** CSP própria para a versão web (a atual assume Tauri).
- **S8.6** Backup agendado no host. **Obrigatório, não conveniência:** como as
  apps nativas são independentes, o host é a cópia única do que lá está.
- **S8.7** Teste multi-dispositivo e multi-utilizador.

---

## Edições — Family e Pro

**Decidido (2026-07-28): construir tudo primeiro, separar por flag depois.**

Duas edições sobre o mesmo codebase. **Family**, uso pessoal/doméstico —
planear refeições, gerir despensa, controlar quanto se gasta. **Pro**, uso de
negócio — produzir para vender, saber o custo real do que se produz, contar o
que se vendeu e o que se perdeu.

A ordem decidida é **construir a funcionalidade toda, e só no fim introduzir
a flag que distingue as versões**. Não se constrói contra a divisão; constrói-
se o produto e a divisão é a última camada.

**A consequência que importa, e é a razão de esta secção vir antes do item 3:**
`stock_movements` nasce com **os seis tipos** — `purchase`, `production`,
`consumption`, `sale`, `loss`, `adjustment` — e com preço de venda gravado no
movimento, desde a primeira migração. Não fica nada para acrescentar depois.
Era esta a pergunta em aberto, e está respondida.

### Como a flag deve funcionar, quando chegar a altura

Não é preciso decidir agora, mas fica registado para não se decidir mal à
pressa no fim:

**Definição em runtime, não em build.** A edição é um valor em `settings`,
lido pela UI para esconder ou mostrar. A alternativa — duas compilações
diferentes por feature de Cargo — multiplicaria a matriz de builds por dois,
e a matriz já tem quatro alvos (Linux, Windows, Android, host). Oito builds
para separar ecrãs é um preço que não se justifica.

**O que isso implica, dito com clareza:** o código do Pro vai dentro do
binário do Family. Quem souber mexer consegue ligar a flag. Para um produto
que não é vendido com DRM isto não é um problema — é a diferença entre
esconder e proibir, e esconder chega. Se um dia houver licenciamento a sério,
aí sim é outra conversa, e o custo de a ter adiado é zero.

**A matriz de gating** (que ecrã, que relatório, que comando pertence a que
edição) foi escrita em 2026-08-13 (PRD-02, auditoria ronda 3): Family cobre
receitas, stock, listas, planeamento, scanner, sugestões e desperdício;
Eventos, Custos, Fornecedores e a produção/venda ficam em Pro. Aplicada em
três sítios — `Edition::allows` (Rust, a fonte da verdade), a sidebar
(esconde), e um loader guard no router (redireciona para `/` se alguém tentar
entrar numa rota Pro por URL direta em Family).


---

---

## Alvos de distribuição

Substitui a antiga secção «Fase Multi-plataforma» (2026-07-10), que listava
Android/iOS/Mac/Linux/Windows como um conjunto indistinto. **Âmbito revisto a
2026-07-28**, com quatro alvos e um deles arquiteturalmente diferente dos
outros três.

Tauri v2 suporta todos estes alvos a partir do mesmo `main` — **não há branch
por SO**. Branch por SO diverge o código e torna os merges dolorosos; cada
alvo é um `cargo tauri build`/`android init` novo sobre o mesmo tronco, com
diferenças tratadas por config e compilação condicional pontual quando
surgirem.

| Alvo | Natureza | Custo | Depende de |
|---|---|---|---|
| **Linux nativo** | Local-first, é o que existe hoje | Feito, falta confirmar | — |
| **Windows nativo** | Local-first, mesma API desktop | Baixo — build e teste | Linux confirmado |
| **Android nativo** | Local-first, UI nova para touch | Médio — trabalho real de UI | Linux confirmado |
| **Linux host** | **Cliente-servidor num PC dedicado, com autenticação** | Alto — arquitetura nova | Movimentos de stock (S2) |

**Fora de âmbito (2026-07-28):** macOS e iOS/iPad. Saem não por
impossibilidade técnica — o Tauri suporta ambos — mas porque exigem hardware
Apple e uma conta de developer paga para assinar e notarizar, e nada no uso
atual os pede. Ficam no [[#Backlog / Deferido (sem data)]], reabríveis com
pedido concreto.

### Linux nativo — alvo de referência

Feito: bundles `.deb` e AppImage construídos por `release.yml` em runner
`ubuntu-latest` limpo (sem Nix, depois de o build local gravar caminhos
`/nix/store/...` no binário e o tornar inutilizável fora dessa máquina).
**Falta a confirmação de ponta a ponta na máquina limpa** — item A da lista de
execução. Tudo o resto herda deste: enquanto não estiver confirmado, os outros
alvos estão a construir sobre uma base não verificada.

### Windows nativo

Mesma API desktop do Tauri que o Linux já usa. Sem UI nova a desenhar. O
trabalho é: runner Windows no `release.yml`, bundle `.msi`/`.exe`, e teste
numa máquina Windows real. Dois pontos a verificar por serem onde o Linux e o
Windows divergem de facto:

- **`resolve_data_dir`** — o caminho de dados é `AppData` no Windows, com
  regras de permissões diferentes. Já está namespaced pelo identifier
  (`com.recipe-planner.app`), mas nunca foi corrido lá.
- **Câmara do Scanner** — o WebView2 do Windows não é o WebKitGTK do Linux; o
  bug pendente da Fase 0 é específico do WebKitGTK e provavelmente não existe
  aqui. Confirmar, não assumir.

### Android nativo

Aqui há trabalho real, não só build.

- **UI para touch e ecrãs pequenos.** Os componentes atuais assumem desktop —
  o `minWidth` da janela era 1200 px até esta semana. Não é «esticar o layout»:
  tabelas de stock, formulários de compra e o revisor de recibos precisam de
  desenho próprio.
- **Telemóvel e tablet são duas classes de ecrã, não uma.** Um layout de
  telemóvel esticado num tablet é um mau tablet. Validar nas duas.
- **Permissões de câmara.** Modelo diferente do desktop, e o Android usa um
  plugin de câmara nativo em vez de `getUserMedia` — código diferente do bug
  de desktop, por isso esse bug **não bloqueia** este alvo.
- **Plugins Tauri.** Confirmar suporte mobile de cada um caso a caso. Hoje
  restam `core` e `opener`: os três plugins mortos (`dialog`, `fs`, `shell`)
  foram apagados na auditoria de 2026-07-26, o que reduziu esta verificação a
  quase nada.
- **Assinatura.** Keystore rodado a 2026-07-28 (PKCS12, Secrets no GitHub).
  O `signingConfig` no `tauri.conf.json` e o workflow Android foram removidos
  em `99ef5d1` e têm de ser repostos a apontar para o ficheiro novo.
- **Peso.** O bundle leva ~37 MB de assets do `tesseract.js` self-hospedados.
  Aceitável em desktop; num APK é uma decisão a tomar conscientemente
  (descarregar em runtime na primeira utilização é a alternativa óbvia).

### Linux host — cliente-servidor, num PC dedicado

**O alvo que muda a arquitetura.** Os outros três são a mesma app local-first
empacotada de forma diferente. Este não é: uma máquina Linux dedicada corre o
mise como serviço, e outros dispositivos acedem-lhe pelo browser.

**Hardware decidido (2026-07-28):** um PC AMD A10 já existente, com SSD.
Substitui a hipótese do Raspberry Pi, e **para melhor** — ver
[[#O que o hardware escolhido poupa e o que exige]] mais abaixo.

**O que já joga a favor, e não é pouco:** `crates/core` não tem uma única
dependência de Tauri. Toda a lógica de domínio e de base de dados já está
separada do shell. Um servidor não é uma reescrita — é um segundo consumidor
do mesmo crate, ao lado de `crates/tauri`.

#### Decisões fechadas (2026-07-28)

**As apps nativas não são clientes do host.** Continuam local-first, cada uma
com a sua base de dados. O cliente do host é o **browser** — quem tem host
acede de qualquer dispositivo sem instalar nada. Sem sincronização, sem
resolução de conflitos, sem estado por dispositivo. O utilizador escolhe um
modo e vive nele.

Ficam assim descartadas, e vale a pena dizer porquê para não voltarem por
inércia: apps nativas a falar HTTP com o host matariam o offline (sem rede, a
app não abre); e local-first com sincronização — que é o que soa melhor
quando se descreve em voz alta — obriga a inventar semântica de conflitos
para um `stock` que duas pessoas alteram offline ao mesmo tempo, e não há
resposta óbvia para isso.

**O host é um aparelho dedicado, não a máquina de trabalho.** Um PC AMD A10
com SSD, ligado permanentemente, com a logística de segurança à volta tratada
como parte do produto e não como problema do utilizador.

**É o último sprint (S8), e a razão é financeira, não técnica.** A
prioridade é a app instalada e a correr no dispositivo de quem a usa, sem
depender de nada online. A infraestrutura online só se monta **quando houver
quem pague por esse serviço** — até lá seria custo fixo sem receita. Nada do
resto do plano espera por ele.

**Consequência sobre a forma:** se o host vier a ser vendido a mais do que um
cliente, a resposta **não é multi-tenancy**. É **uma base de dados por
cliente** — o libSQL é baseado em ficheiro, e um ficheiro por cliente dá
isolamento total sem acrescentar uma coluna de tenant a cada query, nem o
risco de a esquecer numa. Multi-tenancy é a resposta cara para um problema
que a arquitetura já resolve de graça.

#### Forma proposta

```
crates/core      ← domínio + libSQL, já existe, intocado
  ├── crates/tauri   ← comandos IPC (existe)
  └── crates/server  ← HTTP + sessões (novo)
```

O frontend é a **mesma SPA**, servida pelo servidor em vez de embebida no
binário. A camada que hoje chama `invoke()` ganha uma implementação HTTP — é o
único ponto do frontend que precisa de saber em que modo está a correr.

#### A decisão de rede, que é a que define quanta segurança a app tem de carregar

Esta é a decisão que falta, e vem **antes** de escrever o servidor, porque
muda o que o servidor tem de saber defender.

- **(1) Rede privada — recomendado.** O host nunca fica no exterior. Os
  dispositivos entram numa rede privada (WireGuard, ou Tailscale se se quiser
  evitar configurar NAT e DNS à mão) e falam com o Pi lá dentro. Elimina de
  uma vez: formulário de login exposto ao mundo, ataques de força bruta,
  gestão de certificados, e a maior parte da superfície. «Pela internet»
  continua a ser verdade — o dispositivo está onde estiver, entra na rede e
  usa a app.
- **(2) Exposto publicamente com proxy à frente.** Só se for mesmo preciso dar
  acesso a alguém que não pode instalar cliente de VPN. Exige reverse proxy
  com TLS automático (Caddy resolve em duas linhas), rate limiting, fail2ban,
  e manter o Pi atualizado como tarefa contínua e não como setup único.

**Recomendação: (1).** É simultaneamente menos trabalho e mais seguro, o que
é raro. E a diferença é grande: em (1) a autenticação da app é defesa em
profundidade e serve para saber *quem* fez o quê; em (2) a autenticação da app
é a única coisa entre os dados e a internet.

#### Autenticação — requisitos não negociáveis

Independentemente da decisão de rede acima. É fronteira de confiança, nada
aqui é candidato a simplificação:

- **Passwords com hash lento** (argon2 ou bcrypt), nunca em claro, nunca com
  hash rápido.
- **Sessões em cookie `HttpOnly` + `Secure` + `SameSite=Lax`**, com expiração.
  Não guardar tokens em `localStorage`.
- **Rate limiting no login**, mesmo em rede privada.
- **HTTPS**, mesmo em rede privada — um certificado interno chega, mas texto
  em claro não.
- **CSP própria para a versão web.** A atual assume Tauri (`connect-src 'self'
  ipc: http://ipc.localhost`).
- **Um conjunto de dados, N utilizadores — não multi-tenant.** Cada instância
  serve uma cozinha. Se houver vários clientes, são várias instâncias com
  várias bases de dados, não uma base partilhada com coluna de tenant — ver a
  nota nas decisões fechadas acima.

**Papéis:** por agora, nenhum. Todos os utilizadores autenticados veem tudo.
Papéis (quem pode apagar, quem só regista consumo) são decisão para quando
houver mais de uma pessoa a usar e uma queixa concreta.

#### O que o hardware escolhido poupa e o que exige

O PC AMD A10 é **x86_64**, o que apaga o maior custo que a hipótese do
Raspberry Pi trazia:

- **Sem build ARM.** Era o único item de build genuinamente novo deste alvo —
  `aarch64-unknown-linux-gnu`, cross-compile ou runner ARM. O `release.yml` já
  compila x86_64 Linux: o binário do host sai do pipeline que já existe. É a
  maior simplificação que esta escolha traz, e não é pequena.
- **Sem cartão SD.** A preocupação de desgaste de escrita desaparece com o
  SSD. Se mais tarde entrar um HDD, o raciocínio de que estar sempre ligado
  reduz o risco está certo — o que mata discos mecânicos são os ciclos de
  arranque e paragem, não as horas a rodar.
- **Mais folga de CPU e RAM** do que um Pi, o que tira da mesa a questão de o
  OCR ou os relatórios serem pesados de mais para o host.

**O que continua a exigir, e não depende do hardware:**

- **O host é a cópia única.** Como as apps nativas são independentes (decisão
  acima), nada do que está no host existe noutro lado. Isto torna o **backup
  agendado obrigatório**, não conveniência — e é verdade com SSD, com HDD ou
  com o que for. O `backup_export` construído na auditoria de 2026-07-26 já dá
  a peça; falta o agendamento (S8.6).
- **Ser um PC normal não o torna seguro.** A logística de rede e autenticação
  é a mesma, e é onde está o trabalho a sério deste alvo.

#### Porque depende dos movimentos de stock

Multi-utilizador muda **a quem pertence** um movimento. Um consumo registado
por duas pessoas ao mesmo tempo precisa de saber quem o registou, e uma tabela
`stock_movements` desenhada para um único utilizador não tem essa coluna.
Construir o servidor antes dos movimentos existirem obriga a mexer no schema
outra vez, com dados reais lá dentro — exatamente o erro que a auditoria de
2026-07-26 apanhou e que custou uma migração.

---

---

## Desenhos fechados

Decisões de modelação já tomadas, para não serem reabertas durante a
implementação. Cada uma é o detalhe de um sprint acima.

### Desenho — Movimentos de stock

**Sprints S2 e S3.** Origem: PRD-01 da auditoria de 2026-07-26. **Desenho completo em
`docs/AUDIT-2026-07.md` §2.4** — não repetido aqui para não haver duas
versões a divergir.

O problema numa frase: **a app modela aquisição e nunca modela consumo.**
Todos os caminhos que escrevem em `stock` são de entrada (compra, recibo,
seed, upsert manual); o único que desce é o utilizador a corrigir o número
à mão. Não existe `cook`, `consume`, `produce`, `sell` nem `waste`. Isso
explica de uma só vez a tab de desperdício vazia, a tendência de stock
vazia, o Recipe Suggester sem base de decisão, e o stock divergir da
realidade ao fim de uma semana de uso.

Forma decidida: **uma tabela** `stock_movements` (alvo, quantidade na
unidade canónica do alvo, tipo `purchase`/`production`/`consumption`/
`sale`/`loss`/`adjustment`, motivo, custo unitário e preço de venda no
momento, timestamp, referência opcional à produção que o originou).
`stock.quantity` fica como cache do somatório — event sourcing puro
pagaria dez vezes o preço pelo mesmo resultado.

Decisões já fechadas no desenho, para não serem reabertas na
implementação:

- **Os seis tipos de movimento entram desde a primeira migração**, incluindo
  `sale` e `production`, e o preço de venda é gravado no movimento. Decorre da
  decisão de edições de 2026-07-28 ([[#Edições — Family e Pro]]): constrói-se
  tudo e a flag é a última camada, portanto não há aqui um subconjunto
  «Family» a acrescentar depois. A UI de venda e produção pode chegar mais
  tarde — o schema não pode.

- **Multiplicador, não porções fracionárias.** A receita continua canónica
  («rende 40 bolachas»); meia fornada é `0.5`. Não é preciso tornar
  `portions` fracionário nem inventar tamanhos nomeados.
- **Preço de venda gravado no movimento**, nunca consultado depois — senão
  o histórico reescreve-se a cada alteração de preço.
- **Vender algo que não é receita** aponta para um ingrediente: a mesma
  forma polimórfica que `shopping_list_items.ingredient_id: Option<i64>`
  já usa.
- **Stock insuficiente avisa, não bloqueia.** Numa cozinha real o stock
  registado está quase sempre errado; uma app que se recusa a aceitar «eu
  fiz as bolachas» é abandonada ao fim de uma semana.

Pré-requisitos: ✅ todos fechados na branch `fix/audit-2026-07` — TRX-01
(transações), DOM-01/DOM-02 (unidades) e MIG-01 (`user_version`). Cada
movimento é multi-tabela e carrega uma unidade e um custo; construir por
cima dos defeitos antigos garantia gráficos do Pro nascidos errados.

Entram nesta fase, por serem aqui que ganham motivo concreto e migração
barata: **DOM-05** (janela temporal vs. FIFO no custo de receita),
**`f64`→cêntimos** (73 ocorrências em `domain.rs`; meio dia hoje, uma
semana com dados reais) e **PERF-01**.

Desbloqueia, quando existir: tabs de desperdício e tendências, Recipe
Suggester, contagem de vendidos/perdidos do mise Pro, orçamento por
evento (previsto vs. real) e alerta de validade com ação directa.

### Desenho — Lista de compras a partir de receitas

**Sprint S1.**

`create_shopping_list_from_recipes` (`db.rs`, comando registado e exposto
ao frontend) **é um stub**: aceita `recipe_ids` e `portions_multiplier`,
ignora ambos e cria uma lista vazia chamada «Compras \<data\>». O comentário
no corpo — `// This is a complex query - simplified implementation` — diz
exatamente isso. A auditoria classificou-o corretamente como
**«Prometido» — provavelmente a feature mais pedida** (§2.1); fui eu que
depois o confundi com o `suggest_recipes` e propus apagá-lo. Fica
registado aqui para não ser apagado por engano numa próxima limpeza.

Comportamento pretendido: expandir as receitas escolhidas em linhas de
ingrediente (quantidade × `portions_multiplier`, convertida para a unidade
canónica do ingrediente), somar as linhas do mesmo ingrediente, descontar
o que já existe em stock, e criar a lista só com o que falta.

Notas que a implementação não pode ignorar:

- É escrita multi-tabela (`shopping_lists` + `shopping_list_items`) —
  transacional desde o primeiro commit, como as cinco corrigidas em TRX-01.
- A conversão de unidades passa pelo mesmo caminho que `to_ingredient_unit`
  já usa; um ingrediente comprado numa unidade inconvertível é rejeitado
  com o nome do ingrediente na mensagem, não adivinhado.
- `shopping_list_items.ingredient_id` é `Option<i64>` — as linhas geradas
  daqui têm-no sempre preenchido, ao contrário das escritas à mão.
- `portions_multiplier` é `u32` na assinatura atual: meia receita não é
  exprimível. Se 3.6 já tiver passado o multiplicador de produção a
  fracionário, alinhar os dois na mesma altura.

Independente de 3.6: só lê stock e receitas, não precisa de movimentos.

---

---

## Backlog / Deferido (sem data)

- Export para PDF/CSV.
- Recipe Suggester — backend e UI. O `suggester_suggest` que existia era um
  stub e foi apagado (2026-07-27); sem consumo registado não há base de
  decisão para sugerir nada. Depende de [[#Desenho — Movimentos de stock]] (S2/S3).
- Suporte macOS desktop e iPad/iOS — fora de âmbito desde 2026-07-28: exigem
  hardware Apple e conta de developer paga, e nada no uso atual os pede. Ver
  [[#Alvos de distribuição]].
- ~~Modo servidor / multi-user (branch `origin/project/hermes/pi-server`)~~ —
  **saiu do backlog a 2026-07-28**: passou a alvo planeado, ver
  [[#Alvos de distribuição]]. A branch citada já não existe no remoto; o que
  torna isto viável não é código antigo, é `crates/core` não depender de Tauri.
- Supplier price comparison — pode tornar-se redundante com 3.1, reavaliar
  depois de 3.1 estar desenhada.

---

## Fase de experimentação (nova, 2026-07-10)

Depois do Polishing e dos [[#Alvos de distribuição]], com sinal real de
utilização a validar que vale a pena investir em infraestrutura de IA
local mais pesada:

- **Vision LLM local para OCR de recibos** (Ollama + `moondream`) — ver
  [[OCR — Digitalização de recibos]]. Adiado deliberadamente do item
  "Escolha de motor de OCR": exige runtime externo instalado e a correr,
  peso desproporcional antes de haver utilizadores reais.

---

---

## Workflow

A partir da sessão de i18n (2026-07-04): cada tarefa/feature nova segue este
fluxo, sem exceções:

1. `git checkout -b feature/<nome>` a partir de `main` atualizado.
2. Implementar.
3. Validar: `cargo check --workspace`, `cargo test --workspace` (quando
   aplicável), `npx tsc --noEmit`, `npm run build`, teste visual via
   `cargo tauri dev`.
   **Os comandos `cargo` exigem `nix-shell`** (`nix-shell --run "cargo test
   --workspace"`); fora dele o `openssl-sys` não encontra o `openssl.pc` e
   a compilação falha.
4. Confirmação visual da funcionalidade.
5. `git merge --no-ff` para `main` → push.

Nunca trabalhar diretamente em `main`.

---

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

---

## Princípios que se mantêm em todas as fases

- Cumulativo, uma feature de cada vez — sem features meio-implementadas em
  qualquer branch.
- Fixes validados são comitados antes de acumular mais trabalho por cima.
- Decisões de modelação de dados (marca, event mode) fecham-se em desenho
  *antes* de código, não durante.
- Ferramentas de debug/teste nunca chegam a build de produção sem flag
  explícita.
