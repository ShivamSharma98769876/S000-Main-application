const express = require('express');
const router = express.Router();
const passport = require('passport');
const { query } = require('../config/database');
const { authRateLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');
const failedLoginService = require('../services/failedLogin.service');
const jwtService = require('../services/jwt.service');

// Helper function to get frontend URL (auto-detect if not set)
const getFrontendUrl = () => {
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
    }
    
    // Auto-detect for Azure
    if (process.env.WEBSITE_HOSTNAME) {
        return `https://${process.env.WEBSITE_HOSTNAME}`;
    }
    
    // Auto-detect from WEBSITE_SITE_NAME
    if (process.env.WEBSITE_SITE_NAME) {
        const region = process.env.WEBSITE_SITE_NAME.includes('southindia') ? 'southindia-01' : 'eastus';
        return `https://${process.env.WEBSITE_SITE_NAME}.${region}.azurewebsites.net`;
    }
    
    // Fallback to localhost for development
    // Use the same port as the backend (3000) since frontend is served from backend
    return 'http://localhost:3000';
};

// Apply rate limiting to auth routes (but skip OAuth callbacks - they're called by OAuth providers)
router.use((req, res, next) => {
    // Skip rate limiting for OAuth callback routes (they're called by Google/Apple, not users)
    if (req.path.includes('/oauth/google/callback') || req.path.includes('/oauth/apple/callback')) {
        return next();
    }
    // Apply rate limiting to other auth routes
    authRateLimiter(req, res, next);
});

// Google OAuth - Initiate
router.get('/oauth/google', (req, res, next) => {
    logger.info('Google OAuth initiate called');
    console.log('Google OAuth route hit!');
    
    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        logger.error('Google OAuth not configured - missing credentials');
        return res.status(500).json({
            error: 'Configuration Error',
            message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
        });
    }
    
    // Check if passport strategy is registered
    const googleStrategy = passport._strategies && passport._strategies['google'];
    if (!googleStrategy) {
        logger.error('Google OAuth strategy not registered');
        return res.status(500).json({
            error: 'Configuration Error',
            message: 'Google OAuth strategy is not registered. Please check server configuration.'
        });
    }
    
    try {
        passport.authenticate('google', { 
            scope: ['profile', 'email'],
            prompt: 'select_account' // Force account selection after logout
        })(req, res, next);
    } catch (error) {
        logger.error('Error initiating Google OAuth', { error: error.message, stack: error.stack });
        return res.status(500).json({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'production' 
                ? 'Failed to initiate OAuth. Please try again later.'
                : error.message
        });
    }
});

// Google OAuth - Callback
router.get('/oauth/google/callback',
    (req, res, next) => {
        // Check for error in query params (OAuth provider may return errors)
        if (req.query.error) {
            logger.error('OAuth error from provider', {
                error: req.query.error,
                error_description: req.query.error_description,
                error_uri: req.query.error_uri
            });
            return res.redirect(getFrontendUrl() + '/login.html?error=auth_failed&reason=' + encodeURIComponent(req.query.error_description || req.query.error));
        }
        
        // Check if authorization code is present
        if (!req.query.code) {
            logger.error('OAuth callback missing authorization code', {
                query: req.query,
                url: req.url
            });
            return res.redirect(getFrontendUrl() + '/login.html?error=auth_failed&reason=missing_code');
        }
        
        console.log('========================================');
        console.log('=== NETWORK TAB: OAUTH CALLBACK REQUEST ===');
        console.log('========================================');
        console.log('Request URL:', req.url);
        console.log('Request Method:', req.method);
        console.log('Request Headers:');
        console.log('  - Cookie:', req.headers.cookie || 'No Cookie header');
        console.log('  - User-Agent:', req.headers['user-agent'] || 'No User-Agent');
        console.log('  - Referer:', req.headers.referer || 'No Referer');
        console.log('  - Origin:', req.headers.origin || 'No Origin');
        console.log('Query Params:', req.query);
        console.log('Has code:', !!req.query.code);
        console.log('========================================');
        console.log('=== OAUTH CALLBACK START ===');
        console.log('Session ID before auth:', req.sessionID);
        console.log('Has session:', !!req.session);
        console.log('Has passport before:', !!req.session?.passport);
        
        passport.authenticate('google', (err, user, info) => {
            console.log('=== PASSPORT AUTHENTICATE CALLBACK ===');
            console.log('Error:', err?.message || null);
            console.log('User:', user?.id || null);
            console.log('Session ID after auth:', req.sessionID);
            console.log('Has passport after auth:', !!req.session?.passport);
            
            if (err) {
                logger.error('OAuth authentication error', err);
                return res.redirect(getFrontendUrl() + '/login.html?error=auth_failed');
            }
            
            if (!user) {
                logger.warn('OAuth authentication failed - no user', { info });
                return res.redirect(getFrontendUrl() + '/login.html?error=auth_failed');
            }
            
            console.log('=== BEFORE req.logIn ===');
            console.log('User ID:', user.id);
            console.log('Session ID:', req.sessionID);
            console.log('Has passport before logIn:', !!req.session?.passport);
            
            // CRITICAL: Use req.logIn() normally - this will call serializeUser
            // and save the user ID to req.session.passport.user
            console.log('=== BEFORE req.logIn ===');
            console.log('User ID:', user.id);
            console.log('Session ID before logIn:', req.sessionID);
            console.log('Has passport before logIn:', !!req.session?.passport);
            
            req.logIn(user, async (err) => {
                console.log('=== INSIDE req.logIn CALLBACK ===');
                console.log('logIn error:', err?.message || null);
                console.log('Session ID after logIn:', req.sessionID);
                console.log('Has passport after logIn:', !!req.session?.passport);
                console.log('Passport user:', req.session?.passport?.user || null);
                console.log('Is authenticated:', req.isAuthenticated());
                console.log('Req user:', req.user?.id || null);
                
                if (err) {
                    logger.error('Session login error', err);
                    return res.redirect(getFrontendUrl() + '/login.html?error=server_error');
                }
                
                // CRITICAL: Verify Passport data is in session
                if (!req.session.passport || !req.session.passport.user) {
                    console.log('❌ ERROR: Passport data not in session after logIn!');
                    console.log('Session data:', JSON.stringify(req.session, null, 2));
                    logger.error('Passport data missing after logIn', {
                        sessionID: req.sessionID,
                        hasPassport: !!req.session.passport,
                        passportUser: req.session.passport?.user || null,
                        sessionKeys: Object.keys(req.session || {})
                    });
                    return res.redirect(getFrontendUrl() + '/login.html?error=server_error');
                }
                
                // Save session to ensure cookie is set before redirect
                req.session.save(async (saveErr) => {
                    if (saveErr) {
                        logger.error('Error saving session after logIn', saveErr);
                        return res.redirect(getFrontendUrl() + '/login.html?error=server_error');
                    }
                    
                    console.log('=== SESSION SAVED ===');
                    console.log('Session ID:', req.sessionID);
                    console.log('Has passport:', !!req.session?.passport);
                    console.log('Passport user:', req.session?.passport?.user || null);
                    
                    // Continue with token generation and redirect
                    try {
                        console.log('=== FETCHING USER PROFILE ===');
                        console.log('User ID:', user.id);
                        
                        // Fetch user profile data for JWT token
                        const profileResult = await query(
                            `SELECT up.profile_completed, up.full_name, up.zerodha_client_id, u.is_admin
                             FROM user_profiles up
                             JOIN users u ON u.id = up.user_id
                             WHERE up.user_id = $1`,
                            [user.id]
                        );
                        
                        console.log('Profile query result:', {
                            rowCount: profileResult.rows.length,
                            hasProfile: profileResult.rows.length > 0,
                            profileData: profileResult.rows[0] || null
                        });
                        
                        const profile = profileResult.rows.length > 0 ? profileResult.rows[0] : null;
                        const isProfileComplete = profile ? (profile.profile_completed === true) : false;
                        
                        console.log('=== PROFILE CHECK ===');
                        console.log('Has profile:', !!profile);
                        console.log('Profile completed (raw):', profile?.profile_completed);
                        console.log('Profile completed (boolean):', isProfileComplete);
                        console.log('Full name:', profile?.full_name);
                    
                    // Prepare user data for JWT token
                    const userData = {
                        id: user.id,
                        email: user.email,
                        full_name: profile?.full_name || '',
                        profile_completed: isProfileComplete,
                        is_admin: user.is_admin || false,
                        zerodha_client_id: profile?.zerodha_client_id || null
                    };
                    
                    // Generate JWT token for user authentication
                    const jwtToken = jwtService.generateAuthToken(userData);
                    
                    logger.info('OAuth login successful - JWT token generated', {
                        userId: user.id,
                        email: user.email,
                        isProfileComplete: isProfileComplete
                    });
                    
                    // Determine redirect URL
                    const frontendUrl = getFrontendUrl();
                    const baseUrl = isProfileComplete 
                        ? frontendUrl + '/dashboard.html'
                        : frontendUrl + '/register.html';
                    
                    // Redirect with JWT token in URL (frontend will extract and store it)
                    // Using 'jwt' as URL parameter name for clarity
                    const redirectUrl = `${baseUrl}?jwt=${encodeURIComponent(jwtToken)}`;
                    
                    console.log('=== JWT TOKEN GENERATED ===');
                    console.log('User ID:', user.id);
                    console.log('JWT Token generated:', jwtToken.substring(0, 50) + '...');
                    console.log('Frontend URL:', frontendUrl);
                    console.log('Base URL:', baseUrl);
                    console.log('Redirect URL (with JWT):', redirectUrl.substring(0, 150) + '...');
                    console.log('JWT Token length:', jwtToken.length);
                    console.log('Profile complete:', isProfileComplete);
                    
                    logger.info('Redirecting with JWT token', {
                        userId: user.id,
                        email: user.email,
                        frontendUrl: frontendUrl,
                        baseUrl: baseUrl,
                        isProfileComplete: isProfileComplete,
                        jwtTokenLength: jwtToken.length,
                        redirectUrlLength: redirectUrl.length,
                        redirectUrlPreview: redirectUrl.substring(0, 100)
                    });
                    
                    // Log redirect for debugging
                    console.log('=== REDIRECTING USER ===');
                    console.log('Full redirect URL:', redirectUrl);
                    console.log('Redirect URL length:', redirectUrl.length);
                    console.log('Will redirect to:', isProfileComplete ? 'DASHBOARD' : 'REGISTRATION');
                    
                    // Ensure response hasn't been sent
                    if (res.headersSent) {
                        console.error('❌ ERROR: Response already sent, cannot redirect!');
                        logger.error('Cannot redirect - response already sent', {
                            userId: user.id,
                            redirectUrl: redirectUrl
                        });
                        return;
                    }
                    
                    logger.info('Sending redirect response', {
                        userId: user.id,
                        statusCode: 302,
                        location: redirectUrl.substring(0, 200)
                    });
                    
                    res.redirect(redirectUrl);
                    } catch (error) {
                        console.error('❌ ERROR IN OAUTH CALLBACK:', error);
                        console.error('Error stack:', error.stack);
                        logger.error('Error in Google OAuth callback', {
                            error: error.message,
                            stack: error.stack,
                            userId: user?.id
                        });
                        
                        if (!res.headersSent) {
                            res.redirect(getFrontendUrl() + '/login.html?error=server_error');
                        } else {
                            console.error('❌ Cannot send error redirect - response already sent');
                        }
                    }
                });
            });
        })(req, res, next);
    }
);

// Debug endpoint to check session in database
router.get('/debug-session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await query(
            'SELECT sid, sess, expire FROM session WHERE sid = $1',
            [sessionId]
        );
        
        if (result.rows.length === 0) {
            return res.json({
                sessionId: sessionId,
                exists: false,
                message: 'Session not found in database'
            });
        }
        
        const sessionData = result.rows[0];
        const sess = typeof sessionData.sess === 'string' 
            ? JSON.parse(sessionData.sess) 
            : sessionData.sess;
        
        res.json({
            sessionId: sessionId,
            exists: true,
            hasPassport: !!sess.passport,
            passportUser: sess.passport?.user || null,
            expire: sessionData.expire,
            isExpired: new Date(sessionData.expire) < new Date()
        });
    } catch (error) {
        logger.error('Error checking session', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint to verify cookie is stored (used by redirect page)
router.get('/test-cookie', (req, res) => {
    // This endpoint is called by the redirect page to verify cookie is stored
    // It returns the current session ID so the redirect page can verify it matches
    logger.info('=== TEST COOKIE ENDPOINT CALLED ===', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasPassport: !!req.session?.passport,
        passportUser: req.session?.passport?.user || null,
        isAuthenticated: req.isAuthenticated(),
        cookiesReceived: !!req.headers.cookie,
        cookies: req.headers.cookie || 'No cookies'
    });
    
    res.json({
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasPassport: !!req.session?.passport || false,
        passportUser: req.session?.passport?.user || null,
        isAuthenticated: req.isAuthenticated(),
        cookiesReceived: !!req.headers.cookie
    });
});

// Test endpoint to verify cookie setting
router.get('/test-cookie-set', (req, res) => {
    // Create a test session
    req.session.testCookie = 'test-value-' + Date.now();
    req.session.save((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to save session', err: err.message });
        }
        
        const setCookieHeader = res.getHeader('Set-Cookie');
        res.json({
            message: 'Test cookie should be set',
            sessionID: req.sessionID,
            setCookieHeader: setCookieHeader || 'NOT SET',
            sessionData: req.session
        });
    });
});

// Apple OAuth - Initiate
router.get('/oauth/apple',
    passport.authenticate('apple', {
        scope: ['name', 'email']
    })
);

// Apple OAuth - Callback
router.get('/oauth/apple/callback',
    (req, res, next) => {
        passport.authenticate('apple', (err, user, info) => {
            if (err) {
                logger.error('Apple OAuth error', err);
                return res.redirect(getFrontendUrl() + '/login.html?error=auth_failed');
            }
            
            if (!user) {
                logger.warn('Apple OAuth failed - no user', { info });
                return res.redirect(getFrontendUrl() + '/login.html?error=auth_failed');
            }
            
            req.logIn(user, async (err) => {
                if (err) {
                    logger.error('Session login error', err);
                    return res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
                }
                
                try {
                    // Save session before redirect to ensure cookie is set
                    req.session.save((saveErr) => {
                        if (saveErr) {
                            logger.error('Session save error', saveErr);
                            return res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
                        }
                        
                        // Check if profile is complete
                        query(
                            'SELECT profile_completed FROM user_profiles WHERE user_id = $1',
                            [req.user.id]
                        )
                        .then(result => {
                            const isProfileComplete = result.rows.length > 0 && result.rows[0].profile_completed;
                            
                            if (isProfileComplete) {
                                res.redirect(getFrontendUrl() + '/dashboard.html');
                            } else {
                                res.redirect(getFrontendUrl() + '/register.html');
                            }
                        })
                        .catch(error => {
                            logger.error('Error in Apple OAuth callback', error);
                            res.redirect(getFrontendUrl() + '/login.html?error=server_error');
                        });
                    });
                } catch (error) {
                    logger.error('Error in Apple OAuth callback', error);
                    res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
                }
            });
        })(req, res, next);
    }
);

// Get current user (requires JWT token)
router.get('/me', async (req, res) => {
    try {
        // JWT token authentication (REQUIRED)
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Bots/crawlers (e.g. SkypeUriPreview) hit this without token - log at debug only
            logger.debug('Missing or invalid authorization header in /me', {
                userAgent: req.headers['user-agent']
            });
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'JWT token required. Please include Authorization: Bearer <token> header'
            });
        }
        
        const jwtToken = authHeader.substring(7);
        let authenticatedUser = null;
        
        try {
            const decoded = jwtService.verifyAuthToken(jwtToken);
            
            const userResult = await query(
                'SELECT id, provider_type, provider_user_id, email, is_admin FROM users WHERE id = $1',
                [decoded.user_id]
            );
            
            if (userResult.rows.length === 0) {
                logger.warn('User not found in database for /me', { userId: decoded.user_id });
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not found'
                });
            }
            
            authenticatedUser = userResult.rows[0];
            req.user = authenticatedUser; // Set for compatibility
        } catch (tokenError) {
            logger.warn('JWT token verification failed in /me', { 
                error: tokenError.message
            });
            
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
        
        // Get user profile - use LEFT JOIN to handle missing profiles
        const profileResult = await query(
            `SELECT up.*, u.email, u.is_admin, u.provider_type
             FROM users u
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE u.id = $1`,
            [authenticatedUser.id]
        );
        
        const profile = profileResult.rows.length > 0 ? profileResult.rows[0] : null;
        const profileCompleted = profile ? (profile.profile_completed === true) : false;
        
        logger.debug('User profile fetched for /me endpoint', {
            userId: authenticatedUser.id,
            hasProfile: !!profile,
            profileCompleted: profileCompleted
        });
        
        res.json({
            user: {
                id: authenticatedUser.id,
                email: authenticatedUser.email,
                provider_type: authenticatedUser.provider_type,
                is_admin: authenticatedUser.is_admin
            },
            profile: profile,
            isProfileComplete: profileCompleted,
            profileCompleted: profileCompleted // Alias for compatibility
        });
    } catch (error) {
        logger.error('Error fetching current user', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch user data'
        });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    try {
        if (req.session) {
            const userId = req.user?.id || null;
            req.session.destroy((err) => {
                if (err) {
                    logger.error('Error destroying session', err);
                    return res.status(500).json({ error: 'Failed to logout' });
                }
                
                res.clearCookie('sessionId', {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                });
                
                logger.info('User logged out', { userId });
                res.json({ message: 'Logged out successfully' });
            });
        } else {
            res.json({ message: 'Already logged out' });
        }
    } catch (error) {
        logger.error('Error in logout', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
