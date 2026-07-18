# Dependências — 6 → 10

1. Remover `image = "0.25"` (não usada, 3MB+) — 5min
2. Mudar `specta 2.0.0-rc.25` para stable — 5min
3. Resolver `reqwest` duplicado (0.12.28 + 0.13.2) no lock — 10min
4. Remover `dirs 5.0.1` duplicado — usar só 6.0.0 — 5min
5. Remover `tauri-plugin-global-shortcut` se não usado — 5min
6. Remover features não usadas (tokio fs, process) — 5min
