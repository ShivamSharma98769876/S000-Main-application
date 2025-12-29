const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated, isProfileComplete, isAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

// Get user's subscriptions
router.get('/me', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const result = await query(
            `SELECT s.*, p.name as product_name, p.description, p.category, p.price_per_month, p.price_per_year
             FROM subscriptions s
             JOIN products p ON p.id = s.product_id
             WHERE s.user_id = $1
             ORDER BY p.name ASC`,
            [req.user.id]
        );
        
        // Sort by strategy code (S001, S002, etc.) if present in product name
        const sortedSubscriptions = result.rows.sort((a, b) => {
            const extractStrategyCode = (name) => {
                const match = name.match(/S(\d+)/i);
                return match ? parseInt(match[1], 10) : 9999;
            };
            
            const codeA = extractStrategyCode(a.product_name);
            const codeB = extractStrategyCode(b.product_name);
            
            if (codeA !== codeB) {
                return codeA - codeB;
            }
            
            // If same code or no code, sort alphabetically
            return a.product_name.localeCompare(b.product_name);
        });
        
        res.json({
            subscriptions: sortedSubscriptions
        });
    } catch (error) {
        logger.error('Error fetching subscriptions', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch subscriptions'
        });
    }
});

// Get all subscriptions (admin only)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const offset = (page - 1) * pageSize;
        
        // Get total count
        const countResult = await query('SELECT COUNT(*) FROM subscriptions');
        const totalCount = parseInt(countResult.rows[0].count);
        
        // Get subscriptions
        const result = await query(
            `SELECT s.*, p.name as product_name, u.email as user_email, up.full_name
             FROM subscriptions s
             JOIN products p ON p.id = s.product_id
             JOIN users u ON u.id = s.user_id
             LEFT JOIN user_profiles up ON up.user_id = s.user_id
             ORDER BY s.created_at DESC
             LIMIT $1 OFFSET $2`,
            [pageSize, offset]
        );
        
        res.json({
            subscriptions: result.rows,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });
    } catch (error) {
        logger.error('Error fetching all subscriptions', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch subscriptions'
        });
    }
});

module.exports = router;


