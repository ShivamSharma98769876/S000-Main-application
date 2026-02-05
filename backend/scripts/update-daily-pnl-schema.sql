-- Migration: Update daily_pnl table
-- - Keep user_id referencing user_profiles(id)
-- - Add Z_client_id (Zerodha client ID; no FK because user_profiles.zerodha_client_id can have duplicates)
-- - Add Streatgy referencing products(id)
-- - Replace UNIQUE(user_id, date) with UNIQUE(user_id, date, Z_client_id, Streatgy)

-- 1. Drop existing unique constraint on daily_pnl (name may vary)
ALTER TABLE daily_pnl DROP CONSTRAINT IF EXISTS daily_pnl_user_id_date_key;

-- 2. Add new columns (nullable for existing rows; set NOT NULL later if needed)
--    Use quoted names so PostgreSQL keeps Z_client_id and Streatgy as given.
ALTER TABLE daily_pnl
    ADD COLUMN IF NOT EXISTS "Z_client_id" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "Streatgy" INTEGER;

-- 3. Add foreign key: Streatgy -> products(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'daily_pnl_streatgy_fkey'
          AND conrelid = 'daily_pnl'::regclass
    ) THEN
        ALTER TABLE daily_pnl
        ADD CONSTRAINT daily_pnl_streatgy_fkey
        FOREIGN KEY ("Streatgy") REFERENCES products(id);
    END IF;
END $$;

-- 4. Add new unique constraint
ALTER TABLE daily_pnl
    ADD CONSTRAINT daily_pnl_user_id_date_key
    UNIQUE (user_id, date, "Z_client_id", "Streatgy");

-- Comments
COMMENT ON COLUMN daily_pnl.user_id IS 'References user_profiles(id)';
COMMENT ON COLUMN daily_pnl."Z_client_id" IS 'Zerodha client ID (logically from user_profiles.zerodha_client_id; no FK due to possible duplicates)';
COMMENT ON COLUMN daily_pnl."Streatgy" IS 'References products(id)';
