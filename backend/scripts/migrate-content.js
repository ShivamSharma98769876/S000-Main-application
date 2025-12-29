const { pool } = require('../config/database');
const logger = require('../config/logger');

const contentMigrations = `
-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    discount_text VARCHAR(100) NOT NULL,
    badge_text VARCHAR(100),
    validity_text VARCHAR(255),
    cta_text VARCHAR(100) DEFAULT 'Claim Offer',
    cta_link VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
    id BIGSERIAL PRIMARY KEY,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(255) NOT NULL,
    author_initials VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    rating INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    display_order INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status, display_order);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status, display_order);

-- Insert sample offers (if table is empty)
INSERT INTO offers (title, description, discount_text, badge_text, validity_text, display_order)
SELECT 
    'Annual Subscription',
    'Save big with our annual plans. Get 40% off on all products when you subscribe for 12 months.',
    '40% OFF',
    '🎉 New Year Sale',
    'Valid until: Dec 31, 2025',
    1
WHERE NOT EXISTS (SELECT 1 FROM offers LIMIT 1);

INSERT INTO offers (title, description, discount_text, badge_text, validity_text, display_order)
SELECT 
    'First Month Free',
    'New users get their first month absolutely free on any Premium or Pro plan. No credit card required.',
    'FREE',
    '🔥 Hot Deal',
    'Limited spots available',
    2
WHERE NOT EXISTS (SELECT 1 FROM offers WHERE title = 'First Month Free');

INSERT INTO offers (title, description, discount_text, badge_text, validity_text, display_order)
SELECT 
    'Complete Package',
    'Subscribe to 2 or more products and get 25% off on your total subscription cost.',
    '25% OFF',
    '💰 Bundle Offer',
    'Ongoing offer',
    3
WHERE NOT EXISTS (SELECT 1 FROM offers WHERE title = 'Complete Package');

-- Insert sample testimonials (if table is empty)
INSERT INTO testimonials (author_name, author_role, author_initials, content, rating, display_order)
SELECT 
    'Rajesh Kumar',
    'Full-time Trader',
    'RK',
    'The algo trading platform has completely transformed my trading. I''ve seen a 45% increase in my profits since I started using it. The backtesting feature is incredibly accurate!',
    5,
    1
WHERE NOT EXISTS (SELECT 1 FROM testimonials LIMIT 1);

INSERT INTO testimonials (author_name, author_role, author_initials, content, rating, display_order)
SELECT 
    'Priya Sharma',
    'Options Trader',
    'PS',
    'Best investment I''ve made in my trading career. The premium analytics suite provides insights that I couldn''t get anywhere else. Worth every rupee!',
    5,
    2
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE author_name = 'Priya Sharma');

INSERT INTO testimonials (author_name, author_role, author_initials, content, rating, display_order)
SELECT 
    'Amit Mehta',
    'Swing Trader',
    'AM',
    'I started as a complete beginner with the Trading Academy. Now I''m consistently profitable. The mentorship program is exceptional and the community is very supportive.',
    5,
    3
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE author_name = 'Amit Mehta');

INSERT INTO testimonials (author_name, author_role, author_initials, content, rating, display_order)
SELECT 
    'Sneha Kapoor',
    'Day Trader',
    'SK',
    'The trading bots are game-changers. They execute trades perfectly 24/7 while I sleep. My portfolio has grown steadily without the stress of manual trading.',
    5,
    4
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE author_name = 'Sneha Kapoor');

INSERT INTO testimonials (author_name, author_role, author_initials, content, rating, display_order)
SELECT 
    'Vikram Gupta',
    'Intraday Trader',
    'VG',
    'Outstanding platform with excellent customer support. The tools are intuitive and powerful. I''ve recommended it to all my trading friends.',
    5,
    5
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE author_name = 'Vikram Gupta');

INSERT INTO testimonials (author_name, author_role, author_initials, content, rating, display_order)
SELECT 
    'Neha Reddy',
    'Position Trader',
    'NR',
    'The risk management tools have saved me from many bad trades. The platform''s analytics help me make informed decisions rather than emotional ones.',
    5,
    6
WHERE NOT EXISTS (SELECT 1 FROM testimonials WHERE author_name = 'Neha Reddy');
`;

async function runContentMigrations() {
    try {
        logger.info('Starting content tables migrations...');
        
        await pool.query(contentMigrations);
        
        logger.info('Content tables migrations completed successfully');
        console.log('✅ Content tables (offers, testimonials) created successfully');
        
        process.exit(0);
    } catch (error) {
        logger.error('Content migration failed', error);
        console.error('❌ Content migration failed:', error.message);
        process.exit(1);
    }
}

// Run migrations if called directly
if (require.main === module) {
    runContentMigrations();
}

module.exports = { runContentMigrations };


