const logger = require('../config/logger');
const jwtService = require('../services/jwt.service');
const { query } = require('../config/database');

// Check if user is authenticated (JWT token required)
// JWT token is the primary and preferred authentication method
const isAuthenticated = async (req, res, next) => {
    try {
        // JWT token authentication (REQUIRED)
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Authentication failed: No JWT token provided', {
                hasAuthHeader: !!authHeader,
                method: req.method,
                path: req.path
            });
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'JWT token required. Please include Authorization: Bearer <jwt_token> header'
            });
        }
        
        const jwtToken = authHeader.substring(7);
        
        try {
            const decoded = jwtService.verifyAuthToken(jwtToken);
            
            // Fetch user from database to ensure user still exists
            const userResult = await query(
                'SELECT id, provider_type, provider_user_id, email, is_admin FROM users WHERE id = $1',
                [decoded.user_id]
            );
            
            if (userResult.rows.length === 0) {
                logger.warn('Authentication failed: User not found in database', {
                    userId: decoded.user_id
                });
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not found'
                });
            }
            
            // Attach user and token to request
            req.user = userResult.rows[0];
            req.token = decoded;
            
            logger.debug('JWT authentication successful', {
                userId: req.user.id,
                email: req.user.email
            });
            
            return next();
        } catch (tokenError) {
            logger.warn('JWT token verification failed', {
                error: tokenError.message,
                method: req.method,
                path: req.path
            });
            
            // Provide specific error messages
            if (tokenError.message === 'Token expired') {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Token expired. Please log in again'
                });
            }
            
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired JWT token. Please log in again'
            });
        }
    } catch (error) {
        logger.error('Authentication error', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication check failed'
        });
    }
};

// Check if user is admin (requires JWT authentication first)
const isAdmin = (req, res, next) => {
    // Check JWT token payload first (preferred)
    if (req.token && req.token.is_admin === true) {
        return next();
    }
    
    // Check user object from database (fetched in isAuthenticated)
    if (req.user && req.user.is_admin === true) {
        return next();
    }
    
    logger.warn('Admin access denied', {
        userId: req.user?.id,
        email: req.user?.email,
        hasToken: !!req.token,
        tokenIsAdmin: req.token?.is_admin,
        userIsAdmin: req.user?.is_admin,
        method: req.method,
        path: req.path
    });
    
    return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required. You do not have permission to access this resource'
    });
};

// Check if profile is complete
const isProfileComplete = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT profile_completed FROM user_profiles WHERE user_id = $1',
            [req.user.id]
        );
        
        // PostgreSQL returns boolean directly
        const profileCompleted = result.rows.length > 0 && result.rows[0].profile_completed === true;
        
        if (!profileCompleted) {
            return res.status(403).json({
                error: 'Profile Incomplete',
                message: 'Please complete your profile before accessing this resource'
            });
        }
        
        next();
    } catch (error) {
        logger.error('Error checking profile completion', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to verify profile status'
        });
    }
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isProfileComplete
};


