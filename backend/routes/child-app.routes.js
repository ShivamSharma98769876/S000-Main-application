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
            decoded = jwtService.verifyAuthToken(token, 'tradingpro-child-app');
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
            decoded = jwtService.verifyAuthToken(token, 'tradingpro-main-app');
        } catch (error) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Build child app URL with token
        const childAppUrl = getChildAppUrl();
        const url = new URL(childAppUrl);
        url.searchParams.append('sso_token', token);

        logger.info('Child app URL generated', {
            user_id: decoded.user_id,
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

