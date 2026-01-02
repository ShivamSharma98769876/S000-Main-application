#!/usr/bin/env node
/**
 * Recover corrupted SQLite database
 * Creates a new database if the current one is corrupted
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
const BACKUP_PATH = DB_PATH + '.backup.' + Date.now();
const dataDir = path.dirname(DB_PATH);

console.log('='.repeat(60));
console.log('Database Recovery Tool');
console.log('='.repeat(60));
console.log(`Database Path: ${DB_PATH}`);
console.log('');

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
    console.log('Database file does not exist. Nothing to recover.');
    process.exit(0);
}

// Try to open and check integrity
let db;
let isCorrupted = false;

try {
    db = new Database(DB_PATH);
    const integrityCheck = db.pragma('integrity_check');
    const result = Array.isArray(integrityCheck) ? integrityCheck[0]?.integrity_check : integrityCheck;
    
    if (result !== 'ok') {
        isCorrupted = true;
        console.log('⚠️  Database integrity check failed');
        console.log('Result:', result);
    } else {
        // Try a test query
        try {
            db.prepare('SELECT 1').get();
            console.log('✓ Database appears to be healthy');
            db.close();
            process.exit(0);
        } catch (queryError) {
            isCorrupted = true;
            console.log('⚠️  Database queries fail - database is corrupted');
        }
    }
} catch (error) {
    if (error.code === 'SQLITE_CORRUPT') {
        isCorrupted = true;
        console.log('⚠️  Database is corrupted (SQLITE_CORRUPT)');
    } else {
        console.error('❌ Error checking database:', error.message);
        process.exit(1);
    }
}

if (isCorrupted) {
    console.log('');
    console.log('Creating backup of corrupted database...');
    try {
        if (db) db.close();
        fs.copyFileSync(DB_PATH, BACKUP_PATH);
        console.log(`✓ Backup created: ${BACKUP_PATH}`);
    } catch (backupError) {
        console.error('⚠️  Failed to create backup:', backupError.message);
    }
    
    console.log('');
    console.log('Removing corrupted database...');
    try {
        // Also remove WAL and SHM files
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
        
        fs.unlinkSync(DB_PATH);
        console.log('✓ Corrupted database removed');
    } catch (removeError) {
        console.error('❌ Failed to remove corrupted database:', removeError.message);
        process.exit(1);
    }
    
    console.log('');
    console.log('Creating new database...');
    try {
        // Ensure data directory exists
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Create new database
        db = new Database(DB_PATH);
        db.pragma('foreign_keys = ON');
        db.pragma('journal_mode = WAL');
        console.log('✓ New database created');
        
        console.log('');
        console.log('⚠️  IMPORTANT: You need to run migrations to create tables:');
        console.log('   npm run db:migrate:sqlite');
        console.log('');
        console.log('Or if you have a backup, restore it.');
        
        db.close();
        console.log('');
        console.log('✓ Recovery complete!');
        console.log(`✓ Backup saved at: ${BACKUP_PATH}`);
        console.log('');
        console.log('Next steps:');
        console.log('1. Run migrations: npm run db:migrate:sqlite');
        console.log('2. Restart the application');
    } catch (createError) {
        console.error('❌ Failed to create new database:', createError.message);
        process.exit(1);
    }
}

