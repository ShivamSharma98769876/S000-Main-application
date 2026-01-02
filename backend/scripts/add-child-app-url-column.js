// Migration script to add child_app_url_local and child_app_url_cloud columns to products table
// Load environment variables BEFORE requiring database config
const path = require('path');
const fs = require('fs');

// Try multiple possible locations for .env file
const envPaths = [
    path.join(__dirname, '../env'),      // backend/env
    path.join(__dirname, '../.env'),     // backend/.env
    path.join(__dirname, '../../.env'),  // root/.env
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        envLoaded = true;
        break;
    }
}

// Fallback to default dotenv behavior
if (!envLoaded) {
    require('dotenv').config();
}

const { pool } = require('../config/database');
const logger = require('../config/logger');

async function addChildAppUrlColumns() {
    try {
        logger.info('Starting migration: Add child_app_url_local and child_app_url_cloud columns to products table');
        
        // Check if columns already exist
        const checkColumns = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name IN ('child_app_url_local', 'child_app_url_cloud')
        `);
        
        const existingColumns = checkColumns.rows.map(row => row.column_name);
        
        // Check if old child_app_url column exists (for migration)
        const checkOldColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name = 'child_app_url'
        `);
        
        const hasOldColumn = checkOldColumn.rows.length > 0;
        
        // Add child_app_url_local if it doesn't exist
        if (!existingColumns.includes('child_app_url_local')) {
            await pool.query(`
                ALTER TABLE products 
                ADD COLUMN child_app_url_local TEXT
            `);
            logger.info('✓ Successfully added child_app_url_local column to products table');
        } else {
            logger.info('Column child_app_url_local already exists');
        }
        
        // Add child_app_url_cloud if it doesn't exist
        if (!existingColumns.includes('child_app_url_cloud')) {
            await pool.query(`
                ALTER TABLE products 
                ADD COLUMN child_app_url_cloud TEXT
            `);
            logger.info('✓ Successfully added child_app_url_cloud column to products table');
        } else {
            logger.info('Column child_app_url_cloud already exists');
        }
        
        // Migrate data from old child_app_url column if it exists
        if (hasOldColumn) {
            logger.info('Migrating data from old child_app_url column...');
            // Copy old child_app_url to child_app_url_cloud (assuming old URLs were cloud URLs)
            await pool.query(`
                UPDATE products 
                SET child_app_url_cloud = child_app_url 
                WHERE child_app_url IS NOT NULL 
                AND child_app_url_cloud IS NULL
            `);
            logger.info('✓ Migrated data from child_app_url to child_app_url_cloud');
            
            // Optionally drop the old column (commented out for safety - uncomment if you want to remove it)
            // await pool.query(`ALTER TABLE products DROP COLUMN child_app_url`);
            // logger.info('✓ Dropped old child_app_url column');
        }
        
        // Create indexes for faster lookups (optional)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_products_child_app_url_local 
            ON products(child_app_url_local) 
            WHERE child_app_url_local IS NOT NULL
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_products_child_app_url_cloud 
            ON products(child_app_url_cloud) 
            WHERE child_app_url_cloud IS NOT NULL
        `);
        
        logger.info('✓ Created indexes on child_app_url columns');
        
        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed', error);
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run migration
addChildAppUrlColumns();

