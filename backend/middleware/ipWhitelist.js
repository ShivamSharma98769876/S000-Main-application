const logger = require('../config/logger');

// IP Whitelist configuration
// Set ADMIN_IP_WHITELIST environment variable with comma-separated IPs
// Example: ADMIN_IP_WHITELIST=127.0.0.1,192.168.1.100,10.0.0.50

const getClientIP = (req) => {
    // Check various headers for real IP (useful behind proxies/load balancers)
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip;
};

const ipWhitelist = (req, res, next) => {
    // Skip if IP whitelisting is not enabled
    if (!process.env.ENABLE_IP_WHITELIST || process.env.ENABLE_IP_WHITELIST !== 'true') {
        return next();
    }

    const clientIP = getClientIP(req);
    const whitelist = process.env.ADMIN_IP_WHITELIST?.split(',').map(ip => ip.trim()) || [];

    // If no whitelist configured, log warning but allow
    if (whitelist.length === 0) {
        logger.warn('IP whitelist enabled but no IPs configured in ADMIN_IP_WHITELIST');
        return next();
    }

    // Check if client IP is in whitelist
    const isWhitelisted = whitelist.some(whitelistedIP => {
        // Support for CIDR notation or exact match
        if (whitelistedIP.includes('/')) {
            // CIDR range check would go here (requires additional library)
            return false;
        }
        return clientIP === whitelistedIP || clientIP.includes(whitelistedIP);
    });

    if (isWhitelisted) {
        logger.info(`IP whitelist: Allowed access from ${clientIP}`);
        return next();
    }

    // IP not whitelisted
    logger.warn(`IP whitelist: Blocked access attempt from ${clientIP}`, {
        ip: clientIP,
        path: req.path,
        method: req.method,
        user: req.user?.email
    });

    res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. Your IP address is not authorized for admin access.'
    });
};

// Apply whitelist only to admin routes
const adminIPWhitelist = (req, res, next) => {
    // Only apply to admin routes
    if (req.path.startsWith('/admin') || req.baseUrl.includes('/admin')) {
        return ipWhitelist(req, res, next);
    }
    next();
};

module.exports = {
    ipWhitelist,
    adminIPWhitelist,
    getClientIP
};



