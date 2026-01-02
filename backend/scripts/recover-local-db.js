#!/usr/bin/env node
/**
 * Recover corrupted local SQLite database
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path from command line or use default
const dbPathArg = process.argv[2];
const defaultPath = path.resolve(__dirname, '../../data/tradingpro.db');
const dbPath = dbPathArg ? path.resolve(dbPathArg) : defaultPath;

console.log('='.repeat(60));
console.log('Local Database Recovery Tool');
console.log('='.repeat(60));
console.log(`Database Path: ${dbPath}`);
console.log('');

// Check if file exists
if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database file not found: ${dbPath}`);
    process.exit(1);
}

// Get file stats
const stats = fs.statSync(dbPath);
console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`Last modified: ${stats.mtime.toLocaleString()}`);
console.log('');

// Check for WAL files
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';
const hasWal = fs.existsSync(walPath);
const hasShm = fs.existsSync(shmPath);

if (hasWal || hasShm) {
    console.log('⚠️  WAL files detected. Attempting to merge...');
    try {
        const db = new Database(dbPath);
        db.pragma('wal_checkpoint(FULL)');
        db.close();
        console.log('✓ WAL checkpoint completed');
        
        // Try to remove WAL files after checkpoint
        if (fs.existsSync(walPath)) {
            try {
                fs.unlinkSync(walPath);
                console.log('✓ Removed WAL file');
            } catch (e) {
                console.warn('⚠️  Could not remove WAL file (may be in use)');
            }
        }
        if (fs.existsSync(shmPath)) {
            try {
                fs.unlinkSync(shmPath);
                console.log('✓ Removed SHM file');
            } catch (e) {
                console.warn('⚠️  Could not remove SHM file (may be in use)');
            }
        }
    } catch (checkpointError) {
        console.warn('⚠️  WAL checkpoint failed:', checkpointError.message);
    }
    console.log('');
}

// Try to open and check integrity
let db;
let isCorrupted = false;

console.log('Checking database integrity...');
try {
    db = new Database(dbPath);
    const integrityCheck = db.pragma('integrity_check');
    const result = Array.isArray(integrityCheck) ? integrityCheck[0]?.integrity_check : integrityCheck;
    
    if (result !== 'ok') {
        isCorrupted = true;
        console.log('❌ Database integrity check failed');
        console.log('Result:', result);
    } else {
        // Try a test query
        try {
            db.prepare('SELECT 1').get();
            console.log('✓ Database appears to be healthy');
            db.close();
            console.log('');
            console.log('✅ No recovery needed!');
            process.exit(0);
        } catch (queryError) {
            isCorrupted = true;
            console.log('❌ Database queries fail - database is corrupted');
            console.log('Error:', queryError.message);
        }
    }
} catch (error) {
    if (error.code === 'SQLITE_CORRUPT' || error.message.includes('malformed')) {
        isCorrupted = true;
        console.log('❌ Database is corrupted (SQLITE_CORRUPT)');
        console.log('Error:', error.message);
    } else {
        console.error('❌ Error checking database:', error.message);
        if (db) db.close();
        process.exit(1);
    }
}

if (!isCorrupted) {
    if (db) db.close();
    process.exit(0);
}

// Database is corrupted - attempt recovery
console.log('');
console.log('='.repeat(60));
console.log('Attempting Recovery');
console.log('='.repeat(60));
console.log('');

// Close database if open
if (db) {
    try {
        db.close();
    } catch (e) {
        // Ignore
    }
}

// Create backup
const backupPath = dbPath + '.backup.' + Date.now();
console.log('Creating backup...');
try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✓ Backup created: ${backupPath}`);
    
    // Also backup WAL files
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

// Try SQLite recovery
console.log('');
console.log('Attempting SQLite recovery...');
const recoveredPath = dbPath + '.recovered.' + Date.now();

try {
    // Try to use sqlite3 command-line tool if available
    const { execSync } = require('child_process');
    
    console.log('Trying to recover using sqlite3 command-line tool...');
    try {
        execSync(`sqlite3 "${dbPath}" ".recover" > "${recoveredPath}"`, { 
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 60000 // 60 second timeout
        });
        
        // Try to create database from recovered SQL
        const recoveredDbPath = dbPath + '.recovered.db';
        try {
            execSync(`sqlite3 "${recoveredDbPath}" < "${recoveredPath}"`, {
                encoding: 'utf8',
                stdio: 'pipe',
                timeout: 60000
            });
            
            // Verify recovered database
            const recoveredDb = new Database(recoveredDbPath, { readonly: true });
            const integrityCheck = recoveredDb.pragma('integrity_check');
            const result = Array.isArray(integrityCheck) ? integrityCheck[0]?.integrity_check : integrityCheck;
            recoveredDb.close();
            
            if (result === 'ok') {
                console.log('✓ Recovery successful!');
                console.log(`✓ Recovered database: ${recoveredDbPath}`);
                console.log('');
                console.log('Next steps:');
                console.log(`1. Review the recovered database: ${recoveredDbPath}`);
                console.log(`2. If it looks good, replace the corrupted one:`);
                console.log(`   - Delete: ${dbPath}`);
                console.log(`   - Rename: ${recoveredDbPath} → ${dbPath}`);
                console.log(`3. Or use the recovered database directly`);
                process.exit(0);
            } else {
                console.log('⚠️  Recovered database still has issues');
            }
        } catch (recoverError) {
            console.log('⚠️  Could not create database from recovered SQL');
        }
    } catch (sqliteError) {
        console.log('⚠️  sqlite3 command-line tool not available or recovery failed');
        console.log('   Install SQLite: https://www.sqlite.org/download.html');
    }
} catch (error) {
    console.log('⚠️  Recovery attempt failed:', error.message);
}

// If recovery didn't work, offer to recreate
console.log('');
console.log('='.repeat(60));
console.log('Recovery Options');
console.log('='.repeat(60));
console.log('');
console.log('Option 1: Restore from backup (if you have one)');
console.log('  - Copy your backup database file');
console.log('  - Replace the corrupted database');
console.log('');
console.log('Option 2: Recreate database (data will be lost)');
console.log('  - Delete corrupted database');
console.log('  - Run migrations to create new database');
console.log('  - Run: npm run db:migrate:sqlite');
console.log('');
console.log('Option 3: Try manual recovery');
console.log('  1. Install SQLite command-line tool');
console.log('  2. Run: sqlite3 tradingpro.db ".recover" > recovered.sql');
console.log('  3. Create new database: sqlite3 new.db < recovered.sql');
console.log('');
console.log(`Backup saved at: ${backupPath}`);
console.log('');
console.log('Would you like to recreate the database? (This will delete the corrupted one)');
console.log('Run: node scripts/recreate-db.js');

