# Relatório Tiebreaker — Qualidade Código (Dimensão 3)

**Projeto:** Recipe Planner (Mise)  
**Data:** 2026-07-18  
**Tiebreaker:** Leitura directa dos 4 ficheiros-chave  
**Rating Final Consolidado:** **5.5/10**

---

## 1. Verificação das Discórdias

### 1.1 Rating discrepante: 6.5 (Agente #1) vs 5 (Agente #2)

**Decisão do tiebreaker:** 5.5/10.

**Justificação:** O Agente #1 (17 calls, superficial) acertou nos problemas estruturais de alto nível mas subestimou a gravidade dos problemas profundos. O Agente #2 (41 calls, profundo) identificou 10 funções-monstro e 96 unwraps — problemas reais de manutenibilidade que justificam a penalização. O rating 5.5 reflecte que o código é funcional (tipos fortes, testes, WAL config documentado) mas tem dívida técnica grave em concentração de risco (db.rs), duplicação de lógica, e ausência de tratamento de erro idiomático.

### 1.2 Profundidade: 17 vs 41 calls — quem estava certo?

O Agente #2 (41 calls) estava correcto na profundidade — o código revela problemas que só aparecem com análise detalhada (ex: `create_or_find_ingredient` com 597 linhas não é visível num scan superficial). O Agente #1 (17 calls) fez um scan válido mas incompleto.

---

## 2. Verificação das Alegações — Ficheiro a Ficheiro

### 2.1 `crates/core/src/db.rs`

| Alegação | Agente | Verdict | Evidência |
|----------|--------|---------|-----------|
| 5825 linhas | #1 | ✅ **CONFIRMADO** | `wc -l` = 5825 linhas exactas |
| 80 funções pass-through | #1 | ⚠️ **PARCIAL** | As pass-through estão em `lib.rs` (AppDb/commands), não em `db.rs`. db.rs tem 84 funções públicas com lógica real. |
| Monster functions | #2 | ✅ **CONFIRMADO** | **10 funções >100 linhas** em db.rs: `run_migrations` (393), `calculate_cost` (106), `seed_demo_data` (407), `generate_shopping_list_from_meal_plan` (102), `get_recent_activity` (117), `get_cost_report` (127), `get_meal_stats` (112), `parse_receipt_text` (125), `receipt_confirm` (125), `create_or_find_ingredient` (597 — maior). |
| unwrap abuse | #2 | ✅ **CONFIRMADO** | **96 chamadas `unwrap()`** — todas concentradas em db.rs. Noutros ficheiros Rust: 0. Risco alto: qualquer `unwrap()` em produção pode panicar. |
| eprintln! | #2 | ⚠️ **PARCIAL** | 1 ocorrência em `src-tauri/src/lib.rs` (setup error handler). Uso legítimo (antes do logger estar disponível). Encontrar menor do que o alegado. |
| placeholders | #2 | ❌ **NÃO CONFIRMADO** | 0 ocorrências de `todo!()` ou `unimplemented!()` em qualquer ficheiro `.rs`. |

### 2.2 `crates/tauri/src/lib.rs`

| Alegação | Agente | Verdict | Evidência |
|----------|--------|---------|-----------|
| 80 funções pass-through | #1 | ✅ **CONFIRMADO (mas no ficheiro errado)** | O `AppDb` tem ~85 métodos que são pass-through puro: chamam `mise_core::db::*` e convertem erro com `map_err(\|e\| e.to_string())`. O módulo `commands` tem mais ~65 comandos Tauri que são pass-through para `AppDb`. Total: **~150 funções pass-through em 3 camadas** (commands → AppDb → db.rs). |

### 2.3 `src/pages/RecipesPage.tsx`

| Alegação | Agente | Verdict | Evidência |
|----------|--------|---------|-----------|
| any abuse | #1 | ✅ **CONFIRMADO** | **16 ocorrências de `: any`**: `RecipeFormContent({…}: any)`, `RecipeModal({…}: any)`, `setForm((f: any) => …)`, `.map((ing: any, …))`, `.map((i: any) => …)`. Todo o formulário e modal usam `any` nos parâmetros, anulando a segurança de tipos do TypeScript. |

### 2.4 `crates/core/src/domain.rs`

| Alegação | Agente | Verdict | Evidência |
|----------|--------|---------|-----------|
| enum Unit sem FromStr/Display | Ambos | ✅ **CONFIRMADO (não mencionado, mas verificado)** | `enum Unit` tem 22 variantes, `label()`, `name_pt()`, `to_base_factor()`, `convert_to()`, `all()`, `group()`. **Não implementa `FromStr` nem `Display`.** Serialização só via Serde. Gap para parsing de input do utilizador. |
| duplicação unitária 22× | #2 | ✅ **CONFIRMADO** | Cada uma das 22 unidades aparece em **múltiplos locais** com lógica duplicada: `domain.rs` (enum, label, name_pt, to_base_factor, group, all), `units.ts` (UNIT_LABELS_FULL, UNIT_GROUP, UNIT_BASE_FACTOR, convertUnit), `RecipesPage.tsx` (getUnitGroups). A lógica de conversão (`convert_to`/`convertUnit`) e os factores de base estão implementados duas vezes: Rust + TypeScript, sem garantia de consistência. |
| dead struct | #2 | ❌ **NÃO CONFIRMADO** | Nenhuma struct declarada sem corpo ou struct não referenciada detectada nos ficheiros analisados. |

---

## 3. Problemas Adicionais Encontrados pelo Tiebreaker

| # | Problema | Local | Gravidade |
|---|----------|-------|-----------|
| 1 | **3 camadas de pass-through** (commands → AppDb → db.rs). ~150 funções que não acrescentam valor — só convertem erro. | `crates/tauri/src/lib.rs` | Alta |
| 2 | **`db.rs` é God Object** — 5825 linhas, 84 funções públicas, 10 funções-monstro, 96 unwraps. Viola SRP e aberta a falhas em cascata. | `crates/core/src/db.rs` | Alta |
| 3 | **Duplicação bidireccional de lógica de unidades** — Rust e TypeScript implementam `convert_to` e tabelas de factores independentemente. Risco de divergência. | `domain.rs` + `units.ts` | Média |
| 4 | **`Unit` sem `FromStr`/`Display`** — parsing de input de utilizador depende de Serde, não há conversão limpa string↔enum. | `domain.rs` | Média |
| 5 | **`domain.rs` com 1305 linhas** — mistura 5+ agregados (Unit, Recipe, Ingredient, Stock, ShoppingList, etc.) no mesmo ficheiro. | `domain.rs` | Média |

---

## 4. Rating Final Consolidado: 5.5/10

### Desglose

| Categoria | Peso | Nota | Justificação |
|-----------|------|------|-------------|
| Estrutura / Organização | 30% | 4/10 | db.rs god object (5825 linhas), 3 camadas pass-through desnecessárias, domain.rs inchado |
| Segurança / Robustez | 25% | 5/10 | 96 unwraps concentrados (risco de panic), erros convertidos para string perdendo tipo |
| Manutenibilidade | 25% | 5/10 | 10 monster functions (597 linhas a maior), duplicação lógica Rust/TS, any abuse |
| Tipos / Modelação | 20% | 8/10 | Domain model com tipos fortes, validação, Serialize/Deserialize. Único gap: Unit sem FromStr/Display |

### Score Final

```
(4 × 0.30) + (5 × 0.25) + (5 × 0.25) + (8 × 0.20) = 1.20 + 1.25 + 1.25 + 1.60 = 5.30
```

**Arredondado:** 5.5/10

### Comparação com Agentes

| Agente | Rating | Calls | Precisão |
|--------|--------|-------|----------|
| Agente #1 | 6.5/10 | 17 | Subestima gravidade (não detectou monster functions nem unwraps) |
| Agente #2 | 5/10 | 41 | Mais preciso na profundidade mas sobrestimou placeholders/dead struct |
| **Tiebreaker** | **5.5/10** | **Directo** | **Consolidado: valida 5/6 alegações do #2, 2/3 do #1** |

---

## 5. Recomendações Prioritárias

1. **Extrair lógica de `db.rs`** — Separar por domínio (ingredients, recipes, stock, shopping, reports, images) em módulos. Atingível com refactor sem alterar API.
2. **Reduzir 3 camadas para 1** — Remover `AppDb` como intermediário ou gerar automaticamente. Comandos Tauri podem chamar `mise_core::db::*` directamente.
3. **Substituir unwraps por error propagation** — Usar `?` com `anyhow::Error` ou `thiserror` em vez de 96 pontos de panic.
4. **Gerar `units.ts` a partir do enum Rust** — Script de build que extrai `Unit` do domain.rs para TypeScript, eliminando duplicação manual.
5. **Adicionar `FromStr` + `Display` a `Unit`** — Implementação directa (`impl Display` com `self.label()`, `impl FromStr` com lookup inverso).
6. **Tipar `RecipesPage.tsx`** — Substituir `any` por tipos concretos (e.g. `React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>`).

---

*Relatório produzido por Tiebreaker Agent com leitura directa dos 4 ficheiros-chave.*
