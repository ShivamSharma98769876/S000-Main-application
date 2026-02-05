-- Create table to store per-account, per-strategy daily realised P&L
-- Data is derived from Kite trades (getTrades + getOrders) using tags as strategy codes.
-- Columns:
--   - date: trading date (YYYY-MM-DD)
--   - account_name: Name from Kite profile (user_name / user_shortname)
--   - kite_client_id: Kite / broker client ID (profile.user_id, e.g. "UK9394")
--   - strategy_code: Normalised strategy code from tag (e.g., "S001", "S002")
--   - pnl: Realised P&L for that strategy on that date
--   - trade_count: Number of trades contributing to that strategy P&L
--   - api_key, api_secret, access_token: Credentials used to fetch trades (for traceability)

CREATE TABLE IF NOT EXISTS daily_strategy_pnl (
    id SERIAL PRIMARY KEY,
    date        DATE      NOT NULL,
    account_name       TEXT,
    kite_client_id     VARCHAR(50),
    strategy_code      VARCHAR(32),
    pnl                DECIMAL(18, 2) DEFAULT 0,
    trade_count        INTEGER        DEFAULT 0,
    api_key            VARCHAR(100),
    api_secret         VARCHAR(255),
    access_token       TEXT,
    created_at         TIMESTAMP      DEFAULT NOW(),
    updated_at         TIMESTAMP      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_strategy_pnl_date ON daily_strategy_pnl(date);
CREATE INDEX IF NOT EXISTS idx_daily_strategy_pnl_account_date ON daily_strategy_pnl(kite_client_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_strategy_pnl_strategy_date ON daily_strategy_pnl(strategy_code, date);

