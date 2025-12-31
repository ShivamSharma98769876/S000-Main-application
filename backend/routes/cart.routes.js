const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const { validateCartItem } = require('../middleware/validator');
const logger = require('../config/logger');
const { addDays, addYears, format } = require('date-fns');

// Helper function to calculate dates and pricing
// If user has existing subscription, new subscription starts from previous end date
async function calculateCartItem(product, durationUnit, durationValue, userId, client) {
    let startDate = new Date();
    let endDate;
    let price;
    
    // Check if user has an existing subscription for this product
    // If yes, new subscription should start from the previous subscription's end date
    if (userId && client) {
        try {
            const subscriptionResult = await client.query(
                `SELECT end_date, status
                 FROM subscriptions 
                 WHERE user_id = $1 AND product_id = $2 
                 ORDER BY end_date DESC 
                 LIMIT 1`,
                [userId, product.id]
            );
            
            if (subscriptionResult.rows.length > 0) {
                const previousEndDate = new Date(subscriptionResult.rows[0].end_date);
                const previousStatus = subscriptionResult.rows[0].status;
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
                const endDateOnly = new Date(previousEndDate);
                endDateOnly.setHours(0, 0, 0, 0);
                
                // Always start from the previous subscription's end date
                // This ensures seamless continuation of subscription
                startDate = previousEndDate;
                
                logger.info('Found existing subscription, continuing from end date', {
                    userId,
                    productId: product.id,
                    previousEndDate: format(previousEndDate, 'yyyy-MM-dd'),
                    previousStatus,
                    newStartDate: format(startDate, 'yyyy-MM-dd')
                });
            } else {
                // No existing subscription, start from today
                logger.info('No existing subscription found, starting from today', {
                    userId,
                    productId: product.id
                });
            }
        } catch (error) {
            logger.warn('Error checking existing subscription, using current date', {
                error: error.message,
                userId,
                productId: product.id
            });
            // If there's an error checking subscription, default to current date
            startDate = new Date();
        }
    }
    
    // Calculate end date based on start date
    if (durationUnit === 'MONTH') {
        endDate = addDays(startDate, durationValue * 30);
        price = parseFloat(product.price_per_month);
    } else { // YEAR
        endDate = addYears(startDate, durationValue);
        price = parseFloat(product.price_per_year);
    }
    
    const totalPrice = price * durationValue;
    
    return {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        price: totalPrice
    };
}

// Get user's cart
router.get('/', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        // Get or create cart
        let cartResult = await query(
            'SELECT id FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        
        if (cartResult.rows.length === 0) {
            cartResult = await query(
                'INSERT INTO carts (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id',
                [req.user.id]
            );
        }
        
        const cartId = cartResult.rows[0].id;
        
        // Get cart items with product details
        const itemsResult = await query(
            `SELECT ci.*, p.name as product_name, p.description, p.category, p.status
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             WHERE ci.cart_id = $1
             ORDER BY ci.created_at DESC`,
            [cartId]
        );
        
        // Calculate totals
        const subtotal = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.price), 0);
        const discount = 0; // TODO: Implement discount logic
        const total = subtotal - discount;
        
        res.json({
            cartId,
            items: itemsResult.rows,
            summary: {
                subtotal,
                discount,
                total
            }
        });
    } catch (error) {
        logger.error('Error fetching cart', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch cart'
        });
    }
});

// Add item to cart
router.post('/items', isAuthenticated, isProfileComplete, validateCartItem, async (req, res) => {
    try {
        const { productId, duration_unit, duration_value } = req.body;
        const durationUnit = duration_unit || req.body.durationType || 'MONTH';
        const durationValue = duration_value || req.body.durationUnits || 1;
        
        // Get product first (outside transaction)
        const productResult = await query(
            'SELECT * FROM products WHERE id = $1 AND status = $2',
            [productId, 'ACTIVE']
        );
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found or inactive' });
        }
        
        const product = productResult.rows[0];
        
        // Calculate dates and pricing (check for existing subscription) - outside transaction
        // We need to pass a query function that can be used inside calculateCartItem
        const { startDate, endDate, price } = await calculateCartItem(
            product, 
            durationUnit, 
            durationValue, 
            req.user.id, 
            { query: (text, params) => query(text, params) }
        );
        
        // Calculate unit_price (price per unit - month or year)
        const unitPrice = durationUnit === 'MONTH' 
            ? parseFloat(product.price_per_month) 
            : parseFloat(product.price_per_year);
        
        // subtotal is the same as price (total price)
        const subtotal = price;
        
        // Get or create cart (outside transaction for simplicity, or we can do it inside)
        let cartResult = await query(
            'SELECT id FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        
        if (cartResult.rows.length === 0) {
            cartResult = await query(
                'INSERT INTO carts (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id',
                [req.user.id]
            );
        }
        
        const cartId = cartResult.rows[0].id;
        
        // Check if product already in cart
        const existingItem = await query(
            'SELECT id FROM cart_items WHERE cart_id = $1 AND product_id = $2',
            [cartId, productId]
        );
        
        let item;
            if (existingItem.rows.length > 0) {
                // Update existing item
                const result = await query(
                    `UPDATE cart_items 
                     SET duration_unit = $1, duration_value = $2, duration_type = $3, duration_units = $4,
                         start_date = $5, end_date = $6, price = $7, unit_price = $8, subtotal = $9, updated_at = NOW()
                     WHERE id = $10
                     RETURNING *`,
                    [durationUnit, durationValue, durationUnit, durationValue, startDate, endDate, price, unitPrice, subtotal, existingItem.rows[0].id]
                );
            
            item = result.rows[0];
        } else {
            // Insert new item
            const result = await query(
                `INSERT INTO cart_items (cart_id, product_id, duration_unit, duration_value, 
                                        duration_type, duration_units, start_date, end_date, price, unit_price, subtotal, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                 RETURNING *`,
                [cartId, productId, durationUnit, durationValue, durationUnit, durationValue, startDate, endDate, price, unitPrice, subtotal]
            );
            
            item = result.rows[0];
        }
        
        if (item) {
            logger.info('Item added to cart', { userId: req.user.id, productId, item: item.id });
            
            res.status(201).json({
                message: 'Item added to cart successfully',
                item
            });
        } else {
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to add item to cart'
            });
        }
    } catch (error) {
        logger.error('Error adding item to cart', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message || 'Failed to add item to cart'
        });
    }
});

// Update cart item
router.put('/items/:itemId', isAuthenticated, isProfileComplete, validateCartItem, async (req, res) => {
    try {
        const { duration_unit, duration_value } = req.body;
        const durationUnit = duration_unit || req.body.durationType || 'MONTH';
        const durationValue = duration_value || req.body.durationUnits || 1;
        const { itemId } = req.params;
        
        // Get cart item with product (outside transaction)
        const itemResult = await query(
            `SELECT ci.*, c.user_id, p.*
             FROM cart_items ci
             JOIN carts c ON c.id = ci.cart_id
             JOIN products p ON p.id = ci.product_id
             WHERE ci.id = $1`,
            [itemId]
        );
        
        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Cart item not found'
            });
        }
        
        const item = itemResult.rows[0];
        
        // Verify ownership
        if (item.user_id !== req.user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Unauthorized to update this item'
            });
        }
        
        // Calculate new dates and pricing (check for existing subscription) - outside transaction
        const { startDate, endDate, price } = await calculateCartItem(
            item, 
            durationUnit, 
            durationValue, 
            req.user.id, 
            { query: (text, params) => query(text, params) }
        );
        
        // Calculate unit_price (price per unit - month or year)
        const unitPrice = durationUnit === 'MONTH' 
            ? parseFloat(item.price_per_month) 
            : parseFloat(item.price_per_year);
        
        // subtotal is the same as price (total price)
        const subtotal = price;
        
        // Update item
        const result = await query(
            `UPDATE cart_items 
             SET duration_unit = $1, duration_value = $2, duration_type = $3, duration_units = $4,
                 start_date = $5, end_date = $6, price = $7, unit_price = $8, subtotal = $9, updated_at = NOW()
             WHERE id = $10
             RETURNING *`,
            [durationUnit, durationValue, durationUnit, durationValue, startDate, endDate, price, unitPrice, subtotal, itemId]
        );
        
        const updatedItem = result.rows[0];
        
        if (updatedItem) {
            logger.info('Cart item updated', { userId: req.user.id, itemId });
            
            res.json({
                message: 'Cart item updated successfully',
                item: updatedItem
            });
        } else {
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to update cart item'
            });
        }
    } catch (error) {
        logger.error('Error updating cart item', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message || 'Failed to update cart item'
        });
    }
});

// Remove cart item
router.delete('/items/:itemId', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const { itemId } = req.params;
        
        // Verify ownership
        const itemResult = await query(
            `SELECT ci.id, c.user_id
             FROM cart_items ci
             JOIN carts c ON c.id = ci.cart_id
             WHERE ci.id = $1`,
            [itemId]
        );
        
        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Cart item not found'
            });
        }
        
        if (itemResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Unauthorized to delete this item'
            });
        }
        
        await query('DELETE FROM cart_items WHERE id = $1', [itemId]);
        
        logger.info('Cart item removed', { userId: req.user.id, itemId });
        
        res.json({
            message: 'Cart item removed successfully'
        });
    } catch (error) {
        logger.error('Error removing cart item', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to remove cart item'
        });
    }
});

// Empty cart
router.delete('/', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const cartResult = await query(
            'SELECT id FROM carts WHERE user_id = $1',
            [req.user.id]
        );
        
        if (cartResult.rows.length === 0) {
            return res.json({
                message: 'Cart is already empty'
            });
        }
        
        await query('DELETE FROM cart_items WHERE cart_id = $1', [cartResult.rows[0].id]);
        
        logger.info('Cart emptied', { userId: req.user.id });
        
        res.json({
            message: 'Cart emptied successfully'
        });
    } catch (error) {
        logger.error('Error emptying cart', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to empty cart'
        });
    }
});

module.exports = router;


