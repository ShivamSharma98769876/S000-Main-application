/**
 * Fix subscription_order_items table schema - migrate from duration_type/duration_units to duration_unit/duration_value
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
const envPaths = [
    path.join(__dirname, '../env'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    require('dotenv').config();
}

const { query } = require('../config/database');
const logger = require('../config/logger');

async function fixSubscriptionOrderItemsSchema() {
    try {
        logger.info('Checking subscription_order_items table schema...');
        
        // Check current columns
        const columnCheck = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subscription_order_items'
            ORDER BY ordinal_position
        `);
        
        const columns = columnCheck.rows.map(row => row.column_name);
        console.log('Current columns:', columns.join(', '));
        
        const hasOldColumns = columns.includes('duration_type') || columns.includes('duration_units');
        const hasNewColumns = columns.includes('duration_unit') && columns.includes('duration_value');
        
        if (!hasOldColumns && hasNewColumns) {
            console.log('✓ Schema is already correct (duration_unit, duration_value)');
            logger.info('subscription_order_items schema is already correct');
            
            // Check if created_at exists
            if (!columns.includes('created_at')) {
                await query(`
                    ALTER TABLE subscription_order_items 
                    ADD COLUMN created_at TIMESTAMP DEFAULT NOW()
                `);
                console.log('✓ Added created_at column');
            }
            return;
        }
        
        if (hasOldColumns && !hasNewColumns) {
            console.log('Migrating from old schema (duration_type, duration_units) to new schema (duration_unit, duration_value)...');
            
            // Add new columns
            if (!columns.includes('duration_unit')) {
                await query(`
                    ALTER TABLE subscription_order_items 
                    ADD COLUMN duration_unit VARCHAR(10) CHECK (duration_unit IN ('MONTH', 'YEAR'))
                `);
                console.log('✓ Added duration_unit column');
            }
            
            if (!columns.includes('duration_value')) {
                await query(`
                    ALTER TABLE subscription_order_items 
                    ADD COLUMN duration_value INTEGER CHECK (duration_value BETWEEN 1 AND 12)
                `);
                console.log('✓ Added duration_value column');
            }
            
            // Migrate data
            if (columns.includes('duration_type') && columns.includes('duration_units')) {
                await query(`
                    UPDATE subscription_order_items 
                    SET duration_unit = duration_type,
                        duration_value = duration_units
                    WHERE duration_unit IS NULL OR duration_value IS NULL
                `);
                console.log('✓ Migrated data from old columns to new columns');
            }
            
            // Drop old columns
            if (columns.includes('duration_type')) {
                await query(`ALTER TABLE subscription_order_items DROP COLUMN IF EXISTS duration_type`);
                console.log('✓ Dropped duration_type column');
            }
            
            if (columns.includes('duration_units')) {
                await query(`ALTER TABLE subscription_order_items DROP COLUMN IF EXISTS duration_units`);
                console.log('✓ Dropped duration_units column');
            }
            
            logger.info('subscription_order_items schema migration completed');
            console.log('✅ Schema migration completed successfully!');
        } else if (!hasNewColumns) {
            // Table exists but has neither old nor new columns - add new ones
            console.log('Adding duration_unit and duration_value columns...');
            
            await query(`
                ALTER TABLE subscription_order_items 
                ADD COLUMN duration_unit VARCHAR(10) CHECK (duration_unit IN ('MONTH', 'YEAR'))
            `);
            
            await query(`
                ALTER TABLE subscription_order_items 
                ADD COLUMN duration_value INTEGER CHECK (duration_value BETWEEN 1 AND 12)
            `);
            
            console.log('✅ Added duration_unit and duration_value columns');
        }
        
        // Ensure created_at exists
        if (!columns.includes('created_at')) {
            await query(`
                ALTER TABLE subscription_order_items 
                ADD COLUMN created_at TIMESTAMP DEFAULT NOW()
            `);
            console.log('✓ Added created_at column');
        }
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to fix subscription_order_items schema', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    fixSubscriptionOrderItemsSchema();
}

module.exports = { fixSubscriptionOrderItemsSchema };

