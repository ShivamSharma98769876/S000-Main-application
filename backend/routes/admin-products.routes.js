const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');

// Validation middleware for product
const validateProduct = [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('description').optional().trim(),
    body('category').optional().trim(),
    body('price_per_month').isFloat({ min: 0 }).withMessage('Monthly price must be a positive number'),
    body('price_per_year').isFloat({ min: 0 }).withMessage('Yearly price must be a positive number'),
    body('features').optional().isJSON().withMessage('Features must be valid JSON'),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE'),
    body('child_app_url_local').optional().isURL().withMessage('Child app URL (Local) must be a valid URL').trim(),
    body('child_app_url_cloud').optional().isURL().withMessage('Child app URL (Cloud) must be a valid URL').trim()
];

// GET all products (admin view - includes inactive)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM products 
             ORDER BY created_at DESC`,
            []
        );
        
        res.json({
            products: result.rows
        });
    } catch (error) {
        logger.error('Error fetching products', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch products'
        });
    }
});

// GET single product
router.get('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            'SELECT * FROM products WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }
        
        res.json({
            product: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching product', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch product'
        });
    }
});

// CREATE product
router.post('/', isAuthenticated, isAdmin, validateProduct, async (req, res) => {
    try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation Error',
                errors: errors.array()
            });
        }
        
        const {
            name,
            description,
            category,
            price_per_month,
            price_per_year,
            features,
            status,
            child_app_url_local,
            child_app_url_cloud
        } = req.body;
        
        const result = await query(
            `INSERT INTO products (name, description, category, price_per_month, price_per_year, features, status, child_app_url_local, child_app_url_cloud, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
             RETURNING *`,
            [
                name,
                description,
                category,
                price_per_month,
                price_per_year,
                features || null,
                status || 'ACTIVE',
                child_app_url_local || null,
                child_app_url_cloud || null
            ]
        );
        
        logger.info('Product created', { 
            productId: result.rows[0].id, 
            name,
            adminId: req.user.id 
        });
        
        res.status(201).json({
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (error) {
        logger.error('Error creating product', error);
        
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({
                error: 'Conflict',
                message: 'Product with this name already exists'
            });
        }
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create product'
        });
    }
});

// UPDATE product
router.put('/:id', isAuthenticated, isAdmin, validateProduct, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation Error',
                errors: errors.array()
            });
        }
        
        // Check if product exists
        const existingProduct = await query(
            'SELECT id FROM products WHERE id = $1',
            [id]
        );
        
        if (existingProduct.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }
        
        const {
            name,
            description,
            category,
            price_per_month,
            price_per_year,
            features,
            status,
            child_app_url_local,
            child_app_url_cloud
        } = req.body;
        
        const result = await query(
            `UPDATE products 
             SET name = $1, 
                 description = $2, 
                 category = $3, 
                 price_per_month = $4, 
                 price_per_year = $5, 
                 features = $6, 
                 status = $7,
                 child_app_url_local = $8,
                 child_app_url_cloud = $9,
                 updated_at = NOW()
             WHERE id = $10
             RETURNING *`,
            [
                name,
                description,
                category,
                price_per_month,
                price_per_year,
                features || null,
                status || 'ACTIVE',
                child_app_url_local || null,
                child_app_url_cloud || null,
                id
            ]
        );
        
        logger.info('Product updated', { 
            productId: id, 
            name,
            adminId: req.user.id 
        });
        
        res.json({
            message: 'Product updated successfully',
            product: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating product', error);
        
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({
                error: 'Conflict',
                message: 'Product with this name already exists'
            });
        }
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update product'
        });
    }
});

// TOGGLE product status (soft activation/deactivation)
router.patch('/:id/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Status must be ACTIVE or INACTIVE'
            });
        }
        
        const result = await query(
            `UPDATE products 
             SET status = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [status, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }
        
        logger.info('Product status updated', { 
            productId: id, 
            status,
            adminId: req.user.id 
        });
        
        res.json({
            message: `Product ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
            product: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating product status', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update product status'
        });
    }
});

// DELETE product (hard delete - use with caution)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if product has active subscriptions
        const subscriptionCheck = await query(
            `SELECT COUNT(*) as count 
             FROM subscriptions 
             WHERE product_id = $1 AND status = 'ACTIVE'`,
            [id]
        );
        
        if (parseInt(subscriptionCheck.rows[0].count) > 0) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Cannot delete product with active subscriptions. Please deactivate it instead.'
            });
        }
        
        // Check if product exists
        const productResult = await query(
            'SELECT name FROM products WHERE id = $1',
            [id]
        );
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }
        
        const productName = productResult.rows[0].name;
        
        // Delete the product
        await query('DELETE FROM products WHERE id = $1', [id]);
        
        logger.warn('Product deleted', { 
            productId: id, 
            productName,
            adminId: req.user.id 
        });
        
        res.json({
            message: 'Product deleted successfully',
            deletedProductId: id
        });
    } catch (error) {
        logger.error('Error deleting product', error);
        
        if (error.code === '23503') { // Foreign key constraint violation
            return res.status(409).json({
                error: 'Conflict',
                message: 'Cannot delete product. It has associated records. Please deactivate it instead.'
            });
        }
        
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete product'
        });
    }
});

module.exports = router;


