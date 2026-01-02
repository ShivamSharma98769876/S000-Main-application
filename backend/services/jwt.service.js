const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

class JWTService {
    constructor() {
        try {
            // Try to load keys from environment variables first (for cloud deployments)
            if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
                this.privateKey = process.env.JWT_PRIVATE_KEY;
                this.publicKey = process.env.JWT_PUBLIC_KEY;
                
                // Validate key format
                if (!this.privateKey.includes('BEGIN') || !this.privateKey.includes('PRIVATE KEY')) {
                    throw new Error('JWT_PRIVATE_KEY is not in valid PEM format. It must include -----BEGIN and -----END markers.');
                }
                if (!this.publicKey.includes('BEGIN') || !this.publicKey.includes('PUBLIC KEY')) {
                    throw new Error('JWT_PUBLIC_KEY is not in valid PEM format. It must include -----BEGIN and -----END markers.');
                }
                
                logger.info('JWT Service initialized from environment variables');
            } else {
                // Fallback to file system (for local development)
                const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH 
                    ? path.resolve(process.env.JWT_PRIVATE_KEY_PATH)
                    : path.join(__dirname, '../config/keys/private.pem');
                const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH 
                    ? path.resolve(process.env.JWT_PUBLIC_KEY_PATH)
                    : path.join(__dirname, '../config/keys/public.pem');

                if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
                    throw new Error(`JWT keys not found at ${privateKeyPath} or ${publicKeyPath}. Either set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables, or run generate-keys.js to create keys.`);
                }

                this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
                this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');
                logger.info('JWT Service initialized from file system');
            }

            this.issuer = process.env.JWT_ISSUER || 'tradingpro-main-app';
            this.audience = process.env.JWT_AUDIENCE || 'tradingpro-child-app';
            this.expiresIn = process.env.JWT_EXPIRY || '10m';

            logger.info('JWT Service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize JWT Service', error);
            const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME);
            
            if (isAzure) {
                throw new Error(`JWT keys not configured for Azure. Please set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables in Azure Portal → Configuration → Application settings. Error: ${error.message}`);
            } else {
                throw new Error(`JWT keys not found. Either set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables, or run generate-keys.js and upload keys to server. Error: ${error.message}`);
            }
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
                profile_completed: user.profile_completed || false,
                zerodha_client_id: user.zerodha_client_id || null
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
                profile_completed: decoded.profile_completed,
                zerodha_client_id: decoded.zerodha_client_id || null
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

    /**
     * Generate user authentication JWT token (for main app login)
     * This token can also be used by child apps for SSO
     * @param {Object} user - User object with id, email, full_name, profile_completed
     * @returns {String} Signed JWT token
     */
    generateAuthToken(user) {
        try {
            // Validate private key before signing
            if (!this.privateKey || typeof this.privateKey !== 'string') {
                throw new Error('JWT private key is not set or invalid');
            }
            
            if (!this.privateKey.includes('BEGIN') || !this.privateKey.includes('PRIVATE KEY')) {
                throw new Error('JWT private key is not in valid PEM format. It must be an RSA private key in PEM format with -----BEGIN and -----END markers. Please set JWT_PRIVATE_KEY in Azure Portal.');
            }

            const payload = {
                user_id: user.id,
                email: user.email,
                full_name: user.full_name || '',
                profile_completed: user.profile_completed || false,
                is_admin: user.is_admin || false,
                zerodha_client_id: user.zerodha_client_id || null
            };

            // Use same keys but different issuer/audience for user auth tokens
            // Audience can be an array to support both main app and child app
            const audience = [
                'tradingpro-main-app',
                'tradingpro-child-app'
            ];

            const token = jwt.sign(payload, this.privateKey, {
                algorithm: 'RS256',
                issuer: 'tradingpro-user-auth',
                audience: audience,
                expiresIn: process.env.AUTH_TOKEN_EXPIRY || '7d', // 7 days default
                jwtid: uuidv4()
            });

            logger.info('User auth JWT token generated', {
                user_id: user.id,
                email: user.email,
                audience: audience
            });

            return token;
        } catch (error) {
            logger.error('Failed to generate user auth JWT token', error);
            throw error;
        }
    }

    /**
     * Verify user authentication JWT token
     * Supports tokens with audience for both main app and child app
     * @param {String} token - JWT token to verify
     * @param {String|Array} expectedAudience - Optional: specific audience to verify (default: accepts both)
     * @returns {Object} Decoded token payload
     */
    verifyAuthToken(token, expectedAudience = null) {
        try {
            const verifyOptions = {
                algorithms: ['RS256'],
                issuer: 'tradingpro-user-auth'
            };

            // If specific audience provided, use it; otherwise accept both
            if (expectedAudience) {
                verifyOptions.audience = expectedAudience;
            } else {
                // Accept tokens with either audience
                verifyOptions.audience = [
                    'tradingpro-main-app',
                    'tradingpro-child-app'
                ];
            }

            const decoded = jwt.verify(token, this.publicKey, verifyOptions);

            logger.info('User auth JWT token verified', {
                user_id: decoded.user_id,
                audience: decoded.aud
            });

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                logger.warn('User auth JWT token expired', { expiredAt: error.expiredAt });
                throw new Error('Token expired');
            } else if (error.name === 'JsonWebTokenError') {
                logger.warn('Invalid user auth JWT token', { message: error.message });
                throw new Error('Invalid token');
            }
            throw error;
        }
    }
}

module.exports = new JWTService();

