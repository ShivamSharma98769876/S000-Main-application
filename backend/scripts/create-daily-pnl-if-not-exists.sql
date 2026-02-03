-- Optional: create daily_pnl table if it doesn't exist.
-- You said no new table/migration needed; run this only if the table is missing.
-- Columns: user_id links to public.user_profiles.id; kite credentials and pnl.

CREATE TABLE IF NOT EXISTS daily_pnl (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    api_key VARCHAR(100),
    api_secret VARCHAR(255),
    access_token TEXT,
    pnl DECIMAL(18, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

COMMENT ON COLUMN daily_pnl.user_id IS 'Links to public.user_profiles.id';
COMMENT ON COLUMN daily_pnl.pnl IS 'Daily P&L from Kite trades for date';
