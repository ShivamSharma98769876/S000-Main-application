const express = require('express');
const { ssoAuthMiddleware, requireProfileComplete } = require('../middleware/sso-auth');

const router = express.Router();

// Public landing page (no auth required)
router.get('/', (req, res) => {
    res.send('Child App Home');
});

// Protected routes - require SSO authentication
router.get('/dashboard', ssoAuthMiddleware, (req, res) => {
    res.json({
        message: 'Welcome to child app',
        user: req.ssoUser
    });
});

// Highly protected routes - require profile completion
router.get('/trading', ssoAuthMiddleware, requireProfileComplete, (req, res) => {
    res.json({
        message: 'Trading interface',
        user: req.ssoUser
    });
});

// API endpoint to verify token (called by frontend)
router.post('/api/verify-sso', ssoAuthMiddleware, (req, res) => {
    res.json({
        success: true,
        user: req.ssoUser
    });
});

module.exports = router;

