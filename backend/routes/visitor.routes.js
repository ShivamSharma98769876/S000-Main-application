const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /api/v1/visitor/count
 * Get current visitor count
 */
router.get('/count', async (req, res) => {
    try {
        const result = await query(
            'SELECT count FROM visitor_counter ORDER BY id DESC LIMIT 1'
        );
        
        const count = result.rows.length > 0 ? parseInt(result.rows[0].count) : 0;
        
        res.json({
            success: true,
            count: count
        });
    } catch (error) {
        logger.error('Error fetching visitor count', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch visitor count',
            count: 0
        });
    }
});

/**
 * POST /api/v1/visitor/increment
 * Increment visitor count (called when someone visits the landing page)
 */
router.post('/increment', async (req, res) => {
    try {
        // Get current count
        const currentResult = await query(
            'SELECT count FROM visitor_counter ORDER BY id DESC LIMIT 1'
        );
        
        let newCount;
        if (currentResult.rows.length > 0) {
            // Increment existing count
            const updateResult = await query(
                `UPDATE visitor_counter 
                 SET count = count + 1, last_updated = NOW()
                 WHERE id = (SELECT id FROM visitor_counter ORDER BY id DESC LIMIT 1)
                 RETURNING count`
            );
            newCount = parseInt(updateResult.rows[0].count);
        } else {
            // Initialize with count = 1
            const insertResult = await query(
                `INSERT INTO visitor_counter (count, last_updated, created_at)
                 VALUES (1, NOW(), NOW())
                 RETURNING count`
            );
            newCount = parseInt(insertResult.rows[0].count);
        }
        
        logger.info('Visitor count incremented', { count: newCount });
        
        res.json({
            success: true,
            count: newCount
        });
    } catch (error) {
        logger.error('Error incrementing visitor count', error);
        res.status(500).json({
            success: false,
            error: 'Failed to increment visitor count'
        });
    }
});

module.exports = router;
