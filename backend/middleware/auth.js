const logger = require('../config/logger');
const jwtService = require('../services/jwt.service');
const { query } = require('../config/database');

// Check if user is authenticated (JWT token or session)
const isAuthenticated = async (req, res, next) => {
    try {
        // First, try JWT token authentication
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwtService.verifyAuthToken(token);
                
                // Fetch user from database
                const userResult = await query(
                    'SELECT id, provider_type, provider_user_id, email, is_admin FROM users WHERE id = $1',
                    [decoded.user_id]
                );
                
                if (userResult.rows.length === 0) {
                    return res.status(401).json({
                        error: 'Unauthorized',
                        message: 'User not found'
                    });
                }
                
                // Attach user to request
                req.user = userResult.rows[0];
                req.token = decoded;
                
                return next();
            } catch (tokenError) {
                logger.warn('JWT token verification failed', { error: tokenError.message });
                // Fall through to session check
            }
        }
        
        // Fallback to session-based authentication (for backward compatibility)
        if (req.isAuthenticated && req.isAuthenticated()) {
            return next();
        }
        
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'You must be logged in to access this resource'
        });
    } catch (error) {
        logger.error('Authentication error', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Authentication check failed'
        });
    }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    // Check JWT token first (from token payload)
    if (req.token && req.token.is_admin) {
        return next();
    }
    
    // Check user object from database (fetched in isAuthenticated)
    if (req.user && req.user.is_admin) {
        return next();
    }
    
    // Fallback to session
    if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.is_admin) {
        return next();
    }
    
    logger.warn('Admin access denied', {
        userId: req.user?.id,
        hasToken: !!req.token,
        tokenIsAdmin: req.token?.is_admin,
        userIsAdmin: req.user?.is_admin
    });
    
    return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
    });
};

// Check if profile is complete
const isProfileComplete = async (req, res, next) => {
    try {
        const result = await query(
            'SELECT profile_completed FROM user_profiles WHERE user_id = $1',
            [req.user.id]
        );
        
        // Handle SQLite boolean (0/1) conversion
        const profileCompleted = result.rows.length > 0 && result.rows[0].profile_completed !== null && result.rows[0].profile_completed !== undefined
            ? (result.rows[0].profile_completed === 1 || result.rows[0].profile_completed === true || result.rows[0].profile_completed === '1')
            : false;
        
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


