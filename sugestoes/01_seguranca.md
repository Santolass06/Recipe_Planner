# Segurança — 6 → 10

1. `withGlobalTauri: false` (tauri.conf.json) — 5min
2. CSP restrita: remover `wasm-unsafe-eval`, `blob:` de `script-src` — 10min
3. Chamar `.validate()` nos inputs que têm `#[derive(Validate)]` — 30min
4. Adicionar meta CSP no index.html (defense-in-depth) — 5min
5. Remover `format!()` em queries SQL — usar prepared statements — 1h
6. Validar URL em `recipe_import_from_url` — 30min
7. Limitar upload imagem (tamanho/dimensão) — 30min
