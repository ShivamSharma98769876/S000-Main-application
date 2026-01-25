// Migration script to add user_id column to testimonials table (PostgreSQL)
// so that admin and user-specific testimonial queries work correctly.

const path = require('path');
const fs = require('fs');

// Try to load dotenv if available (optional - not needed in Azure where env vars are set directly)
try {
    const envPaths = [
        path.join(__dirname, '../env'),      // backend/env
        path.join(__dirname, '../.env'),     // backend/.env
        path.join(__dirname, '../../.env'),  // root/.env
    ];

    let envLoaded = false;
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            try {
                require('dotenv').config({ path: envPath });
                envLoaded = true;
                console.log(`Loaded environment from: ${envPath}`);
                break;
            } catch (err) {
                // dotenv not available, continue
            }
        }
    }

    if (!envLoaded) {
        try {
            require('dotenv').config();
        } catch (err) {
            console.log('Note: dotenv not available, using environment variables directly');
        }
    }
} catch (error) {
    console.log('Note: dotenv not available, using environment variables directly');
}

const { pool } = require('../config/database');
const logger = require('../config/logger');

async function addTestimonialsUserIdColumn() {
    try {
        logger.info('Starting migration: Add user_id column to testimonials table');

        // Check if column already exists
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'testimonials' 
              AND column_name = 'user_id'
        `);

        if (checkColumn.rows.length === 0) {
            // Add user_id column as nullable and reference users(id)
            await pool.query(`
                ALTER TABLE testimonials 
                ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE SET NULL
            `);
            logger.info('✓ Successfully added user_id column to testimonials table');
            console.log('✅ Added user_id column to testimonials table');
        } else {
            logger.info('Column user_id already exists on testimonials table');
            console.log('ℹ️ Column user_id already exists on testimonials table');
        }

        // Optional: create an index on user_id for faster lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_testimonials_user_id 
            ON testimonials(user_id)
        `);
        logger.info('✓ Created idx_testimonials_user_id index');

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed (add testimonials.user_id)', error);
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run migration
addTestimonialsUserIdColumn();

