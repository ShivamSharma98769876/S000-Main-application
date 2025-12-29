/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

const crypto = require('crypto');
const logger = require('../config/logger');

// Generate CSRF token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Store tokens in session
function getTokenFromSession(req) {
    if (!req.session) {
        throw new Error('Session middleware required for CSRF protection');
    }
    
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateToken();
    }
    
    return req.session.csrfToken;
}

// Middleware to add CSRF token to response
const csrfToken = (req, res, next) => {
    try {
        const token = getTokenFromSession(req);
        
        // Add token to response locals for templates
        res.locals.csrfToken = token;
        
        // Add method to get token
        req.csrfToken = () => token;
        
        next();
    } catch (error) {
        logger.error('CSRF token generation failed:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to generate CSRF token'
        });
    }
};

// Middleware to verify CSRF token
const csrfProtection = (req, res, next) => {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Skip for API endpoints using session-based auth (already has other protections)
    // But verify for state-changing operations
    try {
        const sessionToken = getTokenFromSession(req);
        const requestToken = req.headers['x-csrf-token'] || 
                           req.body._csrf || 
                           req.query._csrf;

        if (!requestToken) {
            logger.warn('CSRF token missing', {
                ip: req.ip,
                path: req.path,
                method: req.method
            });
            
            return res.status(403).json({
                error: 'Forbidden',
                message: 'CSRF token missing'
            });
        }

        if (requestToken !== sessionToken) {
            logger.warn('CSRF token mismatch', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                user: req.user?.email
            });
            
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Invalid CSRF token'
            });
        }

        next();
    } catch (error) {
        logger.error('CSRF verification failed:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'CSRF verification failed'
        });
    }
};

// Get CSRF token endpoint
const getCsrfToken = (req, res) => {
    try {
        const token = getTokenFromSession(req);
        res.json({ csrfToken: token });
    } catch (error) {
        logger.error('Failed to get CSRF token:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get CSRF token'
        });
    }
};

module.exports = {
    csrfToken,
    csrfProtection,
    getCsrfToken,
    generateToken
};


