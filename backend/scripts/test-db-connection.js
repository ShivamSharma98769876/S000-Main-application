#!/usr/bin/env node
/**
 * Test PostgreSQL database connection
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

// Database connection pool
const poolConfig = process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'tradingpro',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
    };

console.log('='.repeat(60));
console.log('Testing PostgreSQL Connection');
console.log('='.repeat(60));
console.log('Configuration:');
console.log(`  Host: ${poolConfig.host || 'from DATABASE_URL'}`);
console.log(`  Port: ${poolConfig.port || 'from DATABASE_URL'}`);
console.log(`  Database: ${poolConfig.database || 'from DATABASE_URL'}`);
console.log(`  User: ${poolConfig.user || 'from DATABASE_URL'}`);
console.log('');

const pool = new Pool(poolConfig);

(async () => {
    try {
        console.log('Attempting to connect...');
        const client = await pool.connect();
        console.log('✓ Connection successful!');
        
        // Test query
        const result = await client.query('SELECT NOW(), version()');
        console.log('✓ Query test successful!');
        console.log(`  Server time: ${result.rows[0].now}`);
        console.log(`  PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
        
        // Check if database exists and has tables
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log(`\n✓ Database has ${tablesResult.rows.length} tables`);
        if (tablesResult.rows.length > 0) {
            console.log('  Tables:', tablesResult.rows.map(r => r.table_name).join(', '));
        }
        
        // Check if session table exists (required for connect-pg-simple)
        const sessionTableExists = tablesResult.rows.some(r => r.table_name === 'session');
        if (!sessionTableExists) {
            console.log('\n⚠️  WARNING: session table does not exist');
            console.log('   This is required for session storage.');
            console.log('   Run migrations: npm run db:migrate');
        } else {
            console.log('\n✓ session table exists');
        }
        
        client.release();
        await pool.end();
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ All checks passed!');
        console.log('='.repeat(60));
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error(`\nError: ${error.message}`);
        console.error(`Code: ${error.code || 'N/A'}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Solution: PostgreSQL service is not running');
            console.error('   Windows: net start postgresql-x64-15');
            console.error('   Or: services.msc → Start PostgreSQL service');
        } else if (error.code === '3D000') {
            console.error('\n💡 Solution: Database does not exist');
            console.error('   Run: psql -U postgres');
            console.error('   Then: CREATE DATABASE tradingpro;');
        } else if (error.code === '28P01') {
            console.error('\n💡 Solution: Authentication failed');
            console.error('   Check DB_USER and DB_PASSWORD in .env file');
        } else if (error.code === 'ENOTFOUND') {
            console.error('\n💡 Solution: Host not found');
            console.error('   Check DB_HOST in .env file');
        }
        
        console.error('\n' + '='.repeat(60));
        await pool.end();
        process.exit(1);
    }
})();

