/**
 * Set a user as admin by email or user ID
 * Usage: node backend/scripts/set-user-admin.js <email_or_id>
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

async function setUserAdmin() {
    try {
        const identifier = process.argv[2];
        
        if (!identifier) {
            console.log('\nUsage: node backend/scripts/set-user-admin.js <email_or_user_id>\n');
            console.log('Examples:');
            console.log('  node backend/scripts/set-user-admin.js user@example.com');
            console.log('  node backend/scripts/set-user-admin.js 1');
            process.exit(1);
        }
        
        // Determine if identifier is email or ID
        const isEmail = identifier.includes('@');
        
        let userResult;
        if (isEmail) {
            // Find user by email
            userResult = await query(
                'SELECT id, email, is_admin FROM users WHERE email = $1',
                [identifier]
            );
        } else {
            // Find user by ID
            const userId = parseInt(identifier);
            if (isNaN(userId)) {
                console.error('❌ Invalid user ID. Must be a number.');
                process.exit(1);
            }
            userResult = await query(
                'SELECT id, email, is_admin FROM users WHERE id = $1',
                [userId]
            );
        }
        
        if (userResult.rows.length === 0) {
            console.error(`❌ User not found: ${identifier}`);
            process.exit(1);
        }
        
        const user = userResult.rows[0];
        
        if (user.is_admin === true) {
            console.log(`\n✓ User is already an admin:`);
            console.log(`  ID: ${user.id}`);
            console.log(`  Email: ${user.email}`);
            process.exit(0);
        }
        
        // Update user to admin
        await query(
            'UPDATE users SET is_admin = true, updated_at = NOW() WHERE id = $1',
            [user.id]
        );
        
        console.log('\n✅ User set as admin successfully!');
        console.log(`  ID: ${user.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  is_admin: true\n`);
        
        logger.info('User set as admin', { userId: user.id, email: user.email });
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to set user as admin', error);
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setUserAdmin();

