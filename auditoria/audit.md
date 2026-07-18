# Auditoria Completa — Recipe Planner (Mise)

**Data:** 2026-07-18
**Branch:** `audit/hermes-2026-07-18`
**Metodologia:** 12 dimensões × 2 agentes + tiebreaker se discordância

---

## Pontuação Geral

| # | Dimensão | Nota | Peso | Ponderada |
|---|----------|------|------|-----------|
| 1 | Segurança | 6.0 | 12% | 0.72 |
| 2 | Arquitetura | 5.0 | 12% | 0.60 |
| 3 | Qualidade Código | 5.5 | 10% | 0.55 |
| 4 | Testes | 2.0 | 10% | 0.20 |
| 5 | Dependências | 6.0 | 8% | 0.48 |
| 6 | Performance | 4.25 | 8% | 0.34 |
| 7 | Qualidade Estética | 7.0 | 8% | 0.56 |
| 8 | Compliance c/ Plano | 9.25 | 8% | 0.74 |
| 9 | Qualidade Ideias | 7.5 | 8% | 0.60 |
| 10 | Qualidade Implementações | 7.5 | 8% | 0.60 |
| 11 | Aproveitamento | 6.0 | 4% | 0.24 |
| 12 | Documentação | 7.0 | 4% | 0.28 |
| | **FINAL** | | **100%** | **5.91/10** |

---

## Resumo por Dimensão

### 1. Segurança — 6/10
0 CRITICAL, 1 HIGH (withGlobalTauri), 6 MEDIUM, 9 LOW. SQL injection via format!() não é injectável actualmente (i64). CSP permissiva mas não quebrável remotamente. Single-user desktop reduz risco.

### 2. Arquitetura — 5/10
db.rs (5825 linhas) é god object. Unit parsing duplicado ~22×. 3 camadas pass-through (AppDb). Router sem lazy-loading (menos crítico em desktop). RecipesPage.tsx 912 linhas.

### 3. Qualidade Código — 5.5/10
22 match blocks de unidades duplicados. 96 unwrap() em db.rs sem contexto. 10 funções >100 linhas. `any` abuse em RecipesPage.tsx. Código funcional mas com dívida técnica pesada.

### 4. Testes — 2/10 **BLOQUEADOR COMERCIAL**
1 ficheiro de teste (db.rs inline, 21 testes). Cobertura real ~2.7%. Zero testes frontend, zero testes Tauri commands, zero CI. Testes existentes são de boa qualidade mas insuficientes.

### 5. Dependências — 6/10
`specta 2.0.0-rc.25` em produção (RC). `image` crate não usada (3MB+). `reqwest` duplicado no lock. Frontend impecável. Resolvível em horas.

### 6. Performance — 4.25/10
3 N+1 queries reais. 0 lazy-loading (tesseract.js 5MB sempre carregado). `setInterval` 1s no Layout. Zero LIMIT nas listagens. Com dados reais será lenta.

### 7. Qualidade Estética — 7/10
Excelente sistema de tokens CSS. Dark/light completo. Zero focus rings, zero media queries, ~60% inline styles no Dashboard. Acessibilidade fraca.

### 8. Compliance c/ Plano — 9.25/10
55+ alegações conformes, 0 falsas. PROJECT.md é exemplar — todas as checkboxes ✅ correspondem a código real. 3 ressalvas menores intencionais.

### 9. Qualidade Ideias — 7.5/10
Stock multi-brand, eventos com snapshot, segregação IVA são ideias excelentes (9-10/10). Calendário redundante com Meal Planner (6/10). Import URL limitado a sites EN.

### 10. Qualidade Implementações — 7.5/10
Stock, ingredientes, receitas, shopping list (9/10). OCR (5-7/10) — UNIT_ALIASES incompatível com backend. Reports (5-6/10) — 40% stubs. Settings/Turso sync é só UI.

### 11. Aproveitamento — 6/10
Núcleo certo para o mercado. Diferenciação real (stock multi-brand, eventos, IVA). O que falta é execução no que já existe: testes, modularização, performance, completude.

### 12. Documentação — 7/10
Rust docs bons (db.rs: 275 ///). Frontend: zero JSDoc. README bom. PROJECT.md excelente. HANDOFF desatualizado.

---

## Top 5 Ações Prioritárias

| # | Ação | Esforço | Impacto | Dimensão |
|---|------|---------|---------|----------|
| 1 | Adicionar testes ao CRUD base (ingredientes, receitas, stock) | Médio (2-3 dias) | Crítico — desbloqueia comercial | Testes |
| 2 | Extrair db.rs por domínio (stock, recipes, ingredients, etc.) | Alto (1 semana) | Acelera TODAS as features futuras | Arquitetura |
| 3 | Remover `image` unused, fix `specta` RC, dedup `reqwest` | Baixo (2h) | Limpeza de dívida | Dependências |
| 4 | `React.lazy()` router + matar N+1 queries | Médio (1 dia) | Performance perceptível | Performance |
| 5 | Criar `Unit::from_str()` + `Display` — elimina ~22 match blocks | Baixo (3h) | Qualidade + manutenção | Qualidade Código |

---

## Verificação de Alucinações

| Achado | Reportado por | Veredito | Flag |
|--------|--------------|----------|------|
| `var(--color-border)` e `var(--color-danger)` não existem | Agente Estética #2 | Verificado: confirmado ausente no theme.css | ✅ Real |
| `image` crate não usada | Agente Deps #1 | Verificado: grep por `image::` ou `use image` — 0 matches | ✅ Real |
| `withGlobalTauri` expõe window.**TAURI** | Ambos Segurança | Verificado: tauri.conf.json:13 | ✅ Real |
| db.rs 5825 linhas | Múltiplos agentes | Verificado: wc -l mostra 5825 | ✅ Real |
| 96 unwrap() em db.rs | Agente Qualidade #2 | Verificado parcialmente: vários unwrap, contagem exacta não confirmada | ⚠️ POSSÍVEL ALUCINAÇÃO — contagem de 96 unwraps não verificada exactamente |
| `recents_activity` query sem WHERE event_id IS NULL | Agente Compliance #2 | Verificado: db.rs:3641 | ✅ Real |

---

## Ficheiros do Relatório

Todos em `auditoria/`:
- `dim_01_seguranca_tiebreaker.md` — relatório final Segurança
- `dim_02_arq_tiebreaker.md` — relatório final Arquitetura
- `dim_03_qualidade_tiebreaker.md` — relatório final Qualidade Código
- `dim_04_testes_agente*.md` — Testes (consenso, sem tiebreaker)
- `dim_05_deps_agente*.md` — Dependências (consenso parcial)
- `dim_06_perf_agente*.md` — Performance (consenso parcial)
- `dim_07_estetica_agente*.md` — Qualidade Estética (consenso)
- `dim_08_compliance_agente*.md` — Compliance (consenso)
- `dim_09_ideias_agente*.md` — Ideias (consenso parcial)
- `dim_10_impl_agente*.md` — Implementações (consenso parcial)
- `dim_11_aproveitamento.md` — Aproveitamento
- `dim_12_documentacao.md` — Documentação
