#!/usr/bin/env node
/**
 * Check database configuration without exposing sensitive data
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

console.log('='.repeat(60));
console.log('Database Configuration Check');
console.log('='.repeat(60));

if (process.env.DATABASE_URL) {
    console.log('✓ DATABASE_URL is set');
    // Parse and display connection info without password
    try {
        const url = new URL(process.env.DATABASE_URL);
        console.log(`  Protocol: ${url.protocol}`);
        console.log(`  Host: ${url.hostname}`);
        console.log(`  Port: ${url.port || 'default'}`);
        console.log(`  Database: ${url.pathname.replace('/', '')}`);
        console.log(`  Username: ${url.username}`);
        console.log(`  Password: ${url.password ? '***' + url.password.slice(-2) : 'not set'}`);
    } catch (e) {
        console.log('  ⚠️  DATABASE_URL format appears invalid');
        console.log(`  Error: ${e.message}`);
    }
} else {
    console.log('✗ DATABASE_URL is not set');
    console.log('  Using individual connection parameters:');
    console.log(`  DB_HOST: ${process.env.DB_HOST || '127.0.0.1'}`);
    console.log(`  DB_PORT: ${process.env.DB_PORT || '5432'}`);
    console.log(`  DB_NAME: ${process.env.DB_NAME || 'tradingpro'}`);
    console.log(`  DB_USER: ${process.env.DB_USER || 'postgres'}`);
    console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-2) : 'not set'}`);
}

console.log('\n' + '='.repeat(60));

