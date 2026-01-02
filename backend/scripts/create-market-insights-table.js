// Load environment variables BEFORE requiring database config
const path = require('path');
const fs = require('fs');

// Try multiple possible locations for .env file
const envPaths = [
    path.join(__dirname, '../env'),      // backend/env
    path.join(__dirname, '../.env'),     // backend/.env
    path.join(__dirname, '../../.env'),  // root/.env
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        envLoaded = true;
        break;
    }
}

// Fallback to default dotenv behavior
if (!envLoaded) {
    require('dotenv').config();
}

const { query } = require('../config/database');
const logger = require('../config/logger');

async function createMarketInsightsTable() {
    try {
        logger.info('Creating market_insights table...');

        // Check if table already exists
        const checkTable = await query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'market_insights'
            );
        `);

        if (checkTable.rows[0].exists) {
            logger.info('✓ market_insights table already exists');
            console.log('✅ market_insights table already exists');
            return;
        }

        // Create market_insights table
        await query(`
            CREATE TABLE market_insights (
                id BIGSERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(100) DEFAULT 'intraday',
                status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
                author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                published_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        logger.info('✓ market_insights table created');
        console.log('✅ market_insights table created');

        // Create indexes
        await query(`
            CREATE INDEX IF NOT EXISTS idx_market_insights_status ON market_insights(status, published_at);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_market_insights_author ON market_insights(author_id);
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_market_insights_created ON market_insights(created_at DESC);
        `);

        logger.info('✓ Indexes created for market_insights table');
        console.log('✅ Indexes created for market_insights table');
        logger.info('✅ Market insights table migration completed successfully');
        console.log('✅ Market insights table migration completed successfully');

    } catch (error) {
        logger.error('❌ Failed to create market_insights table', error);
        console.error('❌ Failed to create market_insights table:', error.message);
        throw error;
    }
}

// Run migration
createMarketInsightsTable()
    .then(() => {
        logger.info('Migration completed');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('Migration failed:', error);
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    });

