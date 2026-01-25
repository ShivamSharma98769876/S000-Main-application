const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple');
const { query } = require('./database');
const logger = require('./logger');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const result = await query(
            'SELECT id, provider_type, provider_user_id, email, is_admin FROM users WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return done(null, false);
        }
        
        done(null, result.rows[0]);
    } catch (error) {
        logger.error('Error deserializing user', error);
        done(error, null);
    }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Auto-detect callback URL if not set
    const toHttpsOrigin = (urlValue) => {
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

    const getGoogleCallbackUrl = () => {
        if (process.env.GOOGLE_CALLBACK_URL) {
            return process.env.GOOGLE_CALLBACK_URL;
        }

        // Prefer FRONTEND_URL for production custom domains
        if (process.env.FRONTEND_URL && process.env.NODE_ENV === 'production') {
            try {
                const httpsOrigin = toHttpsOrigin(process.env.FRONTEND_URL);
                if (httpsOrigin) {
                    return `${httpsOrigin}/api/v1/auth/oauth/google/callback`;
                }
                const frontendUrl = new URL(process.env.FRONTEND_URL);
                return `${frontendUrl.origin}/api/v1/auth/oauth/google/callback`;
            } catch (error) {
                logger.warn('Invalid FRONTEND_URL, falling back to Azure hostname', {
                    value: process.env.FRONTEND_URL,
                    error: error.message
                });
            }
        }
        
        // Auto-detect for Azure
        if (process.env.WEBSITE_HOSTNAME) {
            return `https://${process.env.WEBSITE_HOSTNAME}/api/v1/auth/oauth/google/callback`;
        }
        
        // Auto-detect from WEBSITE_SITE_NAME
        if (process.env.WEBSITE_SITE_NAME) {
            // Azure App Service format: sitename.region.azurewebsites.net
            const region = process.env.WEBSITE_SITE_NAME.includes('southindia') ? 'southindia-01' : 'eastus';
            return `https://${process.env.WEBSITE_SITE_NAME}.${region}.azurewebsites.net/api/v1/auth/oauth/google/callback`;
        }
        
        // Fallback to localhost for development
        return 'http://localhost:3000/api/v1/auth/oauth/google/callback';
    };
    
    const googleCallbackUrl = getGoogleCallbackUrl();
    logger.info('Google OAuth strategy configured', { 
        callbackUrl: googleCallbackUrl,
        source: process.env.GOOGLE_CALLBACK_URL ? 'environment' : 'auto-detected',
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    });
    
    try {
        passport.use('google', new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: googleCallbackUrl,
            passReqToCallback: true
        },
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const displayName = profile.displayName || '';
            
            // Ensure profile.id is a string
            const providerUserId = String(profile.id || '');
            if (!providerUserId) {
                return done(new Error('Google profile ID is missing'));
            }
            
            // Check if user exists
            let result = await query(
                'SELECT * FROM users WHERE provider_type = $1 AND provider_user_id = $2',
                ['GOOGLE', providerUserId]
            );
            
            let user;
            
            if (result.rows.length > 0) {
                // User exists with this Google provider ID
                user = result.rows[0];
                
                // Update last login
                await query(
                    'UPDATE users SET updated_at = NOW() WHERE id = $1',
                    [user.id]
                );
            } else {
                // No user with this Google ID - check if email already exists
                if (email) {
                    const existingEmailUser = await query(
                        'SELECT * FROM users WHERE email = $1',
                        [email]
                    );
                    
                    if (existingEmailUser.rows.length > 0) {
                        // User exists with this email - link Google account to existing user
                        user = existingEmailUser.rows[0];
                        
                        // Update user to link Google account
                        await query(
                            'UPDATE users SET provider_type = $1, provider_user_id = $2, updated_at = NOW() WHERE id = $3',
                            ['GOOGLE', providerUserId, user.id]
                        );
                        
                        logger.info('Existing user linked to Google OAuth', { userId: user.id, email });
                    } else {
                        // Create new user - email doesn't exist
                        result = await query(
                            `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, NOW(), NOW())
                             RETURNING *`,
                            ['GOOGLE', providerUserId, email, false]
                        );
                        user = result.rows[0];
                        
                        // Create empty user profile with required fields set to empty strings
                        // User will complete profile during registration
                        await query(
                            `INSERT INTO user_profiles (user_id, full_name, phone, address, profile_completed, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                            [user.id, '', '', '', false]
                        );
                        
                        logger.info('New user created via Google OAuth', { userId: user.id, email });
                    }
                } else {
                    // No email from Google - create new user without email
                    result = await query(
                        `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, NOW(), NOW())
                         RETURNING *`,
                        ['GOOGLE', providerUserId, '', false]
                    );
                    user = result.rows[0];
                    
                    // Create empty user profile
                    await query(
                        `INSERT INTO user_profiles (user_id, full_name, phone, address, profile_completed, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                        [user.id, '', '', '', false]
                    );
                    
                    logger.info('New user created via Google OAuth (no email)', { userId: user.id });
                }
            }
            
            // Log login audit
            await query(
                `INSERT INTO login_audit (user_id, provider, event_type, status, ip_address, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [user.id, 'GOOGLE', 'LOGIN', 'SUCCESS', req.ip, req.get('user-agent')]
            );
            
            return done(null, user);
        } catch (error) {
            logger.error('Google OAuth error', {
                error: error.message,
                code: error.code,
                stack: error.stack
            });
            
            // Log failed login
            try {
                await query(
                    `INSERT INTO login_audit (provider, event_type, status, error_message, ip_address, user_agent, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                    ['GOOGLE', 'LOGIN', 'FAILURE', error.message, req.ip, req.get('user-agent')]
                );
            } catch (auditError) {
                logger.error('Failed to log audit entry', auditError);
            }
            
            return done(error, null);
        }
    }));
    
    logger.info('Google OAuth strategy registered successfully');
    } catch (error) {
        logger.error('Failed to register Google OAuth strategy', { 
            error: error.message,
            stack: error.stack
        });
    }
} else {
    logger.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// Apple OAuth Strategy
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID) {
    // Auto-detect callback URL if not set
    const getAppleCallbackUrl = () => {
        if (process.env.APPLE_CALLBACK_URL) {
            return process.env.APPLE_CALLBACK_URL;
        }
        
        // Auto-detect for Azure
        if (process.env.WEBSITE_HOSTNAME) {
            return `https://${process.env.WEBSITE_HOSTNAME}/api/v1/auth/oauth/apple/callback`;
        }
        
        // Auto-detect from WEBSITE_SITE_NAME
        if (process.env.WEBSITE_SITE_NAME) {
            const region = process.env.WEBSITE_SITE_NAME.includes('southindia') ? 'southindia-01' : 'eastus';
            return `https://${process.env.WEBSITE_SITE_NAME}.${region}.azurewebsites.net/api/v1/auth/oauth/apple/callback`;
        }
        
        // Fallback to localhost for development
        return 'http://localhost:3000/api/v1/auth/oauth/apple/callback';
    };
    
    const appleCallbackUrl = getAppleCallbackUrl();
    logger.info('Apple OAuth callback URL configured', { 
        callbackUrl: appleCallbackUrl,
        source: process.env.APPLE_CALLBACK_URL ? 'environment' : 'auto-detected'
    });
    
    passport.use(new AppleStrategy({
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
        callbackURL: appleCallbackUrl,
        passReqToCallback: true
    },
    async (req, accessToken, refreshToken, idToken, profile, done) => {
        try {
            // Ensure appleId is a string
            const appleId = String(profile.id || idToken.sub || '');
            if (!appleId) {
                return done(new Error('Apple profile ID is missing'));
            }
            const email = profile.email || (idToken.email || null);
            const displayName = profile.name ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim() : '';
            
            // Check if user exists
            let result = await query(
                'SELECT * FROM users WHERE provider_type = $1 AND provider_user_id = $2',
                ['APPLE', appleId]
            );
            
            let user;
            
            if (result.rows.length > 0) {
                // User exists with this Apple provider ID
                user = result.rows[0];
                
                // Update last login
                await query(
                    'UPDATE users SET updated_at = NOW() WHERE id = $1',
                    [user.id]
                );
            } else {
                // No user with this Apple ID - check if email already exists
                if (email) {
                    const existingEmailUser = await query(
                        'SELECT * FROM users WHERE email = $1',
                        [email]
                    );
                    
                    if (existingEmailUser.rows.length > 0) {
                        // User exists with this email - link Apple account to existing user
                        user = existingEmailUser.rows[0];
                        
                        // Update user to link Apple account
                        await query(
                            'UPDATE users SET provider_type = $1, provider_user_id = $2, updated_at = NOW() WHERE id = $3',
                            ['APPLE', appleId, user.id]
                        );
                        
                        logger.info('Existing user linked to Apple OAuth', { userId: user.id, email });
                    } else {
                        // Create new user - email doesn't exist
                        result = await query(
                            `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, NOW(), NOW())
                             RETURNING *`,
                            ['APPLE', appleId, email, false]
                        );
                        user = result.rows[0];
                        
                        // Create empty user profile with required fields set to empty strings
                        // User will complete profile during registration
                        await query(
                            `INSERT INTO user_profiles (user_id, full_name, phone, address, profile_completed, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                            [user.id, '', '', '', false]
                        );
                        
                        logger.info('New user created via Apple OAuth', { userId: user.id, email });
                    }
                } else {
                    // No email from Apple - create new user without email
                    result = await query(
                        `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, NOW(), NOW())
                         RETURNING *`,
                        ['APPLE', appleId, null, false]
                    );
                    user = result.rows[0];
                    
                    // Create empty user profile
                    await query(
                        `INSERT INTO user_profiles (user_id, full_name, phone, address, profile_completed, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                        [user.id, '', '', '', false]
                    );
                    
                    logger.info('New user created via Apple OAuth (no email)', { userId: user.id });
                }
            }
            
            // Log login audit
            await query(
                `INSERT INTO login_audit (user_id, provider, event_type, status, ip_address, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [user.id, 'APPLE', 'LOGIN', 'SUCCESS', req.ip, req.get('user-agent')]
            );
            
            return done(null, user);
        } catch (error) {
            logger.error('Apple OAuth error', error);
            
            // Log failed login
            try {
                await query(
                    `INSERT INTO login_audit (provider, event_type, status, error_code, ip_address, user_agent, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                    ['APPLE', 'LOGIN', 'FAILURE', error.message, req.ip, req.get('user-agent')]
                );
            } catch (auditError) {
                logger.error('Failed to log audit entry', auditError);
            }
            
            return done(error, null);
        }
    }));
}

module.exports = passport;


