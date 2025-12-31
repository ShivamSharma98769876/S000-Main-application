const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const { validateOrder } = require('../middleware/validator');
const logger = require('../config/logger');
const emailQueue = require('../services/emailQueue.service');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed'));
    }
});

// Create order from cart
router.post('/', isAuthenticated, isProfileComplete, validateOrder, async (req, res) => {
    try {
        const { paymentReference, paymentDate } = req.body;
        
        // Get cart
        const cartResult = await query(
            'SELECT id FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        
        if (cartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cart not found' });
        }
        
        const cartId = cartResult.rows[0].id;
        
        // Get cart items
        const itemsResult = await query(
            `SELECT ci.*, p.status
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             WHERE ci.cart_id = $1`,
            [cartId]
        );
        
        if (itemsResult.rows.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        
        // Validate all products are active
        const inactiveProducts = itemsResult.rows.filter(item => item.status !== 'ACTIVE');
        if (inactiveProducts.length > 0) {
            return res.status(400).json({ error: 'Cart contains inactive products' });
        }
        
        // Calculate total
        const totalAmount = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.price), 0);
        
        // Create order
        const orderResult = await query(
            `INSERT INTO subscription_orders (user_id, status, total_amount, payment_reference, payment_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING *`,
            [req.user.id, 'PENDING', totalAmount, paymentReference || null, paymentDate || null]
        );
        
        const order = orderResult.rows[0];
        
        // Copy cart items to order items
        for (const item of itemsResult.rows) {
            const unitPrice = parseFloat(item.price) / item.duration_value;
            const subtotal = parseFloat(item.price);
            
            await query(
                `INSERT INTO subscription_order_items (order_id, product_id, duration_unit, duration_value, 
                                                      start_date, end_date, unit_price, subtotal)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [order.id, item.product_id, item.duration_unit, item.duration_value, 
                 item.start_date, item.end_date, unitPrice, subtotal]
            );
        }
        
        // Clear cart
        await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
        
        logger.info('Order created', { userId: req.user.id, orderId: order.id });
        
        // TODO: Send email notifications
        
        res.status(201).json({
            message: 'Order created successfully',
            order: {
                orderId: order.id,
                status: order.status,
                totalAmount: order.total_amount
            }
        });
    } catch (error) {
        logger.error('Error creating order', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message || 'Failed to create order'
        });
    }
});

// Upload payment proof
router.post('/:orderId/payment-proof', isAuthenticated, isProfileComplete, upload.single('paymentProof'), async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentReference, paymentDate } = req.body;
        
        if (!req.file) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Payment proof file is required'
            });
        }
        
        // Verify order ownership
        const orderResult = await query(
            'SELECT id, user_id, status FROM subscription_orders WHERE id = $1',
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Order not found'
            });
        }
        
        if (orderResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Unauthorized to update this order'
            });
        }
        
        if (orderResult.rows[0].status !== 'PENDING') {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Payment proof can only be uploaded for pending orders'
            });
        }
        
        // Update order with payment proof
        const paymentProofUrl = `/uploads/${req.file.filename}`;
        
        await query(
            `UPDATE subscription_orders 
             SET payment_proof_url = $1, payment_reference = $2, payment_date = $3, updated_at = NOW()
             WHERE id = $4`,
            [paymentProofUrl, paymentReference || null, paymentDate || null, orderId]
        );
        
        logger.info('Payment proof uploaded', { userId: req.user.id, orderId });
        
        // Get user and order details for email
        const userResult = await query(
            `SELECT u.email, up.full_name
             FROM users u
             LEFT JOIN user_profiles up ON up.user_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );
        
        const orderDetailsResult = await query(
            `SELECT so.total_amount, COUNT(soi.id) as item_count
             FROM subscription_orders so
             LEFT JOIN subscription_order_items soi ON soi.order_id = so.id
             WHERE so.id = $1
             GROUP BY so.id, so.total_amount`,
            [orderId]
        );
        
        if (userResult.rows.length > 0 && orderDetailsResult.rows.length > 0) {
            const user = userResult.rows[0];
            const orderDetails = orderDetailsResult.rows[0];
            
            // Add emails to queue (don't block response)
            Promise.all([
                emailQueue.addToQueue('PAYMENT_RECEIVED', user.email, {
                    userName: user.full_name,
                    orderId: orderId,
                    amount: orderDetails.total_amount
                }, 'HIGH'),
                emailQueue.addToQueue('ADMIN_NEW_ORDER', process.env.ADMIN_EMAIL || 'admin@tradingpro.com', {
                    orderId: orderId,
                    userName: user.full_name,
                    userEmail: user.email,
                    amount: orderDetails.total_amount,
                    itemCount: orderDetails.item_count
                }, 'HIGH')
            ]).catch(err => logger.error('Failed to queue emails', err));
        }
        
        res.json({
            message: 'Payment proof uploaded successfully',
            paymentProofUrl
        });
    } catch (error) {
        logger.error('Error uploading payment proof', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to upload payment proof'
        });
    }
});

// Get user's orders
router.get('/me', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM subscription_orders 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        
        res.json({
            orders: result.rows
        });
    } catch (error) {
        logger.error('Error fetching orders', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch orders'
        });
    }
});

// Get specific order details
router.get('/me/:orderId', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Get order
        const orderResult = await query(
            'SELECT * FROM subscription_orders WHERE id = $1 AND user_id = $2',
            [orderId, req.user.id]
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

module.exports = router;


