/**
 * Import PostgreSQL Data from JSON Export
 * Imports data from data/postgres-export directory into PostgreSQL database
 */

const path = require('path');
const fs = require('fs');

// Load environment variables BEFORE requiring database config
const envPath = path.join(__dirname, '../env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const { pool, query, transaction } = require('../config/database');
const logger = require('../config/logger');

const IMPORT_DIR = path.join(__dirname, '../../data/postgres-export');

// Table import order (respecting foreign key dependencies)
const TABLE_ORDER = [
    'users',
    'user_profiles',
    'products',
    'carts',
    'cart_items',
    'subscription_orders',
    'subscription_order_items',
    'subscriptions',
    'login_audit',
    'system_config',
    'session',
    'offers',
    'testimonials',
    'email_queue',
    'error_logs',
    'performance_metrics',
    'failed_login_attempts',
    'system_alerts'
];

// Field mappings for tables with different column names
// Note: system_config uses config_key and config_value in both JSON and DB
const FIELD_MAPPINGS = {};

function mapFields(tableName, data) {
    const mapping = FIELD_MAPPINGS[tableName];
    if (!mapping) return data;

    const mapped = { ...data };
    for (const [jsonKey, dbKey] of Object.entries(mapping)) {
        if (jsonKey in mapped) {
            mapped[dbKey] = mapped[jsonKey];
            delete mapped[jsonKey];
        }
    }
    return mapped;
}

function formatValue(value, columnType) {
    if (value === null || value === undefined) {
        return null;
    }

    // Handle JSON/JSONB fields
    if (typeof value === 'object' && !(value instanceof Date)) {
        return JSON.stringify(value);
    }

    // Handle dates
    if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
        return new Date(value).toISOString();
    }

    // Handle booleans
    if (typeof value === 'boolean') {
        return value;
    }

    return value;
}

async function importTable(tableName, client = null) {
    const filePath = path.join(IMPORT_DIR, `${tableName}.json`);
    
    if (!fs.existsSync(filePath)) {
        logger.warn(`⚠️  File not found: ${filePath}, skipping ${tableName}`);
        return 0;
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        if (!Array.isArray(data) || data.length === 0) {
            logger.info(`ℹ️  No data to import for ${tableName}`);
            return 0;
        }

        logger.info(`📥 Importing ${data.length} rows into ${tableName}...`);

        // Get table columns to build INSERT statement
        const firstRow = mapFields(tableName, data[0]);
        // Include all columns including id (we'll preserve IDs from export)
        const columns = Object.keys(firstRow);
        
        // Build INSERT statement with ON CONFLICT handling
        let insertQuery;
        let conflictClause = '';

        if (tableName === 'users') {
            // Users: conflict on email (unique constraint)
            conflictClause = 'ON CONFLICT (email) DO UPDATE SET updated_at = EXCLUDED.updated_at';
        } else if (tableName === 'user_profiles') {
            // User profiles: conflict on user_id (unique constraint)
            conflictClause = 'ON CONFLICT (user_id) DO UPDATE SET updated_at = EXCLUDED.updated_at';
        } else if (tableName === 'carts') {
            // Carts: conflict on user_id (unique constraint)
            conflictClause = 'ON CONFLICT (user_id) DO UPDATE SET updated_at = EXCLUDED.updated_at';
        } else if (tableName === 'system_config') {
            // System config: conflict on config_key (unique constraint)
            conflictClause = 'ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = EXCLUDED.updated_at';
        } else if (tableName === 'session') {
            // Session: conflict on sid (primary key)
            conflictClause = 'ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire';
        } else if ('id' in firstRow) {
            // For other tables with id, use id as conflict key
            conflictClause = 'ON CONFLICT (id) DO NOTHING';
        }

        const columnList = columns.join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        insertQuery = `
            INSERT INTO ${tableName} (${columnList})
            VALUES (${placeholders})
            ${conflictClause}
        `;

        // Use provided client or global query function
        const queryFn = client ? client.query.bind(client) : query;

        let imported = 0;
        let skipped = 0;

        // Import in batches for better performance
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            
            for (const row of batch) {
                try {
                    const mappedRow = mapFields(tableName, row);
                    const values = columns.map(col => formatValue(mappedRow[col]));
                    
                    await queryFn(insertQuery, values);
                    imported++;
                } catch (error) {
                    // If it's a conflict error, count as skipped
                    if (error.code === '23505' || error.message.includes('duplicate')) {
                        skipped++;
                    } else if (error.code === '25P02') {
                        // Transaction aborted - can't continue in this transaction
                        logger.error(`Transaction aborted for ${tableName}, stopping import of this table`);
                        throw error;
                    } else {
                        // Log error but continue with next row
                        logger.warn(`Error importing row into ${tableName} (continuing):`, {
                            error: error.message,
                            code: error.code,
                            rowPreview: JSON.stringify(row).substring(0, 100)
                        });
                        skipped++;
                    }
                }
            }
        }

        logger.info(`✅ Imported ${imported} rows into ${tableName}${skipped > 0 ? ` (${skipped} skipped due to conflicts)` : ''}`);
        return imported;
    } catch (error) {
        logger.error(`❌ Error importing ${tableName}:`, error);
        throw error;
    }
}

async function importAllData() {
    try {
        logger.info('🚀 Starting PostgreSQL data import...');
        logger.info(`📁 Import directory: ${IMPORT_DIR}`);

        if (!fs.existsSync(IMPORT_DIR)) {
            throw new Error(`Import directory does not exist: ${IMPORT_DIR}`);
        }

        // Check metadata file
        const metadataPath = path.join(IMPORT_DIR, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            logger.info(`📊 Export metadata: ${metadata.totalRows} total rows from ${metadata.tables.length} tables`);
            logger.info(`📅 Export date: ${metadata.exportDate}`);
        }

        // Test database connection
        await query('SELECT 1');
        logger.info('✅ Database connection verified');

        // Import tables in order (respecting foreign key dependencies)
        // Import each table in its own transaction to prevent one failure from blocking others
        let totalImported = 0;
        
        for (const tableName of TABLE_ORDER) {
            try {
                await transaction(async (client) => {
                    const count = await importTable(tableName, client);
                    totalImported += count;
                });
            } catch (error) {
                logger.error(`Failed to import ${tableName}:`, {
                    error: error.message,
                    code: error.code
                });
                // Continue with other tables
            }
        }

        logger.info(`✅ Import completed! Total rows imported: ${totalImported}`);
        return { totalImported };
    } catch (error) {
        logger.error('❌ Import failed:', error);
        throw error;
    }
}

if (require.main === module) {
    importAllData()
        .then((result) => {
            logger.info('✅ Data import completed successfully!');
            logger.info(`📊 Total rows imported: ${result.totalImported}`);
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Import failed:', error);
            process.exit(1);
        });
}

module.exports = { importAllData, importTable };

