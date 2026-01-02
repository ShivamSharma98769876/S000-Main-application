#!/usr/bin/env node
/**
 * Recreate database from scratch
 * WARNING: This will delete the existing database and all data!
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
const dataDir = path.dirname(DB_PATH);

console.log('='.repeat(60));
console.log('Recreate Database');
console.log('='.repeat(60));
console.log(`Database Path: ${DB_PATH}`);
console.log('');
console.log('⚠️  WARNING: This will DELETE the existing database!');
console.log('   All data will be lost!');
console.log('');

// Check if database exists
if (fs.existsSync(DB_PATH)) {
    const backupPath = DB_PATH + '.backup.' + Date.now();
    console.log('Creating backup before deletion...');
    try {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log(`✓ Backup created: ${backupPath}`);
    } catch (backupError) {
        console.error('⚠️  Failed to create backup:', backupError.message);
        console.log('Continuing anyway...');
    }
    
    console.log('');
    console.log('Removing existing database...');
    try {
        fs.unlinkSync(DB_PATH);
        console.log('✓ Database removed');
        
        // Remove WAL files
        const walPath = DB_PATH + '-wal';
        const shmPath = DB_PATH + '-shm';
        if (fs.existsSync(walPath)) {
            fs.unlinkSync(walPath);
            console.log('✓ WAL file removed');
        }
        if (fs.existsSync(shmPath)) {
            fs.unlinkSync(shmPath);
            console.log('✓ SHM file removed');
        }
    } catch (removeError) {
        console.error('❌ Failed to remove database:', removeError.message);
        process.exit(1);
    }
} else {
    console.log('Database does not exist. Will create new one.');
}

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('✓ Created data directory');
    } catch (mkdirError) {
        console.error('❌ Failed to create data directory:', mkdirError.message);
        process.exit(1);
    }
}

// Create new database
console.log('');
console.log('Creating new database...');
try {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    console.log('✓ New database created');
    console.log('✓ Foreign keys enabled');
    console.log('✓ WAL mode enabled');
    db.close();
} catch (createError) {
    console.error('❌ Failed to create database:', createError.message);
    process.exit(1);
}

console.log('');
console.log('='.repeat(60));
console.log('✅ Database recreated!');
console.log('='.repeat(60));
console.log('');
console.log('Next steps:');
console.log('1. Run migrations to create tables:');
console.log('   npm run db:migrate:sqlite');
console.log('');
console.log('2. (Optional) Seed initial data:');
console.log('   npm run db:seed');
console.log('');
console.log('3. Verify database:');
console.log('   npm run db:check');

