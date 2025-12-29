const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const logger = require('../config/logger');
const { invalidateCache } = require('../middleware/cache');

// Bulk approve orders
router.post('/orders/approve', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { orderIds } = req.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'orderIds must be a non-empty array'
            });
        }

        // Validate all order IDs are numbers
        if (!orderIds.every(id => Number.isInteger(id))) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'All order IDs must be integers'
            });
        }

        // Update orders
        const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
        const updateQuery = `
            UPDATE orders 
            SET status = 'APPROVED', updated_at = NOW()
            WHERE id IN (${placeholders}) AND status = 'PENDING'
            RETURNING id, user_id, product_id, duration_value, duration_unit
        `;

        const result = await query(updateQuery, orderIds);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'No pending orders found with the provided IDs'
            });
        }

        // Create subscriptions for approved orders
        for (const order of result.rows) {
            const durationInDays = order.duration_unit === 'YEAR' 
                ? order.duration_value * 365 
                : order.duration_value * 30;

            await query(
                `INSERT INTO subscriptions (user_id, product_id, order_id, start_date, end_date, status, created_at, updated_at)
                 VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${durationInDays} days', 'ACTIVE', NOW(), NOW())`,
                [order.user_id, order.product_id, order.id]
            );
        }

        // Invalidate cache
        invalidateCache('/orders');
        invalidateCache('/subscriptions');

        logger.info(`Bulk approved ${result.rows.length} orders`, {
            adminId: req.user.id,
            orderIds: result.rows.map(o => o.id)
        });

        res.json({
            message: `Successfully approved ${result.rows.length} orders`,
            approvedOrders: result.rows.map(o => o.id),
            total: result.rows.length
        });
    } catch (error) {
        logger.error('Error bulk approving orders', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to approve orders'
        });
    }
});

// Bulk reject orders
router.post('/orders/reject', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { orderIds, reason } = req.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'orderIds must be a non-empty array'
            });
        }

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Rejection reason is required'
            });
        }

        const placeholders = orderIds.map((_, i) => `$${i + 2}`).join(',');
        const updateQuery = `
            UPDATE orders 
            SET status = 'REJECTED', rejection_reason = $1, updated_at = NOW()
            WHERE id IN (${placeholders}) AND status = 'PENDING'
            RETURNING id
        `;

        const result = await query(updateQuery, [reason, ...orderIds]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'No pending orders found with the provided IDs'
            });
        }

        // Invalidate cache
        invalidateCache('/orders');

        logger.info(`Bulk rejected ${result.rows.length} orders`, {
            adminId: req.user.id,
            orderIds: result.rows.map(o => o.id),
            reason
        });

        res.json({
            message: `Successfully rejected ${result.rows.length} orders`,
            rejectedOrders: result.rows.map(o => o.id),
            total: result.rows.length
        });
    } catch (error) {
        logger.error('Error bulk rejecting orders', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to reject orders'
        });
    }
});

// Bulk update product status
router.post('/products/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { productIds, status } = req.body;

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'productIds must be a non-empty array'
            });
        }

        if (!['ACTIVE', 'INACTIVE'].includes(status)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Status must be ACTIVE or INACTIVE'
            });
        }

        const placeholders = productIds.map((_, i) => `$${i + 2}`).join(',');
        const updateQuery = `
            UPDATE products 
            SET status = $1, updated_at = NOW()
            WHERE id IN (${placeholders})
            RETURNING id, name, status
        `;

        const result = await query(updateQuery, [status, ...productIds]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'No products found with the provided IDs'
            });
        }

        // Invalidate cache
        invalidateCache('/products');

        logger.info(`Bulk updated ${result.rows.length} products to ${status}`, {
            adminId: req.user.id,
            productIds: result.rows.map(p => p.id)
        });

        res.json({
            message: `Successfully updated ${result.rows.length} products`,
            products: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        logger.error('Error bulk updating products', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update products'
        });
    }
});

// Bulk delete products
router.post('/products/delete', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { productIds } = req.body;

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'productIds must be a non-empty array'
            });
        }

        // Check if any products have active subscriptions
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
        const checkQuery = `
            SELECT DISTINCT product_id 
            FROM subscriptions 
            WHERE product_id IN (${placeholders}) AND status = 'ACTIVE'
        `;

        const activeCheck = await query(checkQuery, productIds);

        if (activeCheck.rows.length > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot delete products with active subscriptions',
                productsWithSubscriptions: activeCheck.rows.map(r => r.product_id)
            });
        }

        // Delete products
        const deleteQuery = `
            DELETE FROM products 
            WHERE id IN (${placeholders})
            RETURNING id, name
        `;

        const result = await query(deleteQuery, productIds);

        // Invalidate cache
        invalidateCache('/products');

        logger.info(`Bulk deleted ${result.rows.length} products`, {
            adminId: req.user.id,
            productIds: result.rows.map(p => p.id)
        });

        res.json({
            message: `Successfully deleted ${result.rows.length} products`,
            deletedProducts: result.rows,
            total: result.rows.length
        });
    } catch (error) {
        logger.error('Error bulk deleting products', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete products'
        });
    }
});

module.exports = router;



