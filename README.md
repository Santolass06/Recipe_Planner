# mise

Aplicação de gestão de receitas e custos para cozinhas — uso pessoal, familiar
ou de negócio. Funciona **offline** primeiro; preparada para correr
**online on-device** e depois ligar a **cloud** com sincronização e IA.

Este README é também o **logbook** do projeto: descrição, setup, features,
plano de desenvolvimento e registo de cada passo concluído.

---

## 1. Estado actual

`Fase 0 — scaffold limpo` 🔄 em curso

Repositório migrado de `Recipe_Planner` para arquitectura modular.
Workspace de crates Rust agnósticas + casca Tauri + tema pro-kitchen +
i18n PT/EN. Zero features de utilizador — entram a partir da Fase 1, uma a uma.

### Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Casca / desktop | Tauri 2 |
| Web | mesmo frontend via `npm run build` |
| Mobile | Tauri 2 (iOS/Android — fase posterior) |
| Lógica de negócio | crates Rust puras (`core`, `data`, `entitlements`) |
| Base de dados | libSQL / Turso — local agora, sync cloud mais tarde |
| i18n | PT / EN |

> **Decisão de arquitectura:** começamos em Tauri; se o Dioxus trouxer
> benefícios reais, migramos. Toda a lógica vive nas crates agnósticas —
> o Tauri é só a casca. Uma migração futura reescreve apenas a UI.

---

## 2. Setup por plataforma

Pré-requisitos comuns: **Rust ≥ 1.85**, **Node ≥ 20**.

### Linux (Ubuntu 24.04 / 26.04)

O APT do Ubuntu 26.04 tem libs de sistema fora de sync com os repos oficiais
(`libpng`, `liblzma`, `libffi`), o que impede instalar as deps nativas do Tauri
via `apt`. A solução é usar **Nix** — instala de forma isolada sem tocar no APT:

```bash
# 1. Instalar Nix (só uma vez)
curl -L https://nixos.org/nix/install | sh -s -- --daemon
# fechar e reabrir o terminal

# 2. Dependências nativas do Tauri via Nix
nix-env -iA \
  nixpkgs.pkg-config \
  nixpkgs.openssl \
  nixpkgs.gtk3 \
  nixpkgs.webkitgtk_4_1 \
  nixpkgs.librsvg \
  nixpkgs.libayatana-appindicator \
  nixpkgs.xdotool
```

### Desenvolvimento (todas as plataformas)

```bash
npm install           # instalar dependências do frontend
npm run tauri dev     # app desktop com hot-reload

# só web (sem deps nativas — funciona em qualquer máquina):
npm run dev           # abre em http://localhost:1420
```

### Build de produção

```bash
npm run tauri build   # gera binário nativo + instalador
npm run build         # só o frontend web (gera dist/)
```

### macOS / Windows

Instalar Rust e Node; o Tauri trata do resto. Sem passos extra de sistema.

### Web

O frontend é uma app web normal. `npm run build` gera `dist/` que pode ser
servido em qualquer hosting estático.

### Mobile (iOS / Android)

Suportado pelo Tauri 2. A configurar numa fase posterior quando o núcleo
offline estiver estável.

---

## 3. Arquitectura

```
mise/
├─ crates/
│  ├─ core/          domínio + lógica pura (modelos, cálculo de custos)
│  ├─ data/          contratos de acesso a dados (traits de repositório)
│  └─ entitlements/  tipos de conta + features desbloqueadas por cada um
├─ src-tauri/        casca Tauri — única camada que conhece a plataforma
└─ src/
   ├─ styles/        tema pro-kitchen (tokens CSS)
   ├─ i18n/          PT / EN
   ├─ components/    UI partilhada (Sidebar, Layout, ...)
   └─ pages/         uma pasta por feature (entra na Fase 1)
```

**Regra de ouro:** zero lógica de negócio dentro de `src-tauri` ou `src`.
A casca chama as crates; as crates não conhecem a casca.

### Tema visual

Pro-kitchen: fundo escuro em três camadas (`base` → `surface` → `elevated`),
âmbar como cor de assinatura da marca, verde para estado activo na navegação,
semáforo verde/âmbar/vermelho para estados de stock. Números sempre em
monospace tabular — lidos como folha de cálculo profissional.

---

## 4. Sistema de tipos de conta e features

Cada feature declara para que tipos de conta está disponível.
Ligar/desligar uma feature por tipo de conta é uma linha em
`crates/entitlements/src/lib.rs` — não uma reescrita espalhada pela app.

| Tipo | Descrição |
|---|---|
| `Individual` | Uso pessoal — supermercados, calendário, sugestões |
| `Family` | Partilha entre membros do agregado |
| `Business` | Restaurante / cozinha profissional — fornecedores, multi-utilizador |

Legenda do roadmap: 🟢 todos os tipos · 👤 Individual/Família · 🏢 Negócio

---

## 5. Fluxo de desenvolvimento

Cada sprint é uma branch, um ciclo de review completo.
Dentro de cada sprint as features são implementadas em sequência
— nunca em paralelo, para evitar conflitos de merge.

```
main (sempre compilável)
 └─ feat/<nome> (uma branch por sprint)
```

### Sprints da Fase 1

| Sprint | Branch | Features |
|---|---|---|
| 1 | `feat/db-local-router` | libSQL + migrações + router |
| 2 | `feat/ingredients` | CRUD ingredientes + imagens placeholder |
| 3 | `feat/recipes-costs` | CRUD receitas + análise de custos |
| 4 | `feat/shopping-import` | Lista de compras + import JSON |
| 5 | `feat/shortcuts-i18n` | Atalhos globais + toggle PT/EN |

### Ciclo de cada sprint

1. Planeamos o sprint (humano + Claude Sonnet 4.6)
2. Agente implementa em feat/<nome>
3. Testes a passar (cargo test + tsc + npm run build)
4. Review na branch — Devstral
5. Merge squash para main + delete branch
6. Logbook actualizado neste README

### Routing de modelos

| Task | Modelo | Parâmetro |
|---|---|---|
| Scaffold, mover ficheiros | Haiku 4.5 | sem thinking |
| Implementar feature simples | Haiku 4.5 | `budget_tokens: 8000` |
| Implementar feature complexa | Haiku 4.5 | `budget_tokens: 16000` |
| Review na branch | Devstral | — |
| Debug difícil | Sonnet 4.6 | `effort: medium` |
| Decisão arquitectural | Sonnet 4.6 | `effort: high` |
| Auditoria periódica | Sonnet 4.6 | `effort: high` |
| Último recurso | Opus 4.8 | `effort: high` |

> **Nota:** Haiku 4.5 não suporta `effort` — usa `budget_tokens` manual.
> O parâmetro `effort` pertence ao Sonnet 4.6 e Opus 4.7/4.8.

### Auditorias de arquitectura

Realizadas após Sprint 2 e Sprint 4 por **Sonnet 4.6 · `effort: high`**.

Checklist:
- Arquitectura: lógica de negócio fora de `src-tauri` e `src`?
- Modularidade: alguma crate a importar o que não devia?
- Performance: tamanho do bundle frontend (`npm run build`)
- Performance: tempo de `cargo test`
- Qualidade: warnings em `cargo clippy`
- Qualidade: warnings em `tsc`
- Espaço: tamanho do binário Tauri gerado
- Espaço: tamanho da base de dados após seed de teste

---

## 6. Roadmap

### Fase 1 — Núcleo offline

- [ ] Ingredientes: CRUD + eliminação 🟢
- [ ] Receitas: CRUD + eliminação 🟢
- [ ] Base de dados local (libSQL) 🟢
- [ ] Lista de compras automática 🟢
- [ ] Análise de custos avançada 🟢
- [ ] Atalhos de teclado globais 🟢
- [ ] Navegação por router 🟢
- [ ] Import de receitas por JSON 🟢
- [ ] Imagens: placeholder tipográfico (sem fotos automáticas) 🟢

### Fase 2 — Online on-device

- [ ] OCR de receitas a partir de foto (biblioteca `ocrs`) 🟢
- [ ] Perfis + entitlements (Individual / Família / Negócio) 🟢
- [ ] Calendário pessoal 👤
- [ ] Sugestor de receitas baseado em stock 👤
- [ ] Procura automática de preços em supermercados 👤
- [ ] Gestão de fornecedores 🏢

### Fase 3 — Cloud off-device

- [ ] Sincronização Turso (local ↔ cloud) 🟢
- [ ] Contas + autenticação 🟢
- [ ] Conta partilhada multi-utilizador 👤🏢
- [ ] Chat de IA para descoberta de receitas 🟢
- [ ] Imagens na cloud (object storage) 🟢
- [ ] OCR estruturado por IA (visão) 🟢

---

## 7. Features — como funcionam

*(secção preenchida à medida que as features são implementadas)*

---

## 8. Logbook

### #0 — Fundação
**Data:** Junho 2026

- Análise completa da aplicação `Recipe_Planner` anterior (relatório de agente).
- Decisão de arquitectura: Tauri 2 + workspace de crates Rust agnósticas.
  Migração futura para Dioxus possível sem reescrever lógica de negócio.
- Definição da estratégia de base de dados: libSQL/Turso — offline agora,
  sync cloud numa fase posterior sem mudar a camada de dados.
- Definição do tema visual: pro-kitchen (escuro, denso, técnico) com sidebar
  híbrida (estrutura da versão anterior + paleta nova).
- Ambiente Linux: APT do Ubuntu 26.04 com libs fora de sync com repos oficiais.
  Solução: Nix para dependências nativas do Tauri, isoladas do sistema.
- Workspace Rust criado com três crates agnósticas:
  - `mise-core`: modelos de domínio + cálculo de custos (5 testes a passar).
  - `mise-entitlements`: tipos de conta + mapa de acesso a features (3 testes).
  - `mise-data`: traits de repositório (implementação libSQL chega na Fase 1).
- Casca Tauri 2 com comandos `ping` e `feature_allowed`.
- Frontend React 19 + tema pro-kitchen + sidebar híbrida + i18n PT/EN.
- Definição do routing de modelos de IA para o fluxo de desenvolvimento.

### #1 — Scaffold limpo
**Data:** Junho 2026 · branch `chore/scaffold-clean` · **Haiku 4.5 · sem thinking**

- Migração de `Recipe_Planner` para repositório `mise`.
- Remoção de todas as pages, componentes UI, store, utils e assets antigos.
- Remoção de todas as dependências antigas do frontend
  (zustand, recharts, lucide-react, react-router-dom, react-hook-form).
- Remoção do backend SQLite/SQLx e todos os commands Tauri antigos.
- Substituição por arquitectura modular descrita no #0.
- Branches criadas: `main` (protegida), `dev`, modelo `feat/*`.
- i18n simplificado pelo agente para PT apenas (toggle PT/EN
  a restaurar em feat/i18n).

### #2 — Planeamento Fase 1
**Data:** Junho 2026 · commit directo em `main`

- Definição de sprints comprimidos (5 sprints para 9 features).
- Critério de compressão: features que partilham camada de dados
  e não criam conflitos de merge podem entrar no mesmo sprint.
- Auditorias periódicas de arquitectura definidas após Sprint 2 e 4.
- Routing de modelos actualizado: Devstral para PR review de código,
  Gemini 3.1 Pro só com `low` ou `high` (não `medium`).
