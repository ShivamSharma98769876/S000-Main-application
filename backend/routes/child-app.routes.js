const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwtService = require('../services/jwt.service');
const { isAuthenticated } = require('../middleware/auth');
const logger = require('../config/logger');
const { query } = require('../config/database');
const { childAppRateLimiter } = require('../middleware/rateLimiter');
const { csrfProtection } = require('../middleware/csrf');

const toHttpsOrigin = (urlValue) => {
    if (!urlValue) return null;
    try {
        const parsed = new URL(urlValue);
        if (parsed.protocol !== 'https:') {
            parsed.protocol = 'https:';
        }
        return parsed.origin;
    } catch {
        return null;
    }
};

const getFrontendOrigin = () => {
    if (process.env.FRONTEND_URL) {
        return toHttpsOrigin(process.env.FRONTEND_URL) || process.env.FRONTEND_URL;
    }
    if (process.env.WEBSITE_HOSTNAME) {
        return `https://${process.env.WEBSITE_HOSTNAME}`;
    }
    if (process.env.WEBSITE_SITE_NAME) {
        const region = process.env.WEBSITE_SITE_NAME.includes('southindia') ? 'southindia-01' : 'eastus';
        return `https://${process.env.WEBSITE_SITE_NAME}.${region}.azurewebsites.net`;
    }
    return 'http://localhost:3000';
};

// Helper function to get CHILD_APP_URL
// Priority: 1. process.env.CHILD_APP_URL (for Azure/cloud deployments)
//          2. backend/.env file (for local development)
function getChildAppUrl() {
    // First, check if CHILD_APP_URL is set as an environment variable (Azure/cloud)
    if (process.env.CHILD_APP_URL) {
        const url = process.env.CHILD_APP_URL.trim();
        logger.info('Using CHILD_APP_URL from environment variable', { url });
        // Remove quotes if present
        return url.replace(/^["']|["']$/g, '');
    }
    
    // Fallback to reading from backend/.env file (local development)
    const envPath = path.join(__dirname, '..', '.env');
    
    if (!fs.existsSync(envPath)) {
        logger.error('backend/.env file does not exist and CHILD_APP_URL not set in environment');
        throw new Error('CHILD_APP_URL is not configured. Please set CHILD_APP_URL as an environment variable or in backend/.env file');
    }
    
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/^CHILD_APP_URL=(.+)$/m);
        if (match && match[1]) {
            const url = match[1].trim();
            // Remove quotes if present
            const cleanUrl = url.replace(/^["']|["']$/g, '');
            // Skip commented lines
            if (!cleanUrl.startsWith('#')) {
                logger.info('Using CHILD_APP_URL from .env file', { url: cleanUrl });
                return cleanUrl;
            }
        }
        
        // CHILD_APP_URL not found in .env file
        logger.error('CHILD_APP_URL is not defined in backend/.env file or as environment variable');
        throw new Error('CHILD_APP_URL is not configured. Please set CHILD_APP_URL as an environment variable (for Azure) or in backend/.env file (for local)');
    } catch (error) {
        if (error.message.includes('CHILD_APP_URL is not configured')) {
            throw error;
        }
        logger.error('Failed to read CHILD_APP_URL from backend/.env file', { error: error.message });
        throw new Error(`Failed to read CHILD_APP_URL from backend/.env file: ${error.message}`);
    }
}

/**
 * GET /api/v1/child-app/test-session-id
 * Test endpoint to verify session ID is available (no auth required for testing)
 */
router.get('/test-session-id', async (req, res) => {
    try {
        res.json({
            success: true,
            sessionID: req.sessionID,
            hasSession: !!req.session,
            isAuthenticated: req.isAuthenticated(),
            message: 'Session ID is available for transfer'
        });
    } catch (error) {
        logger.error('Error in test-session-id', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/child-app/generate-token
 * Generate JWT token for accessing child application
 */
router.get('/generate-token', isAuthenticated, childAppRateLimiter, async (req, res) => {
    try {
        const user = req.user;

        // Fetch fresh user data
        const userResult = await query(
            `SELECT u.id, u.email, up.full_name, up.profile_completed, up.zerodha_client_id
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = $1`,
            [user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userResult.rows[0];

        // Generate JWT token
        const token = jwtService.generateToken(userData, req.sessionID);

        // Log token generation for audit
        await query(
            `INSERT INTO app_access_audit 
             (user_id, source_app, target_app, token_id, ip_address, user_agent, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
                user.id,
                'main-app',
                'child-app',
                jwtService.decodeToken(token).payload.jti,
                req.ip,
                req.get('user-agent')
            ]
        );

        res.json({
            success: true,
            token,
            expiresIn: process.env.JWT_EXPIRY || '10m',
            child_app_url: getChildAppUrl()
        });

    } catch (error) {
        logger.error('Failed to generate child app token', error);
        res.status(500).json({ error: 'Failed to generate access token' });
    }
});

/**
 * POST /api/v1/child-app/launch
 * Launch child app with token (returns redirect URL)
 */
router.post('/launch', isAuthenticated, csrfProtection, async (req, res) => {
    try {
        const user = req.user;
        const { return_url } = req.body;

        // Fetch fresh user data including zerodha_client_id
        const userResult = await query(
            `SELECT u.id, u.email, up.full_name, up.profile_completed, up.zerodha_client_id
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = $1`,
            [user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userResult.rows[0];

        const token = jwtService.generateToken(userData, req.sessionID);

        // Build child app URL with token
        const childAppUrlValue = getChildAppUrl();
        const childAppUrl = new URL(childAppUrlValue);
        childAppUrl.searchParams.append('sso_token', token);
        
        if (return_url) {
            childAppUrl.searchParams.append('return_url', return_url);
        }

        logger.info('Child app launch initiated', {
            user_id: user.id,
            child_app: childAppUrlValue
        });

        res.json({
            success: true,
            redirect_url: childAppUrl.toString()
        });

    } catch (error) {
        logger.error('Failed to launch child app', error);
        res.status(500).json({ error: 'Failed to launch child app' });
    }
});

/**
 * POST /api/v1/child-app/refresh-token
 * Refresh expired token
 */
router.post('/refresh-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        const decoded = jwtService.decodeToken(token);
        const newToken = jwtService.refreshToken(token);

        // Log token refresh for audit
        if (decoded && decoded.payload && decoded.payload.user_id) {
            await query(
                `INSERT INTO app_access_audit 
                 (user_id, source_app, target_app, action, token_id, ip_address, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [
                    decoded.payload.user_id,
                    'main-app',
                    'child-app',
                    'token_refreshed',
                    decoded.payload.jti,
                    req.ip,
                    req.get('user-agent')
                ]
            );
        }

        res.json({
            success: true,
            token: newToken,
            expiresIn: process.env.JWT_EXPIRY || '10m'
        });

    } catch (error) {
        logger.error('Failed to refresh token', error);
        res.status(401).json({ error: error.message || 'Failed to refresh token' });
    }
});

/**
 * POST /api/v1/child-app/verify-token
 * Verify token validity (for child app to call)
 * Supports both inter-app tokens and user auth tokens
 */
router.post('/verify-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        let decoded;
        let tokenType = 'unknown';

        // Try to verify as user auth token first (from OAuth login)
        try {
            decoded = jwtService.verifyAuthToken(token, 'StockSage-child-app');
            tokenType = 'user-auth';
        } catch (authError) {
            // If that fails, try as inter-app token
            try {
                decoded = jwtService.verifyToken(token);
                tokenType = 'inter-app';
            } catch (interAppError) {
                throw new Error('Invalid token');
            }
        }

        res.json({
            success: true,
            valid: true,
            tokenType: tokenType,
            user: {
                user_id: decoded.user_id,
                email: decoded.email,
                full_name: decoded.full_name || '',
                profile_completed: decoded.profile_completed || false,
                is_admin: decoded.is_admin || false,
                session_id: decoded.session_id || null,
                zerodha_client_id: decoded.zerodha_client_id || null
            }
        });

    } catch (error) {
        logger.warn('Token verification failed', { error: error.message });
        res.status(401).json({
            success: false,
            valid: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/child-app/get-url
 * Get child app URL with user's JWT token (for SSO)
 * Requires user to be authenticated with JWT token
 * Optional query param: subscription_id - to get product-specific child app URL
 */
router.get('/get-url', async (req, res) => {
    try {
        // Try to get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.substring(7);

        // Verify the token
        let decoded;
        try {
            decoded = jwtService.verifyAuthToken(token, 'StockSage-main-app');
        } catch (error) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        let childAppUrl;

        // Detect environment (local vs cloud/Azure)
        const isProduction = process.env.NODE_ENV === 'production' || 
                            process.env.WEBSITE_SITE_NAME || 
                            process.env.WEBSITE_HOSTNAME;

        // If subscription_id is provided, get the child_app_url from the product
        const subscriptionId = req.query.subscription_id;
        if (subscriptionId) {
            try {
                // Get subscription and product details
                const subscriptionResult = await query(
                    `SELECT s.product_id, p.child_app_url_local, p.child_app_url_cloud, p.name as product_name
                     FROM subscriptions s
                     JOIN products p ON s.product_id = p.id
                     WHERE s.id = $1 AND s.user_id = $2`,
                    [subscriptionId, decoded.user_id]
                );

                if (subscriptionResult.rows.length === 0) {
                    return res.status(404).json({ 
                        error: 'Subscription not found or access denied' 
                    });
                }

                const subscription = subscriptionResult.rows[0];
                
                const productName = subscription.product_name || '';
                const hasS001Proxy = !!process.env.PROXY_S001_URL;
                const hasS002Proxy = !!process.env.PROXY_S002_URL;
                const frontendOrigin = getFrontendOrigin();

                let proxyPath = null;
                if (hasS001Proxy && /s001/i.test(productName)) {
                    proxyPath = '/s001';
                } else if (hasS002Proxy && /s002/i.test(productName)) {
                    proxyPath = '/s002';
                }

                if (proxyPath && frontendOrigin) {
                    childAppUrl = `${frontendOrigin}${proxyPath}`;
                    logger.info('Using reverse proxy child app URL', {
                        product_id: subscription.product_id,
                        product_name: productName,
                        proxyPath,
                        child_app_url: childAppUrl
                    });
                }

                // Use environment-appropriate URL from product
                if (isProduction) {
                    // Use cloud URL in production
                    if (!childAppUrl && subscription.child_app_url_cloud) {
                        childAppUrl = subscription.child_app_url_cloud.trim();
                        logger.info('Using product-specific child app URL (cloud)', {
                            product_id: subscription.product_id,
                            product_name: subscription.product_name,
                            environment: 'cloud',
                            child_app_url: childAppUrl
                        });
                    } else if (!childAppUrl && subscription.child_app_url_local) {
                        // Fallback to local URL if cloud URL not set
                        childAppUrl = subscription.child_app_url_local.trim();
                        logger.warn('Product does not have cloud URL, using local URL', {
                            product_id: subscription.product_id,
                            product_name: subscription.product_name
                        });
                    } else {
                        // Fallback to environment variable
                        if (!childAppUrl) {
                            childAppUrl = getChildAppUrl();
                        }
                        logger.warn('Product does not have child_app_url configured, using environment variable', {
                            product_id: subscription.product_id,
                            product_name: subscription.product_name
                        });
                    }
                } else {
                    // Use local URL in development
                    if (!childAppUrl && subscription.child_app_url_local) {
                        childAppUrl = subscription.child_app_url_local.trim();
                        logger.info('Using product-specific child app URL (local)', {
                            product_id: subscription.product_id,
                            product_name: subscription.product_name,
                            environment: 'local',
                            child_app_url: childAppUrl
                        });
                    } else if (!childAppUrl && subscription.child_app_url_cloud) {
                        // Fallback to cloud URL if local URL not set
                        childAppUrl = subscription.child_app_url_cloud.trim();
                        logger.warn('Product does not have local URL, using cloud URL', {
                            product_id: subscription.product_id,
                            product_name: subscription.product_name
                        });
                    } else {
                        // Fallback to environment variable
                        if (!childAppUrl) {
                            childAppUrl = getChildAppUrl();
                        }
                        logger.warn('Product does not have child_app_url configured, using environment variable', {
                            product_id: subscription.product_id,
                            product_name: subscription.product_name
                        });
                    }
                }
            } catch (error) {
                logger.error('Error fetching subscription/product for child app URL', error);
                // Fallback to environment variable on error
                childAppUrl = getChildAppUrl();
            }
        } else {
            // No subscription_id provided, use environment variable
            childAppUrl = getChildAppUrl();
        }

        // Build child app URL with token
        const url = new URL(childAppUrl);
        url.searchParams.append('sso_token', token);

        logger.info('Child app URL generated', {
            user_id: decoded.user_id,
            subscription_id: subscriptionId || null,
            child_app: childAppUrl
        });

        res.json({
            success: true,
            url: url.toString(),
            expiresIn: process.env.AUTH_TOKEN_EXPIRY || '7d'
        });

    } catch (error) {
        logger.error('Failed to generate child app URL', error);
        res.status(500).json({ error: 'Failed to generate child app URL' });
    }
});

module.exports = router;

