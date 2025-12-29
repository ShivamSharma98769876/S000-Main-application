const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// PostgreSQL connection
const pgPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'tradingpro',
    password: process.env.DB_PASSWORD || 'Itsme123',
    port: parseInt(process.env.DB_PORT) || 5432,
});

const EXPORT_DIR = path.join(__dirname, '../../data/postgres-export');

// Ensure export directory exists
if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

async function exportTable(tableName, query) {
    try {
        logger.info(`Exporting ${tableName}...`);
        const result = await pgPool.query(query);
        
        const filePath = path.join(EXPORT_DIR, `${tableName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(result.rows, null, 2));
        
        logger.info(`✓ Exported ${result.rows.length} rows from ${tableName}`);
        return result.rows.length;
    } catch (error) {
        logger.error(`Error exporting ${tableName}:`, error);
        throw error;
    }
}

async function exportAllData() {
    try {
        logger.info('Starting PostgreSQL data export...');

        const tables = [
            { name: 'users', query: 'SELECT * FROM users ORDER BY id' },
            { name: 'user_profiles', query: 'SELECT * FROM user_profiles ORDER BY user_id' },
            { name: 'products', query: 'SELECT * FROM products ORDER BY id' },
            { name: 'carts', query: 'SELECT * FROM carts ORDER BY id' },
            { name: 'cart_items', query: 'SELECT * FROM cart_items ORDER BY id' },
            { name: 'subscription_orders', query: 'SELECT * FROM subscription_orders ORDER BY id' },
            { name: 'subscription_order_items', query: 'SELECT * FROM subscription_order_items ORDER BY id' },
            { name: 'subscriptions', query: 'SELECT * FROM subscriptions ORDER BY id' },
            { name: 'login_audit', query: 'SELECT * FROM login_audit ORDER BY id' },
            { name: 'system_config', query: 'SELECT * FROM system_config ORDER BY config_key' },
            { name: 'session', query: 'SELECT * FROM session ORDER BY sid' },
            { name: 'offers', query: 'SELECT * FROM offers ORDER BY id' },
            { name: 'testimonials', query: 'SELECT * FROM testimonials ORDER BY id' },
            { name: 'email_queue', query: 'SELECT * FROM email_queue ORDER BY id' },
            { name: 'error_logs', query: 'SELECT * FROM error_logs ORDER BY id' },
            { name: 'performance_metrics', query: 'SELECT * FROM performance_metrics ORDER BY id' },
            { name: 'failed_login_attempts', query: 'SELECT * FROM failed_login_attempts ORDER BY id' },
            { name: 'system_alerts', query: 'SELECT * FROM system_alerts ORDER BY id' },
        ];

        let totalRows = 0;
        for (const table of tables) {
            try {
                const count = await exportTable(table.name, table.query);
                totalRows += count;
            } catch (error) {
                logger.warn(`Skipping ${table.name} (table may not exist):`, error.message);
            }
        }

        // Create metadata file
        const metadata = {
            exportDate: new Date().toISOString(),
            totalRows,
            tables: tables.map(t => t.name),
        };
        fs.writeFileSync(
            path.join(EXPORT_DIR, 'metadata.json'),
            JSON.stringify(metadata, null, 2)
        );

        logger.info(`✅ Export completed! Total rows: ${totalRows}`);
        logger.info(`Export directory: ${EXPORT_DIR}`);
        
        return { totalRows, exportDir: EXPORT_DIR };
    } catch (error) {
        logger.error('❌ Export failed:', error);
        throw error;
    } finally {
        await pgPool.end();
    }
}

if (require.main === module) {
    exportAllData()
        .then(() => {
            logger.info('✅ Data export completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Export failed:', error);
            process.exit(1);
        });
}

module.exports = { exportAllData };

