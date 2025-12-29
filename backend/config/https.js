/**
 * HTTPS Configuration
 * For production deployment with SSL/TLS certificates
 */

const fs = require('fs');
const https = require('https');
const logger = require('./logger');

/**
 * Create HTTPS server with SSL certificates
 * @param {Express} app - Express application
 * @returns {https.Server|null} HTTPS server or null if certificates not found
 */
function createHttpsServer(app) {
    try {
        // Check if SSL certificates are configured
        const keyPath = process.env.SSL_KEY_PATH;
        const certPath = process.env.SSL_CERT_PATH;
        const caPath = process.env.SSL_CA_PATH; // Optional CA bundle

        if (!keyPath || !certPath) {
            logger.info('SSL certificates not configured. Using HTTP server.');
            return null;
        }

        // Check if certificate files exist
        if (!fs.existsSync(keyPath)) {
            logger.error(`SSL key file not found: ${keyPath}`);
            return null;
        }

        if (!fs.existsSync(certPath)) {
            logger.error(`SSL certificate file not found: ${certPath}`);
            return null;
        }

        // Read certificate files
        const httpsOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };

        // Add CA bundle if provided
        if (caPath && fs.existsSync(caPath)) {
            httpsOptions.ca = fs.readFileSync(caPath);
        }

        // Create HTTPS server
        const httpsServer = https.createServer(httpsOptions, app);
        
        logger.info('HTTPS server configured successfully');
        return httpsServer;
    } catch (error) {
        logger.error('Failed to create HTTPS server:', error);
        return null;
    }
}

/**
 * Middleware to redirect HTTP to HTTPS in production
 */
function redirectToHttps(req, res, next) {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
        // Check if request came through a proxy that terminates SSL
        const forwardedProto = req.headers['x-forwarded-proto'];
        
        if (forwardedProto !== 'https') {
            logger.info(`Redirecting HTTP to HTTPS: ${req.url}`);
            return res.redirect(301, `https://${req.headers.host}${req.url}`);
        }
    }
    next();
}

/**
 * Middleware to enforce HTTPS Strict Transport Security (HSTS)
 */
function enforceHSTS(req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        // Tell browsers to only use HTTPS for the next year
        res.setHeader(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );
    }
    next();
}

module.exports = {
    createHttpsServer,
    redirectToHttps,
    enforceHSTS
};


