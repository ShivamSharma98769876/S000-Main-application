const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Get database path from environment or use default
// Default to root data folder: D:\Automation\FIn-Independence\data\tradingpro.db
// From backend/config/, go up two levels to reach project root, then into data folder
const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/tradingpro.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create or open database
// better-sqlite3 opens in read-write mode by default
// Check if file exists and has write permissions
let db;
try {
    // Ensure the database file and directory are writable
    if (fs.existsSync(DB_PATH)) {
        // Check if file is writable
        try {
            fs.accessSync(DB_PATH, fs.constants.W_OK);
        } catch (accessError) {
            logger.error('Database file is not writable', { 
                path: DB_PATH, 
                error: accessError.message 
            });
            throw new Error(`Database file is not writable: ${DB_PATH}`);
        }
    }
    
    // Open database
    db = new Database(DB_PATH);
    
} catch (error) {
    logger.error('Failed to open database', { 
        path: DB_PATH, 
        error: error.message,
        code: error.code
    });
    throw error;
}

// Enable foreign keys
try {
    db.pragma('foreign_keys = ON');
} catch (error) {
    logger.warn('Failed to enable foreign keys', { error: error.message });
}

// Enable WAL mode for better concurrency
// WAL mode requires write access, so we catch errors here
try {
    const journalModeResult = db.pragma('journal_mode');
    const currentMode = Array.isArray(journalModeResult) ? journalModeResult[0]?.journal_mode : journalModeResult;
    
    if (currentMode && currentMode.toLowerCase() !== 'wal') {
        db.pragma('journal_mode = WAL');
        logger.info('WAL mode enabled');
    } else {
        logger.debug('WAL mode already enabled');
    }
} catch (error) {
    logger.error('Failed to enable WAL mode - database may be read-only', { 
        error: error.message,
        code: error.code 
    });
    // Don't throw - allow the app to continue, but log the error
    // The database will work in default journal mode
}

// Set busy timeout (milliseconds to wait when database is locked)
db.pragma('busy_timeout = 5000');

// Test database connection
logger.info('SQLite database connection established', { path: DB_PATH });

// Helper function to sanitize parameters for SQLite
// SQLite can only bind: numbers, strings, bigints, buffers, and null
function sanitizeParams(params) {
    if (!params || !Array.isArray(params)) {
        return [];
    }
    
    return params.map((param, index) => {
        // Handle null and undefined
        if (param === null || param === undefined) {
            return null;
        }
        
        // Handle primitive types (number, string, bigint)
        if (typeof param === 'number' || typeof param === 'string' || typeof param === 'bigint') {
            return param;
        }
        
        // Handle Buffer
        if (Buffer.isBuffer(param)) {
            return param;
        }
        
        // Handle boolean - convert to integer (0 or 1)
        if (typeof param === 'boolean') {
            return param ? 1 : 0;
        }
        
        // Handle Date - convert to ISO string
        if (param instanceof Date) {
            return param.toISOString();
        }
        
        // Handle objects - convert to JSON string
        if (typeof param === 'object') {
            try {
                return JSON.stringify(param);
            } catch (e) {
                logger.warn('Failed to stringify parameter', { index, param, error: e.message });
                return null;
            }
        }
        
        // For any other type, convert to string
        logger.warn('Converting unsupported parameter type to string', { index, type: typeof param, param });
        return String(param);
    });
}

// Query helper function (compatible with PostgreSQL query interface)
const query = async (text, params = []) => {
    const start = Date.now();
    try {
        // Convert PostgreSQL to SQLite syntax
        let sqliteQuery = text;
        
        // Sanitize parameters first
        const sanitizedParams = sanitizeParams(params);
        
        // Replace PostgreSQL parameterized queries ($1, $2) with SQLite (?)
        if (sanitizedParams && sanitizedParams.length > 0) {
            sqliteQuery = sqliteQuery.replace(/\$(\d+)/g, '?');
        }
        
        // Replace PostgreSQL functions with SQLite equivalents
        // Replace NOW() with (datetime('now')) - SQLite requires parentheses in DEFAULT clauses
        sqliteQuery = sqliteQuery.replace(/\bNOW\s*\(\s*\)/gi, "(datetime('now'))");
        // Replace SERIAL with INTEGER for SQLite
        sqliteQuery = sqliteQuery.replace(/\bSERIAL\b/gi, 'INTEGER');
        // Replace BIGSERIAL with INTEGER for SQLite
        sqliteQuery = sqliteQuery.replace(/\bBIGSERIAL\b/gi, 'INTEGER');
        // Replace JSONB with TEXT for SQLite (store as JSON string)
        sqliteQuery = sqliteQuery.replace(/\bJSONB\b/gi, 'TEXT');
        // Replace NUMERIC with REAL for SQLite (or keep as NUMERIC - SQLite supports it)
        // SQLite doesn't support RETURNING in all contexts
        sqliteQuery = sqliteQuery.replace(/\bRETURNING\s+\*/gi, '');
        // Fix DEFAULT clauses - if we have DEFAULT (datetime('now')), remove extra parentheses
        // This handles cases like DEFAULT NOW() which becomes DEFAULT (datetime('now'))
        sqliteQuery = sqliteQuery.replace(/DEFAULT\s+\(\(datetime\('now'\)\)\)/gi, "DEFAULT (datetime('now'))");

        const stmt = db.prepare(sqliteQuery);
        
        // Execute query
        const queryType = sqliteQuery.trim().toUpperCase().split(/\s+/)[0];
        
        if (queryType === 'SELECT') {
            const rows = sanitizedParams.length > 0 ? stmt.all(sanitizedParams) : stmt.all();
            const duration = Date.now() - start;
            logger.debug('Executed query', { text: sqliteQuery, duration, rows: rows.length });
            return {
                rows,
                rowCount: rows.length,
                command: 'SELECT'
            };
        } else if (queryType === 'INSERT') {
            // INSERT - SQLite doesn't support RETURNING, so we need to handle it differently
            const result = sanitizedParams.length > 0 ? stmt.run(sanitizedParams) : stmt.run();
            const duration = Date.now() - start;
            
            // If the original query had RETURNING, fetch the inserted row
            let rows = [];
            if (text.toUpperCase().includes('RETURNING') && result.lastInsertRowid) {
                // Extract table name from INSERT statement
                const tableMatch = sqliteQuery.match(/INSERT\s+INTO\s+(\w+)/i);
                if (tableMatch) {
                    const tableName = tableMatch[1];
                    const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
                    const insertedRow = selectStmt.get(result.lastInsertRowid);
                    if (insertedRow) {
                        rows = [insertedRow];
                    }
                }
            }
            
            logger.debug('Executed query', { text: sqliteQuery, duration, changes: result.changes, lastInsertRowid: result.lastInsertRowid });
            return {
                rows,
                rowCount: result.changes,
                command: 'INSERT',
                lastInsertRowid: result.lastInsertRowid
            };
        } else if (queryType === 'UPDATE') {
            // UPDATE - SQLite doesn't support RETURNING, so we need to handle it differently
            const result = sanitizedParams.length > 0 ? stmt.run(sanitizedParams) : stmt.run();
            const duration = Date.now() - start;
            
            // If the original query had RETURNING, fetch the updated row
            let rows = [];
            if (text.toUpperCase().includes('RETURNING') && result.changes > 0) {
                // Extract table name from UPDATE statement
                const tableMatch = sqliteQuery.match(/UPDATE\s+(\w+)/i);
                if (tableMatch) {
                    const tableName = tableMatch[1];
                    // Try to find WHERE id = ? pattern
                    const whereIdMatch = sqliteQuery.match(/WHERE\s+id\s*=\s*\?/i);
                    if (whereIdMatch && sanitizedParams.length > 0) {
                        // Find the position of the ? in WHERE id = ?
                        const whereIndex = sqliteQuery.indexOf('WHERE');
                        const afterWhere = sqliteQuery.substring(whereIndex);
                        // Count ? placeholders before the WHERE clause
                        const beforeWhere = sqliteQuery.substring(0, whereIndex);
                        const paramCountBeforeWhere = (beforeWhere.match(/\?/g) || []).length;
                        // The ID parameter is at the index corresponding to the ? in WHERE id = ?
                        // Since WHERE id = ? comes after all SET parameters, use the last parameter
                        const idParam = sanitizedParams[sanitizedParams.length - 1];
                        if (idParam !== undefined) {
                            try {
                                const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
                                const updatedRow = selectStmt.get(idParam);
                                if (updatedRow) {
                                    rows = [updatedRow];
                                }
                            } catch (selectError) {
                                logger.warn('Failed to fetch updated row', { error: selectError.message });
                            }
                        }
                    }
                }
            }
            
            logger.debug('Executed query', { text: sqliteQuery, duration, changes: result.changes });
            return {
                rows,
                rowCount: result.changes,
                command: 'UPDATE',
                lastInsertRowid: result.lastInsertRowid
            };
        } else {
            // DELETE
            const result = sanitizedParams.length > 0 ? stmt.run(sanitizedParams) : stmt.run();
            const duration = Date.now() - start;
            logger.debug('Executed query', { text: sqliteQuery, duration, changes: result.changes });
            return {
                rows: [],
                rowCount: result.changes,
                command: queryType,
                lastInsertRowid: result.lastInsertRowid
            };
        }
    } catch (error) {
        logger.error('Database query error', { text, error: error.message, params });
        throw error;
    }
};

// Transaction helper (compatible with PostgreSQL transaction interface)
const transaction = async (callback) => {
    const transactionFn = db.transaction((client) => {
        // Create a mock client object that has a query method
        const mockClient = {
            query: (text, params = []) => {
                let sqliteQuery = text;
                
                // Sanitize parameters
                const sanitizedParams = sanitizeParams(params);
                
                // Replace PostgreSQL parameterized queries ($1, $2) with SQLite (?)
                if (sanitizedParams && sanitizedParams.length > 0) {
                    sqliteQuery = sqliteQuery.replace(/\$(\d+)/g, '?');
                }
                
                // Replace PostgreSQL functions with SQLite equivalents
                sqliteQuery = sqliteQuery.replace(/\bNOW\s*\(\s*\)/gi, "(datetime('now'))");
                
                const stmt = db.prepare(sqliteQuery);
                
                if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
                    const rows = sanitizedParams.length > 0 ? stmt.all(sanitizedParams) : stmt.all();
                    return { rows, rowCount: rows.length };
                } else if (sqliteQuery.trim().toUpperCase().startsWith('INSERT')) {
                    // INSERT - handle RETURNING clause
                    const result = sanitizedParams.length > 0 ? stmt.run(sanitizedParams) : stmt.run();
                    
                    // If the original query had RETURNING, fetch the inserted row
                    let rows = [];
                    if (text.toUpperCase().includes('RETURNING') && result.lastInsertRowid) {
                        const tableMatch = sqliteQuery.match(/INSERT\s+INTO\s+(\w+)/i);
                        if (tableMatch) {
                            const tableName = tableMatch[1];
                            const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
                            const insertedRow = selectStmt.get(result.lastInsertRowid);
                            if (insertedRow) {
                                rows = [insertedRow];
                            }
                        }
                    }
                    
                    return {
                        rows,
                        rowCount: result.changes,
                        lastInsertRowid: result.lastInsertRowid
                    };
                } else if (sqliteQuery.trim().toUpperCase().startsWith('UPDATE')) {
                    // UPDATE - handle RETURNING clause
                    const result = sanitizedParams.length > 0 ? stmt.run(sanitizedParams) : stmt.run();
                    
                    // If the original query had RETURNING, fetch the updated row
                    let rows = [];
                    if (text.toUpperCase().includes('RETURNING') && result.changes > 0) {
                        const tableMatch = sqliteQuery.match(/UPDATE\s+(\w+)/i);
                        if (tableMatch) {
                            const tableName = tableMatch[1];
                            const whereIdMatch = sqliteQuery.match(/WHERE\s+id\s*=\s*\?/i);
                            if (whereIdMatch && sanitizedParams.length > 0) {
                                const idParam = sanitizedParams[sanitizedParams.length - 1];
                                if (idParam !== undefined) {
                                    try {
                                        const selectStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
                                        const updatedRow = selectStmt.get(idParam);
                                        if (updatedRow) {
                                            rows = [updatedRow];
                                        }
                                    } catch (selectError) {
                                        // Silently fail - row might not exist
                                    }
                                }
                            }
                        }
                    }
                    
                    return {
                        rows,
                        rowCount: result.changes,
                        lastInsertRowid: result.lastInsertRowid
                    };
                } else {
                    // DELETE
                    const result = sanitizedParams.length > 0 ? stmt.run(sanitizedParams) : stmt.run();
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
        return transactionFn();
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

