const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
        msg += ` | ${JSON.stringify(metadata)}`;
    }
    
    return msg;
});

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format (human-readable)
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    customFormat
);

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { 
        service: 'tradingpro-api',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Error logs
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        // Warning logs
        new winston.transports.File({ 
            filename: path.join(logsDir, 'warn.log'), 
            level: 'warn',
            maxsize: 10485760,
            maxFiles: 3,
            tailable: true
        }),
        // All logs
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760,
            maxFiles: 5,
            tailable: true
        }),
        // HTTP access logs (for Morgan)
        new winston.transports.File({ 
            filename: path.join(logsDir, 'access.log'),
            maxsize: 10485760,
            maxFiles: 3,
            tailable: true
        })
    ],
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 10485760,
            maxFiles: 5
        })
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 10485760,
            maxFiles: 5
        })
    ]
});

// If not in production, log to console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Create a stream object for Morgan (HTTP access logs)
logger.stream = {
    write: (message) => {
        logger.info(message.trim(), { type: 'http-access' });
    }
};

// Helper methods for structured logging
logger.logRequest = (req, metadata = {}) => {
    logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id,
        ...metadata
    });
};

logger.logError = (error, context = {}) => {
    logger.error(error.message, {
        stack: error.stack,
        ...context
    });
};

logger.logSecurityEvent = (event, metadata = {}) => {
    logger.warn('Security Event', {
        event,
        timestamp: new Date().toISOString(),
        ...metadata
    });
};

logger.logPerformance = (operation, duration, metadata = {}) => {
    logger.info('Performance Metric', {
        operation,
        duration: `${duration}ms`,
        ...metadata
    });
};

module.exports = logger;


