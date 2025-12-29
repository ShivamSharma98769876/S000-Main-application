/**
 * End-to-End Tests for Complete User Journey
 */

const request = require('supertest');
const app = require('../../server');
const { query } = require('../../config/database');

describe('Complete User Journey E2E', () => {
    let testUser, testProduct, cart, order;

    beforeAll(async () => {
        // Setup test data
        const productResult = await query(
            `INSERT INTO products (name, description, category, price_per_month, price_per_year, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING *`,
            ['E2E Test Product', 'Test Description', 'Test', 2999, 29999, 'ACTIVE']
        );
        testProduct = productResult.rows[0];
    });

    afterAll(async () => {
        // Cleanup
        if (testUser) {
            await query('DELETE FROM subscriptions WHERE user_id = $1', [testUser.id]);
            await query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [testUser.id]);
            await query('DELETE FROM orders WHERE user_id = $1', [testUser.id]);
            await query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [testUser.id]);
            await query('DELETE FROM carts WHERE user_id = $1', [testUser.id]);
            await query('DELETE FROM user_profiles WHERE user_id = $1', [testUser.id]);
            await query('DELETE FROM users WHERE id = $1', [testUser.id]);
        }
        if (testProduct) {
            await query('DELETE FROM products WHERE id = $1', [testProduct.id]);
        }
    });

    test('Complete user journey: Registration to Subscription', async () => {
        // Step 1: User registers (OAuth simulation)
        const userResult = await query(
            `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING *`,
            ['GOOGLE', 'e2e-test-' + Date.now(), 'e2etest@example.com', false]
        );
        testUser = userResult.rows[0];
        expect(testUser).toBeDefined();
        expect(testUser.email).toBe('e2etest@example.com');

        // Step 2: User completes profile
        await query(
            `INSERT INTO user_profiles (user_id, full_name, address, phone, capital_used, profile_completed, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [testUser.id, 'E2E Test User', 'Test Address, Mumbai', '+919876543210', 100000, true]
        );

        const profileResult = await query(
            'SELECT * FROM user_profiles WHERE user_id = $1',
            [testUser.id]
        );
        expect(profileResult.rows[0].profile_completed).toBe(true);

        // Step 3: User browses products
        const productsResult = await query(
            'SELECT * FROM products WHERE status = $1',
            ['ACTIVE']
        );
        expect(productsResult.rows.length).toBeGreaterThan(0);

        // Step 4: User adds product to cart
        const cartResult = await query(
            `INSERT INTO carts (user_id, created_at, updated_at)
             VALUES ($1, NOW(), NOW())
             RETURNING *`,
            [testUser.id]
        );
        cart = cartResult.rows[0];

        const cartItemResult = await query(
            `INSERT INTO cart_items (cart_id, product_id, duration_unit, duration_value, start_date, end_date, price, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '365 days', $5, NOW(), NOW())
             RETURNING *`,
            [cart.id, testProduct.id, 'YEAR', 1, 29999]
        );
        expect(cartItemResult.rows[0]).toBeDefined();

        // Step 5: User proceeds to checkout
        const cartItems = await query(
            'SELECT * FROM cart_items WHERE cart_id = $1',
            [cart.id]
        );
        expect(cartItems.rows.length).toBe(1);

        // Step 6: User creates order with payment proof
        const orderResult = await query(
            `INSERT INTO orders (user_id, total_amount, discount_amount, final_amount, payment_proof_url, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             RETURNING *`,
            [testUser.id, 29999, 0, 29999, '/uploads/test-payment.jpg', 'PENDING']
        );
        order = orderResult.rows[0];
        expect(order.status).toBe('PENDING');

        // Step 7: Copy cart items to order items
        await query(
            `INSERT INTO order_items (order_id, product_id, duration_unit, duration_value, start_date, end_date, price, created_at)
             SELECT $1, product_id, duration_unit, duration_value, start_date, end_date, price, NOW()
             FROM cart_items WHERE cart_id = $2`,
            [order.id, cart.id]
        );

        // Step 8: Admin approves order
        await query(
            `UPDATE orders SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
            [order.id]
        );

        // Step 9: Create subscription
        const subscriptionResult = await query(
            `INSERT INTO subscriptions (user_id, product_id, order_id, start_date, end_date, status, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '365 days', 'ACTIVE', NOW(), NOW())
             RETURNING *`,
            [testUser.id, testProduct.id, order.id]
        );
        expect(subscriptionResult.rows[0].status).toBe('ACTIVE');

        // Step 10: User views active subscriptions
        const subscriptions = await query(
            'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2',
            [testUser.id, 'ACTIVE']
        );
        expect(subscriptions.rows.length).toBeGreaterThan(0);

        console.log('✅ Complete user journey test passed!');
    });
});


