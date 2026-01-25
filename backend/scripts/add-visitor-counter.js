// Migration script to create visitor_counter table for tracking website visitors

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

async function addVisitorCounter() {
    try {
        logger.info('Creating visitor_counter table...');
        
        // Create visitor_counter table
        await query(`
            CREATE TABLE IF NOT EXISTS visitor_counter (
                id SERIAL PRIMARY KEY,
                count BIGINT NOT NULL DEFAULT 0,
                last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        // Initialize with count = 0 if table is empty
        const checkCount = await query('SELECT COUNT(*) as count FROM visitor_counter');
        if (parseInt(checkCount.rows[0].count) === 0) {
            await query(`
                INSERT INTO visitor_counter (count, last_updated, created_at)
                VALUES (0, NOW(), NOW())
            `);
            logger.info('✓ Initialized visitor_counter with count = 0');
        }
        
        logger.info('✓ visitor_counter table created successfully');
        console.log('✅ Visitor counter table created successfully!');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to create visitor_counter table', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    addVisitorCounter();
}

module.exports = { addVisitorCounter };
