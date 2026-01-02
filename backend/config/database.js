const { Pool } = require('pg');
const logger = require('./logger');

// Database connection pool
// Supports both DATABASE_URL and individual connection parameters
let poolConfig;

if (process.env.DATABASE_URL) {
    try {
        // Parse DATABASE_URL to validate it
        const url = new URL(process.env.DATABASE_URL);
        // Check if username looks invalid (starts with =)
        if (url.username && url.username.startsWith('%3D')) {
            logger.warn('DATABASE_URL username appears to have invalid format. Using individual connection parameters instead.');
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
                ssl: (process.env.NODE_ENV === 'production' || process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME) 
                    ? { rejectUnauthorized: false } 
                    : false
            };
        }
    } catch (e) {
        logger.warn('Failed to parse DATABASE_URL, using individual connection parameters', { error: e.message });
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
        password: String(process.env.DB_PASSWORD || ''), // Use empty string if not set (for local dev without password)
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };
}

const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
    logger.info('PostgreSQL database connection established');
});

pool.on('error', (err) => {
    logger.error('Unexpected database error', {
        message: err.message,
        code: err.code,
        stack: err.stack
    });
    // Don't exit - let the app handle it gracefully
});

// Query helper function
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        logger.error('Database query error', { text, error: error.message });
        throw error;
    }
};

// Transaction helper
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    transaction
};
