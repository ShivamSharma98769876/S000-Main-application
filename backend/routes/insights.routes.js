const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const logger = require('../config/logger');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET latest published insight (PUBLIC)
router.get('/latest', async (req, res) => {
    try {
        const result = await query(
            `SELECT mi.id, mi.title, mi.content, mi.category, mi.published_at, u.email as author_email 
             FROM market_insights mi 
             LEFT JOIN users u ON u.id = mi.author_id 
             WHERE mi.status = 'published' 
             ORDER BY mi.published_at DESC 
             LIMIT 1`
        );
        
        if (result.rows.length === 0) {
            return res.json({ insight: null });
        }
        
        res.json({ insight: result.rows[0] });
    } catch (error) {
        logger.error('Error fetching latest insight', error);
        console.error('Insights API Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch insight'
        });
    }
});

// GET all insights (ADMIN)
router.get('/admin/all', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT mi.*, u.email as author_email 
             FROM market_insights mi 
             LEFT JOIN users u ON u.id = mi.author_id 
             ORDER BY mi.created_at DESC`
        );
        
        res.json({ insights: result.rows });
    } catch (error) {
        logger.error('Error fetching insights', error);
        console.error('Admin insights API Error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch insights'
        });
    }
});

// CREATE insight (ADMIN)
router.post('/admin',
    isAuthenticated,
    isAdmin,
    [
        body('title').trim().notEmpty().withMessage('Title is required'),
        body('content').trim().notEmpty().withMessage('Content is required'),
        body('category').optional().trim(),
        body('status').optional().isIn(['draft', 'published', 'archived'])
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { title, content, category, status } = req.body;
            const publishedAt = status === 'published' ? new Date() : null;
            
            const result = await query(
                `INSERT INTO market_insights (title, content, category, status, author_id, published_at, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                 RETURNING *`,
                [title, content, category || 'intraday', status || 'draft', req.user.id, publishedAt]
            );
            
            logger.info(`Market insight created by admin ${req.user.email}`);
            res.status(201).json({
                message: 'Insight created successfully',
                insight: result.rows[0]
            });
        } catch (error) {
            logger.error('Error creating insight', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to create insight'
            });
        }
    }
);

// UPDATE insight (ADMIN)
router.put('/admin/:id',
    isAuthenticated,
    isAdmin,
    [
        body('title').optional().trim().notEmpty(),
        body('content').optional().trim().notEmpty(),
        body('category').optional().trim(),
        body('status').optional().isIn(['draft', 'published', 'archived'])
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { id } = req.params;
            const { title, content, category, status } = req.body;
            
            // If changing to published and no published_at, set it
            const existingResult = await query('SELECT status, published_at FROM market_insights WHERE id = $1', [id]);
            if (existingResult.rows.length === 0) {
                return res.status(404).json({ error: 'Insight not found' });
            }
            
            let publishedAt = existingResult.rows[0].published_at;
            if (status === 'published' && !publishedAt) {
                publishedAt = new Date();
            }
            
            const result = await query(
                `UPDATE market_insights 
                 SET title = COALESCE($1, title),
                     content = COALESCE($2, content),
                     category = COALESCE($3, category),
                     status = COALESCE($4, status),
                     published_at = $5,
                     updated_at = NOW()
                 WHERE id = $6
                 RETURNING *`,
                [title, content, category, status, publishedAt, id]
            );
            
            logger.info(`Market insight ${id} updated by admin ${req.user.email}`);
            res.json({
                message: 'Insight updated successfully',
                insight: result.rows[0]
            });
        } catch (error) {
            logger.error('Error updating insight', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update insight'
            });
        }
    }
);

// DELETE insight (ADMIN)
router.delete('/admin/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query('DELETE FROM market_insights WHERE id = $1 RETURNING id', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Insight not found' });
        }
        
        logger.info(`Market insight ${id} deleted by admin ${req.user.email}`);
        res.json({ message: 'Insight deleted successfully' });
    } catch (error) {
        logger.error('Error deleting insight', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete insight'
        });
    }
});

module.exports = router;


