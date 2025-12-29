const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Load public key from main app
const publicKey = fs.readFileSync(
    path.join(__dirname, '../../config/keys/main-app-public.pem'),
    'utf8'
);

const SSO_CONFIG = {
    issuer: 'tradingpro-main-app',
    audience: 'tradingpro-child-app',
    algorithms: ['RS256']
};

/**
 * SSO Authentication Middleware
 * Validates JWT token from parent app
 */
function ssoAuthMiddleware(req, res, next) {
    try {
        // Extract token from multiple sources
        let token = null;

        // 1. Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        // 2. Check URL parameter (for redirect-based SSO)
        if (!token && req.query.sso_token) {
            token = req.query.sso_token;
        }

        // 3. Check cookie (if using cookie-based sessions)
        if (!token && req.cookies.sso_token) {
            token = req.cookies.sso_token;
        }

        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                redirect: process.env.MAIN_APP_URL + '/login'
            });
        }

        // Verify token signature and claims
        const decoded = jwt.verify(token, publicKey, SSO_CONFIG);

        // Validate required claims
        if (!decoded.user_id || !decoded.email || !decoded.session_id) {
            throw new Error('Invalid token payload');
        }

        // Attach user info to request
        req.ssoUser = {
            id: decoded.user_id,
            email: decoded.email,
            full_name: decoded.full_name,
            session_id: decoded.session_id,
            profile_completed: decoded.profile_completed
        };

        // Optional: Create local session for user
        if (req.session) {
            req.session.userId = decoded.user_id;
            req.session.email = decoded.email;
            req.session.ssoSessionId = decoded.session_id;
        }

        console.log('SSO authentication successful:', {
            user_id: decoded.user_id,
            email: decoded.email
        });

        next();

    } catch (error) {
        console.error('SSO authentication failed:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Session expired',
                code: 'TOKEN_EXPIRED',
                redirect: process.env.MAIN_APP_URL + '/login'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid authentication',
                code: 'INVALID_TOKEN',
                redirect: process.env.MAIN_APP_URL + '/login'
            });
        }

        res.status(500).json({
            error: 'Authentication failed',
            message: error.message
        });
    }
}

/**
 * Optional: Require specific user profile completion
 */
function requireProfileComplete(req, res, next) {
    if (!req.ssoUser || !req.ssoUser.profile_completed) {
        return res.status(403).json({
            error: 'Profile completion required',
            redirect: process.env.MAIN_APP_URL + '/register'
        });
    }
    next();
}

module.exports = {
    ssoAuthMiddleware,
    requireProfileComplete
};

