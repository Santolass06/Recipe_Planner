# Performance — 4.25 → 10

1. `React.lazy()` nas 15 páginas — 1h
2. Matar N+1 em `event_recipes_list`, `generate_shopping_list`, `receipt_confirm` — 4h
3. Adicionar `LIMIT` a queries públicas (recipes_list, etc.) — 30min
4. `setInterval` 1s → 30s no Layout — 5min
5. Combinar `get_recent_activity` 4 queries em 1 UNION ALL — 1h
6. Cache IPC: evitar invocar mesmos dados em páginas diferentes — 1 dia
