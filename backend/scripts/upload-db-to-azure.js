#!/usr/bin/env node
/**
 * Script to help upload local database to Azure
 * This script prepares the database file and provides instructions
 */

const path = require('path');
const fs = require('fs');

// Get local database path
const localDbPath = process.argv[2] || path.resolve(__dirname, '../../data/tradingpro.db');

console.log('='.repeat(60));
console.log('Database Upload Helper for Azure');
console.log('='.repeat(60));
console.log(`Local Database: ${localDbPath}`);
console.log('');

// Check if local database exists
if (!fs.existsSync(localDbPath)) {
    console.error(`❌ Local database not found at: ${localDbPath}`);
    console.log('');
    console.log('Please provide the path to your database file:');
    console.log('  node scripts/upload-db-to-azure.js /path/to/tradingpro.db');
    process.exit(1);
}

// Get file stats
const stats = fs.statSync(localDbPath);
const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

console.log(`✓ Database file found`);
console.log(`  Size: ${fileSizeMB} MB`);
console.log(`  Last modified: ${stats.mtime.toLocaleString()}`);
console.log('');

// Check for WAL files
const walPath = localDbPath + '-wal';
const shmPath = localDbPath + '-shm';
const hasWal = fs.existsSync(walPath);
const hasShm = fs.existsSync(shmPath);

if (hasWal || hasShm) {
    console.log('⚠️  WARNING: Database has WAL files. These should be merged before upload.');
    console.log('');
    console.log('To merge WAL files (recommended):');
    console.log('  1. Stop your local server');
    console.log('  2. Run: sqlite3 tradingpro.db "PRAGMA wal_checkpoint(FULL);"');
    console.log('  3. Wait for checkpoint to complete');
    console.log('  4. Then upload the database');
    console.log('');
}

// Check database integrity
console.log('Checking database integrity...');
const Database = require('better-sqlite3');
let db;
try {
    db = new Database(localDbPath, { readonly: true });
    const integrityCheck = db.pragma('integrity_check');
    const result = Array.isArray(integrityCheck) ? integrityCheck[0]?.integrity_check : integrityCheck;
    
    if (result === 'ok') {
        console.log('✓ Database integrity: OK');
    } else {
        console.error('❌ Database integrity check failed!');
        console.error('   Result:', result);
        console.log('');
        console.log('⚠️  Do not upload a corrupted database. Fix it first.');
        db.close();
        process.exit(1);
    }
    
    // Get table count
    const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    console.log(`✓ Found ${tables.length} tables`);
    
    // Get row counts
    let totalRows = 0;
    console.log('');
    console.log('Table row counts:');
    tables.forEach(table => {
        try {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
            totalRows += count.count;
            console.log(`  ${table.name.padEnd(30)} ${count.count.toString().padStart(6)} rows`);
        } catch (err) {
            console.log(`  ${table.name.padEnd(30)} (error)`);
        }
    });
    
    console.log('');
    console.log(`Total rows: ${totalRows}`);
    
    db.close();
} catch (error) {
    console.error('❌ Failed to check database:', error.message);
    if (db) db.close();
    process.exit(1);
}

console.log('');
console.log('='.repeat(60));
console.log('Upload Instructions');
console.log('='.repeat(60));
console.log('');
console.log('Method 1: Via Azure Portal (Recommended)');
console.log('─────────────────────────────────────');
console.log('1. Go to Azure Portal → Your App Service → Advanced Tools → Go');
console.log('2. Click "Debug console" → "CMD" (or "Bash")');
console.log('3. Navigate to: cd D:\\home\\site\\wwwroot (Windows) or cd /home/site/wwwroot (Linux)');
console.log('4. Create data directory: mkdir data');
console.log('5. Use the file upload feature in Kudu to upload your database file');
console.log('   OR use FTP/SFTP to upload the file');
console.log('');
console.log('Method 2: Via Azure CLI');
console.log('───────────────────────');
console.log('1. Install Azure CLI if not already installed');
console.log('2. Login: az login');
console.log('3. Upload file:');
console.log(`   az webapp deploy --name A000-Main-App --resource-group YourResourceGroup --src-path "${localDbPath}" --target-path "data/tradingpro.db" --type zip`);
console.log('');
console.log('Method 3: Via FTP/SFTP');
console.log('─────────────────────');
console.log('1. Get FTP credentials from Azure Portal → App Service → Deployment Center → FTPS credentials');
console.log('2. Use FTP client (FileZilla, WinSCP, etc.)');
console.log('3. Connect to your App Service');
console.log('4. Navigate to: /site/wwwroot/data/');
console.log('5. Upload: tradingpro.db');
console.log('');
console.log('Method 4: Via Kudu API (Advanced)');
console.log('─────────────────────────────────');
console.log('You can use the Kudu API to upload files programmatically');
console.log('');
console.log('After Upload:');
console.log('────────────');
console.log('1. Verify file exists: ls -la data/tradingpro.db (Linux) or dir data\\tradingpro.db (Windows)');
console.log('2. Check file permissions: chmod 644 data/tradingpro.db (Linux)');
console.log('3. Restart App Service');
console.log('4. Test the application');
console.log('');
console.log('⚠️  IMPORTANT:');
console.log('  - Stop the application before uploading (or it may corrupt the database)');
console.log('  - Backup existing database on Azure first');
console.log('  - Ensure file permissions allow read/write');
console.log('  - Database file should be in: /home/site/wwwroot/data/tradingpro.db');

