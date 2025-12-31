const express = require('express');
const router = express.Router();
const passport = require('passport');
const { query } = require('../config/database');
const { authRateLimiter } = require('../middleware/rateLimiter');
const logger = require('../config/logger');
const failedLoginService = require('../services/failedLogin.service');
const jwtService = require('../services/jwt.service');

// Apply rate limiting to auth routes
router.use(authRateLimiter);

// Google OAuth - Initiate
router.get('/oauth/google', (req, res, next) => {
    logger.info('Google OAuth initiate called');
    console.log('Google OAuth route hit!');
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account' // Force account selection after logout
    })(req, res, next);
});

// Google OAuth - Callback
router.get('/oauth/google/callback',
    (req, res, next) => {
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
                return res.redirect(process.env.FRONTEND_URL + '/login.html?error=auth_failed');
            }
            
            if (!user) {
                logger.warn('OAuth authentication failed - no user', { info });
                return res.redirect(process.env.FRONTEND_URL + '/login.html?error=auth_failed');
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
                    return res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
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
                    return res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
                }
                
                // Save session to ensure cookie is set before redirect
                req.session.save(async (saveErr) => {
                    if (saveErr) {
                        logger.error('Error saving session after logIn', saveErr);
                        return res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
                    }
                    
                    console.log('=== SESSION SAVED ===');
                    console.log('Session ID:', req.sessionID);
                    console.log('Has passport:', !!req.session?.passport);
                    console.log('Passport user:', req.session?.passport?.user || null);
                    
                    // Continue with token generation and redirect
                    try {
                        // Fetch user profile data for JWT token
                    const profileResult = await query(
                        `SELECT up.profile_completed, up.full_name, up.zerodha_client_id, u.is_admin
                         FROM user_profiles up
                         JOIN users u ON u.id = up.user_id
                         WHERE up.user_id = $1`,
                        [user.id]
                    );
                    
                    const profile = profileResult.rows.length > 0 ? profileResult.rows[0] : null;
                    // Handle SQLite boolean (0/1) conversion
                    const isProfileComplete = profile && profile.profile_completed !== null && profile.profile_completed !== undefined
                        ? (profile.profile_completed === 1 || profile.profile_completed === true || profile.profile_completed === '1')
                        : false;
                    
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
                    const token = jwtService.generateAuthToken(userData);
                    
                    logger.info('OAuth login successful - JWT token generated', {
                        userId: user.id,
                        email: user.email,
                        isProfileComplete: isProfileComplete
                    });
                    
                    // Determine redirect URL
                    const baseUrl = isProfileComplete 
                        ? process.env.FRONTEND_URL + '/dashboard.html'
                        : process.env.FRONTEND_URL + '/register.html';
                    
                    // Redirect with token in URL (frontend will extract and store it)
                    const redirectUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;
                    
                    console.log('=== JWT TOKEN GENERATED ===');
                    console.log('User ID:', user.id);
                    console.log('Token generated:', token.substring(0, 50) + '...');
                    console.log('Base URL:', baseUrl);
                    console.log('Redirect URL (with token):', redirectUrl.substring(0, 100) + '...');
                    console.log('Token length:', token.length);
                    
                    logger.info('Redirecting with JWT token', {
                        userId: user.id,
                        baseUrl: baseUrl,
                        tokenLength: token.length,
                        redirectUrlLength: redirectUrl.length
                    });
                    
                    res.redirect(redirectUrl);
                    } catch (error) {
                        logger.error('Error in Google OAuth callback', error);
                        res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
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
                return res.redirect(process.env.FRONTEND_URL + '/login.html?error=auth_failed');
            }
            
            if (!user) {
                logger.warn('Apple OAuth failed - no user', { info });
                return res.redirect(process.env.FRONTEND_URL + '/login.html?error=auth_failed');
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
                                res.redirect(process.env.FRONTEND_URL + '/dashboard.html');
                            } else {
                                res.redirect(process.env.FRONTEND_URL + '/register.html');
                            }
                        })
                        .catch(error => {
                            logger.error('Error in Apple OAuth callback', error);
                            res.redirect(process.env.FRONTEND_URL + '/login.html?error=server_error');
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

// Get current user
router.get('/me', async (req, res) => {
    try {
        let authenticatedUser = null;
        
        // Try JWT token authentication first
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
                
                if (userResult.rows.length > 0) {
                    authenticatedUser = userResult.rows[0];
                    req.user = authenticatedUser; // Set for compatibility
                }
            } catch (tokenError) {
                logger.warn('JWT token verification failed in /me', { error: tokenError.message });
            }
        }
        
        // Fallback to session-based authentication
        if (!authenticatedUser && req.isAuthenticated && req.isAuthenticated()) {
            authenticatedUser = req.user;
        }
        
        if (!authenticatedUser) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Not authenticated'
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
        
        // Handle SQLite boolean (0/1) conversion
        // profile_completed can be: null, 0, 1, true, false
        const profileCompleted = profile && profile.profile_completed !== null && profile.profile_completed !== undefined
            ? (profile.profile_completed === 1 || profile.profile_completed === true || profile.profile_completed === '1')
            : false;
        
        res.json({
            user: {
                id: authenticatedUser.id,
                email: authenticatedUser.email,
                provider_type: authenticatedUser.provider_type,
                is_admin: authenticatedUser.is_admin
            },
            profile: profile,
            isProfileComplete: profileCompleted
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
