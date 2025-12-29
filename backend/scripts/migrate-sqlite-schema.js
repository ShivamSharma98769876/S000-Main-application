const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Get database path from environment or use default
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../data/tradingpro.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create or open database
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

async function createSQLiteSchema() {
    try {
        logger.info('Creating SQLite database schema...');

        // Users table
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_type TEXT NOT NULL CHECK (provider_type IN ('GOOGLE', 'APPLE')),
                provider_user_id TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                UNIQUE (provider_type, provider_user_id)
            );
        `);

        // User profiles table
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                full_name TEXT,
                phone TEXT,
                address TEXT,
                capital_used REAL,
                referral_code TEXT,
                zerodha_client_id TEXT,
                communication_preferences TEXT,
                profile_completed INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                UNIQUE (user_id)
            );
        `);

        // Products table
        db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                price_per_month REAL NOT NULL,
                price_per_year REAL NOT NULL,
                features TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
                popularity INTEGER DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Carts table
        db.exec(`
            CREATE TABLE IF NOT EXISTS carts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
                UNIQUE (user_id)
            );
        `);

        // Cart items table
        db.exec(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                duration_type TEXT NOT NULL CHECK (duration_type IN ('MONTH', 'YEAR')),
                duration_units INTEGER NOT NULL CHECK (duration_units BETWEEN 1 AND 12),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                unit_price REAL NOT NULL,
                subtotal REAL NOT NULL,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Subscription orders table
        db.exec(`
            CREATE TABLE IF NOT EXISTS subscription_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
                total_amount REAL NOT NULL,
                payment_proof_url TEXT,
                payment_reference TEXT,
                payment_date DATETIME,
                rejection_reason TEXT,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Subscription order items table
        db.exec(`
            CREATE TABLE IF NOT EXISTS subscription_order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES subscription_orders(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                duration_type TEXT,
                duration_unit TEXT,
                duration_units INTEGER,
                duration_value INTEGER,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                unit_price REAL,
                price REAL,
                subtotal REAL NOT NULL,
                created_at DATETIME
            );
        `);

        // Subscriptions table
        db.exec(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                order_id INTEGER REFERENCES subscription_orders(id),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'UPCOMING')),
                auto_renew INTEGER DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Login audit table
        db.exec(`
            CREATE TABLE IF NOT EXISTS login_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                email TEXT,
                provider TEXT,
                event_type TEXT CHECK (event_type IN ('LOGIN', 'LOGOUT', 'FAILED_LOGIN')),
                ip_address TEXT,
                user_agent TEXT,
                status TEXT,
                error_message TEXT,
                created_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // System config table
        db.exec(`
            CREATE TABLE IF NOT EXISTS system_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_key TEXT NOT NULL UNIQUE,
                config_value TEXT,
                config_type TEXT DEFAULT 'STRING',
                description TEXT,
                is_public INTEGER DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Session table (for express-session)
        db.exec(`
            CREATE TABLE IF NOT EXISTS session (
                sid TEXT NOT NULL PRIMARY KEY,
                sess TEXT NOT NULL,
                expire DATETIME NOT NULL
            );
        `);

        // Offers table
        db.exec(`
            CREATE TABLE IF NOT EXISTS offers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                discount_text TEXT NOT NULL,
                badge_text TEXT,
                validity_text TEXT,
                cta_text TEXT DEFAULT 'Claim Offer',
                cta_link TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
                display_order INTEGER DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Testimonials table (supports both old and new schema)
        db.exec(`
            CREATE TABLE IF NOT EXISTS testimonials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                customer_name TEXT,
                customer_role TEXT,
                testimonial_text TEXT,
                author_name TEXT,
                author_role TEXT,
                author_initials TEXT,
                content TEXT,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                is_active INTEGER DEFAULT 1,
                status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
                display_order INTEGER DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT (datetime('now')),
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Email queue table
        db.exec(`
            CREATE TABLE IF NOT EXISTS email_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                recipient TEXT NOT NULL,
                data TEXT NOT NULL,
                priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
                status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                created_at DATETIME NOT NULL,
                sent_at DATETIME,
                updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Error logs table
        db.exec(`
            CREATE TABLE IF NOT EXISTS error_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT NOT NULL,
                stack TEXT,
                error_name TEXT,
                error_code TEXT,
                context TEXT,
                created_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Performance metrics table
        db.exec(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation TEXT NOT NULL,
                duration INTEGER NOT NULL,
                metadata TEXT,
                created_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Failed login attempts table
        db.exec(`
            CREATE TABLE IF NOT EXISTS failed_login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                provider TEXT,
                ip_address TEXT,
                user_agent TEXT,
                reason TEXT,
                created_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // System alerts table
        db.exec(`
            CREATE TABLE IF NOT EXISTS system_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_type TEXT NOT NULL,
                severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
                message TEXT NOT NULL,
                metadata TEXT,
                resolved INTEGER DEFAULT 0,
                resolved_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT (datetime('now'))
            );
        `);

        // Create indexes
        logger.info('Creating indexes...');
        
        db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider_type, provider_user_id);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON subscription_orders(status, created_at);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_subscription_orders_user ON subscription_orders(user_id);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit(user_id, created_at);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON subscription_order_items(order_id);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_testimonials_user_id ON testimonials(user_id);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status, display_order);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status, display_order);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, priority);`);

        logger.info('✅ SQLite schema created successfully!');
        logger.info(`Database location: ${DB_PATH}`);
        
        return true;
    } catch (error) {
        logger.error('❌ SQLite schema creation failed:', error);
        throw error;
    } finally {
        db.close();
    }
}

if (require.main === module) {
    createSQLiteSchema()
        .then(() => {
            logger.info('✅ SQLite migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { createSQLiteSchema };

