/**
 * Fix existing session table to add explicit unique constraint
 * Run this if you're getting "no unique or exclusion constraint" errors
 */

const path = require('path');
const fs = require('fs');

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

async function fixExistingSessionTable() {
    try {
        console.log('🔧 Fixing session table for connect-pg-simple...\n');
        
        // Check if unique constraint exists
        const uniqueCheck = await query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'session' 
            AND table_schema = 'public'
            AND constraint_type = 'UNIQUE'
            AND constraint_name != 'session_pkey'
        `);
        
        if (uniqueCheck.rows.length > 0) {
            console.log('✅ Unique constraint already exists');
            console.log('   Constraint:', uniqueCheck.rows[0].constraint_name);
        } else {
            console.log('⚠️  Adding explicit unique constraint...');
            
            // Add explicit unique constraint
            await query(`
                ALTER TABLE session 
                ADD CONSTRAINT session_sid_unique UNIQUE (sid)
            `);
            
            console.log('✅ Unique constraint added successfully');
        }
        
        // Verify ON CONFLICT works
        console.log('\n🧪 Testing ON CONFLICT...');
        try {
            await query(`
                INSERT INTO session (sid, sess, expire)
                VALUES ($1, $2, $3)
                ON CONFLICT (sid) 
                DO UPDATE SET sess = $2, expire = $3
            `, ['test-fix-' + Date.now(), JSON.stringify({ test: true }), new Date(Date.now() + 3600000)]);
            
            console.log('✅ ON CONFLICT works correctly!');
            console.log('\n✅ Session table is fixed and ready!');
        } catch (testError) {
            console.error('❌ ON CONFLICT still failing:', testError.message);
            console.error('\nTrying alternative fix...');
            
            // Drop and recreate
            console.log('⚠️  Recreating session table...');
            await query('DROP TABLE IF EXISTS session CASCADE');
            await query(`
                CREATE TABLE session (
                    sid VARCHAR NOT NULL,
                    sess JSON NOT NULL,
                    expire TIMESTAMP(6) NOT NULL,
                    CONSTRAINT session_pkey PRIMARY KEY (sid),
                    CONSTRAINT session_sid_unique UNIQUE (sid)
                )
            `);
            await query('CREATE INDEX idx_session_expire ON session(expire)');
            
            console.log('✅ Session table recreated with proper constraints');
        }
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to fix session table', error);
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixExistingSessionTable();

