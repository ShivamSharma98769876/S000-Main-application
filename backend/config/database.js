const { Pool } = require('pg');
const logger = require('./logger');

// Detect if running on Azure
const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME);

// Database connection pool
// Supports both DATABASE_URL and individual connection parameters
let poolConfig;

// Log environment detection
logger.info('Database configuration', {
    isAzure,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDbHost: !!process.env.DB_HOST,
    hasDbUser: !!process.env.DB_USER,
    hasDbPassword: !!process.env.DB_PASSWORD,
    websiteSiteName: process.env.WEBSITE_SITE_NAME,
    websiteHostname: process.env.WEBSITE_HOSTNAME
});

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
                connectionTimeoutMillis: 10000, // Increased to 10 seconds for cloud databases
            };
        } else {
            // Parse connection string to check if SSL is required
            const urlString = process.env.DATABASE_URL.toLowerCase();
            const requiresSSL = urlString.includes('sslmode=require') || 
                               urlString.includes('cloudclusters.net') ||
                               urlString.includes('azure.com') ||
                               urlString.includes('amazonaws.com') ||
                               process.env.NODE_ENV === 'production' || 
                               process.env.WEBSITE_SITE_NAME || 
                               process.env.WEBSITE_HOSTNAME;
            
            poolConfig = {
                connectionString: process.env.DATABASE_URL,
                connectionTimeoutMillis: 10000, // Increased to 10 seconds for cloud databases
                ssl: requiresSSL 
                    ? { 
                        rejectUnauthorized: false  // Allow self-signed certificates (common with cloud providers like CloudClusters)
                    } 
                    : false
            };
            
            if (requiresSSL) {
                logger.info('SSL enabled for database connection', { 
                    host: urlString.includes('@') ? urlString.split('@')[1].split('/')[0].split(':')[0] : 'unknown',
                    rejectUnauthorized: false 
                });
            }
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
            connectionTimeoutMillis: 10000, // Increased to 10 seconds for cloud databases
        };
    }
} else {
    // Check if we're on Azure but don't have database config
    if (isAzure && !process.env.DB_HOST && !process.env.DATABASE_URL) {
        logger.error('Azure deployment detected but database configuration is missing!', {
            error: 'Missing database configuration',
            required: 'DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD must be set',
            help: 'Set these in Azure Portal → Configuration → Application Settings'
        });
        throw new Error('Database configuration required for Azure deployment. Please set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in Azure Portal.');
    }
    
    // Check if SSL is required (cloud providers, Azure, or explicit SSL mode)
    const host = process.env.DB_HOST || '127.0.0.1';
    const requiresSSL = host.includes('cloudclusters.net') ||
                       host.includes('azure.com') ||
                       host.includes('amazonaws.com') ||
                       isAzure ||
                       process.env.DB_SSL === 'true';
    
    poolConfig = {
        host: host,
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'tradingpro',
        user: process.env.DB_USER || 'postgres',
        password: String(process.env.DB_PASSWORD || ''), // Use empty string if not set (for local dev without password)
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased to 10 seconds for cloud databases
        // Add SSL for cloud providers (with certificate verification disabled for self-signed certs)
        ssl: requiresSSL 
            ? { 
                rejectUnauthorized: false  // Allow self-signed certificates (common with cloud providers)
            } 
            : false
    };
    
    if (requiresSSL) {
        logger.info('SSL enabled for database connection', { 
            host: host,
            rejectUnauthorized: false 
        });
    }
    
    // Warn if using localhost on Azure
    if (isAzure && poolConfig.host === '127.0.0.1') {
        logger.error('⚠️  WARNING: Using localhost database on Azure!', {
            host: poolConfig.host,
            message: 'This will not work. Please set DATABASE_URL or DB_HOST in Azure Portal.'
        });
    }
}

// Log final pool configuration (without sensitive data)
const safeConfig = { ...poolConfig };
if (safeConfig.password) safeConfig.password = '***';
if (safeConfig.connectionString) safeConfig.connectionString = safeConfig.connectionString.replace(/:[^:@]+@/, ':***@');
logger.info('Database pool configuration', safeConfig);

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
