#!/usr/bin/env node
/**
 * Script to restore database from a file on Azure
 * Run this on Azure after uploading your database file
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database paths
const getDefaultDbPath = () => {
    if (process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME) {
        return path.resolve(process.cwd(), 'data', 'tradingpro.db');
    }
    return path.resolve(__dirname, '../../data/tradingpro.db');
};

const DB_PATH = process.env.SQLITE_DB_PATH || getDefaultDbPath();
const UPLOADED_FILE = process.argv[2] || path.resolve(process.cwd(), 'data', 'tradingpro.db.uploaded');

console.log('='.repeat(60));
console.log('Database Restore from Uploaded File');
console.log('='.repeat(60));
console.log(`Uploaded file: ${UPLOADED_FILE}`);
console.log(`Target database: ${DB_PATH}`);
console.log('');

// Check if uploaded file exists
if (!fs.existsSync(UPLOADED_FILE)) {
    console.error(`❌ Uploaded file not found: ${UPLOADED_FILE}`);
    console.log('');
    console.log('Please provide the path to the uploaded database file:');
    console.log('  node scripts/restore-db-from-file.js /path/to/uploaded.db');
    console.log('');
    console.log('Or if you uploaded to data/tradingpro.db.uploaded:');
    console.log('  node scripts/restore-db-from-file.js');
    process.exit(1);
}

// Check uploaded file integrity
console.log('Checking uploaded file integrity...');
let uploadedDb;
try {
    uploadedDb = new Database(UPLOADED_FILE, { readonly: true });
    const integrityCheck = uploadedDb.pragma('integrity_check');
    const result = Array.isArray(integrityCheck) ? integrityCheck[0]?.integrity_check : integrityCheck;
    
    if (result === 'ok') {
        console.log('✓ Uploaded file integrity: OK');
    } else {
        console.error('❌ Uploaded file is corrupted!');
        console.error('   Result:', result);
        uploadedDb.close();
        process.exit(1);
    }
    
    // Get table count
    const tables = uploadedDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    console.log(`✓ Found ${tables.length} tables in uploaded file`);
    uploadedDb.close();
} catch (error) {
    console.error('❌ Failed to check uploaded file:', error.message);
    if (uploadedDb) uploadedDb.close();
    process.exit(1);
}

// Backup existing database if it exists
if (fs.existsSync(DB_PATH)) {
    const backupPath = DB_PATH + '.backup.' + Date.now();
    console.log('');
    console.log('Backing up existing database...');
    try {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`✓ Backup created: ${backupPath}`);
        
        // Also backup WAL files if they exist
        const walPath = DB_PATH + '-wal';
        const shmPath = DB_PATH + '-shm';
        if (fs.existsSync(walPath)) {
            fs.copyFileSync(walPath, backupPath + '-wal');
            console.log('✓ WAL file backed up');
        }
        if (fs.existsSync(shmPath)) {
            fs.copyFileSync(shmPath, backupPath + '-shm');
            console.log('✓ SHM file backed up');
        }
    } catch (backupError) {
        console.error('⚠️  Failed to create backup:', backupError.message);
        console.log('Continuing anyway...');
    }
}

// Remove existing database and WAL files
console.log('');
console.log('Removing existing database...');
try {
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
        console.log('✓ Removed existing database');
    }
    
    const walPath = DB_PATH + '-wal';
    const shmPath = DB_PATH + '-shm';
    if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
        console.log('✓ Removed WAL file');
    }
    if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
        console.log('✓ Removed SHM file');
    }
} catch (removeError) {
    console.error('❌ Failed to remove existing database:', removeError.message);
    process.exit(1);
}

// Copy uploaded file to database location
console.log('');
console.log('Restoring database...');
try {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('✓ Created data directory');
    }
    
    // Copy file
    fs.copyFileSync(UPLOADED_FILE, DB_PATH);
    console.log('✓ Database restored');
    
    // Set permissions (Linux)
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(DB_PATH, 0o644);
            console.log('✓ Set file permissions');
        } catch (chmodError) {
            console.warn('⚠️  Could not set permissions:', chmodError.message);
        }
    }
    
    // Verify restored database
    console.log('');
    console.log('Verifying restored database...');
    const restoredDb = new Database(DB_PATH, { readonly: true });
    const integrityCheck = restoredDb.pragma('integrity_check');
    const result = Array.isArray(integrityCheck) ? integrityCheck[0]?.integrity_check : integrityCheck;
    
    if (result === 'ok') {
        console.log('✓ Restored database integrity: OK');
        
        // Get table count
        const tables = restoredDb.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all();
        
        console.log(`✓ Found ${tables.length} tables`);
        
        // Get total row count
        let totalRows = 0;
        tables.forEach(table => {
            try {
                const count = restoredDb.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
                totalRows += count.count;
            } catch (err) {
                // Ignore errors
            }
        });
        
        console.log(`✓ Total rows: ${totalRows}`);
        restoredDb.close();
    } else {
        console.error('❌ Restored database integrity check failed!');
        restoredDb.close();
        process.exit(1);
    }
    
} catch (restoreError) {
    console.error('❌ Failed to restore database:', restoreError.message);
    process.exit(1);
}

console.log('');
console.log('='.repeat(60));
console.log('✅ Database restore complete!');
console.log('='.repeat(60));
console.log('');
console.log('Next steps:');
console.log('1. Restart the App Service');
console.log('2. Test the application');
console.log('3. Verify OAuth login works');

