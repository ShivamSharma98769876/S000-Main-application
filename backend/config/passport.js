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
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const displayName = profile.displayName || '';
            
            // Ensure profile.id is a string (SQLite requirement)
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
                // User exists
                user = result.rows[0];
                
                // Update last login
                await query(
                    'UPDATE users SET updated_at = NOW() WHERE id = $1',
                    [user.id]
                );
            } else {
                // Create new user
                result = await query(
                    `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, NOW(), NOW())
                     RETURNING *`,
                    ['GOOGLE', providerUserId, email || '', false]
                );
                user = result.rows[0];
                
                // Create empty user profile
                await query(
                    `INSERT INTO user_profiles (user_id, profile_completed, created_at, updated_at)
                     VALUES ($1, $2, NOW(), NOW())`,
                    [user.id, false]
                );
                
                logger.info('New user created via Google OAuth', { userId: user.id, email });
            }
            
            // Log login audit
            await query(
                `INSERT INTO login_audit (user_id, provider, event_type, status, ip_address, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [user.id, 'GOOGLE', 'LOGIN', 'SUCCESS', req.ip, req.get('user-agent')]
            );
            
            return done(null, user);
        } catch (error) {
            logger.error('Google OAuth error', error);
            
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
}

// Apple OAuth Strategy
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID) {
    passport.use(new AppleStrategy({
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
        callbackURL: process.env.APPLE_CALLBACK_URL,
        passReqToCallback: true
    },
    async (req, accessToken, refreshToken, idToken, profile, done) => {
        try {
            // Ensure appleId is a string (SQLite requirement)
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
                // User exists
                user = result.rows[0];
                
                // Update last login
                await query(
                    'UPDATE users SET updated_at = NOW() WHERE id = $1',
                    [user.id]
                );
            } else {
                // Create new user
                result = await query(
                    `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, NOW(), NOW())
                     RETURNING *`,
                    ['APPLE', appleId, email, false]
                );
                user = result.rows[0];
                
                // Create empty user profile
                await query(
                    `INSERT INTO user_profiles (user_id, profile_completed, created_at, updated_at)
                     VALUES ($1, $2, NOW(), NOW())`,
                    [user.id, false]
                );
                
                logger.info('New user created via Apple OAuth', { userId: user.id, email });
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


