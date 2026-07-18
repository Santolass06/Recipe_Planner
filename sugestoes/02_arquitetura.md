# Arquitetura — 5 → 10

1. Extrair db.rs por domínio (stock, recipes, ingredients, suppliers, events, reports) — 1 semana
2. Implementar `Unit::from_str()` + `Display` — elimina ~22 match blocks — 3h
3. Cortar camada `AppDb` (commands chamam core::db directamente) — 2h
4. Extrair `RecipesPage.tsx` >900 linhas em subcomponentes — 4h
5. `React.lazy()` no router — 1h
6. Error handling tipado (enum em vez de `Result<_, String>`) — 1 dia
