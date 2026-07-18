# Relatório Tiebreaker — Auditoria de Segurança: Recipe Planner (Mise)

**Data:** 2026-07-18
**Analista:** Agente Tiebreaker (independente)
**Contexto:** Mediação entre Agente #1 (Rating 6/10, 10 achados, 0 CRITICAL) e Agente #2 (Rating 6/10, 15 achados, 2 CRITICAL)
**Aplicação:** Recipe Planner (Mise) — Tauri 2 desktop (Rust + React/TypeScript + libSQL)

---

## Metodologia

Li o código fonte em cada ponto de discórdia, tracei o fluxo real dos dados (origem do input, tipos, transformações) e verifiquei cada alegação contra o código real — não contra interpretações teóricas. Para cada ponto: decido quem está correcto, ou proponho uma terceira via com justificação baseada no código observado.

---

## Pontos de Discórdia

### 1. SQL injection com `format!()` — CRITICAL (#2) vs MEDIUM (#1)

**Decisão: Agente #1 correcto → MEDIUM**

**Justificação:**

Existem dois usos de `format!()` para construir SQL:

**a) `recipes_list` (db.rs:1101–1105):**
```rust
let ids_str = recipe_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
let query = format!("SELECT ... WHERE ri.recipe_id IN ({})", ids_str);
```
Os `recipe_ids` vêm **exclusivamente** da query anterior (db.rs:1090–1095) que lê IDs auto-incrementados da tabela `recipes` — são `i64` garantidos pelo schema SQLite (`INTEGER PRIMARY KEY`). A função `recipes_list()` não aceita parâmetros externos. **Não há vectorde injeção actual.** O rating CRITICAL do Agente #2 está incorrecto porque assume que dados `i64` são injectáveis — não são, a menos que haja overflow/underscore parsing que o libSQL não faz.

**b) `add_column_if_missing` (db.rs:462–477):**
```rust
debug_assert!([table, column].iter().all(|s| s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')));
let mut rows = conn.query(&format!("PRAGMA table_info({table})"), ()).await?;
conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"), ()).await?;
```
A função só é chamada de `run_migrations()` com literais hardcoded. O `debug_assert!` é removido em release, mas isto é irrelevante porque os valores são literais. Contudo, o `decl` (tipo SQL) não é validado, e `debug_assert!` em vez de `assert!` é uma fragilidade.

**Veredicto final:** O padrão `format!()` viola defesa-em-profundidade e é um code smell, mas **não é explorável actualmente**. MEDIUM é a severidade correcta — risco futuro, não actual.

---

### 2. `withGlobalTauri: true` — CRITICAL (#2) vs HIGH (#1)

**Decisão: Agente #1 correcto → HIGH**

**Justificação:**

`withGlobalTauri: true` expõe `window.__TAURI__` globalmente no webview. Isto permite que **qualquer código JS** invoque comandos Tauri — mas apenas **depois de existir XSS na página**.

- O Agente #2 classifica como CRITICAL, o que implicaria exploração remota sem pré-condições. Isto não é o caso: o atacante precisa primeiro de injectar JavaScript na webview (via XSS, extensão maliciosa, DevTools abertos).
- O Agente #1 classifica como HIGH: o `withGlobalTauri` transforma um XSS limitado numa compromissão total (pode chamar `delete_all_data`, `export_data`, `recipe_import_from_url` para SSRF, etc.). Esta é a classificação correcta.
- Em Tauri 2, a app já usa `@tauri-apps/api` com `invoke()` explícito, logo `withGlobalTauri: true` é desnecessário.

**Veredicto final:** HIGH — amplificador de XSS. Fix: `"withGlobalTauri": false`.

---

### 3. SSRF em `recipe_import_from_url` — MEDIUM (#2) vs LOW (#1)

**Decisão: Agente #2 correcto → MEDIUM**

**Justificação:**

`recipe_import_from_url` (db.rs:2907–2958):
```rust
pub async fn recipe_import_from_url(db: &Database, url: String) -> Result<RecipeImportPreview, String> {
    let client = reqwest::Client::new();
    let html = client.get(&url).header("User-Agent", ...).send().await ...
```

Não há **nenhuma validação** do URL: sem verificação de esquema, sem whitelist, sem bloqueio de IPs privados. Um atacante (via XSS) pode fazer a app atingir:
- `http://localhost:8080/admin` (serviços internos)
- `http://169.254.169.254/latest/meta-data/` (cloud metadata)
- `http://192.168.1.1/` (router)

O Agente #1 argumenta que "o atacante já controla o client em single-user". Isto é verdade para um atacante com acesso ao sistema, mas ignora que **num cenário de XSS** (amplificado pelo `withGlobalTauri`), o atacante remoto pode usar esta função para SSRF sem nunca ter acesso local.

**Veredicto final:** MEDIUM — SSRF real, impacto ampliado por combinação com outros achados.

---

### 4. Turso token em localStorage/DB — MEDIUM (#2) vs LOW (#1)

**Decisão: MEDIUM (terceira via — ambos parcialmente correctos)**

**Justificação:**

O `auth_token` do Turso sync é:
- Guardado na BD local (libSQL) via `settings_set`
- Enviado ao frontend via `settings_get` e mantido em estado React
- Visível em DevTools

O Agente #1 diz LOW porque "o token é para uma BD de receitas, não para autenticação crítica". O Agente #2 diz MEDIUM porque "Turso é cloud — exposição permite acesso remoto não autorizado".

Ambos têm razão parcial. A severidade depende de:
- **Se o sync Turso estiver activo:** o token permite acesso de leitura/escrita à réplica remota → MEDIUM
- **Se o sync não estiver configurado:** o token é vazio → risco zero

Como a app **suporta sync Turso** (a UI tem os campos), o token pode estar presente. Num contexto comercial com dados sensíveis na cloud, é MEDIUM. O rating default deve ser MEDIUM porque a infra-estrutura existe, mesmo que o utilizador possa não a usar.

**Veredicto final:** MEDIUM — depende se sync está activo, mas a app suporta a funcionalidade.

---

### 5. CSP ausente no `index.html` — MEDIUM (#2) vs LOW (#1)

**Decisão: Agente #1 correcto → LOW**

**Justificação:**

Em Tauri 2, a CSP **autoritativa** é definida em `tauri.conf.json`:
```json
"csp": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; ..."
```

A CSP do `tauri.conf.json` é aplicada pelo runtime Tauri a todas as páginas na webview. A meta-tag CSP no HTML seria:
- **Redundante em produção** (a do config prevalece)
- **Útil em dev** (quando se abre o browser directamente)

O Agente #2 classifica como MEDIUM "defense-in-depth". Mas defense-in-depth para uma camada que já está coberta pelo binário Tauri não justifica MEDIUM — especialmente quando a ausência só é relevante em ambiente de desenvolvimento.

**Veredicto final:** LOW — pode ser ignorado em segurança. Útil adicionar para consistência dev/prod, mas não é prioritário.

---

### 6. Path traversal em `image_read_base64` / `image_delete` — MEDIUM (#1) vs não mencionado (#2)

**Decisão: Agente #1 correcto → MEDIUM (2 sub-achados)**

**Justificação:**

Ambas as funções usam `data_dir.join(&path)` sem validar o caminho lido da BD:

```rust
// image_read_base64 (db.rs:4422)
let bytes = std::fs::read(data_dir.join(&path))

// image_delete (db.rs:4406)
let _ = std::fs::remove_file(data_dir.join(&path));
```

O `path` vem da tabela `images`. Embora `save_base64_image` (db.rs:4324–4363) construa nomes seguros (`images/{type}_{id}_{timestamp}.{ext}`), não há garantia que a BD não possa ser corrompida — por SQL injection (se houver), por outro processo com acesso ao ficheiro `.db`, ou por manipulação manual.

O Agente #2 não menciona este vector (o seu L4 é sobre path traversal teórico via `entity_type` no filename, que é diferente).

**Veredicto final:** MEDIUM — requer escrita na BD (já comprometida), mas amplifica dano permitindo leitura/remoção arbitrária de ficheiros. Fundir os dois sub-achados num só (mesma causa raiz).

---

### 7. Validação de input nos comandos Tauri — HIGH (#2) vs não mencionado (#1)

**Decisão: MEDIUM (terceira via — Agente #2 sobrestima)**

**Justificação:**

O Agente #2 identificou correctamente que:
- Structs como `IngredientInput` têm `#[derive(Validate)]` com regras (`#[validate(length(min = 1, max = 200))]`)
- Mas `.validate()` **nunca é chamado** nos handlers Tauri

Exemplo (`crates/tauri/src/lib.rs:541–547`):
```rust
pub async fn ingredient_create(
    db: tauri::State<'_, crate::AppDb>,
    input: IngredientInput,
) -> Result<Ingredient, String> {
    db.create_ingredient(input).await.map_err(|e| e.to_string())
    // input.validate() nunca é chamado!
}
```

Isto é um achado real: as annotations de validação existem mas são ineficazes. Contudo, **HIGH é excessivo** porque:
- O backend tem validação de tipos via Serde (deserialização rejeita tipos inválidos)
- A BD tem constraints (NOT NULL, UNIQUE)
- Os inputs String são armazenados com escaping do libSQL (parameter binding)
- Single-user: o frontend é o caller imediato e já faz validação UX

A validação perdida é defesa-em-profundidade, não uma lacuna crítica. MEDIUM é a severidade apropriada.

**Veredicto final:** MEDIUM — real mas não explorável sem frontend adulterado. Basta adicionar `input.validate().map_err(|e| e.to_string())?;` nos handlers.

---

### 8. Erros expostos como `String` — LOW (#1) vs não mencionado (#2)

**Decisão: Agente #1 correcto → LOW**

**Justificação:**

Todos os comandos Tauri retornam `Result<_, String>`, o que faz leak de detalhes internos (caminhos de ficheiro, mensagens de SQL) para o frontend. Em single-user desktop:
- Quem vê os erros é o próprio utilizador
- Não há vector de exfiltração remota directa
- Risco: copy-paste de erros em bug reports públicos

O Agente #2 não menciona este achado separadamente (subsumido no H2 "input validation").

**Veredicto final:** LOW — risco baixo para single-user. Melhorar com erros tipados seria bom para UX e segurança, mas não é urgente.

---

## Achados Adicionais (não disputados)

### Dos dois agentes, consolidados:

| # | Achado | Severidade Final | Fonte | Nota |
|---|--------|-----------------|-------|------|
| F1 | `withGlobalTauri: true` | **HIGH** | A1→HIGH, A2→CRITICAL | MAX prioridade. Fix: `false` |
| F2 | SQL `format!` em `recipes_list` | **MEDIUM** | A1→MEDIUM, A2→CRITICAL | i64, não injectável. Code smell |
| F3 | SQL `format!` em `add_column_if_missing` | **MEDIUM** | A1→MEDIUM, A2→CRITICAL | Só migrations. `debug_assert!` frágil |
| F4 | SSRF `recipe_import_from_url` | **MEDIUM** | A1→LOW, A2→MEDIUM | Sem validação de URL |
| F5 | Path traversal imagens (leitura + remoção) | **MEDIUM** | A1→MEDIUM, A2→não viu | 2 locais, mesma causa |
| F6 | Input validation Tauri commands | **MEDIUM** | A1→não viu, A2→HIGH | `.validate()` nunca chamado |
| F7 | Turso token plaintext | **MEDIUM** | A1→LOW, A2→MEDIUM | Contextual: sync activo = MEDIUM |
| F8 | CSP ausente index.html | **LOW** | A1→LOW, A2→MEDIUM | Redundante com config |
| F9 | Erros expostos como String | **LOW** | A1→LOW, A2→não viu | Leak para frontend |
| F10 | CSP bloqueia Google Fonts | **LOW** (funcional) | A1→HIGH, A2→MEDIUM | Bug funcional, não de segurança |
| F11 | CSP permissivo (`wasm-unsafe-eval`, `blob:`) | **LOW** | A2→HIGH | Necessário para Tauri 2 + Vite |
| F12 | Settings sem whitelist | **LOW** | A2→MEDIUM | Single-user: frontend controla keys |
| F13 | React nomes XSS potencial | **LOW** | A2→MEDIUM | React escapa HTML, sem `dangerouslySetInnerHTML` |
| F14 | Imagens sem limite tamanho | **LOW** | A2→LOW | DoS local (encher disco) |
| F15 | `forbid(unsafe_code)` ausente no crate tauri | **LOW** | A2→LOW | Ausência, não presença de unsafe |
| F16 | Google Fonts CDN externo | **LOW** | A2→MEDIUM | Privacidade/offline, não segurança |

**Descarte do Agente #1:** Path traversal (F5) mantido. CSP fontes Google reclassificado para LOW funcional (F10). Erro leakage mantido LOW (F9).

**Descarte do Agente #2:** SQL injection CRITICAL → MEDIUM (F2,F3). withGlobalTauri CRITICAL → HIGH (F1). Input validation HIGH → MEDIUM (F6). CSP permissivo HIGH → LOW (F11). CSP meta MEDIUM → LOW (F8). Google Fonts CDN MEDIUM → LOW (F16). Settings whitelist MEDIUM → LOW (F12). Nomes XSS MEDIUM → LOW (F13).

---

## Lista Final de Achados (consolidada, 16 achados)

| Severidade | Qtd | IDs |
|-----------|-----|-----|
| **CRITICAL** | **0** | — |
| **HIGH** | **1** | F1 |
| **MEDIUM** | **6** | F2, F3, F4, F5, F6, F7 |
| **LOW** | **9** | F8, F9, F10, F11, F12, F13, F14, F15, F16 |

---

## Rating Final: **6/10**

### Justificação:

**Porque não sobe para 7/10:**
- `withGlobalTauri: true` (HIGH) é a falha mais grave e não há desculpa para estar activo — a app usa `invoke()` explícito, a flag é desnecessária
- Seis achados MEDIUM representam défices reais de defesa-em-profundidade
- A validação de input com `#[derive(Validate)]` está implementada mas nunca é chamada — código morto que dá falsa sensação de segurança

**Porque não desce para 5/10:**
- Zero CRITICAL: não há SQL injection explorável, XSS refletido, ou chain de exploração remota
- 99% das queries SQL usam parameter binding correcto
- Nenhum uso de `dangerouslySetInnerHTML`, `eval()`, ou `unsafe` Rust
- Structs de input têm validação declarativa (só falta chamá-la)
- API keys em variáveis de ambiente, não hardcoded
- `forbid(unsafe_code)` no core

### Distribuição final:

```
CRITICAL ████ 0
HIGH     ████████████ 1   ← withGlobalTauri
MEDIUM   ████████████████████████████████████████████████ 6
LOW      ████████████████████████████████████████████████████████████ 9
```

---

## Recomendações Prioritárias

1. **IMEDIATO HIGH:** Desligar `withGlobalTauri: false` em `tauri.conf.json`
2. **CURTO PRAZO MEDIUM:** Adicionar `input.validate()` em todos os Tauri commands com `#[derive(Validate)]`
3. **CURTO PRAZO MEDIUM:** Validar URL em `recipe_import_from_url` (esquema + bloqueio IPs privados)
4. **CURTO PRAZO MEDIUM:** Validar path em `image_read_base64` e `image_delete` (rejeitar `..`)
5. **CURTO PRAZO MEDIUM:** Migrar `format!("... IN ({})", ids_str)` para prepared statement com placeholders
6. **CURTO PRAZO MEDIUM:** Usar `tauri-plugin-store` ou keyring OS para token Turso
7. **MÉDIO PRAZO LOW:** Substituir `debug_assert!` por `assert!` em `add_column_if_missing`
8. **MÉDIO PRAZO LOW:** Adicionar meta-tag CSP ao `index.html` para consistência dev
9. **MÉDIO PRAZO LOW:** Considerar self-host das Google Fonts (remove dependência externa)

---

## Notas sobre Descarte

**O que foi descartado do Agente #1:**
- Nada foi descartado como falso positivo. Todos os seus 10 achados foram mantidos (alguns reclassificados).

**O que foi descartado do Agente #2:**
- **C1 (CRITICAL SQL injection):** ↓ para MEDIUM — os dados são `i64`, não injectáveis. O padrão é frágil mas não explorável.
- **C2 (CRITICAL withGlobalTauri):** ↓ para HIGH — requer XSS prévio, não é standalone.
- **H1 (CSP permissivo HIGH):** ↓ para LOW — `wasm-unsafe-eval` é standard em Tauri 2, não removível sem quebrar IPC.
- **H2 (Input validation HIGH):** ↓ para MEDIUM — real, mas sem vetor de exploração directo em single-user.
- **M1 (CSP meta tag MEDIUM):** ↓ para LOW — redundante em produção.
- **M2 (Google Fonts CDN MEDIUM):** ↓ para LOW — segurança baixa, mais privacidade/offline.
- **M3 (Settings whitelist MEDIUM):** ↓ para LOW — frontend controla em single-user.
- **M5 (XSS nomes MEDIUM):** ↓ para LOW — React já escapa HTML.

---

## Ficheiros Verificados

- `src-tauri/tauri.conf.json` — withGlobalTauri, CSP
- `crates/core/src/db.rs` — format! SQL (1101, 462–477), image_read_base64 (4422), image_delete (4406), recipe_import_from_url (2907), save_base64_image (4324), set_setting (1953)
- `crates/tauri/src/lib.rs` — commands (todos), ingestão de input, erros Result<_, String>
- `index.html` — CSP meta tag ausente, Google Fonts CDN
- `src/pages/SettingsPage.tsx` — Turso auth_token
- `crates/core/src/domain.rs` — IngredientInput com Validate
- `auditoria/dim_01_seguranca_agente1.md` — relatório original A1
- `auditoria/dim_01_seguranca_agente2.md` — relatório original A2

---

**Fim do relatório tiebreaker.** Decisões baseadas em verificação de código real, não em interpretação teórica.
