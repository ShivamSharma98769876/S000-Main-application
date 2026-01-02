const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validator');
const logger = require('../config/logger');
const emailQueue = require('../services/emailQueue.service');

// Get pending orders
router.get('/orders', isAuthenticated, isAdmin, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const status = req.query.status || 'PENDING';
        const offset = (page - 1) * pageSize;
        
        // Get total count
        const countResult = await query(
            'SELECT COUNT(*) FROM subscription_orders WHERE status = $1',
            [status]
        );
        const totalCount = parseInt(countResult.rows[0].count);
        
        // Get orders with user details
        const result = await query(
            `SELECT so.*, u.email, up.full_name, up.phone,
                    (SELECT COUNT(*) FROM subscription_order_items WHERE order_id = so.id) as item_count
             FROM subscription_orders so
             JOIN users u ON u.id = so.user_id
             LEFT JOIN user_profiles up ON up.user_id = so.user_id
             WHERE so.status = $1
             ORDER BY so.created_at DESC
             LIMIT $2 OFFSET $3`,
            [status, pageSize, offset]
        );
        
        res.json({
            orders: result.rows,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });
    } catch (error) {
        logger.error('Error fetching admin orders', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch orders'
        });
    }
});

// Get order details
router.get('/orders/:orderId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Get order with user details
        const orderResult = await query(
            `SELECT so.*, 
                    u.email, u.provider_type,
                    up.full_name, up.phone, up.address, up.capital_used, 
                    up.referral_code, up.zerodha_client_id, up.profile_completed
             FROM subscription_orders so
             JOIN users u ON u.id = so.user_id
             LEFT JOIN user_profiles up ON up.user_id = so.user_id
             WHERE so.id = $1`,
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Order not found'
            });
        }
        
        // Get order items
        const itemsResult = await query(
            `SELECT soi.*, p.name as product_name, p.description, p.category
             FROM subscription_order_items soi
             JOIN products p ON p.id = soi.product_id
             WHERE soi.order_id = $1`,
            [orderId]
        );
        
        res.json({
            order: orderResult.rows[0],
            items: itemsResult.rows
        });
    } catch (error) {
        logger.error('Error fetching order details', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch order details'
        });
    }
});

// Approve order
router.post('/orders/:orderId/approve', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Get order
        const orderResult = await query(
            'SELECT * FROM subscription_orders WHERE id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orderResult.rows[0];
        
        if (order.status !== 'PENDING') {
            return res.status(400).json({ error: 'Only pending orders can be approved' });
        }
        
        // Get order items
        const itemsResult = await query(
            'SELECT * FROM subscription_order_items WHERE order_id = $1',
            [orderId]
        );
        
        // Create subscriptions for each item
        for (const item of itemsResult.rows) {
            // Determine subscription status based on dates
            // When order is approved, set to ACTIVE immediately (unless already expired)
            const endDate = new Date(item.end_date);
            const now = new Date();
            
            let status;
            if (now > endDate) {
                status = 'EXPIRED';
            } else {
                // Set to ACTIVE when approved, regardless of start_date
                // This allows customers to use the subscription immediately after approval
                status = 'ACTIVE';
            }
            
            await query(
                `INSERT INTO subscriptions (user_id, product_id, start_date, end_date, status, order_id, auto_renew, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())`,
                [order.user_id, item.product_id, item.start_date, item.end_date, status, orderId]
            );
        }
        
        // Update order status
        await query(
            'UPDATE subscription_orders SET status = $1, updated_at = NOW() WHERE id = $2',
            ['APPROVED', orderId]
        );
        
        logger.info('Order approved', { orderId, adminId: req.user.id });
        
        // Get user details and subscriptions for email
        const userResult = await query(
            `SELECT u.email, up.full_name
             FROM subscription_orders so
             JOIN users u ON u.id = so.user_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE so.id = $1`,
            [orderId]
        );
        
        const subscriptionsResult = await query(
            `SELECT s.*, p.name as product_name
             FROM subscriptions s
             JOIN products p ON p.id = s.product_id
             WHERE s.order_id = $1`,
            [orderId]
        );
        
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const subscriptions = subscriptionsResult.rows.map(sub => ({
                productName: sub.product_name,
                startDate: new Date(sub.start_date).toLocaleDateString('en-IN'),
                endDate: new Date(sub.end_date).toLocaleDateString('en-IN')
            }));
            
            // Add approval email to queue (don't block response)
            emailQueue.addToQueue('ORDER_APPROVED', user.email, {
                userName: user.full_name,
                orderId: orderId,
                subscriptions: subscriptions
            }, 'HIGH').catch(err => logger.error('Failed to queue approval email', err));
        }
        
        res.json({
            message: 'Order approved successfully'
        });
    } catch (error) {
        logger.error('Error approving order', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message || 'Failed to approve order'
        });
    }
});

// Reject order
router.post('/orders/:orderId/reject', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        
        // Get order
        const orderResult = await query(
            'SELECT * FROM subscription_orders WHERE id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Order not found'
            });
        }
        
        const order = orderResult.rows[0];
        
        if (order.status !== 'PENDING') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Only pending orders can be rejected'
            });
        }
        
        // Update order status
        await query(
            'UPDATE subscription_orders SET status = $1, rejection_reason = $2, updated_at = NOW() WHERE id = $3',
            ['REJECTED', reason || null, orderId]
        );
        
        logger.info('Order rejected', { orderId, adminId: req.user.id, reason });
        
        // Get user details for email
        const userResult = await query(
            `SELECT u.email, up.full_name
             FROM subscription_orders so
             JOIN users u ON u.id = so.user_id
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE so.id = $1`,
            [orderId]
        );
        
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            
            // Add rejection email to queue (don't block response)
            emailQueue.addToQueue('ORDER_REJECTED', user.email, {
                userName: user.full_name,
                orderId: orderId,
                reason: reason
            }, 'HIGH').catch(err => logger.error('Failed to queue rejection email', err));
        }
        
        res.json({
            message: 'Order rejected successfully'
        });
    } catch (error) {
        logger.error('Error rejecting order', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to reject order'
        });
    }
});

// Get login audit logs
router.get('/login-audit', isAuthenticated, isAdmin, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const userId = req.query.userId;
        const offset = (page - 1) * pageSize;
        
        let queryText = `
            SELECT la.*, u.email, up.full_name
            FROM login_audit la
            LEFT JOIN users u ON u.id = la.user_id
            LEFT JOIN user_profiles up ON up.user_id = la.user_id
        `;
        let queryParams = [];
        
        if (userId) {
            queryText += ' WHERE la.user_id = $1';
            queryParams.push(userId);
        }
        
        queryText += ' ORDER BY la.created_at DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
        queryParams.push(pageSize, offset);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM login_audit';
        let countParams = [];
        if (userId) {
            countQuery += ' WHERE user_id = $1';
            countParams.push(userId);
        }
        
        const countResult = await query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);
        
        // Get logs
        const result = await query(queryText, queryParams);
        
        res.json({
            logs: result.rows,
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });
    } catch (error) {
        logger.error('Error fetching login audit logs', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch audit logs'
        });
    }
});

// Email Queue Management
router.get('/email-queue/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const stats = await emailQueue.getStats();
        res.json({ stats });
    } catch (error) {
        logger.error('Error fetching email queue stats', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch email queue statistics'
        });
    }
});

router.post('/email-queue/retry-failed', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const count = await emailQueue.retryFailed();
        res.json({
            message: `${count} failed emails reset for retry`,
            count
        });
    } catch (error) {
        logger.error('Error retrying failed emails', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to retry failed emails'
        });
    }
});

router.post('/email-queue/cleanup', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const daysToKeep = parseInt(req.body.daysToKeep) || 30;
        const count = await emailQueue.cleanup(daysToKeep);
        res.json({
            message: `Cleaned up ${count} old emails`,
            count
        });
    } catch (error) {
        logger.error('Error cleaning up email queue', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to cleanup email queue'
        });
    }
});

// Get cross-app access audit logs
router.get('/audit/cross-app', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, userId } = req.query;

        let queryText = `
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
        let paramCount = 1;

        if (startDate) {
            params.push(startDate);
            queryText += ` AND aaa.created_at >= $${paramCount}`;
            paramCount++;
        }

        if (endDate) {
            params.push(endDate);
            queryText += ` AND aaa.created_at <= $${paramCount}`;
            paramCount++;
        }

        if (userId) {
            params.push(userId);
            queryText += ` AND aaa.user_id = $${paramCount}`;
            paramCount++;
        }

        queryText += ` ORDER BY aaa.created_at DESC LIMIT 1000`;

        const result = await query(queryText, params);

        res.json({
            success: true,
            audit: result.rows
        });

    } catch (error) {
        logger.error('Failed to fetch cross-app audit', error);
        res.status(500).json({ 
            error: 'Failed to fetch audit logs',
            message: error.message 
        });
    }
});

module.exports = router;


