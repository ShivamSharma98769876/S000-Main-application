#!/usr/bin/env node
/**
 * Script to open and inspect SQLite database
 * Usage: node scripts/open-db.js [db-path]
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path from command line or use default
const dbPathArg = process.argv[2];
const defaultPath = path.resolve(__dirname, '../../data/tradingpro.db');
const dbPath = dbPathArg ? path.resolve(dbPathArg) : defaultPath;

console.log('='.repeat(60));
console.log('SQLite Database Inspector');
console.log('='.repeat(60));
console.log(`Database Path: ${dbPath}`);
console.log('');

// Check if file exists
if (!fs.existsSync(dbPath)) {
    console.error(`❌ ERROR: Database file not found at: ${dbPath}`);
    console.log('');
    console.log('Available database files:');
    
    // Check common locations
    const commonPaths = [
        path.resolve(__dirname, '../../data/tradingpro.db'),
        path.resolve(__dirname, '../data/tradingpro.db'),
        path.resolve(__dirname, '../../backend/data/tradingpro.db'),
    ];
    
    commonPaths.forEach(p => {
        if (fs.existsSync(p)) {
            console.log(`  ✓ ${p}`);
        }
    });
    
    process.exit(1);
}

// Check file permissions
try {
    fs.accessSync(dbPath, fs.constants.R_OK);
    console.log('✓ File is readable');
} catch (error) {
    console.error(`❌ ERROR: Cannot read file - ${error.message}`);
    process.exit(1);
}

try {
    fs.accessSync(dbPath, fs.constants.W_OK);
    console.log('✓ File is writable');
} catch (error) {
    console.warn(`⚠ WARNING: File is read-only - ${error.message}`);
}

// Get file stats
const stats = fs.statSync(dbPath);
console.log(`✓ File size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`✓ Last modified: ${stats.mtime.toLocaleString()}`);
console.log('');

// Try to open database
let db;
try {
    console.log('Attempting to open database...');
    
    // Try to open in read-only mode first to check if it's locked
    try {
        db = new Database(dbPath, { readonly: true });
        console.log('✓ Database opened successfully (read-only mode)');
        db.close();
    } catch (readOnlyError) {
        if (readOnlyError.code === 'SQLITE_BUSY' || readOnlyError.message.includes('locked')) {
            console.error('❌ ERROR: Database is locked by another process');
            console.log('');
            console.log('Troubleshooting:');
            console.log('  1. Close any applications using the database');
            console.log('  2. Stop the Node.js server if it\'s running');
            console.log('  3. Check for WAL files and close any SQLite browsers');
            console.log('  4. Wait a few seconds and try again');
            process.exit(1);
        }
        throw readOnlyError;
    }
    
    // Open in read-write mode
    db = new Database(dbPath);
    console.log('✓ Database opened successfully (read-write mode)');
    console.log('');
    
} catch (error) {
    console.error(`❌ ERROR: Failed to open database`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.log('');
    
    if (error.code === 'SQLITE_CORRUPT') {
        console.log('Database appears to be corrupted. Try:');
        console.log('  1. Restore from backup');
        console.log('  2. Run: sqlite3 database.db ".recover" | sqlite3 recovered.db');
    } else if (error.code === 'SQLITE_BUSY' || error.message.includes('locked')) {
        console.log('Database is locked. Try:');
        console.log('  1. Close all applications using the database');
        console.log('  2. Stop the server');
        console.log('  3. Delete WAL files if safe to do so');
    }
    
    process.exit(1);
}

// Get database info
console.log('Database Information:');
console.log('-'.repeat(60));

try {
    // Get SQLite version
    const version = db.pragma('user_version');
    console.log(`SQLite Version: ${db.prepare('SELECT sqlite_version()').get()['sqlite_version()']}`);
    
    // Get journal mode
    const journalMode = db.pragma('journal_mode');
    const mode = Array.isArray(journalMode) ? journalMode[0]?.journal_mode : journalMode;
    console.log(`Journal Mode: ${mode || 'unknown'}`);
    
    // Get foreign keys status
    const foreignKeys = db.pragma('foreign_keys');
    const fkStatus = Array.isArray(foreignKeys) ? foreignKeys[0]?.foreign_keys : foreignKeys;
    console.log(`Foreign Keys: ${fkStatus ? 'Enabled' : 'Disabled'}`);
    
    // List all tables
    const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all();
    
    console.log('');
    console.log(`Tables (${tables.length}):`);
    console.log('-'.repeat(60));
    
    if (tables.length === 0) {
        console.log('  No tables found');
    } else {
        tables.forEach((table, index) => {
            try {
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
                console.log(`  ${(index + 1).toString().padStart(2)}. ${table.name.padEnd(30)} (${count.count} rows)`);
            } catch (err) {
                console.log(`  ${(index + 1).toString().padStart(2)}. ${table.name.padEnd(30)} (error reading)`);
            }
        });
    }
    
    console.log('');
    console.log('✓ Database inspection complete');
    
} catch (error) {
    console.error(`❌ Error inspecting database: ${error.message}`);
} finally {
    db.close();
    console.log('✓ Database connection closed');
}

console.log('');
console.log('='.repeat(60));
console.log('To open in a GUI tool:');
console.log('  1. Download DB Browser for SQLite: https://sqlitebrowser.org/');
console.log('  2. Or use VS Code extension: "SQLite Viewer"');
console.log('  3. Open the file:', dbPath);
console.log('='.repeat(60));

