// Migration script to update offers table schema to match current application requirements
// Adds missing columns: discount_text, badge_text, validity_text, cta_text, cta_link, status

const path = require('path');
const fs = require('fs');

// Load environment variables BEFORE requiring database config
const envPath = path.join(__dirname, '../env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const { query } = require('../config/database');
const logger = require('../config/logger');

async function updateOffersSchema() {
    try {
        logger.info('Starting migration: Update offers table schema');
        
        // Check existing columns
        const colResult = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'offers'
        `);
        
        const columns = colResult.rows.map(r => r.column_name);
        const hasColumn = (name) => columns.includes(name);
        
        // Add discount_text if it doesn't exist
        if (!hasColumn('discount_text')) {
            await query(`
                ALTER TABLE offers 
                ADD COLUMN discount_text VARCHAR(100)
            `);
            logger.info('✓ Added discount_text column to offers');
        }
        
        // Add badge_text if it doesn't exist
        if (!hasColumn('badge_text')) {
            await query(`
                ALTER TABLE offers 
                ADD COLUMN badge_text VARCHAR(100)
            `);
            logger.info('✓ Added badge_text column to offers');
        }
        
        // Add validity_text if it doesn't exist
        if (!hasColumn('validity_text')) {
            await query(`
                ALTER TABLE offers 
                ADD COLUMN validity_text VARCHAR(255)
            `);
            logger.info('✓ Added validity_text column to offers');
        }
        
        // Add cta_text if it doesn't exist
        if (!hasColumn('cta_text')) {
            await query(`
                ALTER TABLE offers 
                ADD COLUMN cta_text VARCHAR(100) DEFAULT 'Claim Offer'
            `);
            logger.info('✓ Added cta_text column to offers');
        }
        
        // Add cta_link if it doesn't exist
        if (!hasColumn('cta_link')) {
            await query(`
                ALTER TABLE offers 
                ADD COLUMN cta_link VARCHAR(255)
            `);
            logger.info('✓ Added cta_link column to offers');
        }
        
        // Add status column if it doesn't exist (or update is_active to status)
        if (!hasColumn('status')) {
            if (hasColumn('is_active')) {
                // Migrate is_active to status
                await query(`
                    ALTER TABLE offers 
                    ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' 
                        CHECK (status IN ('ACTIVE', 'INACTIVE'))
                `);
                
                // Migrate data from is_active to status
                await query(`
                    UPDATE offers 
                    SET status = CASE 
                        WHEN is_active IS TRUE THEN 'ACTIVE'
                        WHEN is_active IS FALSE THEN 'INACTIVE'
                        ELSE 'ACTIVE'
                    END
                `);
                logger.info('✓ Added status column and migrated data from is_active');
            } else {
                // Just add status column
                await query(`
                    ALTER TABLE offers 
                    ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' 
                        CHECK (status IN ('ACTIVE', 'INACTIVE'))
                `);
                logger.info('✓ Added status column to offers');
            }
        }
        
        // Migrate discount_percentage to discount_text if discount_text is empty
        if (hasColumn('discount_percentage') && hasColumn('discount_text')) {
            await query(`
                UPDATE offers 
                SET discount_text = discount_percentage::text || '% OFF'
                WHERE discount_text IS NULL AND discount_percentage IS NOT NULL
            `);
            logger.info('✓ Migrated discount_percentage to discount_text');
        }
        
        // Migrate valid_from/valid_until to validity_text if validity_text is empty
        if (hasColumn('valid_from') && hasColumn('valid_until') && hasColumn('validity_text')) {
            await query(`
                UPDATE offers 
                SET validity_text = 'Valid from ' || valid_from::text || ' to ' || valid_until::text
                WHERE validity_text IS NULL AND valid_from IS NOT NULL AND valid_until IS NOT NULL
            `);
            logger.info('✓ Migrated valid_from/valid_until to validity_text');
        }
        
        // Update discount_text to NOT NULL if it's currently nullable and has values
        if (hasColumn('discount_text')) {
            const nullCheck = await query(`
                SELECT COUNT(*) as null_count 
                FROM offers 
                WHERE discount_text IS NULL
            `);
            
            if (parseInt(nullCheck.rows[0].null_count) === 0) {
                // All rows have discount_text, make it NOT NULL
                try {
                    await query(`
                        ALTER TABLE offers 
                        ALTER COLUMN discount_text SET NOT NULL
                    `);
                    logger.info('✓ Set discount_text to NOT NULL');
                } catch (err) {
                    // If it fails, that's okay - might already be NOT NULL
                    logger.info('discount_text constraint already set or cannot be set');
                }
            }
        }
        
        console.log('✅ Offers schema migration completed successfully!');
        logger.info('Offers schema migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Offers schema migration failed:', error.message);
        logger.error('Offers schema migration failed', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    updateOffersSchema();
}

module.exports = { updateOffersSchema };
