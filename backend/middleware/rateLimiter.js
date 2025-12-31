const rateLimit = require('express-rate-limit');

// Helper function to extract IP address from request
// Handles proxy scenarios (Azure App Service, load balancers, etc.)
const getClientIp = (req) => {
    // Check X-Forwarded-For header (most common proxy header)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        const ip = forwardedFor.split(',')[0].trim();
        // Remove port if present (e.g., "122.171.20.7:4126" -> "122.171.20.7")
        return ip.split(':')[0];
    }
    
    // Check X-Real-IP header (alternative proxy header)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return realIp.split(':')[0];
    }
    
    // Fallback to req.ip or req.connection.remoteAddress
    let ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
    
    // Remove port if present and handle IPv6 format
    if (ip) {
        // Handle IPv6 format: "::ffff:127.0.0.1" or "::1"
        if (ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }
        // Remove port number if present
        if (ip.includes(':')) {
            ip = ip.split(':')[0];
        }
    }
    
    // Final fallback
    return ip || 'unknown';
};

// General API rate limiter
const rateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    validate: {
        ip: false, // Disable built-in IP validation since we're using custom keyGenerator
    }
});

// Strict rate limiter for auth endpoints
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window (increased for development)
    message: {
        error: 'Too Many Requests',
        message: 'Too many login attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    validate: {
        ip: false, // Disable built-in IP validation since we're using custom keyGenerator
    }
});

// Rate limiter for child app token generation
const childAppRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 token generations per 15 min
    message: {
        error: 'Too Many Requests',
        message: 'Too many token requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    validate: {
        ip: false, // Disable built-in IP validation since we're using custom keyGenerator
    }
});

module.exports = {
    rateLimiter,
    authRateLimiter,
    childAppRateLimiter
};


