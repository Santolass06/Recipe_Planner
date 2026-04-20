-- Migração 0001: Esquema inicial
-- Recipe Planner — criação de todas as tabelas base

PRAGMA foreign_keys = ON;

-- ─── Ingredientes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingredientes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT    NOT NULL,
    unidade     TEXT    NOT NULL DEFAULT 'unidade',  -- kg, g, l, ml, unidade, colher_sopa, colher_cha, chavena
    preco_atual REAL    NOT NULL DEFAULT 0.0,
    imagem_path TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Histórico de Preços ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS historico_precos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ingrediente_id  INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
    preco           REAL    NOT NULL,
    data            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Fornecedores (em revisão — pode ser removido na Fase 2) ─────────────────

CREATE TABLE IF NOT EXISTS fornecedores (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nome      TEXT NOT NULL,
    contacto  TEXT
);

CREATE TABLE IF NOT EXISTS precos_fornecedor (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ingrediente_id  INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
    fornecedor_id   INTEGER NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
    preco           REAL    NOT NULL,
    data            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Receitas ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS receitas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT    NOT NULL,
    categoria   TEXT,
    tags        TEXT    NOT NULL DEFAULT '[]',  -- JSON array: ["vegetariano", "rápido"]
    porcoes_base INTEGER NOT NULL DEFAULT 1,
    instrucoes  TEXT,
    imagem_path TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Receita ↔ Ingrediente ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS receita_ingredientes (
    receita_id      INTEGER NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
    ingrediente_id  INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE RESTRICT,
    quantidade      REAL    NOT NULL DEFAULT 1.0,
    PRIMARY KEY (receita_id, ingrediente_id)
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_historico_ingrediente ON historico_precos(ingrediente_id);
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_receita ON receita_ingredientes(receita_id);
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_ingrediente ON receita_ingredientes(ingrediente_id);

-- ─── Trigger: atualiza updated_at automaticamente ────────────────────────────

CREATE TRIGGER IF NOT EXISTS ingredientes_updated_at
    AFTER UPDATE ON ingredientes
    FOR EACH ROW
BEGIN
    UPDATE ingredientes SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS receitas_updated_at
    AFTER UPDATE ON receitas
    FOR EACH ROW
BEGIN
    UPDATE receitas SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ─── Trigger: guarda histórico de preço ao atualizar ingrediente ─────────────

CREATE TRIGGER IF NOT EXISTS historico_preco_on_update
    AFTER UPDATE OF preco_atual ON ingredientes
    FOR EACH ROW
    WHEN OLD.preco_atual != NEW.preco_atual
BEGIN
    INSERT INTO historico_precos (ingrediente_id, preco)
    VALUES (NEW.id, NEW.preco_atual);
END;
