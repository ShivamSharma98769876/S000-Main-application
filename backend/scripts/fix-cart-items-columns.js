const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Get database path from environment or use default
const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/tradingpro.db');

async function fixCartItemsColumns() {
    let db;
    try {
        // Check if database exists
        if (!fs.existsSync(DB_PATH)) {
            logger.error('Database file not found', { path: DB_PATH });
            console.error(`❌ Database file not found: ${DB_PATH}`);
            process.exit(1);
        }

        // Open database
        db = new Database(DB_PATH);
        logger.info('Database opened', { path: DB_PATH });

        // Check if cart_items table exists
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='cart_items'
        `).get();

        if (!tableExists) {
            logger.error('cart_items table does not exist');
            console.error('❌ cart_items table does not exist. Please run migrations first.');
            process.exit(1);
        }

        // Check current columns
        const tableInfo = db.prepare(`PRAGMA table_info(cart_items)`).all();
        const columnNames = tableInfo.map(col => col.name);
        
        console.log('Current cart_items columns:', columnNames);

        // Add duration_unit column if it doesn't exist
        if (!columnNames.includes('duration_unit')) {
            console.log('Adding duration_unit column...');
            db.exec(`
                ALTER TABLE cart_items 
                ADD COLUMN duration_unit TEXT CHECK (duration_unit IN ('MONTH', 'YEAR'))
            `);
            
            // Migrate data from duration_type to duration_unit
            db.exec(`
                UPDATE cart_items 
                SET duration_unit = duration_type 
                WHERE duration_unit IS NULL
            `);
            
            logger.info('Added duration_unit column');
            console.log('✓ Added duration_unit column');
        } else {
            console.log('✓ duration_unit column already exists');
        }

        // Add duration_value column if it doesn't exist
        if (!columnNames.includes('duration_value')) {
            console.log('Adding duration_value column...');
            db.exec(`
                ALTER TABLE cart_items 
                ADD COLUMN duration_value INTEGER CHECK (duration_value > 0 AND duration_value <= 12)
            `);
            
            // Migrate data from duration_units to duration_value
            db.exec(`
                UPDATE cart_items 
                SET duration_value = duration_units 
                WHERE duration_value IS NULL
            `);
            
            logger.info('Added duration_value column');
            console.log('✓ Added duration_value column');
        } else {
            console.log('✓ duration_value column already exists');
        }

        // Add price column if it doesn't exist (for compatibility)
        if (!columnNames.includes('price')) {
            console.log('Adding price column...');
            db.exec(`
                ALTER TABLE cart_items 
                ADD COLUMN price REAL
            `);
            
            // Migrate data from subtotal to price (or calculate from unit_price if needed)
            db.exec(`
                UPDATE cart_items 
                SET price = COALESCE(subtotal, unit_price, 0)
                WHERE price IS NULL
            `);
            
            logger.info('Added price column');
            console.log('✓ Added price column');
        } else {
            console.log('✓ price column already exists');
        }

        // Verify the changes
        const newTableInfo = db.prepare(`PRAGMA table_info(cart_items)`).all();
        const newColumnNames = newTableInfo.map(col => col.name);
        console.log('\nUpdated cart_items columns:', newColumnNames);

        logger.info('Cart items columns fixed successfully');
        console.log('\n✅ Cart items table columns fixed successfully!');
        
    } catch (error) {
        logger.error('Failed to fix cart_items columns', error);
        console.error('❌ Error fixing cart_items columns:', error.message);
        process.exit(1);
    } finally {
        if (db) {
            db.close();
        }
    }
}

// Run if called directly
if (require.main === module) {
    fixCartItemsColumns()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { fixCartItemsColumns };

