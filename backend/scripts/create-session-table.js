const { query } = require('../config/database');
const logger = require('../config/logger');

async function createSessionTable() {
    try {
        logger.info('Creating session table...');
        
        // Create session table with explicit unique constraint for connect-pg-simple
        // connect-pg-simple requires UNIQUE constraint for ON CONFLICT to work
        await query(`
            CREATE TABLE IF NOT EXISTS session (
                sid VARCHAR NOT NULL,
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL,
                CONSTRAINT session_pkey PRIMARY KEY (sid),
                CONSTRAINT session_sid_unique UNIQUE (sid)
            );
        `);
        
        // Create index for session expiration
        await query(`
            CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
        `);
        
        logger.info('✓ Session table created successfully');
        console.log('✅ Session table created successfully');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to create session table', error);
        console.error('❌ Failed to create session table:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    createSessionTable();
}

module.exports = { createSessionTable };


