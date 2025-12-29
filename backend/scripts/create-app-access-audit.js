const { query } = require('../config/database');
const logger = require('../config/logger');

async function createAppAccessAuditTable() {
    try {
        logger.info('Creating app_access_audit table...');

        await query(`
            CREATE TABLE IF NOT EXISTS app_access_audit (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                source_app VARCHAR(50) NOT NULL,
                target_app VARCHAR(50) NOT NULL,
                token_id VARCHAR(255),
                action VARCHAR(50) DEFAULT 'token_generated',
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_app_access_user ON app_access_audit(user_id);
            CREATE INDEX IF NOT EXISTS idx_app_access_created ON app_access_audit(created_at);
        `);

        logger.info('✓ app_access_audit table created successfully');
        console.log('✅ App Access Audit table created successfully');
        process.exit(0);

    } catch (error) {
        logger.error('Failed to create app_access_audit table', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    createAppAccessAuditTable();
}

module.exports = { createAppAccessAuditTable };

