/**
 * Test database connection with password
 */

const path = require('path');
const fs = require('fs');

// Load environment variables FIRST
const envPath = path.join(__dirname, '../env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const { Pool } = require('pg');
const logger = require('../config/logger');

async function testConnection() {
    console.log('\n=== Testing Database Connection ===\n');
    
    // Build config exactly like database.js does
    let poolConfig;
    
    if (process.env.DATABASE_URL) {
        try {
            const url = new URL(process.env.DATABASE_URL);
            if (url.username && url.username.startsWith('%3D')) {
                poolConfig = {
                    host: process.env.DB_HOST || url.hostname || '127.0.0.1',
                    port: parseInt(process.env.DB_PORT) || parseInt(url.port) || 5432,
                    database: process.env.DB_NAME || url.pathname.replace('/', '') || 'tradingpro',
                    user: process.env.DB_USER || 'postgres',
                    password: String(process.env.DB_PASSWORD || url.password || ''),
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                };
            } else {
                poolConfig = {
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
                };
            }
        } catch (e) {
            poolConfig = {
                host: process.env.DB_HOST || '127.0.0.1',
                port: parseInt(process.env.DB_PORT) || 5432,
                database: process.env.DB_NAME || 'tradingpro',
                user: process.env.DB_USER || 'postgres',
                password: String(process.env.DB_PASSWORD || ''),
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            };
        }
    } else {
        poolConfig = {
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'tradingpro',
            user: process.env.DB_USER || 'postgres',
            password: String(process.env.DB_PASSWORD || ''),
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };
    }
    
    console.log('Connection config:');
    console.log(`  Host: ${poolConfig.host || 'N/A'}`);
    console.log(`  Port: ${poolConfig.port || 'N/A'}`);
    console.log(`  Database: ${poolConfig.database || 'N/A'}`);
    console.log(`  User: ${poolConfig.user || 'N/A'}`);
    console.log(`  Password type: ${typeof poolConfig.password}`);
    console.log(`  Password length: ${poolConfig.password ? poolConfig.password.length : 0}`);
    console.log(`  Password value: ${poolConfig.password ? '***' + poolConfig.password.slice(-2) : 'NOT SET'}`);
    
    // Check if password is a valid string
    if (typeof poolConfig.password !== 'string') {
        console.log('\n❌ ERROR: Password is not a string!');
        console.log(`   Type: ${typeof poolConfig.password}`);
        console.log(`   Value: ${poolConfig.password}`);
        process.exit(1);
    }
    
    if (poolConfig.password === 'undefined') {
        console.log('\n⚠️  WARNING: Password is the string "undefined"');
        console.log('   This means DB_PASSWORD was not set in environment');
    }
    
    console.log('\nAttempting to connect...\n');
    
    const pool = new Pool(poolConfig);
    
    try {
        const result = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
        console.log('✅ Connection successful!');
        console.log(`   Current time: ${result.rows[0].current_time}`);
        console.log(`   Database: ${result.rows[0].db_name}\n`);
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.log('❌ Connection failed!');
        console.log(`   Error: ${error.message}`);
        console.log(`   Code: ${error.code}`);
        console.log(`   Password type in error: ${typeof poolConfig.password}`);
        await pool.end();
        process.exit(1);
    }
}

testConnection();

