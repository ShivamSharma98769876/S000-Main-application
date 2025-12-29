const { v4: uuidv4 } = require('uuid');

class SessionService {
    /**
     * Create or update session from SSO token
     * @param {Object} ssoUser - User info from validated JWT
     * @param {Object} req - Express request object
     */
    async createSessionFromSSO(ssoUser, req) {
        try {
            // Check if user exists in child app database
            let user = await this.findOrCreateUser(ssoUser);

            // Create session entry
            const sessionId = req.session.id || uuidv4();
            
            await this.saveSession({
                session_id: sessionId,
                user_id: user.id,
                parent_session_id: ssoUser.session_id,
                email: ssoUser.email,
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                created_at: new Date(),
                expires_at: new Date(Date.now() + 3600000) // 1 hour
            });

            // Set session data
            req.session.userId = user.id;
            req.session.email = ssoUser.email;
            req.session.parentSessionId = ssoUser.session_id;
            req.session.authenticated = true;

            console.log('Session created for SSO user:', {
                user_id: user.id,
                email: ssoUser.email,
                session_id: sessionId
            });

            return { success: true, user, sessionId };

        } catch (error) {
            console.error('Failed to create SSO session:', error);
            throw error;
        }
    }

    /**
     * Find existing user or create new one
     */
    async findOrCreateUser(ssoUser) {
        // Check if user exists
        let user = await db.query(
            'SELECT * FROM users WHERE parent_user_id = $1',
            [ssoUser.id]
        );

        if (user.rows.length > 0) {
            // Update existing user
            await db.query(
                `UPDATE users 
                 SET email = $1, full_name = $2, last_login = NOW(), updated_at = NOW()
                 WHERE parent_user_id = $3`,
                [ssoUser.email, ssoUser.full_name, ssoUser.id]
            );
            return user.rows[0];
        }

        // Create new user
        const result = await db.query(
            `INSERT INTO users 
             (parent_user_id, email, full_name, profile_completed, created_at, last_login)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING *`,
            [ssoUser.id, ssoUser.email, ssoUser.full_name, ssoUser.profile_completed]
        );

        return result.rows[0];
    }

    /**
     * Save session to database
     */
    async saveSession(sessionData) {
        await db.query(
            `INSERT INTO sessions 
             (session_id, user_id, parent_session_id, email, ip_address, user_agent, created_at, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (session_id) 
             DO UPDATE SET expires_at = EXCLUDED.expires_at`,
            [
                sessionData.session_id,
                sessionData.user_id,
                sessionData.parent_session_id,
                sessionData.email,
                sessionData.ip_address,
                sessionData.user_agent,
                sessionData.created_at,
                sessionData.expires_at
            ]
        );
    }
}

module.exports = new SessionService();

