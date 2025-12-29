const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { validateProduct, validatePagination } = require('../middleware/validator');
const logger = require('../config/logger');

// Get all products (public for authenticated users)
router.get('/', isAuthenticated, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status || 'ACTIVE';
        const offset = (page - 1) * pageSize;
        
        // Get total count
        const countResult = await query(
            'SELECT COUNT(*) FROM products WHERE status = $1',
            [status]
        );
        const totalCount = parseInt(countResult.rows[0].count);
        
        // Get products
        const result = await query(
            `SELECT * FROM products 
             WHERE status = $1 
             ORDER BY created_at DESC 
             LIMIT $2 OFFSET $3`,
            [status, pageSize, offset]
        );
        
        res.json({
            products: result.rows,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });
    } catch (error) {
        logger.error('Error fetching products', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch products'
        });
    }
});

// Get single product
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM products WHERE id = $1',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error fetching product', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch product'
        });
    }
});

// Create product (admin only)
router.post('/', isAuthenticated, isAdmin, validateProduct, async (req, res) => {
    try {
        const { name, description, category, monthlyPrice, yearlyPrice, status } = req.body;
        
        const result = await query(
            `INSERT INTO products (name, description, category, price_per_month, price_per_year, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING *`,
            [name, description || null, category || null, monthlyPrice, yearlyPrice, status || 'ACTIVE']
        );
        
        logger.info('Product created', { productId: result.rows[0].id, adminId: req.user.id });
        
        res.status(201).json({
            message: 'Product created successfully',
            product: result.rows[0]
        });
    } catch (error) {
        logger.error('Error creating product', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create product'
        });
    }
});

// Update product (admin only)
router.put('/:id', isAuthenticated, isAdmin, validateProduct, async (req, res) => {
    try {
        const { name, description, category, monthlyPrice, yearlyPrice, status } = req.body;
        
        const result = await query(
            `UPDATE products 
             SET name = $1, description = $2, category = $3, price_per_month = $4, 
                 price_per_year = $5, status = $6, updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [name, description || null, category || null, monthlyPrice, yearlyPrice, status || 'ACTIVE', req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }
        
        logger.info('Product updated', { productId: req.params.id, adminId: req.user.id });
        
        res.json({
            message: 'Product updated successfully',
            product: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating product', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update product'
        });
    }
});

// Delete product (admin only)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const result = await query(
            'DELETE FROM products WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Product not found'
            });
        }
        
        logger.info('Product deleted', { productId: req.params.id, adminId: req.user.id });
        
        res.json({
            message: 'Product deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting product', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete product'
        });
    }
});

module.exports = router;


