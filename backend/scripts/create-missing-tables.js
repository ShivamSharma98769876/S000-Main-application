#!/usr/bin/env node
/**
 * Quick script to create missing database tables on Azure
 * Run this via SSH/Kudu Console: node scripts/create-missing-tables.js
 */

const Database = require('better-sqlite3');
const path = require('path');

// Get database path from environment or use default
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/tradingpro.db');

console.log('Creating missing database tables...');
console.log(`Database path: ${DB_PATH}`);

const db = new Database(DB_PATH);

try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Create error_logs table
    console.log('Creating error_logs table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS error_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT NOT NULL,
            stack TEXT,
            error_name TEXT,
            error_code TEXT,
            context TEXT,
            created_at DATETIME NOT NULL DEFAULT (datetime('now'))
        );
    `);
    console.log('✓ error_logs table created');

    // Create email_queue table
    console.log('Creating email_queue table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS email_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            recipient TEXT NOT NULL,
            data TEXT NOT NULL,
            priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
            status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
            retry_count INTEGER DEFAULT 0,
            error_message TEXT,
            created_at DATETIME NOT NULL,
            sent_at DATETIME,
            updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
        );
    `);
    console.log('✓ email_queue table created');

    // Create performance_metrics table
    console.log('Creating performance_metrics table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation TEXT NOT NULL,
            duration INTEGER NOT NULL,
            metadata TEXT,
            created_at DATETIME NOT NULL DEFAULT (datetime('now'))
        );
    `);
    console.log('✓ performance_metrics table created');

    // Create indexes
    console.log('Creating indexes...');
    db.exec(`CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, priority);`);
    console.log('✓ Indexes created');

    // Verify tables exist
    console.log('\nVerifying tables...');
    const tables = ['error_logs', 'email_queue', 'performance_metrics'];
    for (const table of tables) {
        const result = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        `).get(table);
        
        if (result) {
            console.log(`✓ ${table} exists`);
        } else {
            console.error(`✗ ${table} NOT found!`);
        }
    }

    console.log('\n✅ All missing tables created successfully!');
    console.log('You can now restart your Azure App Service.');
    
} catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
} finally {
    db.close();
}

