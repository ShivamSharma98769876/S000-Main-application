#!/usr/bin/env node
/**
 * Create PostgreSQL database if it doesn't exist
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '../env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

// Connect to default 'postgres' database to create our database
const adminPoolConfig = process.env.DATABASE_URL
    ? {
        // Extract connection string and change database to 'postgres'
        connectionString: process.env.DATABASE_URL.replace(/\/[^\/]+$/, '/postgres'),
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: 'postgres', // Connect to default database
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
    };

const dbName = process.env.DB_NAME || 'tradingpro';

console.log('='.repeat(60));
console.log('Creating PostgreSQL Database');
console.log('='.repeat(60));
console.log(`Database name: ${dbName}`);
console.log(`Host: ${adminPoolConfig.host || 'from DATABASE_URL'}`);
console.log(`Port: ${adminPoolConfig.port || 'from DATABASE_URL'}`);
console.log(`User: ${adminPoolConfig.user || 'from DATABASE_URL'}`);
console.log('');

const adminPool = new Pool(adminPoolConfig);

(async () => {
    try {
        console.log('Connecting to PostgreSQL server...');
        const client = await adminPool.connect();
        console.log('✓ Connected to PostgreSQL server');
        
        // Check if database exists
        console.log(`\nChecking if database '${dbName}' exists...`);
        const checkResult = await client.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [dbName]
        );
        
        if (checkResult.rows.length > 0) {
            console.log(`✓ Database '${dbName}' already exists`);
            client.release();
            await adminPool.end();
            console.log('\n' + '='.repeat(60));
            console.log('✅ Database already exists!');
            console.log('='.repeat(60));
            console.log('\nNext step: Run migrations to create tables:');
            console.log('  npm run db:migrate');
            process.exit(0);
        }
        
        // Create database
        console.log(`\nCreating database '${dbName}'...`);
        // Note: CREATE DATABASE cannot be run in a transaction
        await client.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✓ Database '${dbName}' created successfully!`);
        
        client.release();
        await adminPool.end();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Database created successfully!');
        console.log('='.repeat(60));
        console.log('\nNext step: Run migrations to create tables:');
        console.log('  npm run db:migrate');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Failed to create database!');
        console.error(`\nError: ${error.message}`);
        console.error(`Code: ${error.code || 'N/A'}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Solution: PostgreSQL service is not running');
            console.error('   Windows: net start postgresql-x64-15');
            console.error('   Or check: services.msc → Start PostgreSQL service');
        } else if (error.code === '42P04') {
            console.error(`\n⚠️  Database '${dbName}' already exists (this is OK)`);
            console.error('   You can proceed to run migrations: npm run db:migrate');
        } else if (error.code === '28P01') {
            console.error('\n💡 Solution: Authentication failed');
            console.error('   Check DB_USER and DB_PASSWORD in env file');
        } else if (error.code === 'ENOTFOUND') {
            console.error('\n💡 Solution: Host not found');
            console.error('   Check DB_HOST in env file');
        } else if (error.code === '3D000') {
            console.error('\n💡 Solution: Cannot connect to default "postgres" database');
            console.error('   Make sure PostgreSQL is installed and running');
        }
        
        console.error('\n' + '='.repeat(60));
        await adminPool.end();
        process.exit(1);
    }
})();

