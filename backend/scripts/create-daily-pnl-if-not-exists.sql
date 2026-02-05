-- Optional: create daily_pnl table if it doesn't exist.
-- Columns: user_id -> user_profiles(id); Z_client_id = Zerodha client ID (no FK; zerodha_client_id can have duplicates); Streatgy -> products(id).

CREATE TABLE IF NOT EXISTS daily_pnl (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    "Z_client_id" VARCHAR(50),
    "Streatgy" INTEGER REFERENCES products(id),
    api_key VARCHAR(100),
    api_secret VARCHAR(255),
    access_token TEXT,
    pnl DECIMAL(18, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date, "Z_client_id", "Streatgy")
);

COMMENT ON COLUMN daily_pnl.user_id IS 'References user_profiles(id)';
COMMENT ON COLUMN daily_pnl."Z_client_id" IS 'Zerodha client ID (logically from user_profiles.zerodha_client_id)';
COMMENT ON COLUMN daily_pnl."Streatgy" IS 'References products(id)';
COMMENT ON COLUMN daily_pnl.pnl IS 'Daily P&L from Kite trades for date';
