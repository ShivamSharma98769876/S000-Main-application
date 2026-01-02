/**
 * Fix session table for connect-pg-simple
 * Ensures the table has the correct structure and constraints
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

async function fixSessionTable() {
    try {
        logger.info('Checking session table structure...');
        
        // Check if table exists and get its structure
        const tableCheck = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'session' AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        if (tableCheck.rows.length === 0) {
            console.log('⚠️  Session table does not exist. Creating it...');
            await query(`
                CREATE TABLE session (
                    sid VARCHAR NOT NULL PRIMARY KEY,
                    sess JSON NOT NULL,
                    expire TIMESTAMP(6) NOT NULL
                )
            `);
            console.log('✅ Session table created');
        } else {
            console.log('✓ Session table exists');
            console.log('  Columns:', tableCheck.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
        }
        
        // Check for primary key constraint
        const pkCheck = await query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'session' 
            AND table_schema = 'public'
            AND constraint_type = 'PRIMARY KEY'
        `);
        
        if (pkCheck.rows.length === 0) {
            console.log('⚠️  No primary key found. Adding primary key constraint...');
            await query(`
                ALTER TABLE session 
                ADD CONSTRAINT session_pkey PRIMARY KEY (sid)
            `);
            console.log('✅ Primary key constraint added');
        } else {
            console.log('✓ Primary key constraint exists:', pkCheck.rows[0].constraint_name);
        }
        
        // Check for unique constraint (connect-pg-simple needs this for ON CONFLICT)
        const uniqueCheck = await query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'session' 
            AND table_schema = 'public'
            AND constraint_type = 'UNIQUE'
        `);
        
        // Primary key already provides uniqueness, but let's ensure it's explicit
        if (uniqueCheck.rows.length === 0 && pkCheck.rows.length > 0) {
            console.log('ℹ️  Primary key provides uniqueness (no separate unique constraint needed)');
        }
        
        // Ensure expire index exists
        const indexCheck = await query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'session' 
            AND indexname = 'idx_session_expire'
        `);
        
        if (indexCheck.rows.length === 0) {
            console.log('⚠️  Expire index not found. Creating it...');
            await query(`
                CREATE INDEX idx_session_expire ON session(expire)
            `);
            console.log('✅ Expire index created');
        } else {
            console.log('✓ Expire index exists');
        }
        
        // Test the table structure by checking constraints
        const allConstraints = await query(`
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'session' 
            AND tc.table_schema = 'public'
            ORDER BY tc.constraint_type, tc.constraint_name
        `);
        
        console.log('\n📋 All constraints on session table:');
        allConstraints.rows.forEach(row => {
            console.log(`  - ${row.constraint_type}: ${row.constraint_name} on ${row.column_name}`);
        });
        
        // Verify the table can handle ON CONFLICT
        console.log('\n🧪 Testing ON CONFLICT support...');
        try {
            // This is what connect-pg-simple does internally
            await query(`
                INSERT INTO session (sid, sess, expire)
                VALUES ($1, $2, $3)
                ON CONFLICT (sid) 
                DO UPDATE SET sess = $2, expire = $3
            `, ['test-session-id', JSON.stringify({ test: true }), new Date(Date.now() + 3600000)]);
            
            // Clean up test data
            await query('DELETE FROM session WHERE sid = $1', ['test-session-id']);
            
            console.log('✅ ON CONFLICT works correctly!');
        } catch (testError) {
            console.error('❌ ON CONFLICT test failed:', testError.message);
            console.error('   This means connect-pg-simple will fail.');
            console.error('   Error code:', testError.code);
            
            // Try to fix by ensuring explicit unique constraint
            if (testError.message.includes('no unique or exclusion constraint')) {
                console.log('\n🔧 Attempting to fix by ensuring unique constraint...');
                
                // Drop and recreate with explicit unique constraint
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
                
                console.log('✅ Session table recreated with explicit unique constraint');
                
                // Test again
                await query(`
                    INSERT INTO session (sid, sess, expire)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (sid) 
                    DO UPDATE SET sess = $2, expire = $3
                `, ['test-session-id-2', JSON.stringify({ test: true }), new Date(Date.now() + 3600000)]);
                
                await query('DELETE FROM session WHERE sid = $1', ['test-session-id-2']);
                console.log('✅ ON CONFLICT now works correctly!');
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Session table is ready for connect-pg-simple');
        console.log('='.repeat(60) + '\n');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to fix session table', error);
        console.error('❌ Error:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

fixSessionTable();

