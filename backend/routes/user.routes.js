const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');
const { validateProfile } = require('../middleware/validator');
const logger = require('../config/logger');

// Create or update user profile
router.post('/me/profile', isAuthenticated, validateProfile, async (req, res) => {
    try {
        const { fullName, address, phone, capitalUsed, referralCode, zerodhaClientId } = req.body;
        
        // Ensure capitalUsed is a number
        const capitalUsedNum = parseFloat(capitalUsed);
        if (isNaN(capitalUsedNum) || capitalUsedNum < 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Capital used must be a valid positive number'
            });
        }
        
        // Check if profile exists
        const existingProfile = await query(
            'SELECT user_id FROM user_profiles WHERE user_id = $1',
            [req.user.id]
        );
        
        let result;
        
        if (existingProfile.rows.length > 0) {
            // Update existing profile
            result = await query(
                `UPDATE user_profiles 
                 SET full_name = $1, address = $2, phone = $3, capital_used = $4, 
                     referral_code = $5, zerodha_client_id = $6, profile_completed = true, updated_at = NOW()
                 WHERE user_id = $7
                 RETURNING *`,
                [fullName, address, phone, capitalUsedNum, referralCode || null, zerodhaClientId || null, req.user.id]
            );
        } else {
            // Create new profile
            result = await query(
                `INSERT INTO user_profiles (user_id, full_name, address, phone, capital_used, referral_code, zerodha_client_id, profile_completed, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
                 RETURNING *`,
                [req.user.id, fullName, address, phone, capitalUsedNum, referralCode || null, zerodhaClientId || null]
            );
        }
        
        logger.info('User profile updated', { userId: req.user.id });
        
        res.json({
            message: 'Profile updated successfully',
            profile: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating user profile', {
            error: error.message,
            stack: error.stack,
            code: error.code,
            userId: req.user?.id,
            body: req.body
        });
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update profile',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        });
    }
});

// Get user profile
router.get('/me/profile', isAuthenticated, async (req, res) => {
    try {
        const result = await query(
            `SELECT up.*, u.email, u.provider_type, u.is_admin
             FROM user_profiles up
             JOIN users u ON u.id = up.user_id
             WHERE up.user_id = $1`,
            [req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Profile not found'
            });
        }
        
        // Get subscriptions
        const subscriptions = await query(
            `SELECT s.*, p.name as product_name, p.category
             FROM subscriptions s
             JOIN products p ON p.id = s.product_id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC`,
            [req.user.id]
        );
        
        res.json({
            profile: result.rows[0],
            subscriptions: subscriptions.rows
        });
    } catch (error) {
        logger.error('Error fetching user profile', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch profile'
        });
    }
});

// Update user profile (PUT)
router.put('/me/profile', isAuthenticated, validateProfile, async (req, res) => {
    try {
        const { fullName, address, phone, capitalUsed, referralCode, zerodhaClientId } = req.body;
        
        // Ensure capitalUsed is a number
        const capitalUsedNum = parseFloat(capitalUsed);
        if (isNaN(capitalUsedNum) || capitalUsedNum < 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Capital used must be a valid positive number'
            });
        }
        
        const result = await query(
            `UPDATE user_profiles 
             SET full_name = $1, address = $2, phone = $3, capital_used = $4, 
                 referral_code = $5, zerodha_client_id = $6, updated_at = NOW()
             WHERE user_id = $7
             RETURNING *`,
            [fullName, address, phone, capitalUsedNum, referralCode || null, zerodhaClientId || null, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Profile not found'
            });
        }
        
        logger.info('User profile updated', { userId: req.user.id });
        
        res.json({
            message: 'Profile updated successfully',
            profile: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating user profile', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update profile'
        });
    }
});

module.exports = router;


