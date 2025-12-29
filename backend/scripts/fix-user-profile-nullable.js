const { query } = require('../config/database');
const logger = require('../config/logger');

async function makeProfileFieldsNullable() {
    try {
        logger.info('Making user profile fields nullable...');
        
        // Make fields nullable so users can be created before completing registration
        await query(`
            ALTER TABLE user_profiles 
            ALTER COLUMN full_name DROP NOT NULL,
            ALTER COLUMN address DROP NOT NULL,
            ALTER COLUMN phone DROP NOT NULL;
        `);
        
        logger.info('✓ User profile fields are now nullable');
        console.log('✅ Profile fields updated successfully');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to update user_profiles table', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    makeProfileFieldsNullable();
}

module.exports = { makeProfileFieldsNullable };


