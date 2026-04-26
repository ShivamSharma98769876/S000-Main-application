const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const { validateCartItem } = require('../middleware/validator');
const logger = require('../config/logger');
const { addDays, addWeeks, addYears, format } = require('date-fns');

// Default weekly price (used as fallback when product.price_per_week is missing).
const DEFAULT_WEEKLY_PRICE = 100;

/**
 * Check whether the current user has already used the Weekly plan for the
 * given product. The rule (per product spec):
 *   Block if the same email OR the same Zerodha/Kite Client ID has
 *   previously redeemed Weekly for THIS product.
 *
 * Looks at both completed subscription_orders (any status) and current
 * cart_items containing a WEEK row for the product.
 *
 * Returns { allowed: boolean, reason?: string }.
 */
async function checkWeeklyEligibility(userId, productId, runner) {
    const q = runner && runner.query ? (text, params) => runner.query(text, params) : query;

    // Resolve current user's email + zerodha_client_id
    const userRow = await q(
        `SELECT u.email, up.zerodha_client_id
         FROM users u
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id = $1`,
        [userId]
    );
    if (userRow.rows.length === 0) {
        return { allowed: true };
    }
    const { email, zerodha_client_id: zerodhaId } = userRow.rows[0];

    // Look for any prior WEEK order item for this product where the buyer
    // shares email OR zerodha_client_id with the current user.
    const prior = await q(
        `SELECT 1
         FROM subscription_order_items soi
         JOIN subscription_orders so ON so.id = soi.order_id
         JOIN users u2 ON u2.id = so.user_id
         LEFT JOIN user_profiles up2 ON up2.user_id = u2.id
         WHERE soi.product_id = $1
           AND soi.duration_unit = 'WEEK'
           AND (
             LOWER(u2.email) = LOWER($2::text)
             OR ($3::text IS NOT NULL AND up2.zerodha_client_id IS NOT NULL
                 AND up2.zerodha_client_id = $3::text)
           )
         LIMIT 1`,
        [productId, email || '', zerodhaId || null]
    );

    if (prior.rows.length > 0) {
        return {
            allowed: false,
            reason: 'You are already availed this Offer once. Please Subscribe Monthly or Yearly plan'
        };
    }

    return { allowed: true };
}

// Helper function to calculate dates and pricing
// If user has existing subscription, new subscription starts from previous end date
// (Weekly plan is always a fresh "trial" so it ignores existing subscriptions.)
async function calculateCartItem(product, durationUnit, durationValue, userId, client) {
    let startDate = new Date();
    let endDate;
    let price;
    
    // Check if user has an existing subscription for this product
    // If yes, new subscription should start from the previous subscription's end date
    // Weekly plan is exempt: it always starts today (one-time trial offer).
    if (durationUnit !== 'WEEK' && userId && client) {
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

                // If the existing subscription is still active in the future,
                // chain the new subscription to start when it ends.
                // Otherwise (already expired) start fresh from today.
                if (endDateOnly > today) {
                    startDate = previousEndDate;
                    logger.info('Existing subscription still active, chaining from end date', {
                        userId,
                        productId: product.id,
                        previousEndDate: format(previousEndDate, 'yyyy-MM-dd'),
                        previousStatus,
                        newStartDate: format(startDate, 'yyyy-MM-dd')
                    });
                } else {
                    startDate = new Date();
                    logger.info('Previous subscription already expired, starting from today', {
                        userId,
                        productId: product.id,
                        previousEndDate: format(previousEndDate, 'yyyy-MM-dd'),
                        previousStatus,
                        newStartDate: format(startDate, 'yyyy-MM-dd')
                    });
                }
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
    if (durationUnit === 'WEEK') {
        // Weekly plan: strictly 1 week trial that runs for 7 business days
        // (skips Saturdays and Sundays). Starts from today.
        startDate = new Date();
        endDate = new Date(startDate);
        let added = 0;
        while (added < 7) {
            endDate.setDate(endDate.getDate() + 1);
            const dow = endDate.getDay(); // 0 = Sunday, 6 = Saturday
            if (dow !== 0 && dow !== 6) {
                added += 1;
            }
        }
        const weekly = product.price_per_week !== undefined && product.price_per_week !== null
            ? parseFloat(product.price_per_week)
            : DEFAULT_WEEKLY_PRICE;
        price = isNaN(weekly) ? DEFAULT_WEEKLY_PRICE : weekly;
    } else if (durationUnit === 'MONTH') {
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

        // Weekly plan eligibility: only one redemption per (email | zerodha_id)
        // per product across the whole platform.
        if (durationUnit === 'WEEK') {
            const eligibility = await checkWeeklyEligibility(req.user.id, product.id);
            if (!eligibility.allowed) {
                return res.status(409).json({
                    error: 'Weekly Plan Already Used',
                    message: eligibility.reason
                });
            }
        }
        
        // Calculate dates and pricing (check for existing subscription) - outside transaction
        // We need to pass a query function that can be used inside calculateCartItem
        const { startDate, endDate, price } = await calculateCartItem(
            product, 
            durationUnit, 
            durationValue, 
            req.user.id, 
            { query: (text, params) => query(text, params) }
        );
        
        // Calculate unit_price (price per unit - week, month or year)
        let unitPrice;
        if (durationUnit === 'WEEK') {
            unitPrice = product.price_per_week !== undefined && product.price_per_week !== null
                ? parseFloat(product.price_per_week)
                : DEFAULT_WEEKLY_PRICE;
        } else if (durationUnit === 'MONTH') {
            unitPrice = parseFloat(product.price_per_month);
        } else {
            unitPrice = parseFloat(product.price_per_year);
        }
        
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
                     SET duration_unit = $1, duration_value = $2,
                         start_date = $3, end_date = $4, price = $5, unit_price = $6, subtotal = $7, updated_at = NOW()
                     WHERE id = $8
                     RETURNING *`,
                    [durationUnit, durationValue, startDate, endDate, price, unitPrice, subtotal, existingItem.rows[0].id]
                );
            
            item = result.rows[0];
        } else {
            // Insert new item
            const result = await query(
                `INSERT INTO cart_items (cart_id, product_id, duration_unit, duration_value, 
                                        start_date, end_date, price, unit_price, subtotal, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                 RETURNING *`,
                [cartId, productId, durationUnit, durationValue, startDate, endDate, price, unitPrice, subtotal]
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

        // If switching to Weekly, re-check eligibility
        if (durationUnit === 'WEEK') {
            const eligibility = await checkWeeklyEligibility(req.user.id, item.product_id);
            if (!eligibility.allowed) {
                return res.status(409).json({
                    error: 'Weekly Plan Already Used',
                    message: eligibility.reason
                });
            }
        }
        
        // Calculate new dates and pricing (check for existing subscription) - outside transaction
        const { startDate, endDate, price } = await calculateCartItem(
            item, 
            durationUnit, 
            durationValue, 
            req.user.id, 
            { query: (text, params) => query(text, params) }
        );
        
        // Calculate unit_price (price per unit - week, month or year)
        let unitPrice;
        if (durationUnit === 'WEEK') {
            unitPrice = item.price_per_week !== undefined && item.price_per_week !== null
                ? parseFloat(item.price_per_week)
                : DEFAULT_WEEKLY_PRICE;
        } else if (durationUnit === 'MONTH') {
            unitPrice = parseFloat(item.price_per_month);
        } else {
            unitPrice = parseFloat(item.price_per_year);
        }
        
        // subtotal is the same as price (total price)
        const subtotal = price;
        
        // Update item
        const result = await query(
            `UPDATE cart_items 
             SET duration_unit = $1, duration_value = $2,
                 start_date = $3, end_date = $4, price = $5, unit_price = $6, subtotal = $7, updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [durationUnit, durationValue, startDate, endDate, price, unitPrice, subtotal, itemId]
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


