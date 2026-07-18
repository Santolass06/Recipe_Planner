# Auditoria de Dependências — Agente #1

**Projeto:** Recipe Planner (Mise) — Tauri 2 Desktop, ~20K LOC
**Data:** 2026-07-18
**Rating Global:** 5/10
**Risco:** Moderado

---

## Resumo Executivo

| Categoria | Achados | Severidade |
|-----------|---------|------------|
| Dependências não usadas | 8 | Média-Alta |
| Versões duplicadas no lock | 4 | Baixa |
| Feature flags desnecessárias | 1 | Baixa |
| Deprecações (chrono::Duration) | 10 ocorrências | Baixa |
| Dev-deps em prod | 0 | N/A |
| Versões RC/pré-release | 1 (specta) | Alta |
| Frontend ok | 0 achados | N/A |

---

## 1. DEPENDÊNCIAS RUST NÃO USADAS

### 1.1. `image = "0.25"` — NÃO USADA em nenhum crate
- **Ficheiro:** `Cargo.toml` (root):18, herdado por `crates/core/Cargo.toml`:15
- **Versão:** 0.25.10 (Cargo.lock:2486)
- **Problema:** A crate `image` está declarada no workspace e em mise-core, mas **nunca é importada** (`use image` ou `image::`) em qualquer ficheiro `.rs`. O código trata imagens via leitura/escrita de bytes crus com deteção de MIME type por magic bytes (JPEG/PNG/GIF/WEBP).
- **Severidade:** Média
- **Sugestão:** Remover do `[workspace.dependencies]` e de `crates/core/Cargo.toml`. Aumenta tempo de compilação em ~30-60s sem benefício.

### 1.2. `tauri-plugin-global-shortcut = "2"` — NÃO USADA em 2 crates
- **Ficheiros:**
  - `crates/tauri/Cargo.toml`:10
  - `src-tauri/Cargo.toml`:17
- **Versão:** resolvida mas nunca iniciada
- **Problema:** Declarada como dependência em **ambos** os crates, mas **zero** referências no código Rust: nem `use tauri_plugin_global_shortcut`, nem `plugin(tauri_plugin_global_shortcut::init())`. Dead weight.
- **Severidade:** Alta (código morto + compilação extra)
- **Sugestão:** Remover de ambos os `Cargo.toml`.

### 1.3. `serde_json` — NÃO USADA em mise-tauri e src-tauri
- **Ficheiros:**
  - `crates/tauri/Cargo.toml`:15 (workspace)
  - `src-tauri/Cargo.toml`:22 (workspace)
- **Problema:** `serde_json` é herdada do workspace em ambos os crates, mas **zero** ocorrências de `use serde_json` ou `serde_json::` em `crates/tauri/src/` ou `src-tauri/src/`.
- **Severidade:** Média
- **Sugestão:** Remover da secção `[dependencies]` destes dois crates. É usada apenas em `mise-core`.

### 1.4. `specta` e `ts-rs` — NÃO USADAS em mise-tauri
- **Ficheiro:** `crates/tauri/Cargo.toml`:17-18 (workspace)
- **Problema:** `specta` e `ts-rs` são herdadas do workspace em mise-tauri, mas **zero** uso de `specta::Type` ou `ts_rs::TS` no código de mise-tauri. As derives `#[derive(Type, TS)]` existem apenas em mise-core (domain.rs).
- **Severidade:** Média
- **Sugestão:** Remover de `crates/tauri/Cargo.toml`.

### 1.5. `tokio` — NÃO USADA em src-tauri
- **Ficheiro:** `src-tauri/Cargo.toml`:25 (workspace)
- **Problema:** `tokio` é herdada do workspace em src-tauri, mas **zero** uso no código de src-tauri (`src-tauri/src/lib.rs` e `main.rs`). O crate só chama `mise_tauri` e `tauri::*`.
- **Severidade:** Média-Baixa (tokio já está na árvore de deps por causa do tauri, mas a declaração explícita é enganosa)
- **Sugestão:** Remover de `src-tauri/Cargo.toml`.

### 1.6. `serde` — NÃO USADA em src-tauri (mas usada noutros)
- **Ficheiro:** `src-tauri/Cargo.toml`:21 (workspace)
- **Problema:** `serde` é herdada em src-tauri mas **zero** uso direto. Structs em src-tauri não usam `#[derive(Serialize, Deserialize)]` (não há structs de domínio aí, só código de arranque).
- **Severidade:** Baixa
- **Sugestão:** Remover de `src-tauri/Cargo.toml`.

---

## 2. VERSÕES DUPLICADAS NO CARGO.LOCK

### 2.1. `dirs` 5.0.1 + 6.0.0
- **Problema:** Workspace declara `dirs = "5"` → mise-core usa `dirs 5.0.1`. Tauri + tray-icon + wry puxam `dirs 6.0.0`. Duas versões no lock.
- **Severidade:** Baixa (cada versão ~2-3 ficheiros)
- **Sugestão:** Atualizar workspace para `dirs = "6"` para unificar. Verificar que `dirs::data_dir()` mantém comportamento compatível.

### 2.2. `base64` 0.21.7 + 0.22.1
- **Problema:** Workspace declara `base64 = "0.22"` → usado como 0.22.1. Alguma dep transitiva (provavelmente `tesseract` ou image) puxa 0.21.7.
- **Severidade:** Mínima
- **Sugestão:** Se a dep transitiva já atualizou, `cargo update` pode limpar. Caso contrário, aceitável.

### 2.3. `reqwest` 0.12.28 + 0.13.2
- **Problema:** Workspace declara `reqwest = "0.12"` → mise-core usa 0.12.28. Tauri 2.10.3 puxa **0.13.2** (linha 5492 do lock).
- **Severidade:** Baixa (2 versões compiladas)
- **Sugestão:** Considerar atualizar workspace para `reqwest = "0.13"` para unificar. Pode exigir ajuste de API.

### 2.4. `rand` 0.7.3 + 0.8.6 + 0.9.4
- **Problema:** Workspace declara `rand = "0.9"` → usado como 0.9.4. Várias deps transitivas puxam rand 0.7 e 0.8.
- **Severidade:** Mínima (comum em ecossistema Rust)
- **Sugestão:** Executar `cargo update` para ver se alguma dep já atualizou. Geralmente aceitável.

---

## 3. FEATURE FLAGS DESNECESSÁRIAS

### 3.1. Tokio feature `fs` não usada
- **Ficheiro:** `Cargo.toml` (root):13
- **Problema:** `tokio = { features = ["fs"] }` está declarado, mas **zero** código usa `tokio::fs::*`. Todo I/O de ficheiros usa `std::fs` (síncrono, o que é correto para operações de setup/export).
- **Severidade:** Baixa
- **Sugestão:** Remover `"fs"` de `features = [...]` em tokio.

### 3.2. Feature flags tokio usadas: `rt`, `macros`, `process`
- `rt` + `macros`: necessário para `#[tokio::test]` e `tokio::join!` (db.rs:4670, vários testes)
- `process`: necessário para `tokio::process::Command` (db.rs:4922 — tesseract OCR)
- **Conclusão:** Estas 3 estão corretas.

---

## 4. VERSÕES PRÉ-RELEASE / RC

### 4.1. `specta = "2.0.0-rc.25"`
- **Ficheiro:** `Cargo.toml` (root):16
- **Problema:** Dependência numa **release candidate**, não numa versão estável. Riscos: quebras de API em updates, bugs não detetados em produção, falta de garantias semver.
- **Severidade:** Alta
- **Sugestão:** Monitorizar o lançamento de specta 2.0.0 estável. Enquanto não sai, travar versão exacta no lock (já está). Considerar se specta é essencial — se só serve para gerar bindings TS, `ts-rs` já cobre isso.

---

## 5. DEPRECAÇÕES NO CÓDIGO

### 5.1. `chrono::Duration::days()` — 10 ocorrências
- **Ficheiro:** `crates/core/src/db.rs`
- **Linhas:** 2026, 2296, 2297, 2387, 3804, 3888, 3917, 3919, 3996, 4146, 4198, 4258
- **Problema:** `chrono::Duration::days()` foi **deprecado** em chrono 0.4.35 a favor de `TimeDelta::days()`. Em 0.4.44 (versão resolvida), compila com warnings.
- **Severidade:** Baixa (warnings de compilação, não quebra)
- **Sugestão:** Migrar para `chrono::TimeDelta::days()`.

---

## 6. SEGURANÇA E ESTABILIDADE DAS DEPS PRINCIPAIS

| Dependência | Versão | Estável? | Notas |
|------------|--------|----------|-------|
| tokio | 1.52.1 | ✅ | Latest stable series |
| serde | 1.0.228 | ✅ | Latest, inclui serde_core |
| serde_json | 1.0.149 | ✅ | Latest |
| libsql | 0.6.0 | ⚠️ | v0.6 — ainda pré-1.0, mas ativo |
| chrono | 0.4.44 | ✅ | Latest |
| validator | 0.18.1 | ✅ | Latest |
| specta | 2.0.0-rc.25 | ❌ | **RC, não estável** |
| tauri | 2.10.3 | ✅ | Latest Tauri 2.x |
| tauri-build | 2.5.6 | ✅ | Latest |
| tauri-plugins | 2.x | ✅ | Todos os plugins na 2.x |
| gtk | 0.18.2 | ⚠️ | gtk3-rs 0.18, funcional mas versão antiga |
| reqwest | 0.12.28 | ✅ | 0.13 já disponível |
| image | 0.25.10 | ✅ | **Não usada** |
| base64 | 0.22.1 | ✅ | Latest |
| rand | 0.9.4 | ✅ | 0.9 series |

---

## 7. FRONTEND (NPM)

### 7.1. Dependências de produção
| Pacote | Versão | Usada? | Notas |
|--------|--------|--------|-------|
| @tauri-apps/api | ^2 | ✅ | `theme.ts`, `devInvoke.ts` |
| react | ^19.0.0 | ✅ | tsx files |
| react-dom | ^19.0.0 | ✅ | Necessário com react |
| react-router-dom | ^7.0.0 | ✅ | Vários ficheiros |
| tesseract.js | ^7.0.0 | ✅ | `ReceiptScannerPage.tsx` |

**Conclusão:** Todas as deps frontend estão a ser usadas. Sem achados.

### 7.2. DevDependencies
| Pacote | Versão | Notas |
|--------|--------|-------|
| @tauri-apps/cli | ^2 | Correcto para build |
| @types/react | ^19.0.0 | Correcto |
| @types/react-dom | ^19.0.0 | Correcto |
| @vitejs/plugin-react | ^4.3.4 | Correcto |
| typescript | ^5.7.0 | Correcto |
| vite | ^6.0.0 | Correcto |

**Conclusão:** DevDependencies normais para um projeto Tauri + React + Vite.

---

## 8. EDITIONS RUST

| Crate | Edition |
|-------|---------|
| Root workspace | 2021 |
| mise-core | 2021 |
| mise-tauri | 2021 |
| mise (src-tauri) | 2021 |

**Conclusão:** Todas as crates usam edition 2021, o que é correto. Sem necessidade de migrar para 2024 (ainda instável).

---

## 9. LINHAS DE ACÇÃO PRIORITÁRIAS

### Imediatas (1-2 sprints)
1. **Remover `image` do workspace** — economia de 30-60s compilação
2. **Remover `tauri-plugin-global-shortcut`** de ambos os crates — código morto
3. **Migrar `chrono::Duration::days()`** → `chrono::TimeDelta::days()` — limpa warnings

### Curto prazo (2-4 sprints)
4. **Remover dependências não usadas** de `crates/tauri/Cargo.toml` e `src-tauri/Cargo.toml` (serde_json em ambos, specta/ts-rs em tauri, tokio/serde em src-tauri)
5. **Atualizar `specta`** para stable quando lançado, ou reavaliar necessidade
6. **Subir `dirs` para `"6"`** no workspace para unificar com tauri

### Oportunidades
7. **Subir `reqwest` para `"0.13"`** para unificar com tauri
8. **Remover feature flag `fs` do tokio** no workspace
9. Executar `cargo update` para limpar versões duplicadas residuais

---

## Rating Final: 5 / 10

**Justificação:**
- +2: Dependências não usadas = peso morto na compilação e manutenção
- -1: `specta` em RC é risco para produção comercial
- -1: Duplicação de versões (dirs, reqwest, base64) aumenta tempo de compilação
- -1: Warnings de deprecação (chrono) indicam falta de hygiene
- = 5

**Recuperável para 7-8** com uma sprint de limpeza.
