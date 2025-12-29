const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Get database path from environment or use default
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/tradingpro.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create or open database
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Set busy timeout (milliseconds to wait when database is locked)
db.pragma('busy_timeout = 5000');

// Test database connection
logger.info('SQLite database connection established', { path: DB_PATH });

// Query helper function (compatible with PostgreSQL query interface)
const query = async (text, params = []) => {
    const start = Date.now();
    try {
        // Convert PostgreSQL parameterized queries ($1, $2) to SQLite (?)
        let sqliteQuery = text;
        if (params && params.length > 0) {
            // Replace $1, $2, etc. with ?
            sqliteQuery = text.replace(/\$(\d+)/g, '?');
        }

        const stmt = db.prepare(sqliteQuery);
        
        // Execute query
        if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
            const rows = params.length > 0 ? stmt.all(params) : stmt.all();
            const duration = Date.now() - start;
            logger.debug('Executed query', { text: sqliteQuery, duration, rows: rows.length });
            return {
                rows,
                rowCount: rows.length,
                command: 'SELECT'
            };
        } else {
            // INSERT, UPDATE, DELETE
            const result = params.length > 0 ? stmt.run(params) : stmt.run();
            const duration = Date.now() - start;
            logger.debug('Executed query', { text: sqliteQuery, duration, changes: result.changes });
            return {
                rows: [],
                rowCount: result.changes,
                command: sqliteQuery.trim().split(' ')[0].toUpperCase(),
                lastInsertRowid: result.lastInsertRowid
            };
        }
    } catch (error) {
        logger.error('Database query error', { text, error: error.message });
        throw error;
    }
};

// Transaction helper (compatible with PostgreSQL transaction interface)
const transaction = async (callback) => {
    const transaction = db.transaction((client) => {
        // Create a mock client object that has a query method
        const mockClient = {
            query: async (text, params = []) => {
                let sqliteQuery = text;
                if (params && params.length > 0) {
                    sqliteQuery = text.replace(/\$(\d+)/g, '?');
                }
                const stmt = db.prepare(sqliteQuery);
                
                if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
                    const rows = params.length > 0 ? stmt.all(params) : stmt.all();
                    return { rows, rowCount: rows.length };
                } else {
                    const result = params.length > 0 ? stmt.run(params) : stmt.run();
                    return {
                        rows: [],
                        rowCount: result.changes,
                        lastInsertRowid: result.lastInsertRowid
                    };
                }
            }
        };
        return callback(mockClient);
    });
    
    try {
        return await transaction();
    } catch (error) {
        logger.error('Transaction error', error);
        throw error;
    }
};

// Pool-like interface for compatibility
const pool = {
    connect: async () => {
        return {
            query: async (text, params = []) => {
                return await query(text, params);
            },
            release: () => {
                // No-op for SQLite
            }
        };
    },
    query: async (text, params = []) => {
        return await query(text, params);
    },
    end: async () => {
        db.close();
        logger.info('SQLite database connection closed');
    }
};

module.exports = {
    db,
    pool,
    query,
    transaction
};

