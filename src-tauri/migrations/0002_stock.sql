-- Migração 0002: Tabela de stock / armazém

CREATE TABLE IF NOT EXISTS stock (
    ingrediente_id          INTEGER PRIMARY KEY REFERENCES ingredientes(id) ON DELETE CASCADE,
    quantidade_disponivel   REAL NOT NULL DEFAULT 0.0,
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_ingrediente ON stock(ingrediente_id);
