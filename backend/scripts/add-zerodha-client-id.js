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

async function addZerodhaClientId() {
    try {
        logger.info('Adding zerodha_client_id column to user_profiles...');
        
        // Add zerodha_client_id column
        await query(`
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS zerodha_client_id VARCHAR(50);
        `);
        
        logger.info('✓ zerodha_client_id column added successfully');
        console.log('✅ Zerodha Client ID column added successfully');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to add zerodha_client_id column', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    addZerodhaClientId();
}

module.exports = { addZerodhaClientId };


