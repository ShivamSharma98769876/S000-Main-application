# 🔐 Child Application Integration - Implementation Plan

## Project Overview
Implement secure JWT-based Single Sign-On (SSO) between the main trading platform and child application (a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Trading Platform                     │
│  - Google OAuth Login                                        │
│  - Apple ID Login                                            │
│  - Generate JWT Token (signed with RSA private key)         │
│  - Token contains: session_id, user_id, email, iat, exp     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Pass JWT Token via:
                          │ 1. Authorization Header
                          │ 2. URL Parameter (encrypted)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Child Application                         │
│  - Validate JWT (verify signature with RSA public key)      │
│  - Extract user_id, email, session_id                       │
│  - Create internal session                                  │
│  - Deny access if token invalid/expired                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Task 1: Setup JWT Infrastructure

### 1.1 Install Required Libraries

**Backend (Main App):**
```bash
npm install jsonwebtoken
npm install uuid
```

**For RSA key generation:**
```bash
npm install node-rsa
# OR use OpenSSL
```

### 1.2 Generate RSA Key Pair

Create script `backend/scripts/generate-keys.js`:
```javascript
const NodeRSA = require('node-rsa');
const fs = require('fs');
const path = require('path');

// Generate 2048-bit RSA key pair
const key = new NodeRSA({ b: 2048 });

// Export keys in PEM format
const privateKey = key.exportKey('private');
const publicKey = key.exportKey('public');

// Save to secure location
const keysDir = path.join(__dirname, '../config/keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey);
fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

console.log('✅ RSA key pair generated successfully!');
console.log('📁 Private key: backend/config/keys/private.pem');
console.log('📁 Public key: backend/config/keys/public.pem');
console.log('⚠️  Add private.pem to .gitignore!');
```

**Run:**
```bash
node backend/scripts/generate-keys.js
```

### 1.3 Update Environment Variables

Add to `backend/.env`:
```env
# JWT Configuration
JWT_PRIVATE_KEY_PATH=./config/keys/private.pem
JWT_PUBLIC_KEY_PATH=./config/keys/public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
JWT_EXPIRY=10m

# Child App URLs
CHILD_APP_URL=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
CHILD_APP_ALLOWED_ORIGINS=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
```

### 1.4 Update .gitignore

Add to `.gitignore`:
```
# JWT Keys - NEVER COMMIT
backend/config/keys/private.pem
backend/config/keys/*.pem
```

**⚠️ CRITICAL:** Share `public.pem` with child app team via secure channel (Azure Key Vault, encrypted email, etc.)

---

## Task 2: Create JWT Token Generation Service

### 2.1 Create JWT Service

Create `backend/services/jwt.service.js`:
```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class JWTService {
    constructor() {
        try {
            const privateKeyPath = path.join(__dirname, '../config/keys/private.pem');
            const publicKeyPath = path.join(__dirname, '../config/keys/public.pem');

            this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
            this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');

            this.issuer = process.env.JWT_ISSUER || 'tradingpro-main-app';
            this.audience = process.env.JWT_AUDIENCE || 'tradingpro-child-app';
            this.expiresIn = process.env.JWT_EXPIRY || '10m';

            logger.info('JWT Service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize JWT Service', error);
            throw new Error('JWT keys not found. Run generate-keys.js first.');
        }
    }

    /**
     * Generate inter-app JWT token
     * @param {Object} user - User object with id, email
     * @param {String} sessionId - Optional session ID
     * @returns {String} Signed JWT token
     */
    generateToken(user, sessionId = null) {
        try {
            const payload = {
                session_id: sessionId || uuidv4(),
                user_id: user.id,
                email: user.email,
                full_name: user.full_name || '',
                profile_completed: user.profile_completed || false
            };

            const token = jwt.sign(payload, this.privateKey, {
                algorithm: 'RS256',
                issuer: this.issuer,
                audience: this.audience,
                expiresIn: this.expiresIn,
                jwtid: uuidv4() // Unique token ID for tracking
            });

            logger.info('JWT token generated', {
                user_id: user.id,
                email: user.email,
                token_id: payload.session_id
            });

            return token;
        } catch (error) {
            logger.error('Failed to generate JWT token', error);
            throw error;
        }
    }

    /**
     * Verify and decode JWT token
     * @param {String} token - JWT token to verify
     * @returns {Object} Decoded token payload
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.publicKey, {
                algorithms: ['RS256'],
                issuer: this.issuer,
                audience: this.audience
            });

            logger.info('JWT token verified', {
                user_id: decoded.user_id,
                session_id: decoded.session_id
            });

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                logger.warn('JWT token expired', { expiredAt: error.expiredAt });
                throw new Error('Token expired');
            } else if (error.name === 'JsonWebTokenError') {
                logger.warn('Invalid JWT token', { message: error.message });
                throw new Error('Invalid token');
            }
            throw error;
        }
    }

    /**
     * Refresh token with new expiry
     * @param {String} oldToken - Existing valid token
     * @returns {String} New token with extended expiry
     */
    refreshToken(oldToken) {
        try {
            // Verify old token (allows expired tokens within grace period)
            const decoded = jwt.verify(oldToken, this.publicKey, {
                algorithms: ['RS256'],
                issuer: this.issuer,
                audience: this.audience,
                ignoreExpiration: true // Allow refresh of expired tokens
            });

            // Check if token is too old (max 1 hour past expiry)
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp && (now - decoded.exp) > 3600) {
                throw new Error('Token too old to refresh');
            }

            // Generate new token with same session_id
            const newPayload = {
                session_id: decoded.session_id,
                user_id: decoded.user_id,
                email: decoded.email,
                full_name: decoded.full_name,
                profile_completed: decoded.profile_completed
            };

            const newToken = jwt.sign(newPayload, this.privateKey, {
                algorithm: 'RS256',
                issuer: this.issuer,
                audience: this.audience,
                expiresIn: this.expiresIn,
                jwtid: uuidv4()
            });

            logger.info('JWT token refreshed', {
                user_id: decoded.user_id,
                session_id: decoded.session_id
            });

            return newToken;
        } catch (error) {
            logger.error('Failed to refresh JWT token', error);
            throw error;
        }
    }

    /**
     * Decode token without verification (for debugging)
     * @param {String} token - JWT token
     * @returns {Object} Decoded payload (unverified)
     */
    decodeToken(token) {
        return jwt.decode(token, { complete: true });
    }
}

module.exports = new JWTService();
```

---

## Task 3: Implement Token Signing Endpoint

### 3.1 Create Child App Routes

Create `backend/routes/child-app.routes.js`:
```javascript
const express = require('express');
const router = express.Router();
const jwtService = require('../services/jwt.service');
const { isAuthenticated } = require('../middleware/auth');
const logger = require('../config/logger');
const { query } = require('../config/database');

/**
 * GET /api/v1/child-app/generate-token
 * Generate JWT token for accessing child application
 */
router.get('/generate-token', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;

        // Fetch fresh user data
        const userResult = await query(
            `SELECT u.id, u.email, up.full_name, up.profile_completed
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
            child_app_url: process.env.CHILD_APP_URL
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
router.post('/launch', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        const { return_url } = req.body;

        // Generate token
        const userData = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            profile_completed: user.profile_completed
        };

        const token = jwtService.generateToken(userData, req.sessionID);

        // Build child app URL with token
        const childAppUrl = new URL(process.env.CHILD_APP_URL);
        childAppUrl.searchParams.append('sso_token', token);
        
        if (return_url) {
            childAppUrl.searchParams.append('return_url', return_url);
        }

        logger.info('Child app launch initiated', {
            user_id: user.id,
            child_app: process.env.CHILD_APP_URL
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

        const newToken = jwtService.refreshToken(token);

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
 */
router.post('/verify-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        const decoded = jwtService.verifyToken(token);

        res.json({
            success: true,
            valid: true,
            user: {
                user_id: decoded.user_id,
                email: decoded.email,
                full_name: decoded.full_name,
                session_id: decoded.session_id
            }
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            error: error.message
        });
    }
});

module.exports = router;
```

### 3.2 Create Audit Table Migration

Create `backend/scripts/create-app-access-audit.js`:
```javascript
const { query } = require('../config/database');
const logger = require('../config/logger');

async function createAppAccessAuditTable() {
    try {
        logger.info('Creating app_access_audit table...');

        await query(`
            CREATE TABLE IF NOT EXISTS app_access_audit (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                source_app VARCHAR(50) NOT NULL,
                target_app VARCHAR(50) NOT NULL,
                token_id VARCHAR(255),
                action VARCHAR(50) DEFAULT 'token_generated',
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_app_access_user ON app_access_audit(user_id);
            CREATE INDEX IF NOT EXISTS idx_app_access_created ON app_access_audit(created_at);
        `);

        logger.info('✓ app_access_audit table created successfully');
        console.log('✅ App Access Audit table created successfully');
        process.exit(0);

    } catch (error) {
        logger.error('Failed to create app_access_audit table', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    createAppAccessAuditTable();
}

module.exports = { createAppAccessAuditTable };
```

### 3.3 Mount Routes in server.js

Add to `backend/server.js`:
```javascript
// Child App Integration Routes
const childAppRoutes = require('./routes/child-app.routes');
app.use('/api/v1/child-app', childAppRoutes);
```

---

## Task 4: Create Secure Token Passing Mechanism

### 4.1 Update Dashboard with Child App Launch Button

Modify `public/dashboard.html` (add to active subscriptions):
```html
<!-- Add to subscription card -->
<div class="subscription-actions">
    <button class="btn-execute" onclick="executeStrategy('${subscription.product_name}')">
        Execute Strategy
    </button>
    
    <!-- NEW: Launch Child App Button -->
    <button class="btn-child-app" onclick="launchChildApp(${subscription.id})">
        Launch Advanced Tools
    </button>
</div>
```

### 4.2 Add JavaScript Function

Add to `public/dashboard.html` (in `<script>` section):
```javascript
/**
 * Launch child application with SSO token
 */
async function launchChildApp(subscriptionId) {
    try {
        showLoading('Launching advanced tools...');

        // Generate token and get redirect URL
        const response = await fetch(`${API_BASE_URL}/child-app/launch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                return_url: `/subscription/${subscriptionId}`
            })
        });

        const data = await response.json();

        if (data.success) {
            // Open child app in new window with token
            window.open(data.redirect_url, '_blank', 'noopener,noreferrer');
            showSuccess('Advanced tools launched successfully!');
        } else {
            showError(data.error || 'Failed to launch child app');
        }

    } catch (error) {
        console.error('Launch error:', error);
        showError('Failed to launch child app');
    } finally {
        hideLoading();
    }
}

/**
 * Alternative: Launch with Authorization header (for iframe/API approach)
 */
async function launchChildAppWithHeader(subscriptionId) {
    try {
        // Get token
        const tokenResponse = await fetch(`${API_BASE_URL}/child-app/generate-token`, {
            credentials: 'include'
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.success) {
            // Store token for child app API calls
            sessionStorage.setItem('child_app_token', tokenData.token);
            
            // Open child app
            window.open(tokenData.child_app_url, '_blank');
        }

    } catch (error) {
        console.error('Launch error:', error);
        showError('Failed to launch child app');
    }
}
```

### 4.3 Add Styling

Add to `public/dashboard.html` (in `<style>` section):
```css
.btn-child-app {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    margin-left: 10px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn-child-app:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
```

---

## Task 5: Build Child App Token Validation Middleware

### 5.1 Share Public Key with Child App

**⚠️ SECURE TRANSFER REQUIRED:**

1. Copy `backend/config/keys/public.pem`
2. Transfer via:
   - Azure Key Vault (recommended)
   - Encrypted email
   - Secure file sharing service
   
**DO NOT:**
- Commit to repository
- Send via plain email
- Share via Slack/Teams

### 5.2 Child App Middleware (Example - Node.js/Express)

**File: `child-app/middleware/sso-auth.js`**

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Load public key from main app
const publicKey = fs.readFileSync(
    path.join(__dirname, '../config/keys/main-app-public.pem'),
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
        req.session.userId = decoded.user_id;
        req.session.email = decoded.email;
        req.session.ssoSessionId = decoded.session_id;

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
```

### 5.3 Child App Route Protection

**Example usage in child app:**

```javascript
const express = require('express');
const { ssoAuthMiddleware, requireProfileComplete } = require('./middleware/sso-auth');

const app = express();

// Public landing page (no auth required)
app.get('/', (req, res) => {
    res.send('Child App Home');
});

// Protected routes - require SSO authentication
app.use('/dashboard', ssoAuthMiddleware, (req, res) => {
    res.json({
        message: 'Welcome to child app',
        user: req.ssoUser
    });
});

// Highly protected routes - require profile completion
app.use('/trading', ssoAuthMiddleware, requireProfileComplete, (req, res) => {
    res.json({
        message: 'Trading interface',
        user: req.ssoUser
    });
});

// API endpoint to verify token (called by frontend)
app.post('/api/verify-sso', ssoAuthMiddleware, (req, res) => {
    res.json({
        success: true,
        user: req.ssoUser
    });
});
```

---

## Task 6: Implement Session Creation in Child App

### 6.1 Child App Session Manager

**File: `child-app/services/session.service.js`**

```javascript
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
```

### 6.2 Child App Database Schema

**File: `child-app/migrations/001_create_users_sessions.sql`**

```sql
-- Users table (mirrored from parent app)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    parent_user_id INTEGER NOT NULL UNIQUE, -- References main app user.id
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    profile_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_parent_id ON users(parent_user_id);
CREATE INDEX idx_users_email ON users(email);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_session_id VARCHAR(255), -- References main app session
    email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_parent ON sessions(parent_session_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- SSO audit log
CREATE TABLE IF NOT EXISTS sso_audit (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    parent_user_id INTEGER,
    action VARCHAR(50), -- 'login', 'token_refresh', 'logout'
    token_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sso_audit_user ON sso_audit(user_id);
CREATE INDEX idx_sso_audit_created ON sso_audit(created_at);
```

---

## Task 7: Add Token Refresh Mechanism

### 7.1 Frontend Token Refresh Logic

**File: `child-app/public/js/token-manager.js`**

```javascript
class TokenManager {
    constructor() {
        this.token = null;
        this.refreshTimer = null;
        this.mainAppUrl = 'http://127.0.0.1:3000'; // Main app URL
    }

    /**
     * Initialize token from URL or storage
     */
    async initialize() {
        // Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const ssoToken = urlParams.get('sso_token');

        if (ssoToken) {
            // Validate and store token
            await this.setToken(ssoToken);
            
            // Clean URL (remove token from address bar)
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // Try to restore from sessionStorage
            const storedToken = sessionStorage.getItem('child_app_token');
            if (storedToken) {
                try {
                    await this.verifyToken(storedToken);
                    this.token = storedToken;
                    this.scheduleRefresh();
                } catch (error) {
                    console.error('Stored token invalid:', error);
                    this.redirectToMainApp();
                }
            } else {
                // No token found - redirect to main app
                this.redirectToMainApp();
            }
        }
    }

    /**
     * Set and validate token
     */
    async setToken(token) {
        try {
            // Verify token with child app backend
            const response = await fetch('/api/verify-sso', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Token validation failed');
            }

            const data = await response.json();

            if (data.success) {
                this.token = token;
                sessionStorage.setItem('child_app_token', token);
                
                // Store user info
                sessionStorage.setItem('user_email', data.user.email);
                sessionStorage.setItem('user_id', data.user.id);

                // Schedule refresh before expiry
                this.scheduleRefresh();

                console.log('Token validated and stored successfully');
                return true;
            }

            throw new Error('Invalid token response');

        } catch (error) {
            console.error('Token validation error:', error);
            this.redirectToMainApp();
            return false;
        }
    }

    /**
     * Verify token is still valid
     */
    async verifyToken(token) {
        const response = await fetch('/api/verify-sso', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Token invalid');
        }

        return await response.json();
    }

    /**
     * Schedule token refresh (8 minutes for 10-minute token)
     */
    scheduleRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        // Refresh at 80% of token lifetime (8 min for 10 min token)
        const refreshInterval = 8 * 60 * 1000;

        this.refreshTimer = setTimeout(() => {
            this.refreshToken();
        }, refreshInterval);

        console.log('Token refresh scheduled in', refreshInterval / 1000, 'seconds');
    }

    /**
     * Refresh token via main app
     */
    async refreshToken() {
        try {
            console.log('Refreshing token...');

            const response = await fetch(`${this.mainAppUrl}/api/v1/child-app/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ token: this.token })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();

            if (data.success) {
                await this.setToken(data.token);
                console.log('Token refreshed successfully');
            } else {
                throw new Error('Invalid refresh response');
            }

        } catch (error) {
            console.error('Token refresh error:', error);
            this.redirectToMainApp();
        }
    }

    /**
     * Get current token for API calls
     */
    getToken() {
        return this.token;
    }

    /**
     * Redirect to main app login
     */
    redirectToMainApp() {
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `${this.mainAppUrl}/login?redirect=${returnUrl}`;
    }

    /**
     * Clear token and logout
     */
    logout() {
        this.token = null;
        sessionStorage.clear();
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.redirectToMainApp();
    }
}

// Global instance
const tokenManager = new TokenManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await tokenManager.initialize();
});
```

### 7.2 Include in Child App HTML

```html
<!-- In all protected pages -->
<script src="/js/token-manager.js"></script>

<script>
// Use token in API calls
async function makeAuthenticatedRequest(url, options = {}) {
    const token = tokenManager.getToken();
    
    if (!token) {
        tokenManager.redirectToMainApp();
        return;
    }

    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, options);

    if (response.status === 401) {
        // Token expired - try refresh
        await tokenManager.refreshToken();
        
        // Retry request
        const retryToken = tokenManager.getToken();
        options.headers['Authorization'] = `Bearer ${retryToken}`;
        return await fetch(url, options);
    }

    return response;
}
</script>
```

---

## Task 8: Implement Security Hardening

### 8.1 HTTPS Enforcement

**Main App - Add to `backend/server.js`:**
```javascript
// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}
```

### 8.2 CORS Configuration for Child App

**Update `backend/server.js`:**
```javascript
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://127.0.0.1:8000',
            'http://localhost:8000',
            process.env.FRONTEND_URL,
            process.env.CHILD_APP_ALLOWED_ORIGINS
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

### 8.3 Rate Limiting for Token Generation

**Update `backend/middleware/rateLimiter.js`:**
```javascript
const childAppRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 token generations per 15 min
    message: 'Too many token requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    // ... existing limiters
    childAppRateLimiter
};
```

**Apply to routes:**
```javascript
const { childAppRateLimiter } = require('../middleware/rateLimiter');

router.get('/generate-token', 
    isAuthenticated, 
    childAppRateLimiter, 
    async (req, res) => {
        // ... token generation logic
    }
);
```

### 8.4 Token Blacklisting (Optional)

**For immediate token revocation:**

Create `backend/services/token-blacklist.service.js`:
```javascript
const redis = require('redis');
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

class TokenBlacklist {
    async blacklistToken(tokenId, expiresIn) {
        // Add token to blacklist with TTL
        await client.setEx(`blacklist:${tokenId}`, expiresIn, 'revoked');
    }

    async isBlacklisted(tokenId) {
        const result = await client.get(`blacklist:${tokenId}`);
        return result !== null;
    }
}

module.exports = new TokenBlacklist();
```

**Usage in verification:**
```javascript
// Check blacklist before accepting token
const decoded = jwtService.verifyToken(token);

if (await tokenBlacklist.isBlacklisted(decoded.jti)) {
    throw new Error('Token has been revoked');
}
```

### 8.5 CSRF Protection

**Already implemented in main app via `csurf` middleware**

For child app API calls from main app frontend:
```javascript
// Include CSRF token in child app launch
router.post('/launch', isAuthenticated, csrfProtection, async (req, res) => {
    // ... existing code
});
```

---

## Task 9: Create Audit Logging

### 9.1 Main App Audit

Already created in Task 3.2 (`app_access_audit` table)

**Additional logging points:**

```javascript
// Log token refresh
await query(
    `INSERT INTO app_access_audit 
     (user_id, source_app, target_app, action, token_id, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [user.id, 'main-app', 'child-app', 'token_refreshed', tokenId, req.ip]
);

// Log token revocation
await query(
    `INSERT INTO app_access_audit 
     (user_id, source_app, target_app, action, token_id, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [user.id, 'main-app', 'child-app', 'token_revoked', tokenId, req.ip]
);
```

### 9.2 Child App Audit

**Log all SSO authentications:**

```javascript
// In sso-auth.js middleware
await db.query(
    `INSERT INTO sso_audit 
     (user_id, parent_user_id, action, token_id, ip_address, user_agent, success, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
        localUserId,
        decoded.user_id,
        'login',
        decoded.jti,
        req.ip,
        req.get('user-agent'),
        true
    ]
);
```

### 9.3 Audit Dashboard (Admin)

**Create admin endpoint to view cross-app access:**

```javascript
// Main app - backend/routes/admin.routes.js
router.get('/audit/cross-app', isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, userId } = req.query;

        let query = `
            SELECT 
                aaa.*,
                u.email,
                up.full_name
            FROM app_access_audit aaa
            JOIN users u ON aaa.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE 1=1
        `;

        const params = [];

        if (startDate) {
            params.push(startDate);
            query += ` AND aaa.created_at >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            query += ` AND aaa.created_at <= $${params.length}`;
        }

        if (userId) {
            params.push(userId);
            query += ` AND aaa.user_id = $${params.length}`;
        }

        query += ` ORDER BY aaa.created_at DESC LIMIT 1000`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            audit: result.rows
        });

    } catch (error) {
        logger.error('Failed to fetch cross-app audit', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});
```

---

## Task 10: Testing & Error Scenarios

### 10.1 Test Scenarios

1. **Happy Path:**
   - User logs in to main app
   - Clicks "Launch Child App"
   - Gets redirected with valid token
   - Child app validates token
   - Session created, user gains access

2. **Expired Token:**
   - Token expires after 10 minutes
   - Child app detects expiry
   - Triggers refresh via main app
   - New token issued, session continues

3. **Invalid Token:**
   - Tampered token detected
   - Child app rejects access
   - User redirected to main app login

4. **No Active Session:**
   - User directly accesses child app URL
   - No token present
   - Redirected to main app login

5. **Token Refresh Failure:**
   - Main app session expired
   - Refresh fails
   - User redirected to login
   - After login, returns to child app

### 10.2 Error Handling Matrix

| Error | Status | Action | User Experience |
|-------|--------|--------|-----------------|
| No token | 401 | Redirect to main app | Seamless login redirect |
| Expired token | 401 | Auto-refresh attempt | Transparent refresh |
| Invalid signature | 401 | Reject + redirect | Security alert + login |
| Refresh failed | 401 | Force re-authentication | Login required message |
| Network error | 500 | Retry + fallback | "Please try again" |
| Child app down | 503 | Show maintenance | "Service temporarily unavailable" |

### 10.3 Integration Tests

**Main App Test - `backend/tests/child-app.test.js`:**

```javascript
const request = require('supertest');
const app = require('../server');
const jwtService = require('../services/jwt.service');

describe('Child App Integration', () => {
    let authCookie;

    beforeAll(async () => {
        // Login to get session
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'test123' });
        
        authCookie = loginRes.headers['set-cookie'];
    });

    test('Generate token for authenticated user', async () => {
        const res = await request(app)
            .get('/api/v1/child-app/generate-token')
            .set('Cookie', authCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.child_app_url).toBeDefined();
    });

    test('Token contains correct payload', async () => {
        const res = await request(app)
            .get('/api/v1/child-app/generate-token')
            .set('Cookie', authCookie);

        const decoded = jwtService.decodeToken(res.body.token);

        expect(decoded.payload.user_id).toBeDefined();
        expect(decoded.payload.email).toBeDefined();
        expect(decoded.payload.session_id).toBeDefined();
        expect(decoded.payload.iss).toBe('tradingpro-main-app');
        expect(decoded.payload.aud).toBe('tradingpro-child-app');
    });

    test('Reject token generation without authentication', async () => {
        const res = await request(app)
            .get('/api/v1/child-app/generate-token');

        expect(res.status).toBe(401);
    });

    test('Token refresh works', async () => {
        // Generate initial token
        const tokenRes = await request(app)
            .get('/api/v1/child-app/generate-token')
            .set('Cookie', authCookie);

        const oldToken = tokenRes.body.token;

        // Wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Refresh token
        const refreshRes = await request(app)
            .post('/api/v1/child-app/refresh-token')
            .send({ token: oldToken });

        expect(refreshRes.status).toBe(200);
        expect(refreshRes.body.success).toBe(true);
        expect(refreshRes.body.token).toBeDefined();
        expect(refreshRes.body.token).not.toBe(oldToken);
    });
});
```

### 10.4 Manual Testing Checklist

**Main App:**
- [ ] User can login via Google OAuth
- [ ] Token generation endpoint returns valid JWT
- [ ] Token contains all required fields
- [ ] Token expiry is set correctly (10 min)
- [ ] Rate limiting prevents abuse
- [ ] Audit logs record token generation

**Child App:**
- [ ] Direct access without token redirects to main app
- [ ] Valid token grants access
- [ ] User session created successfully
- [ ] User data synced from main app
- [ ] Expired token triggers refresh
- [ ] Invalid token rejects access
- [ ] Refresh mechanism works
- [ ] Audit logs record SSO events

**Security:**
- [ ] HTTPS enforced in production
- [ ] CORS properly configured
- [ ] CSRF protection active
- [ ] Rate limiting prevents brute force
- [ ] Tokens signed with strong algorithm (RS256)
- [ ] Private key secured (not in repo)
- [ ] Public key shared securely

---

## Deployment Checklist

### Main App (Trading Platform)

1. **Environment Variables:**
```env
JWT_PRIVATE_KEY_PATH=./config/keys/private.pem
JWT_PUBLIC_KEY_PATH=./config/keys/public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
JWT_EXPIRY=10m
CHILD_APP_URL=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
CHILD_APP_ALLOWED_ORIGINS=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
NODE_ENV=production
```

2. **Generate Keys:**
```bash
node backend/scripts/generate-keys.js
```

3. **Run Migrations:**
```bash
node backend/scripts/create-app-access-audit.js
```

4. **Test Endpoints:**
```bash
npm test -- child-app.test.js
```

5. **Deploy:**
   - Ensure private key is secure (Azure Key Vault recommended)
   - Share public key with child app team
   - Update DNS/CORS settings
   - Enable HTTPS

### Child App (Strangle Bot)

1. **Receive Public Key:**
   - Get `main-app-public.pem` from main app team
   - Store in `config/keys/` directory
   - DO NOT commit to repository

2. **Environment Variables:**
```env
MAIN_APP_URL=http://127.0.0.1:3000
MAIN_APP_PUBLIC_KEY_PATH=./config/keys/main-app-public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
NODE_ENV=production
```

3. **Run Migrations:**
```sql
-- Run migrations/001_create_users_sessions.sql
```

4. **Implement Middleware:**
   - Add `sso-auth.js` middleware
   - Protect all routes except landing page
   - Add token-manager.js to frontend

5. **Test:**
   - Test with sample JWT from main app
   - Verify token validation works
   - Test refresh mechanism
   - Test error scenarios

6. **Deploy:**
   - Configure Azure App Service
   - Enable HTTPS
   - Set environment variables
   - Configure session store (Redis recommended)

---

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Token Generation:**
   - Rate of token generation
   - Failed generation attempts
   - Average time to generate

2. **Token Validation:**
   - Success/failure rates
   - Expired token rates
   - Invalid signature attempts

3. **Session Activity:**
   - Active cross-app sessions
   - Average session duration
   - Session creation/termination rates

4. **Errors:**
   - Authentication failures
   - Network timeouts
   - Refresh failures

### Alerts to Configure

- High rate of invalid token attempts (potential attack)
- Token generation failures (key issues)
- Child app unavailability
- Expired token rate >20% (may need longer expiry)

### Regular Tasks

- Review audit logs weekly
- Rotate keys every 6 months
- Review and update CORS origins
- Check for expired sessions in database
- Monitor token blacklist size (if using)

---

## Security Best Practices Summary

✅ **DO:**
- Use RS256 algorithm (asymmetric signing)
- Keep private key secure (never commit)
- Use short-lived tokens (10 minutes)
- Implement token refresh mechanism
- Log all authentication events
- Use HTTPS everywhere
- Validate all claims (iss, aud, exp)
- Rate limit token generation
- Implement CSRF protection

❌ **DON'T:**
- Use HS256 with shared secret across apps
- Store private key in repository
- Use long-lived tokens (>1 hour)
- Skip signature verification
- Allow direct child app access without token
- Use HTTP in production
- Log sensitive token data
- Share keys via insecure channels

---

## Troubleshooting Guide

### Problem: "Token validation failed"

**Possible Causes:**
1. Public key mismatch (child app has old/wrong key)
2. Clock skew between servers
3. Token expired
4. Token tampered with

**Solutions:**
- Verify public key matches private key
- Sync server clocks (use NTP)
- Check token expiry with decode tool
- Regenerate token from main app

### Problem: "Session not created in child app"

**Possible Causes:**
1. Database connection issue
2. Missing user in child app database
3. Session middleware not configured

**Solutions:**
- Check database connectivity
- Verify user sync logic
- Enable express-session middleware

### Problem: "Infinite redirect loop"

**Possible Causes:**
1. Child app can't set session cookie
2. Token validation always fails
3. CORS misconfiguration

**Solutions:**
- Check cookie settings (SameSite, Secure)
- Test token validation with curl
- Verify CORS allows credentials

---

## Next Steps

After completing all 10 tasks:

1. **Integration Testing:**
   - Test full user journey from main to child app
   - Verify all error scenarios handled gracefully
   - Load test token generation endpoint

2. **Documentation:**
   - Create user guide for accessing child app
   - Document API endpoints for both teams
   - Create runbooks for common issues

3. **Monitoring Setup:**
   - Configure application insights
   - Set up alerts for failures
   - Create dashboard for cross-app metrics

4. **Production Rollout:**
   - Deploy to staging first
   - Test with small user group
   - Monitor for 1 week before full rollout
   - Prepare rollback plan

---

## Support & Resources

- **JWT.io**: https://jwt.io/ (token debugger)
- **Node.js jsonwebtoken**: https://github.com/auth0/node-jsonwebtoken
- **OAuth 2.0 Best Practices**: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics

---

**Document Version:** 1.0  
**Last Updated:** December 27, 2025  
**Author:** AI Assistant  
**Review Status:** Ready for implementation

