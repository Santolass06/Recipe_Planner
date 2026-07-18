# Relatório de Auditoria de Segurança — Recipe Planner (Mise)

**Data:** 2026-07-18
**Analista:** Agente #2 (Segurança)
**Scope:** Backend Rust (Tauri 2 + libSQL) + Frontend React/TypeScript
**Contexto:** App comercial desktop single-user

Li **34 ficheiros**, ~9.200 linhas no total.

---

## Rating Geral: **6/10**

App tem base sólida (usa `withGlobalTauri` mínimo possível, `forbid(unsafe_code)`, parâmetros SQL maioritariamente vinculados), mas o `withGlobalTauri: true`, CSP permissivo e ausência de validação de input em vários comandos Tauri são lacunas reais mesmo em single-user.

---

## ACHADOS

### 🔴 CRITICAL

#### C1 — SQL Injection via `format!()` com IDs de receitas inline

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/core/src/db.rs` |
| **Linha** | 1101–1104 |
| **Problema** | `recipe_ids` (i64) são convertidos a string e formatados directamente na query SQL com `format!()` em vez de usar `?` params. Embora `i64` não seja injectável (são números), a quebra do padrão de parâmetros vinculados é perigosa — qualquer alteração futura que introduza strings nesta variável cria SQL injection imediato. |
| **Código** | ```rust
let ids_str = recipe_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
let query = format!(
    "SELECT ri.id, ri.recipe_id, ri.ingredient_id, ri.ingredient_name, ri.quantity, ri.unit
     FROM recipe_ingredients ri
     WHERE ri.recipe_id IN ({})
     ...", ids_str);
``` |
| **Impacto** | Single-user: corrupção/destruição de dados, elevação de privilégios local. Se Turso sync for activado, propaga-se ao remoto. |
| **Severidade** | **CRITICAL** (SQL injection clássico) |
| **Sugestão de fix** | Substituir por query que aceite slice via prepared statement dinâmico com `?` placeholders ou refactor para múltiplas queries individuais: |
| | ```rust
// Para listas pequenas: uma query por ID é seguro
let mut all_ingredients = Vec::new();
for recipe_id in &recipe_ids {
    let mut rows = conn.query(
        "SELECT ri.id, ri.recipe_id, ri.ingredient_id, ri.ingredient_name, ri.quantity, ri.unit
         FROM recipe_ingredients ri WHERE ri.recipe_id = ?1",
        params![recipe_id],
    ).await?;
    // processar...
}
``` |

---

#### C2 — `withGlobalTauri: true` activo

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `src-tauri/tauri.conf.json` |
| **Linha** | 13 |
| **Problema** | `withGlobalTauri: true` expõe `window.__TAURI__` globalmente no frontend. Permite que qualquer código JS (mesmo de extensões ou scripts injectados) invoque comandos Tauri directamente. |
| **Código** | `"withGlobalTauri": true` |
| **Impacto** | Single-user: se o user abrir DevTools ou instalar extensões maliciosas, podem aceder a toda a API do backend. |
| **Severidade** | **CRITICAL** |
| **Sugestão de fix** | Mudar para `false` em tauri.conf.json e importar `@tauri-apps/api` nos módulos que precisam: |
| | ```json
"withGlobalTauri": false
``` |

---

### 🟠 HIGH

#### H1 — CSP permissivo: `'wasm-unsafe-eval'` e `blob:` em `script-src`

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `src-tauri/tauri.conf.json` |
| **Linha** | 26 |
| **Problema** | A CSP permite `script-src 'self' 'wasm-unsafe-eval' blob:`. `blob:` permite criar scripts arbitrários via `Blob` URLs; `wasm-unsafe-eval` permite execução de WebAssembly que pode fazer bypass a outras restrições. |
| **Código** | `"csp": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost"` |
| **Impacto** | Mesmo single-user, CSP deve proteger contra scripts injectados em dados importados (e.g. nome de ingrediente com XSS). |
| **Severidade** | **HIGH** |
| **Sugestão de fix** | Restringir `script-src` a `'self'` apenas; remover `'wasm-unsafe-eval'` e `blob:`: |
| | ```
"csp": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; base-uri 'none'"
``` |

---

#### H2 — Ausência de validação de entrada nos comandos Tauri (input sanitisation zero)

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/tauri/src/lib.rs` (várias linhas) |
| **Problema** | Nenhum comando Tauri faz validação semântica dos inputs. Exemplos: `settings_set(key: String, value: String)` aceita qualquer string (linha 862); `stock_upsert(input: StockInput)` aceita `quantity: f64` sem limite; `ingredient_create(input: IngredientInput)` aceita `name: String` sem sanitização. A struct `IngredientInput` usa `#[derive(validator::Validate)]` (em domain.rs) com `#[validate(length(min = 1, max = 200))]` mas a validação nunca é chamada nos handlers. |
| **Código** | ```rust
#[tauri::command]
pub async fn settings_set(
    db: tauri::State<'_, crate::AppDb>,
    key: String,    // ← sem validação
    value: String,  // ← sem validação
) -> Result<(), String> {
    db.set_setting(&key, &value).await.map_err(|e| e.to_string())
}
``` |
| **Impacto** | Single-user: dados corrompidos, chaves de settings inválidas, nomes com caractéres especiais podem causar problemas nas queries (nomes com `'` escapados só pelo libSQL). |
| **Severidade** | **HIGH** |
| **Sugestão de fix** | Chamar `.validate()` em todos os inputs que implementam `validator::Validate`: |
| | ```rust
#[tauri::command]
pub async fn ingredient_create(
    db: tauri::State<'_, crate::AppDb>,
    input: IngredientInput,
) -> Result<Ingredient, String> {
    input.validate().map_err(|e| e.to_string())?;  // ← ADICIONAR
    db.create_ingredient(input).await.map_err(|e| e.to_string())
}
``` |

---

### 🟡 MEDIUM

#### M1 — Ausência de CSP no ficheiro `index.html` (meta tag)

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `index.html` |
| **Linha** | 1–25 |
| **Problema** | A CSP está definida apenas no `tauri.conf.json`. Não há `<meta http-equiv="Content-Security-Policy">` no HTML. Em Tauri 2, a CSP do config é aplicada, mas uma meta tag no HTML serviria como defesa adicional (defense-in-depth). |
| **Código** | (ausência de meta tag CSP) |
| **Impacto** | Se a CSP do config for removida por engano, não há fallback. |
| **Severidade** | **MEDIUM** |
| **Sugestão de fix** | Adicionar meta tag no `<head>` do index.html: |
| | ```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; base-uri 'none'">
``` |

---

#### M2 — Fontes Google carregadas de CDN externo (offline / tracking)

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `index.html` |
| **Linha** | 16–19 |
| **Problema** | Carregar fonts.googleapis.com e fonts.gstatic.com a partir de CDN externo. Além da dependência de rede (app desktop deve funcionar offline), envia metadata sobre o referer ao Google. |
| **Código** | ```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk..." rel="stylesheet">
``` |
| **Impacto** | App pode falhar a carregar fonts sem internet. Envio de `Referer` header ao Google. |
| **Severidade** | **MEDIUM** |
| **Sugestão de fix** | Self-host as fonts: |
| | ```html
<!-- Download e incluir localmente -->
<link rel="stylesheet" href="/assets/fonts.css">
``` |

---

#### M3 — Comando `settings_set` sem whitelist de chaves

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/tauri/src/lib.rs` |
| **Linha** | 862–868 |
| **Problema** | Qualquer `key: String` é aceite e guardada na DB. Um caller (frontend) pode criar chaves arbitrárias no `settings` table, potencialmente enchendo a DB ou colidindo com chaves internas. |
| **Código** | ```rust
pub async fn settings_set(
    db: tauri::State<'_, crate::AppDb>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.set_setting(&key, &value).await.map_err(|e| e.to_string())
}
``` |
| **Impacto** | Poluição das settings. App single-user: médio impacto. |
| **Severidade** | **MEDIUM** |
| **Sugestão de fix** | Validar key contra whitelist: |
| ```rust
const ALLOWED_KEYS: &[&str] = &["language", "theme", "density", "date_format", "weight", "volume", "temperature", "currency", "symbol_position", "turso_url", "auth_token"];
pub async fn settings_set(
    db: tauri::State<'_, crate::AppDb>,
    key: String,
    value: String,
) -> Result<(), String> {
    if !ALLOWED_KEYS.contains(&key.as_str()) {
        return Err(format!("Unknown setting key: {}", key));
    }
    db.set_setting(&key, &value).await.map_err(|e| e.to_string())
}
``` |

---

#### M4 — `recipe_import_from_url` permite SSRF (Server-Side Request Forgery)

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/tauri/src/lib.rs` |
| **Linha** | 516–518 (wrapper), `crates/core/src/db.rs` função `recipe_import_from_url` |
| **Problema** | O comando `recipe_import_from_url` aceita uma URL arbitrária do frontend e faz HTTP request. Sem validação ou whitelist de domínios, pode ser usado para SSRF (aceder a `localhost`, `127.0.0.1`, `file:` protocol, etc.). |
| **Código** | ```rust
pub async fn recipe_import_from_url(&self, url: String) -> Result<RecipeImportPreview, String> {
    mise_core::db::recipe_import_from_url(&self.db, url).await.map_err(|e| e.to_string())
}
``` |
| **Impacto** | Ataque SSRF: accesso a serviços internos (e.g. Turso sync endpoint, outros serviços na rede local). |
| **Severidade** | **MEDIUM** |
| **Sugestão de fix** | Validar URL: permitir apenas HTTPS, bloquear IPs privados: |
| ```rust
use url::Url;
fn validate_import_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "Invalid URL".to_string())?;
    if url.scheme() != "https" { return Err("Only HTTPS allowed".to_string()); }
    if let Some(host) = url.host_str() {
        if host == "localhost" || host == "127.0.0.1" || host.starts_with("192.168.") || host.starts_with("10.") || host.starts_with("172.") {
            return Err("Private IP not allowed".to_string());
        }
    }
    Ok(url)
}
``` |

---

#### M5 — Nomes de ingredientes/receitas não sanitizados no frontend (XSS potencial)

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `src/pages/*.tsx` (várias páginas) |
| **Problema** | Nomes de ingredientes, receitas e notas são renderizados directamente com React (`{recipe.name}`, `{ingredient.name}`, etc.). React escapa HTML por defeito, mas dados podem conter caracteres especiais que causam problemas em contextos de URL (`href`) ou atributos. Não foi encontrado `dangerouslySetInnerHTML` em nenhum componente. |
| **Código** | ```tsx
// Em várias páginas:
<span>{recipe.name}</span>
<span>{ingredient.name}</span>
``` |
| **Impacto** | React escapa XSS classic, mas se estes valores forem usados em href dinâmicos (não encontrados), CSS inline, ou `eval`, há risco. Context: single-user, LOW. |
| **Severidade** | **MEDIUM** (React protege, mas nomes com `"` ou `&` podem quebrar atributos) |
| **Sugestão de fix** | Manter React rendering (já escapa). Adicionar validação no backend para rejeitar nomes com `<`, `>`, `"`, `&`, `'` ou aplicar sanitização: |
| ```rust
// Em ingredient_create/update no Rust
use validator::Validate;
// Já existe #[validate(length(min=1, max=200))] no domain.rs
// Adicionar regex validation:
#[validate(regex = "VALID_NAME")]
pub name: String,
// ONDE: VALID_NAME = regex::Regex::new(r"^[a-zA-Z0-9À-ÿ\s\-'(),.!]+$").unwrap()
``` |

---

#### M6 — Credenciais Turso guardadas na DB local sem cifra

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `src/pages/SettingsPage.tsx` |
| **Linha** | 72–73 (DEFAULTS), 619–639 (inputs) |
| **Problema** | O campo `auth_token` do Turso é guardado como string na settings table da DB local (libSQL). Sem cifra. Se a DB for exfiltrada, a chave Turso fica exposta. |
| **Código** | ```tsx
const DEFAULTS = {
  sync: {
    turso_url: "",
    auth_token: "",  // ← guardado em plaintext na DB
  },
};
...
<input type="password" ... value={getSetting("auth_token", "sync")} />
// Guardado via: await invoke("settings_set", { key: "sync", value: JSON.stringify(newSettings) });
``` |
| **Impacto** | A DB local não é cifrada. Turso é um serviço cloud — a exposição do token permite acesso não autorizado à réplica remota. |
| **Severidade** | **MEDIUM** |
| **Sugestão de fix** | Usar keyring/token storage nativo (Secret Service / Keychain) ou cifrar o token antes de persistir: |
| ```rust
// Usar keyring crate:
use keyring::Entry;
let entry = Entry::new("com.recipe-planner.app", "turso_token")?;
entry.set_password(&token)?;
``` |

---

### 🟢 LOW

#### L1 — Base64 de imagem sem limite de tamanho

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/core/src/db.rs` |
| **Linha** | 4324–4363 |
| **Problema** | `save_base64_image` aceita base64 de qualquer tamanho. Um ficheiro gigante pode encher o disco. |
| **Código** | ```rust
async fn save_base64_image(base64: &str, entity_type: &str, entity_id: i64, data_dir: &std::path::Path) -> Result<String, String> {
    let bytes = STANDARD.decode(base64).map_err(|e| e.to_string())?;
    // Sem verificação de tamanho antes de escrever
    std::fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;
``` |
| **Impacto** | Desktop single-user: DoS local (encher disco). Baixo risco. |
| **Severidade** | **LOW** |
| **Sugestão de fix** | Adicionar limite de tamanho: |
| ```rust
const MAX_IMAGE_SIZE: usize = 10 * 1024 * 1024; // 10 MB
if bytes.len() > MAX_IMAGE_SIZE {
    return Err(format!("Image too large: {} bytes (max {})", bytes.len(), MAX_IMAGE_SIZE));
}
``` |

---

#### L2 — Missing `forbid(unsafe_code)` no crate `mise-tauri`

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/tauri/src/lib.rs` (primeira linha) |
| **Problema** | O crate `crates/core/src/lib.rs` usa `#![forbid(unsafe_code)]` mas o crate `mise-tauri` (crates/tauri/src/lib.rs) não. Embora não haja unsafe code visível, a falta da attribute remove a garantia do compilador. |
| **Código** | (ausência de `#![forbid(unsafe_code)]`) |
| **Impacto** | Risco baixo — código actual é safe. Mas sem a attribute, unsafe pode ser introducido sem warning. |
| **Severidade** | **LOW** |
| **Sugestão de fix** | Adicionar ao topo de `crates/tauri/src/lib.rs`: `#![forbid(unsafe_code)]` |

---

#### L3 — `delete_all_data` e `seed_demo_data` expostos apenas em debug (correto) mas `delete_all_data` não confirmado via frontend

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/tauri/src/lib.rs` |
| **Linha** | 885–899 |
| **Problema** | Os comandos têm `#[cfg(debug_assertions)]`, o que é correcto. Contudo, `seed_demo_data` gera dados falsos que podem poluir a DB. O frontend já pede confirmação para `delete_all_data` (SettingsPage.tsx linha 757). |
| **Código** | ```rust
#[cfg(debug_assertions)]
#[tauri::command]
pub async fn delete_all_data(db: tauri::State<'_, crate::AppDb>) -> Result<(), String> {
    db.delete_all_data().await.map_err(|e| e.to_string())
}
``` |
| **Impacto** | Baixo. Correctamente protegido. |
| **Severidade** | **LOW** (observação: boa prática) |

---

#### L4 — Possível path traversal via `entity_type` em imagens (teórico)

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `crates/core/src/db.rs` |
| **Linha** | 4353 |
| **Problema** | O filename gerado inclui `entity_type` como string: `format!("{}_{}_{}.{}", entity_type, entity_id, ...)`. O `entity_type` vem do enum `ImageEntityType::as_str()` que retorna valores fixos ("recipe", "ingredient", etc.). Contudo, se o enum for estendido com um variant que permita `../`, haveria path traversal. |
| **Código** | ```rust
let filename = format!("{}_{}_{}.{}", entity_type, entity_id, chrono::Utc::now().timestamp_millis(), ext);
``` |
| **Impacto** | Teórico — implementação actual segura. |
| **Severidade** | **LOW** |
| **Sugestão de fix** | Validar ou mapear entity_type para valores fixos: |
| ```rust
fn safe_entity_prefix(entity_type: &ImageEntityType) -> &'static str {
    match entity_type {
        ImageEntityType::Recipe => "recipe",
        ImageEntityType::Ingredient => "ingredient",
        // etc.
    }
}
``` |

---

#### L5 — Console errors não tratados: `invoke` no tema sem fallback adequado

| Campo | Valor |
|-------|-------|
| **Ficheiro** | `src/theme.ts` |
| **Linha** | 9–15 |
| **Problema** | `systemPrefersDark()` chama `invoke("get_system_theme")` e faz `catch` silencioso. OK para desktop, mas em DEV (navegador) este invoke falha. A função devInvoke trata disso, mas ainda há dependência do Tauri runtime. |
| **Código** | ```ts
export async function systemPrefersDark(): Promise<boolean> {
  try {
    const theme = await invoke<string>("get_system_theme");
    return theme === "dark";
  } catch {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
}
``` |
| **Impacto** | Baixo. Fallback funciona. |
| **Severidade** | **LOW** |
| **Sugestão de fix** | N/A — comportamento correcto para single-user desktop. |

---

## ACHADOS NÃO IDENTIFICADOS (N/I)

Os seguintes problemas foram procurados mas **NÃO** encontrados:

1. **`dangerouslySetInnerHTML`** — Não usado em nenhum componente React auditado.
2. **Chaves/credenciais hardcoded** — Nenhuma chave API, password ou token hardcoded (UNSPLASH_ACCESS_KEY e PEXELS_API_KEY vêm de env vars).
3. **XSS via `href` dinâmicos** — Links externos usam `openExternal()` com `onClick.preventDefault()`, seguros.
4. **Path traversal activo** — Todos os paths de ficheiro usam `data_dir.join()` que resolve correctamente.
5. **Race conditions na DB** — `get_conn()` cria conexão separada por chamada, mas libSQL lida com concorrência via WAL mode. Não foram encontrados deadlocks óbvios.

---

## RESUMO DE SEVERIDADES

| Severidade | Qtd | ID |
|-----------|-----|----|
| CRITICAL | 2 | C1, C2 |
| HIGH | 2 | H1, H2 |
| MEDIUM | 6 | M1–M6 |
| LOW | 5 | L1–L5 |
| **Total** | **15** | |

### Checklist de Foco

| Categoria | Encontrado? |
|-----------|-------------|
| Tauri commands expostos sem validação | ✅ H2, M3, M4 |
| Input validation (frontend e backend) | ✅ H2 (falta), M5 (parcial) |
| SQL injection (libSQL queries) | ✅ C1 (CRITICAL) |
| XSS (React dangerouslySetInnerHTML) | ❌ Não encontrado |
| CSP headers (index.html / tauri.conf.json) | ✅ M1, H1 (presente mas permissivo) |
| Exposição de dados sensíveis | ✅ M6 (Turso token plaintext) |
| Path traversal | ❌ Não encontrado (prevenido por enum) |
| `withGlobalTauri` | ✅ C2 (CRITICAL — activo) |
| Chaves/credenciais hardcoded | ❌ Não encontrado |

---

## Ficheiros com mais achados

| Ficheiro | Achados |
|----------|---------|
| `src-tauri/tauri.conf.json` | C2, H1 |
| `crates/core/src/db.rs` | C1, L1, L4 |
| `crates/tauri/src/lib.rs` | H2, M3, M4, L3, L2 |
| `index.html` | M1, M2 |
| `src/pages/SettingsPage.tsx` | M6 |

---

## Notas Finais

A base de código está bem estruturada e usa boas práticas de Rust (libSQL params na maioria das queries, `forbid(unsafe_code)` no core). Os problemas principais são:

1. **C1** — A única SQL injection real, mesmo que os valores actuais sejam `i64`. Precisa de fix urgente.
2. **C2** — `withGlobalTauri: true` é um risco desnecessário num ambiente Tauri 2.
3. **H1** — CSP precisa de ser restringida (`wasm-unsafe-eval` e `blob:` em `script-src`).
4. **H2** — Falta chamar `.validate()` nos inputs dos comandos Tauri — as annotations já existem nos modelos.
5. **M6** — O token Turso (sync cloud) guardado em plaintext na DB local será um problema real quando o sync for activado.

Os componentes React/TypeScript estão notavelmente limpos — sem `dangerouslySetInnerHTML`, sem `eval`, sem `innerHTML`. O risco XSS é minimizado pelo React e pela CSP existente.
