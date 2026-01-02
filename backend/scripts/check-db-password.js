/**
 * Check database password configuration
 * This script helps diagnose password-related connection issues
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '../env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

console.log('\n=== Database Password Configuration Check ===\n');

// Check DATABASE_URL
if (process.env.DATABASE_URL) {
    console.log('✓ DATABASE_URL is set');
    try {
        const url = new URL(process.env.DATABASE_URL);
        console.log(`  Host: ${url.hostname}`);
        console.log(`  Port: ${url.port || '5432'}`);
        console.log(`  Database: ${url.pathname.replace('/', '')}`);
        console.log(`  Username: ${url.username}`);
        console.log(`  Password type: ${typeof url.password}`);
        console.log(`  Password value: ${url.password ? '***' + url.password.slice(-2) : 'NOT SET'}`);
        console.log(`  Password length: ${url.password ? url.password.length : 0}`);
        
        if (!url.password) {
            console.log('\n⚠️  WARNING: Password is missing from DATABASE_URL!');
            console.log('   Format should be: postgresql://username:password@host:port/database');
        }
    } catch (e) {
        console.log(`  ⚠️  Error parsing DATABASE_URL: ${e.message}`);
    }
} else {
    console.log('✗ DATABASE_URL is not set');
    console.log('  Using individual connection parameters:');
    console.log(`  DB_HOST: ${process.env.DB_HOST || '127.0.0.1'}`);
    console.log(`  DB_PORT: ${process.env.DB_PORT || '5432'}`);
    console.log(`  DB_NAME: ${process.env.DB_NAME || 'tradingpro'}`);
    console.log(`  DB_USER: ${process.env.DB_USER || 'postgres'}`);
    console.log(`  DB_PASSWORD type: ${typeof process.env.DB_PASSWORD}`);
    console.log(`  DB_PASSWORD value: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-2) : 'NOT SET'}`);
    console.log(`  DB_PASSWORD length: ${process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0}`);
    
    if (!process.env.DB_PASSWORD) {
        console.log('\n⚠️  WARNING: DB_PASSWORD is not set!');
        console.log('   If your PostgreSQL requires a password, set it in your .env or env file.');
    }
}

console.log('\n=== Environment File Locations ===');
console.log(`  Looking for env file at: ${envPath}`);
console.log(`  File exists: ${fs.existsSync(envPath)}`);
console.log(`  Looking for .env file at: ${path.join(__dirname, '../.env')}`);
console.log(`  File exists: ${fs.existsSync(path.join(__dirname, '../.env'))}`);

console.log('\n=== Recommendations ===');
if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
    console.log('1. Set DB_PASSWORD in your .env or env file');
    console.log('2. Or use DATABASE_URL format: postgresql://user:password@host:port/database');
    console.log('3. If PostgreSQL has no password, ensure DB_PASSWORD="" (empty string)');
} else if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (!url.password) {
        console.log('1. Add password to DATABASE_URL: postgresql://user:password@host:port/database');
    }
}

console.log('\n');

