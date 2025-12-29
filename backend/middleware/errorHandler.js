const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error('Error occurred', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    
    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message,
            details: err.details
        });
    }
    
    // Database errors
    if (err.code && err.code.startsWith('23')) {
        if (err.code === '23505') {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Resource already exists'
            });
        }
        if (err.code === '23503') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Referenced resource does not exist'
            });
        }
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Token expired'
        });
    }
    
    // Multer errors (file upload)
    if (err.name === 'MulterError') {
        return res.status(400).json({
            error: 'File Upload Error',
            message: err.message
        });
    }
    
    // Default error
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message;
    
    res.status(statusCode).json({
        error: err.name || 'Error',
        message: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = {
    errorHandler
};


