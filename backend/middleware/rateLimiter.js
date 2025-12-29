const rateLimit = require('express-rate-limit');

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
    legacyHeaders: false
});

module.exports = {
    rateLimiter,
    authRateLimiter,
    childAppRateLimiter
};


