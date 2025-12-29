const { query } = require('../config/database');
const logger = require('../config/logger');

const seedData = async () => {
    try {
        logger.info('Starting database seeding...');
        
        // Seed products
        const products = [
            {
                name: 'Algo Trading Platform',
                description: 'Advanced algorithmic trading platform with backtesting, strategy optimization, and automated execution',
                category: 'Trading Software',
                monthly_price: 2999,
                yearly_price: 29990,
                status: 'ACTIVE'
            },
            {
                name: 'Premium Analytics Suite',
                description: 'Comprehensive market analysis tools with AI-powered insights, advanced charting, and predictive analytics',
                category: 'Analytics',
                monthly_price: 4999,
                yearly_price: 49990,
                status: 'ACTIVE'
            },
            {
                name: 'Smart Trading Bots',
                description: 'Pre-configured trading bots with proven strategies for different market conditions and asset classes',
                category: 'Automation',
                monthly_price: 3499,
                yearly_price: 34990,
                status: 'ACTIVE'
            },
            {
                name: 'Trading Academy',
                description: 'Complete trading education with video courses, live sessions, mentorship, and community access',
                category: 'Education',
                monthly_price: 1999,
                yearly_price: 19990,
                status: 'ACTIVE'
            }
        ];
        
        for (const product of products) {
            await query(
                `INSERT INTO products (name, description, category, price_per_month, price_per_year, status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                 ON CONFLICT DO NOTHING`,
                [product.name, product.description, product.category, product.monthly_price, product.yearly_price, product.status]
            );
        }
        
        logger.info('Products seeded successfully');
        console.log('✅ Products seeded successfully');
        
        // Create admin user (if ADMIN_EMAIL is set)
        if (process.env.ADMIN_EMAIL) {
            const adminResult = await query(
                `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, NOW(), NOW())
                 ON CONFLICT (email) DO UPDATE SET is_admin = true
                 RETURNING id`,
                ['GOOGLE', 'admin-' + Date.now(), process.env.ADMIN_EMAIL, true]
            );
            
            if (adminResult.rows.length > 0) {
                const adminId = adminResult.rows[0].id;
                
                // Create admin profile
                await query(
                    `INSERT INTO user_profiles (user_id, full_name, address, phone, capital_used, profile_completed, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                     ON CONFLICT (user_id) DO NOTHING`,
                    [adminId, 'Admin User', 'Mumbai, Maharashtra, India', '+918888888888', 0, true]
                );
                
                logger.info('Admin user created');
                console.log('✅ Admin user created');
            }
        }
        
        logger.info('Database seeding completed successfully');
        console.log('✅ Database seeding completed successfully');
        
        process.exit(0);
    } catch (error) {
        logger.error('Seeding failed', error);
        console.error('❌ Seeding failed:', error.message);
        process.exit(1);
    }
};

// Run seeding if called directly
if (require.main === module) {
    seedData();
}

module.exports = { seedData };


