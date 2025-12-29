const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../config/logger');

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/tradingpro.db');

async function verifyMigration() {
    const db = new Database(DB_PATH);
    
    try {
        logger.info('Verifying SQLite migration...');

        // Check all tables exist
        const tables = [
            'users', 'user_profiles', 'products', 'carts', 'cart_items',
            'subscription_orders', 'subscription_order_items', 'subscriptions',
            'login_audit', 'system_config', 'session', 'offers', 'testimonials',
            'email_queue', 'error_logs', 'performance_metrics',
            'failed_login_attempts', 'system_alerts'
        ];

        const missingTables = [];
        for (const table of tables) {
            const result = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name=?
            `).get(table);
            
            if (!result) {
                missingTables.push(table);
            } else {
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                logger.info(`✓ ${table}: ${count.count} rows`);
            }
        }

        if (missingTables.length > 0) {
            logger.error(`Missing tables: ${missingTables.join(', ')}`);
            return false;
        }

        // Check foreign keys are enabled
        const fkEnabled = db.pragma('foreign_keys');
        if (fkEnabled === 0) {
            logger.warn('Foreign keys are not enabled!');
        } else {
            logger.info('✓ Foreign keys enabled');
        }

        // Check WAL mode
        const journalMode = db.pragma('journal_mode');
        logger.info(`✓ Journal mode: ${journalMode.mode}`);

        // Test a sample query
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        logger.info(`✓ Sample query successful: ${userCount.count} users found`);

        logger.info('✅ Migration verification completed successfully!');
        return true;
    } catch (error) {
        logger.error('❌ Verification failed:', error);
        return false;
    } finally {
        db.close();
    }
}

if (require.main === module) {
    verifyMigration()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            logger.error('❌ Verification error:', error);
            process.exit(1);
        });
}

module.exports = { verifyMigration };

