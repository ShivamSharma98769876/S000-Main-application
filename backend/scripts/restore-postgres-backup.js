/**
 * Restore PostgreSQL database from .backup file
 * Usage: node backend/scripts/restore-postgres-backup.js [backup-file-path]
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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

// Get backup file path
const BACKUP_FILE = process.argv[2] || path.join(__dirname, '../../data/postgres-export/Tradingpro-back.backup');

console.log('\n' + '='.repeat(60));
console.log('PostgreSQL Database Restore');
console.log('='.repeat(60) + '\n');

// Check if backup file exists
if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`❌ Backup file not found: ${BACKUP_FILE}`);
    console.log('\nUsage:');
    console.log('  node backend/scripts/restore-postgres-backup.js [backup-file-path]');
    console.log('\nDefault path:');
    console.log('  data/postgres-export/Tradingpro-back.backup');
    process.exit(1);
}

console.log(`📦 Backup file: ${BACKUP_FILE}`);
console.log(`   Size: ${(fs.statSync(BACKUP_FILE).size / 1024 / 1024).toFixed(2)} MB\n`);

// Get database connection info
const getDbConfig = () => {
    if (process.env.DATABASE_URL) {
        try {
            const url = new URL(process.env.DATABASE_URL);
            return {
                host: url.hostname,
                port: url.port || 5432,
                database: url.pathname.replace('/', ''),
                user: url.username,
                password: url.password
            };
        } catch (e) {
            console.error('❌ Invalid DATABASE_URL format');
            process.exit(1);
        }
    }
    
    return {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'tradingpro',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    };
};

const dbConfig = getDbConfig();

console.log('📊 Database Configuration:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Port: ${dbConfig.port}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}\n`);

// Check if pg_restore is available
async function checkPgRestore() {
    try {
        execSync('pg_restore --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

// Restore using pg_restore
async function restoreWithPgRestore() {
    console.log('🔄 Restoring database using pg_restore...\n');
    
    const pgRestoreCmd = [
        'pg_restore',
        '--verbose',
        '--clean',  // Clean (drop) database objects before recreating
        '--if-exists',  // Don't error if object doesn't exist
        '--no-owner',  // Don't restore ownership
        '--no-privileges',  // Don't restore privileges
        `--host=${dbConfig.host}`,
        `--port=${dbConfig.port}`,
        `--username=${dbConfig.user}`,
        `--dbname=${dbConfig.database}`,
        BACKUP_FILE
    ].join(' ');
    
    // Set PGPASSWORD environment variable
    const env = { ...process.env };
    if (dbConfig.password) {
        env.PGPASSWORD = dbConfig.password;
    }
    
    try {
        console.log('Running pg_restore (this may take a while)...\n');
        execSync(pgRestoreCmd, { 
            stdio: 'inherit',
            env: env,
            shell: true
        });
        console.log('\n✅ Database restored successfully using pg_restore!');
        return true;
    } catch (error) {
        console.error('\n❌ pg_restore failed:', error.message);
        return false;
    }
}

// Alternative: Restore using psql if backup is in SQL format
async function checkIfSqlFile() {
    // Check if there's a .sql file
    const sqlFile = BACKUP_FILE.replace('.backup', '.sql');
    if (fs.existsSync(sqlFile)) {
        console.log(`📄 Found SQL file: ${sqlFile}`);
        return sqlFile;
    }
    return null;
}

// Restore using Node.js (if pg_restore not available)
async function restoreWithNode() {
    console.log('⚠️  pg_restore not available. Attempting alternative method...\n');
    
    // Check if we can read the backup as SQL
    const sqlFile = await checkIfSqlFile();
    if (sqlFile) {
        console.log(`📄 Using SQL file: ${sqlFile}\n`);
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        
        // Split into individual statements
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`📝 Found ${statements.length} SQL statements\n`);
        console.log('⚠️  This method may not work for all backup formats.');
        console.log('   Please install PostgreSQL tools and use pg_restore instead.\n');
        
        return false;
    }
    
    console.log('❌ Cannot restore .backup file without pg_restore.');
    console.log('   Please install PostgreSQL client tools:\n');
    console.log('   Windows: Download from https://www.postgresql.org/download/windows/');
    console.log('   Or use: choco install postgresql');
    console.log('   Or use: scoop install postgresql\n');
    
    return false;
}

// Fix session table after restore
async function fixSessionTable() {
    console.log('\n🔧 Fixing session table for connect-pg-simple...\n');
    
    try {
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
            console.log('✅ Session table already has unique constraint');
        } else {
            console.log('⚠️  Adding explicit unique constraint to session table...');
            
            try {
                await query(`
                    ALTER TABLE session 
                    ADD CONSTRAINT session_sid_unique UNIQUE (sid)
                `);
                console.log('✅ Unique constraint added successfully');
            } catch (alterError) {
                if (alterError.message.includes('already exists')) {
                    console.log('✅ Unique constraint already exists (different name)');
                } else if (alterError.message.includes('does not exist')) {
                    console.log('⚠️  Session table does not exist. Creating it...');
                    await query(`
                        CREATE TABLE session (
                            sid VARCHAR NOT NULL,
                            sess JSON NOT NULL,
                            expire TIMESTAMP(6) NOT NULL,
                            CONSTRAINT session_pkey PRIMARY KEY (sid),
                            CONSTRAINT session_sid_unique UNIQUE (sid)
                        )
                    `);
                    await query('CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire)');
                    console.log('✅ Session table created with proper constraints');
                } else {
                    throw alterError;
                }
            }
        }
        
        // Test ON CONFLICT
        console.log('🧪 Testing ON CONFLICT support...');
        await query(`
            INSERT INTO session (sid, sess, expire)
            VALUES ($1, $2, $3)
            ON CONFLICT (sid) 
            DO UPDATE SET sess = $2, expire = $3
        `, ['test-restore-' + Date.now(), JSON.stringify({ test: true }), new Date(Date.now() + 3600000)]);
        
        await query('DELETE FROM session WHERE sid LIKE $1', ['test-restore-%']);
        console.log('✅ ON CONFLICT works correctly!\n');
        
    } catch (error) {
        console.error('❌ Failed to fix session table:', error.message);
        throw error;
    }
}

// Verify restoration
async function verifyRestoration() {
    console.log('\n🔍 Verifying restoration...\n');
    
    try {
        // Get table count
        const tablesResult = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        console.log(`✅ Found ${tablesResult.rows.length} tables:`);
        tablesResult.rows.forEach((row, index) => {
            if (index < 10) {
                console.log(`   - ${row.table_name}`);
            } else if (index === 10) {
                console.log(`   ... and ${tablesResult.rows.length - 10} more`);
            }
        });
        
        // Check row counts for key tables
        const keyTables = ['users', 'products', 'subscription_orders', 'subscriptions', 'system_config'];
        console.log('\n📊 Row counts:');
        
        for (const tableName of keyTables) {
            try {
                const countResult = await query(`SELECT COUNT(*) as count FROM ${tableName}`);
                console.log(`   ${tableName}: ${countResult.rows[0].count} rows`);
            } catch (e) {
                // Table might not exist
            }
        }
        
        console.log('\n✅ Verification complete!\n');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        throw error;
    }
}

// Main restore function
async function restoreDatabase() {
    try {
        // Check if pg_restore is available
        const hasPgRestore = await checkPgRestore();
        
        let restored = false;
        if (hasPgRestore) {
            restored = await restoreWithPgRestore();
        }
        
        if (!restored) {
            restored = await restoreWithNode();
        }
        
        if (!restored) {
            console.error('\n❌ Could not restore database. Please install PostgreSQL client tools.');
            process.exit(1);
        }
        
        // Fix session table
        await fixSessionTable();
        
        // Verify restoration
        await verifyRestoration();
        
        console.log('='.repeat(60));
        console.log('✅ Database restore complete!');
        console.log('='.repeat(60));
        console.log('\nNext steps:');
        console.log('1. Restart your application');
        console.log('2. Test the application');
        console.log('3. Verify OAuth login works');
        console.log('4. Check that all data is present\n');
        
        process.exit(0);
        
    } catch (error) {
        logger.error('Database restore failed', error);
        console.error('\n❌ Restore failed:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

// Run restore
restoreDatabase();

