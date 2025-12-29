const { Pool } = require('pg');
const logger = require('./logger');

// Database connection pool
//const pool = new Pool({
  //  host: process.env.DB_HOST || '127.0.0.1',
    //port: parseInt(process.env.DB_PORT) || 5432,
    //database: process.env.DB_NAME || 'tradingpro',
    //user: process.env.DB_USER || 'postgres',
    //password: process.env.DB_PASSWORD,
    //max: 20,
    //idleTimeoutMillis: 30000,
    //connectionTimeoutMillis: 2000,
//});

const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'tradingpro',
  password: 'Itsme123',
  port: 5432,
});

// Test database connection
pool.on('connect', () => {
    logger.info('Database connection established');
});

pool.on('error', (err) => {
    logger.error('Unexpected database error', err);
    process.exit(-1);
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


