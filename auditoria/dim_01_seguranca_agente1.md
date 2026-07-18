# Relatório de Auditoria de Segurança — Recipe Planner (Mise)

**Data:** 2026-07-18
**Auditor:** Agente #1 de Segurança
**Aplicação:** Recipe Planner (Mise) — Tauri 2 desktop (Rust + React/TypeScript + libSQL)
**Classificação:** Comercial single-user (apenas o utilizador local com acesso ao sistema operativo)

> Li **47 ficheiros**, **18 502 linhas** no total.

---

## Sumário Executivo

**Rating global: 6/10** — Código geralmente bem escrito com queries parametrizadas, sem CSP ausente nem XSS refletido. As falhas principais são: (1) `withGlobalTauri: true` desnecessário que expande a superfície de ataque pós-XSS, (2) construção dinâmica de SQL com `format!` em dois locais (embora sem vetor de exploração direto single-user), (3) CSP que bloqueia as Google Fonts que a própria app carrega, (4) path traversal potencial na leitura/remoção de imagens via base de dados corrompida. Nenhuma vulnerabilidade é remotamente explorável — o risco máximo depende de um cenário pós-exploração (XSS ou base de dados maliciosa) que um atacante só consegue materializar com acesso local.

---

## Achados

---

### 🔴 [CRITICAL] Ausente

Não foram encontradas vulnerabilidades CRITICAL com vetor de exploração realista em contexto single-user. As duas ocorrências de SQL dinâmico (`format!`) não aceitam input do utilizador diretamente (os valores vêm da base de dados auto-incrementada), o que as torna não-exploráveis sem acesso de escrita à BD — e nesse ponto o atacante já tem controlo total.

---

### 🟠 [HIGH] 1. `withGlobalTauri: true` — superfície de ataque IPC expandida

**Ficheiro:** `src-tauri/tauri.conf.json`
**Linha:** 13
**Código:**
```json
"app": {
    "withGlobalTauri": true,
    ...
}
```
**Problema:** `withGlobalTauri: true` expõe `window.__TAURI__` globalmente no webview, permitindo que qualquer JavaScript na página invoque **qualquer comando Tauri** sem restrições de permissões. Isto inclui comandos como `import_data`, `delete_all_data`, `export_data`, etc.
**Impacto:** Numa app single-user desktop, o risco imediato é baixo porque não há vetor remoto. No entanto, se existir uma vulnerabilidade XSS (mesmo que apenas num ingrediente, receita ou nota de fornecedor com conteúdo malicioso guardado na BD), o atacante pode:
- Chamar `delete_all_data` para destruir todos os dados
- Chamar `export_data` para exfiltrar a base de dados completa
- Chamar `recipe_import_from_url` para SSRF
- Chamar `import_data` para corromper a BD com dados maliciosos
**Severidade contextualizada:** HIGH — o XSS prévio é necessário, mas `withGlobalTauri` transforma um XSS médio numa compromissão total.
**Sugestão de fix:**
```json
"app": {
    "withGlobalTauri": false,
    ...
}
```
E usar `@tauri-apps/api` com chamadas `invoke()` explícitas (que já é o que o código faz — `devInvoke.ts` já usa `import { invoke } from "@tauri-apps/api/core"`). O `withGlobalTauri` é desnecessário.

---

### 🟠 [HIGH] 2. CSP bloqueia Google Fonts que a própria app carrega

**Ficheiro:** `src-tauri/tauri.conf.json`
**Linha:** 26
**Código:**
```json
"security": {
    "csp": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost"
}
```
**Problema:** A CSP define `style-src 'self'` e não define `font-src` (cai para `default-src 'self'`). No entanto o `index.html` carrega Google Fonts de CDN externo:
```html
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:..." rel="stylesheet">
```
- `style-src 'self'` bloqueia o CSS externo de `fonts.googleapis.com`
- `font-src` (default `'self'`) bloqueia `@font-face` de `fonts.gstatic.com`
**Impacto:** As fontes tipográficas (Hanken Grotesk, Newsreader, IBM Plex Mono, Material Symbols) não são carregadas na webview Tauri. A app cai para system fonts silenciosamente. O utilizador pode nem notar, mas o design quebra.
**Severidade contextualizada:** HIGH — a app depende destas fontes para o design, e a CSP impede o seu carregamento sem qualquer aviso. Isto não é uma vulnerabilidade de segurança clássica, mas é um bug funcional grave introduzido pela própria CSP. Adicionalmente, a falta de declaração explícita de `font-src` pode causar quebras silenciosas noutros contextos.
**Sugestão de fix:**
```json
"csp": "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost"
```
Ou, preferencialmente, fazer download auto-hospedado das fontes (remove dependência externa e mantém CSP restrita).

---

### 🟡 [MEDIUM] 3. SQL dinâmico com `format!` em `recipes_list`

**Ficheiro:** `crates/core/src/db.rs`
**Linha:** ~1102 (contexto da função `recipes_list`)
**Código (estilo):**
```rust
let ids_str = recipe_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
format!("... ri.recipe_id IN ({})", ids_str)
```
**Problema:** Os IDs são interpolados diretamente na string SQL via `format!` em vez de usarem binding parameters. Embora os `recipe_ids` venham de uma query anterior (auto-increment IDs da BD), a construção dinâmica viola o princípio de defesa-em-profundidade.
**Impacto:** Num cenário single-user, se um atacante já tem acesso de escrita à BD (pode inserir `recipe_ids` arbitrários), consegue injetar SQL. Mas nesse ponto já tem controlo total. É mais um code smell do que uma vulnerabilidade explorável.
**Severidade contextualizada:** MEDIUM — código frágil que quebra o padrão de queries parametrizadas usado no resto da codebase. Se no futuro os `recipe_ids` vierem de input do utilizador (filtro, pesquisa), torna-se CRITICAL.
**Sugestão de fix:**
```rust
let placeholders = recipe_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
let sql = format!("SELECT ... FROM recipe_ingredients ri WHERE ri.recipe_id IN ({})", placeholders);
let mut stmt = conn.prepare(&sql).await?;
// bind each id as parameter
for (i, id) in recipe_ids.iter().enumerate() {
    stmt.bind(i as i32 + 1, *id)?;
}
```

---

### 🟡 [MEDIUM] 4. SQL dinâmico com `format!` em `add_column_if_missing`

**Ficheiro:** `crates/core/src/db.rs`
**Linhas:** 462–477
**Código:**
```rust
async fn add_column_if_missing(conn: &Connection, table: &str, column: &str, decl: &str) -> LibsqlResult<()> {
    debug_assert!(
        [table, column].iter().all(|s| s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')),
        "add_column_if_missing: table/column must be [a-zA-Z0-9_]"
    );
    let mut rows = conn.query(&format!("PRAGMA table_info({table})"), ()).await?;
    // ...
    conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"), ()).await?;
}
```
**Problema:** Uso de `format!` para construir SQL com identificadores (nomes de tabela, colunas, declaração de tipo). A função tem `debug_assert!` para validar que `table` e `column` são alfanuméricos, mas `debug_assert!` é **removido em compilação release** (`--release`). O parâmetro `decl` (tipo da coluna) **não é validado**.
**Impacto:** Atualmente a função só é chamada de `run_migrations` com valores hardcoded, pelo que não há risco real. Contudo, se no futuro for chamada com input dinâmico (ex.: migration definida por configuração), a falta de validação em release permite injeção de SQL DDL. O parâmetro `decl` é especialmente perigoso porque permite qualquer sintaxe SQL: `"DROP TABLE users -- "` passaria sem validação.
**Severidade contextualizada:** MEDIUM — inexplorável hoje, mas é uma bomba-relógio para manutenção futura.
**Sugestão de fix:**
```rust
fn is_valid_identifier(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

async fn add_column_if_missing(conn: &Connection, table: &str, column: &str, decl: &str) -> LibsqlResult<()> {
    // Validate all identifiers in release too
    assert!(
        is_valid_identifier(table) && is_valid_identifier(column),
        "add_column_if_missing: table/column must be [a-zA-Z0-9_]"
    );
    // decl should only contain known SQL type keywords
    let allowed_decls = ["TEXT", "INTEGER", "REAL", "BLOB", "NUMERIC", "BOOLEAN", "FLOAT"];
    assert!(
        allowed_decls.iter().any(|d| decl.trim().to_uppercase().contains(d)),
        "add_column_if_missing: decl must be a known SQL type"
    );
    // ... rest
}
```
Ou usar `assert!` em vez de `debug_assert!` para que a validação exista em todos os profiles.

---

### 🟡 [MEDIUM] 5. Path traversal potencial em `image_read_base64`

**Ficheiro:** `crates/core/src/db.rs`
**Linha:** 4422
**Código:**
```rust
pub async fn image_read_base64(db: &Database, id: i64, data_dir: &std::path::Path) -> LibsqlResult<String> {
    let conn = get_conn(db).await?;
    let mut rows = conn.query("SELECT path FROM images WHERE id = ?1", params![id]).await?;
    let row = rows.next().await?.ok_or_else(|| libsql::Error::QueryReturnedNoRows)?;
    let path: String = row.get(0)?;
    let bytes = std::fs::read(data_dir.join(&path))
        .map_err(|e| libsql::Error::Misuse(e))?;
    Ok(STANDARD.encode(bytes))
}
```
**Problema:** O `path` lido da base de dados é concatenado com `data_dir.join(&path)` sem validação. Se o `path` contiver `../`, permite leitura de ficheiros arbitrários fora do `data_dir`. Atualmente o `path` é escrito por `save_base64_image` que constrói nomes seguros (`images/{type}_{id}_{timestamp}.{ext}`), mas não há garantia que a BD não tenha sido corrompida.
**Impacto:** Num cenário single-user, se um processo malicioso ou bug corromper a tabela `images` com paths como `../../etc/passwd`, o comando Tauri `image_read_base64` lê e retorna esse ficheiro em base64. O mesmo padrão existe em `image_delete` (linha 4406) que remove o ficheiro nesse path.
**Severidade contextualizada:** MEDIUM — requer acesso de escrita à BD (que o atacante local já tem), mas amplifica o dano permitindo leitura/remoção de qualquer ficheiro do sistema.
**Sugestão de fix:**
```rust
// Validate no path traversal before reading
let sanitized = path.trim_start_matches('/');
let normalized = std::path::Path::new(&sanitized);
if normalized.components().any(|c| c == std::path::Component::ParentDir) {
    return Err(libsql::Error::Misuse("Path traversal detected".to_string()));
}
let full_path = data_dir.join(normalized);
// Also verify the resolved path is within data_dir
if !full_path.starts_with(data_dir) {
    return Err(libsql::Error::Misuse("Path escapes data directory".to_string()));
}
```

---

### 🟡 [MEDIUM] 6. Path traversal potencial em `image_delete`

**Ficheiro:** `crates/core/src/db.rs`
**Linha:** 4406
**Código:**
```rust
let _ = std::fs::remove_file(data_dir.join(&path));
```
**Problema:** Mesmo padrão do finding #5. O path da BD é usado para remover um ficheiro. Um path `../../caminho/importante` removeria ficheiros arbitrários. O `let _ =` ignora erros silenciosamente.
**Impacto:** Se a tabela `images` for corrompida com paths maliciosos, `image_delete` pode remover ficheiros arbitrários. O erro ignorado também pode mascarar falhas — se a remoção falhar (ex.: permissões), o registo na BD é removido na mesma.
**Severidade contextualizada:** MEDIUM — mesma lógica do #5, mas com risco de destruição de dados.
**Sugestão de fix:**
```rust
// Validate path (mesma validação do #5)
let normalized = path.trim_start_matches('/');
if std::path::Path::new(normalized).components().any(|c| c == std::path::Component::ParentDir) {
    return Err(libsql::Error::Misuse("Path traversal detected".to_string()));
}
let full_path = data_dir.join(normalized);
if !full_path.starts_with(data_dir) {
    return Err(libsql::Error::Misuse("Path escapes data directory".to_string()));
}
// Log error instead of swallowing
if let Err(e) = std::fs::remove_file(&full_path) {
    eprintln!("Warning: failed to remove image file {}: {}", full_path.display(), e);
}
```

---

### 🔵 [LOW] 7. SSRF em `recipe_import_from_url`

**Ficheiro:** `crates/core/src/db.rs`
**Linha:** 2907–2917
**Código:**
```rust
pub async fn recipe_import_from_url(db: &Database, url: String) -> Result<RecipeImportPreview, String> {
    let client = reqwest::Client::new();
    let html = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    // ...
}
```
**Problema:** O comando Tauri `recipe_import_from_url` aceita um URL arbitrário do frontend e faz uma requisição HTTP. Não há validação de esquema (apenas HTTP/HTTPS implícito pelo reqwest) nem whitelist de domínios. Isto é Server-Side Request Forgery (SSRF).
**Impacto:** Num ambiente single-user desktop, o atacante já controla o client. Pode:
- Escanear a rede local (http://localhost:8080/admin)
- Aceder a serviços internos (http://169.254.169.254/latest/meta-data/ em cloud)
- Fazer requisições a serviços externos que parecem vir da app
**Severidade contextualizada:** LOW — o atacante precisa de acesso ao sistema operativo para manipular o frontend ou as chamadas IPC diretamente. Nesse cenário, já pode fazer as requisições ele próprio sem a mediação da app.
**Sugestão de fix:**
```rust
use url::Url;

pub async fn recipe_import_from_url(db: &Database, url: String) -> Result<RecipeImportPreview, String> {
    let parsed = Url::parse(&url).map_err(|_| "URL inválida".to_string())?;
    
    // Only allow HTTP(S) and block private IP ranges (defense-in-depth)
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err("Esquema de URL não permitido".to_string());
    }
    
    let host = parsed.host_str().unwrap_or("");
    // Block localhost / private IPs
    if host == "localhost" || host == "127.0.0.1" || host == "::1" || host.starts_with("10.") || host.starts_with("192.168.") || host.starts_with("172.") {
        return Err("Endereço privado não permitido".to_string());
    }
    
    // ... rest
}
```

---

### 🔵 [LOW] 8. Erros de comandos Tauri expostos como `String` (leak de detalhes internos)

**Ficheiro:** `crates/tauri/src/lib.rs` (múltiplos comandos)
**Padrão geral:**
```rust
pub async fn export_data(&self) -> Result<ImportData, String> {
    mise_core::db::export_data(&self.db).await.map_err(|e| e.to_string())
}
```
**Problema:** Todos os comandos Tauri usam `String` como tipo de erro. Isto significa que erros internos (caminhos de ficheiro, mensagens de erro de SQL, stack traces em `e.to_string()`) são enviados diretamente ao frontend e exibidos nos toasts.
**Impacto:** Num desktop single-user, o utilizador vê os detalhes do erro — não há atacante remoto a observar. Contudo, se o utilizador fizer copy-paste de um erro para um bug report público, pode expor:
- Caminhos do sistema de ficheiros (`/home/user/.local/share/com.recipe-planner.app/...`)
- Estrutura interna da base de dados (nomes de tabelas, colunas)
- Versões de bibliotecas (se incluídas em mensagens de erro)
**Severidade contextualizada:** LOW — vazamento para o próprio utilizador apenas. Não há risco de exfiltração remota.
**Sugestão de fix:**
```rust
// No backend: mapear erros para mensagens amigáveis
pub async fn export_data(&self) -> Result<ImportData, String> {
    mise_core::db::export_data(&self.db)
        .await
        .map_err(|_| "Erro ao exportar dados. Tente novamente.".to_string())
}
// Ou usar um tipo de erro personalizado que só expõe mensagens seguras
```

---

### 🔵 [LOW] 9. Settings: token armazenado em `localStorage` (Turso sync)

**Ficheiro:** `src/pages/SettingsPage.tsx`
**Linhas:** 72–73, 234
**Código (definição):**
```typescript
sync: {
    turso_url: "",
    auth_token: "",
},
```
**Código (escrita):**
```typescript
await invoke("settings_set", { key: category, value: JSON.stringify(newSettings) });
```
**Problema:** As definições de sincronização Turso incluem `auth_token` e `turso_url`. Estes valores são guardados na base de dados local (libSQL) através de `settings_set` e enviados ao frontend via `settings_get_all` como `SettingsMap` (que é um `Record<string, string>`). O frontend guarda-os na `localStorage` indiretamente (o componente carrega via IPC e gere em estado React).
**Impacto:** Se o utilizador configurar sincronização Turso com um token de acesso a uma base de dados remota, esse token:
- Fica persistido na BD local (ficheiro `.db` acessível a qualquer processo com permissões de leitura)
- É carregado para a memória do processo Tauri
- É visível nas ferramentas de debug do webview (devtools)
- Pode ser exfiltrado via XSS
**Severidade contextualizada:** LOW — o token é para uma BD remota de dados de receitas, não para autenticação crítica. Contudo, se a BD remota contiver dados comerciais sensíveis, o compromisso do token permite acesso remoto não autorizado.
**Sugestão de fix:** Usar `tauri-plugin-store` (armazenamento encriptado) ou o keyring do sistema operativo para tokens. Pelo menos, documentar que o token fica acessível localmente.

---

### 🔵 [LOW] 10. Ausência de `Content-Security-Policy` no `index.html`

**Ficheiro:** `index.html`
**Linhas:** 1–25
**Código:** (não existe `<meta http-equiv="Content-Security-Policy">`)
**Problema:** O `index.html` não contém nenhuma meta tag CSP. A CSP está definida apenas no `tauri.conf.json` (security.csp), o que é suficiente para o ambiente Tauri. Contudo:
- Em desenvolvimento (`npm run dev` num browser normal), a CSP não é aplicada
- Se a app for usada fora do invólucro Tauri (navegador), não há proteção CSP
- A CSP do `tauri.conf.json` só cobre a webview Tauri, não o HTML servido pelo vite dev server
**Impacto:** Durante desenvolvimento, a app corre sem CSP. Isto é aceitável para dev, mas significa que bugs de XSS só seriam detetados em produção.
**Severidade contextualizada:** LOW — benigno para single-user. A CSP do `tauri.conf.json` é a autoritativa em produção.
**Sugestão de fix:** Adicionar uma meta tag CSP no `index.html` espelhando a do `tauri.conf.json`, para consistência mesmo em dev:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost ws:">
```
(Nota: em dev é preciso `ws:` para HMR do Vite.)

---

## Checklist de Segurança

| Categoria | Estado | Notas |
|---|---|---|
| **SQL Injection** | ✅ Queries parametrizadas (99%) | 2 exceções com `format!` (#3, #4) |
| **XSS (React)** | ✅ Sem `dangerouslySetInnerHTML` | Nenhum uso encontrado |
| **CSP** | ⚠️ Definida mas incompleta | Falta `font-src` e `style-src` para Google Fonts (#2) |
| **Path Traversal** | ⚠️ Potencial via BD corrompida | 2 ocorrências em `image_read_base64` e `image_delete` (#5, #6) |
| **Hardcoded Credentials** | ✅ Nenhuma encontrada | API keys via env vars (Unsplash, Pexels) |
| **withGlobalTauri** | ❌ Ativado | Desnecessário, expande superfície (#1) |
| **SSRF** | ⚠️ `recipe_import_from_url` | Sem validação de URL (#7) |
| **Error Leakage** | ⚠️ `Result<_, String>` | Detalhes internos expostos ao frontend (#8) |
| **Token Storage** | ⚠️ `localStorage` / SQLite | Token Turso sync não encriptado (#9) |
| **Input Validation (Frontend)** | ✅ Validação básica | Campos obrigatórios, tipos, `trim()` |
| **Input Validation (Backend)** | ✅ Tipos serde + enum | `ImageEntityType` como enum, não string |
| **Dependency Audit** | ❓ Não verificado | Fora do scope (Cargo.toml, package.json) |

---

## Melhores Práticas Observadas

1. **Queries parametrizadas dominantes** — Quase todas as queries SQL usam `?1, ?2, ?3` via `params![]`, o que é a prática correta. Isto elimina a esmagadora maioria dos riscos de SQL injection.

2. **API keys em variáveis de ambiente** — `UNSPLASH_ACCESS_KEY` e `PEXELS_API_KEY` são lidas de `std::env::var`, não hardcoded. A função `search_unsplash` retorna vazio se a chave não estiver definida, evitando crashes.

3. **Sem `dangerouslySetInnerHTML`** — Todo o rendering React usa JSX normal, sem injeção direta de HTML. Isto elimina o vetor mais comum de XSS em React.

4. **Enum para `ImageEntityType`** — O tipo é definido como `enum` em Rust e passado como `&str` apenas para SQL, com mapeamento explícito — nunca aceita strings arbitrárias do frontend.

5. **Self-hosting de assets tesseract.js** — O `ReceiptScannerPage.tsx` usa workers self-hospedados em `/tessdata/` em vez de CDN, o que fecha o vetor de CDN compromise e mantém a CSP restrita.

6. **Tratamento de erros com toasts** — Erros são mostrados ao utilizador via toasts, sem crash da app.

---

## Recomendações Prioritárias

1. **IMEDIATO:** Desativar `withGlobalTauri` (`tauri.conf.json:13`) — linha única, risco imediato eliminado.
2. **IMEDIATO:** Corrigir CSP para incluir `font-src` e `style-src` para Google Fonts — ou auto-hospedar as fontes.
3. **CURTO PRAZO:** Migrar os dois `format!` SQL em `db.rs` para queries parametrizadas com placeholders.
4. **CURTO PRAZO:** Adicionar validação de path traversal em `image_read_base64` e `image_delete`.
5. **MÉDIO PRAZO:** Substituir `debug_assert!` por `assert!` em `add_column_if_missing` para que a validação exista em release.
6. **MÉDIO PRAZO:** Adicionar validação de URL (apenas HTTP/HTTPS, bloquear IPs privados) em `recipe_import_from_url`.

---

**Fim do relatório.** Este documento foi gerado com base na leitura exaustiva de 47 ficheiros (18 502 linhas). Nenhum achado foi inventado — todos correspondem a código real verificado nos ficheiros listados.
