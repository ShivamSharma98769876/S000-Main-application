const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/tradingpro.db');
const EXPORT_DIR = path.join(__dirname, '../../data/postgres-export');

if (!fs.existsSync(DB_PATH)) {
    logger.error(`SQLite database not found at ${DB_PATH}. Please run migrate-sqlite-schema.js first.`);
    process.exit(1);
}

if (!fs.existsSync(EXPORT_DIR)) {
    logger.error(`Export directory not found at ${EXPORT_DIR}. Please run export-postgres-data.js first.`);
    process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Helper to convert PostgreSQL types to SQLite-compatible values
function convertValue(value, columnType) {
    if (value === null) return null;
    
    // Handle boolean
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    
    // Handle dates
    if (value instanceof Date) {
        return value.toISOString();
    }
    
    // Handle JSON/JSONB
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    
    return value;
}

async function importTable(tableName, columns) {
    try {
        const filePath = path.join(EXPORT_DIR, `${tableName}.json`);
        
        if (!fs.existsSync(filePath)) {
            logger.warn(`Skipping ${tableName} (file not found)`);
            return 0;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (data.length === 0) {
            logger.info(`Skipping ${tableName} (no data)`);
            return 0;
        }

        logger.info(`Importing ${data.length} rows into ${tableName}...`);

        // Get column names from first row
        const columnNames = Object.keys(data[0]);
        const placeholders = columnNames.map(() => '?').join(', ');
        const columnList = columnNames.join(', ');

        const insert = db.prepare(`INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`);
        const insertMany = db.transaction((rows) => {
            for (const row of rows) {
                const values = columnNames.map(col => convertValue(row[col]));
                insert.run(values);
            }
        });

        insertMany(data);
        
        logger.info(`✓ Imported ${data.length} rows into ${tableName}`);
        return data.length;
    } catch (error) {
        logger.error(`Error importing ${tableName}:`, error);
        throw error;
    }
}

async function importAllData() {
    try {
        logger.info('Starting SQLite data import...');

        // Import in order to respect foreign key constraints
        const tables = [
            'users',
            'user_profiles',
            'products',
            'carts',
            'cart_items',
            'subscription_orders',
            'subscription_order_items',
            'subscriptions',
            'system_config',
            'offers',
            'testimonials',
            'email_queue',
            'login_audit',
            'error_logs',
            'performance_metrics',
            'failed_login_attempts',
            'system_alerts',
            'session', // Import session last as it's less critical
        ];

        let totalRows = 0;
        for (const tableName of tables) {
            try {
                const count = await importTable(tableName);
                totalRows += count;
            } catch (error) {
                logger.warn(`Skipping ${tableName}:`, error.message);
            }
        }

        logger.info(`✅ Import completed! Total rows: ${totalRows}`);
        
        return { totalRows };
    } catch (error) {
        logger.error('❌ Import failed:', error);
        throw error;
    } finally {
        db.close();
    }
}

if (require.main === module) {
    importAllData()
        .then(() => {
            logger.info('✅ Data import completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Import failed:', error);
            process.exit(1);
        });
}

module.exports = { importAllData };

