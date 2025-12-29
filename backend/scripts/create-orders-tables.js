const { query } = require('../config/database');
const logger = require('../config/logger');

async function createOrdersTables() {
    try {
        logger.info('Creating orders and subscriptions tables...');
        
        // 1. Create subscription_orders table
        await query(`
            CREATE TABLE IF NOT EXISTS subscription_orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
                total_amount DECIMAL(12,2) NOT NULL,
                payment_proof_url TEXT,
                payment_reference VARCHAR(100),
                payment_date TIMESTAMP,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ subscription_orders table created');
        
        // 2. Create subscription_order_items table
        await query(`
            CREATE TABLE IF NOT EXISTS subscription_order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES subscription_orders(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                duration_unit VARCHAR(10) NOT NULL CHECK (duration_unit IN ('MONTH', 'YEAR')),
                duration_value INTEGER NOT NULL CHECK (duration_value BETWEEN 1 AND 12),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                unit_price DECIMAL(10,2) NOT NULL,
                subtotal DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ subscription_order_items table created');
        
        // 3. Create subscriptions table
        await query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'UPCOMING')) DEFAULT 'UPCOMING',
                source_order_id INTEGER NOT NULL REFERENCES subscription_orders(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ subscriptions table created');
        
        // 4. Create indexes
        await query(`
            CREATE INDEX IF NOT EXISTS idx_subscription_orders_user ON subscription_orders(user_id);
            CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON subscription_orders(status, created_at);
            CREATE INDEX IF NOT EXISTS idx_subscription_order_items_order ON subscription_order_items(order_id);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date);
        `);
        logger.info('✓ Indexes created');
        
        console.log('✅ All orders and subscriptions tables created successfully!');
        logger.info('Orders and subscriptions tables created successfully');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to create orders tables', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    createOrdersTables();
}

module.exports = { createOrdersTables };


