/**
 * Complete Database Migration Script
 * Creates all tables for the Trading Subscription Platform
 */

const { query } = require('../config/database');
const logger = require('../config/logger');

async function runMigrations() {
    try {
        logger.info('Starting database migrations...');

        // 1. Create Users table
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('GOOGLE', 'APPLE')),
                provider_user_id VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                is_admin BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(provider_type, provider_user_id)
            );
        `);
        logger.info('✓ Users table created');

        // 2. Create User Profiles table
        await query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                address TEXT NOT NULL,
                capital_used DECIMAL(15, 2),
                referral_code VARCHAR(50),
                communication_preferences JSONB DEFAULT '{"email": true, "sms": false}',
                profile_completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id)
            );
        `);
        logger.info('✓ User Profiles table created');

        // 3. Create Products table
        await query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100),
                price_per_month DECIMAL(10, 2) NOT NULL,
                price_per_year DECIMAL(10, 2) NOT NULL,
                features JSONB,
                status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
                popularity INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ Products table created');

        // 4. Create Carts table
        await query(`
            CREATE TABLE IF NOT EXISTS carts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id)
            );
        `);
        logger.info('✓ Carts table created');

        // 5. Create Cart Items table
        await query(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id SERIAL PRIMARY KEY,
                cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                duration_value INTEGER NOT NULL CHECK (duration_value > 0 AND duration_value <= 12),
                duration_unit VARCHAR(10) NOT NULL CHECK (duration_unit IN ('MONTH', 'YEAR')),
                price DECIMAL(10, 2) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(cart_id, product_id)
            );
        `);
        logger.info('✓ Cart Items table created');

        // 6. Create Subscription Orders table
        await query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                total_amount DECIMAL(12, 2) NOT NULL,
                discount_amount DECIMAL(12, 2) DEFAULT 0,
                final_amount DECIMAL(12, 2) NOT NULL,
                payment_proof_url TEXT,
                payment_reference VARCHAR(255),
                payment_date TIMESTAMP,
                status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ Orders table created');

        // 7. Create Order Items table
        await query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                duration_value INTEGER NOT NULL,
                duration_unit VARCHAR(10) NOT NULL CHECK (duration_unit IN ('MONTH', 'YEAR')),
                price DECIMAL(10, 2) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ Order Items table created');

        // 8. Create Subscriptions table
        await query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                order_id INTEGER REFERENCES orders(id),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'UPCOMING')),
                auto_renew BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ Subscriptions table created');

        // 9. Create Login Audit table
        await query(`
            CREATE TABLE IF NOT EXISTS login_audit (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                email VARCHAR(255),
                provider VARCHAR(20),
                event_type VARCHAR(20) CHECK (event_type IN ('LOGIN', 'LOGOUT', 'FAILED_LOGIN')),
                ip_address VARCHAR(45),
                user_agent TEXT,
                status VARCHAR(20),
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ Login Audit table created');

        // 10. Create System Config table
        await query(`
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                config_key VARCHAR(100) NOT NULL UNIQUE,
                config_value TEXT,
                config_type VARCHAR(50) DEFAULT 'STRING',
                description TEXT,
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ System Config table created');

        // 11. Create Offers table (from previous migration)
        await query(`
            CREATE TABLE IF NOT EXISTS offers (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                discount_percentage INTEGER,
                valid_from DATE,
                valid_until DATE,
                is_active BOOLEAN DEFAULT TRUE,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ Offers table created');

        // 12. Create Testimonials table (from previous migration)
        await query(`
            CREATE TABLE IF NOT EXISTS testimonials (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL,
                customer_role VARCHAR(255),
                testimonial_text TEXT NOT NULL,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                is_active BOOLEAN DEFAULT TRUE,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        logger.info('✓ Testimonials table created');

        // 13. Create Session table (for express-session)
        await query(`
            CREATE TABLE IF NOT EXISTS session (
                sid VARCHAR NOT NULL PRIMARY KEY,
                sess JSON NOT NULL,
                expire TIMESTAMP(6) NOT NULL
            );
        `);
        logger.info('✓ Session table created');

        // 14. Create Indexes for Performance
        logger.info('Creating indexes...');

        // Users indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider_type, provider_user_id);`);
        
        // User Profiles indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);`);
        
        // Products indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`);
        
        // Cart indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);`);
        
        // Orders indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);
        
        // Subscriptions indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_product_id ON subscriptions(product_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date);`);
        
        // Login Audit indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_login_audit_email ON login_audit(email);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_login_audit_created_at ON login_audit(created_at DESC);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_login_audit_event_type ON login_audit(event_type);`);
        
        // System Config indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);`);
        
        // Session indexes
        await query(`CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);`);
        
        logger.info('✓ All indexes created');

        logger.info('✅ Database migration completed successfully!');
        return true;
    } catch (error) {
        logger.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migrations if called directly
if (require.main === module) {
    runMigrations()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigrations };


