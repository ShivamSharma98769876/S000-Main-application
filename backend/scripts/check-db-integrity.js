#!/usr/bin/env node
/**
 * Check SQLite database integrity and attempt recovery
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path
const getDefaultDbPath = () => {
    if (process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME) {
        return path.resolve(process.cwd(), 'data', 'tradingpro.db');
    }
    return path.resolve(__dirname, '../../data/tradingpro.db');
};

const DB_PATH = process.env.SQLITE_DB_PATH || getDefaultDbPath();

console.log('='.repeat(60));
console.log('SQLite Database Integrity Check');
console.log('='.repeat(60));
console.log(`Database Path: ${DB_PATH}`);
console.log('');

// Check if file exists
if (!fs.existsSync(DB_PATH)) {
    console.log('❌ Database file does not exist');
    console.log('Creating new database...');
    
    // Create data directory
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    console.log('✓ Database will be created on first use');
    process.exit(0);
}

// Check file size
const stats = fs.statSync(DB_PATH);
console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log('');

// Try to open database
let db;
try {
    console.log('Attempting to open database...');
    db = new Database(DB_PATH);
    console.log('✓ Database opened successfully');
    console.log('');
} catch (error) {
    console.error('❌ Failed to open database:', error.message);
    console.error('   Code:', error.code);
    
    if (error.code === 'SQLITE_CORRUPT') {
        console.log('');
        console.log('⚠️  Database is corrupted!');
        console.log('');
        console.log('Recovery options:');
        console.log('1. Restore from backup if available');
        console.log('2. Delete the corrupted database and let the app create a new one');
        console.log('3. Try to recover using: sqlite3 database.db ".recover" | sqlite3 recovered.db');
        console.log('');
        console.log('To delete and recreate:');
        console.log(`  rm "${DB_PATH}"`);
        console.log('  Then restart the application');
    }
    
    process.exit(1);
}

// Check integrity
console.log('Checking database integrity...');
try {
    const integrityCheck = db.pragma('integrity_check');
    const result = Array.isArray(integrityCheck) ? integrityCheck[0]?.integrity_check : integrityCheck;
    
    if (result === 'ok') {
        console.log('✓ Database integrity: OK');
    } else {
        console.error('❌ Database integrity check failed:');
        console.error(result);
        console.log('');
        console.log('⚠️  Database is corrupted!');
    }
} catch (error) {
    console.error('❌ Failed to check integrity:', error.message);
}

// Quick query test
console.log('');
console.log('Testing database queries...');
try {
    const testResult = db.prepare('SELECT 1 as test').get();
    if (testResult && testResult.test === 1) {
        console.log('✓ Basic queries work');
    } else {
        console.error('❌ Query test failed');
    }
} catch (error) {
    console.error('❌ Query test failed:', error.message);
}

// Check if users table exists and is accessible
console.log('');
console.log('Checking users table...');
try {
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (tableInfo) {
        console.log('✓ Users table exists');
        
        // Try to query it
        try {
            const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
            console.log(`✓ Users table is accessible (${count.count} users)`);
        } catch (queryError) {
            console.error('❌ Cannot query users table:', queryError.message);
            console.error('   This is likely the cause of the OAuth error');
        }
    } else {
        console.log('⚠️  Users table does not exist');
        console.log('   Run: npm run db:migrate:sqlite');
    }
} catch (error) {
    console.error('❌ Error checking users table:', error.message);
}

// Close database
db.close();
console.log('');
console.log('='.repeat(60));
console.log('Integrity check complete');
console.log('='.repeat(60));

