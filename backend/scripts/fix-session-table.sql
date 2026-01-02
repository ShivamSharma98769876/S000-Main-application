-- Fix session table for connect-pg-simple
-- This ensures ON CONFLICT works correctly

-- Drop existing table if it has issues (backup first if needed!)
-- DROP TABLE IF EXISTS session CASCADE;

-- Recreate session table with explicit unique constraint
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL,
    CONSTRAINT session_pkey PRIMARY KEY (sid),
    CONSTRAINT session_sid_unique UNIQUE (sid)
);

-- Create index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- Verify the structure
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints
WHERE table_name = 'session' 
AND table_schema = 'public';

