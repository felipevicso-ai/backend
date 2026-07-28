-- Tabela única de licenças da Onlive.
-- status possíveis: 'active' | 'expired' | 'cancelled'
CREATE TABLE IF NOT EXISTS licenses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL,
  license_key    TEXT    NOT NULL UNIQUE,
  plano          TEXT    NOT NULL CHECK (plano IN ('mensal', 'trimestral', 'anual')),
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  data_criacao   TEXT    NOT NULL,
  data_expiracao TEXT    NOT NULL,
  ultimo_acesso  TEXT,
  cakto_order_id TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_key ON licenses (license_key);
