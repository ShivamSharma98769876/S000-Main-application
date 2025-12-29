/**
 * Security Headers and Input Sanitization Middleware
 */

const helmet = require('helmet');
const logger = require('../config/logger');

// Configure Helmet for security headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://appleid.cdn-apple.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://r2cdn.perplexity.ai"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://accounts.google.com", "https://appleid.apple.com"],
            frameSrc: ["'self'", "https://accounts.google.com", "https://appleid.apple.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    frameguard: {
        action: 'deny'
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize common XSS patterns
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            // Remove potential XSS patterns
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                .replace(/javascript:/gi, '')
                .trim();
        } else if (Array.isArray(obj)) {
            return obj.map(item => sanitize(item));
        } else if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = sanitize(obj[key]);
            }
            return sanitized;
        }
        return obj;
    };

    try {
        if (req.body) {
            req.body = sanitize(req.body);
        }
        if (req.query) {
            req.query = sanitize(req.query);
        }
        if (req.params) {
            req.params = sanitize(req.params);
        }
        next();
    } catch (error) {
        logger.error('Input sanitization failed:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to process request'
        });
    }
};

// SQL Injection protection (basic - use parameterized queries for full protection)
const sqlInjectionProtection = (req, res, next) => {
    // Routes that handle user-generated content and use parameterized queries
    // These can be safely excluded from SQL injection pattern matching
    const exemptRoutes = [
        '/api/v1/insights/admin',  // Market insights content
        '/api/v1/content',          // CMS content
        '/api/v1/testimonials'      // User testimonials
    ];

    // Skip SQL injection check for exempt routes
    if (exemptRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }

    // Skip SQL injection check for static files (HTML, CSS, JS, images, etc.)
    // These are served as static files and don't interact with the database
    const staticFileExtensions = ['.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
    if (staticFileExtensions.some(ext => req.path.toLowerCase().endsWith(ext))) {
        return next();
    }

    // Skip SQL injection check for health check and other system endpoints
    const systemRoutes = ['/health', '/ready', '/live', '/metrics'];
    if (systemRoutes.includes(req.path)) {
        return next();
    }

    // More specific SQL injection patterns - avoid false positives
    const sqlPatterns = [
        // SQL comment patterns (-- or #)
        /(\-\-)|(\%2D\%2D)|(#)/gi,
        // UNION SELECT pattern
        /((\%27)|(\'))\s*union\s+select/gi,
        // OR 1=1 pattern
        /\s+or\s+1\s*=\s*1/gi,
        // EXEC stored procedure
        /exec(\s|\+)+(s|x)p\w+/gi,
        // DROP TABLE pattern
        /drop\s+table/gi,
        // DELETE FROM pattern (suspicious)
        /delete\s+from\s+\w+\s+where\s+1\s*=\s*1/gi
    ];

    const checkForSql = (str) => {
        if (typeof str !== 'string') return false;
        
        // Skip checking if it looks like a JWT token (base64url encoded)
        // JWT tokens are long and contain only base64url characters
        if (str.length > 100 && /^[A-Za-z0-9_-]+$/.test(str)) {
            return false;
        }
        
        // Skip checking if it looks like a UUID or hash
        if (/^[a-f0-9]{32,}$/i.test(str) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
            return false;
        }
        
        return sqlPatterns.some(pattern => pattern.test(str));
    };

    const scanObject = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string' && checkForSql(obj[key])) {
                return true;
            } else if (typeof obj[key] === 'object') {
                if (scanObject(obj[key])) return true;
            }
        }
        return false;
    };

    try {
        if (scanObject(req.query) || scanObject(req.body) || scanObject(req.params)) {
            logger.warn('Potential SQL injection attempt detected', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                user: req.user?.email
            });

            return res.status(400).json({
                error: 'Bad Request',
                message: 'Invalid input detected'
            });
        }
        next();
    } catch (error) {
        logger.error('SQL injection check failed:', error);
        next();
    }
};

// Enhance session security
const enhanceSessionSecurity = (session) => {
    return session({
        name: 'sessionId', // Don't use default name
        secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true, // Prevent XSS access to cookie
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'lax', // CSRF protection
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            domain: process.env.COOKIE_DOMAIN || undefined
        },
        proxy: process.env.NODE_ENV === 'production' // Trust proxy in production
    });
};

// Prevent parameter pollution
const parameterPollutionProtection = (req, res, next) => {
    // Convert array parameters to single value (take first)
    const sanitizeParams = (obj) => {
        for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key].length > 0) {
                obj[key] = obj[key][0];
            }
        }
        return obj;
    };

    try {
        if (req.query) {
            req.query = sanitizeParams(req.query);
        }
        next();
    } catch (error) {
        logger.error('Parameter pollution protection failed:', error);
        next();
    }
};

module.exports = {
    securityHeaders,
    sanitizeInput,
    sqlInjectionProtection,
    enhanceSessionSecurity,
    parameterPollutionProtection
};


