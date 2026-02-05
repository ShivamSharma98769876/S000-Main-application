-- Optional migration to simplify daily_pnl by dropping legacy linkage columns.
-- After introducing daily_strategy_pnl as the primary source of P&L,
-- daily_pnl acts mainly as a source of Kite API credentials.
--
-- WARNING: This script will drop user_id, Z_client_id and Streatgy columns
-- from daily_pnl. Run only after you have updated the application code
-- and are sure you no longer depend on these columns.

ALTER TABLE daily_pnl
    DROP COLUMN IF EXISTS "user_id"    CASCADE,
    DROP COLUMN IF EXISTS "Z_client_id" CASCADE,
    DROP COLUMN IF EXISTS "Streatgy"    CASCADE;

