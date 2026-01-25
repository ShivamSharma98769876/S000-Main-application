// Migration script to add broker column to user_profiles table
// Note: BROKER will be populated from Kite API authAccountID (e.g., "UK9394")

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

async function addBrokerColumn() {
    try {
        logger.info('Adding broker column to user_profiles...');
        
        // Check if column already exists
        const checkColumn = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user_profiles' 
            AND column_name = 'broker'
        `);
        
        if (checkColumn.rows.length > 0) {
            logger.info('broker column already exists');
            console.log('ℹ️  broker column already exists');
            process.exit(0);
        }
        
        // Add broker column
        // Will store Kite API authAccountID (e.g., "UK9394", "UK9090")
        await query(`
            ALTER TABLE user_profiles 
            ADD COLUMN broker VARCHAR(50);
        `);
        
        // Create index for faster lookups
        await query(`
            CREATE INDEX IF NOT EXISTS idx_user_profiles_broker 
            ON user_profiles(broker) 
            WHERE broker IS NOT NULL
        `);
        
        logger.info('✓ broker column added successfully');
        console.log('✅ broker column added successfully');
        console.log('📝 Note: BROKER will store Kite API authAccountID (e.g., "UK9394")');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to add broker column', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    addBrokerColumn();
}

module.exports = { addBrokerColumn };
