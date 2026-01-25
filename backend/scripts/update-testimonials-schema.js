// Migration script to align PostgreSQL testimonials table with current application schema

const path = require('path');
const fs = require('fs');

// Load environment variables before requiring database config
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

async function updateTestimonialsSchema() {
    try {
        logger.info('Starting migration: Update testimonials table schema');

        // Get existing columns
        const colResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'testimonials'
        `);

        const columns = colResult.rows.map(r => r.column_name);
        const hasColumn = (name) => columns.includes(name);

        // Add new columns if they don't exist
        if (!hasColumn('author_name')) {
            await pool.query(`
                ALTER TABLE testimonials 
                ADD COLUMN author_name VARCHAR(255)
            `);
            logger.info('✓ Added author_name column to testimonials');
        }

        if (!hasColumn('author_role')) {
            await pool.query(`
                ALTER TABLE testimonials 
                ADD COLUMN author_role VARCHAR(255)
            `);
            logger.info('✓ Added author_role column to testimonials');
        }

        if (!hasColumn('author_initials')) {
            await pool.query(`
                ALTER TABLE testimonials 
                ADD COLUMN author_initials VARCHAR(10)
            `);
            logger.info('✓ Added author_initials column to testimonials');
        }

        if (!hasColumn('content')) {
            await pool.query(`
                ALTER TABLE testimonials 
                ADD COLUMN content TEXT
            `);
            logger.info('✓ Added content column to testimonials');
        }

        if (!hasColumn('status')) {
            await pool.query(`
                ALTER TABLE testimonials 
                ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' 
                    CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING'))
            `);
            logger.info('✓ Added status column to testimonials');
        }

        // Refresh columns list after potential changes
        const updatedCols = (await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'testimonials'
        `)).rows.map(r => r.column_name);
        const hasUpdated = (name) => updatedCols.includes(name);

        // Data migration from old columns if they exist
        const hasCustomerName = hasUpdated('customer_name');
        const hasCustomerRole = hasUpdated('customer_role');
        const hasTestimonialText = hasUpdated('testimonial_text');
        const hasIsActive = hasUpdated('is_active');

        if (hasCustomerName && hasUpdated('author_name')) {
            await pool.query(`
                UPDATE testimonials
                SET author_name = customer_name
                WHERE author_name IS NULL AND customer_name IS NOT NULL
            `);
            logger.info('✓ Migrated customer_name -> author_name');
        }

        if (hasCustomerRole && hasUpdated('author_role')) {
            await pool.query(`
                UPDATE testimonials
                SET author_role = customer_role
                WHERE author_role IS NULL AND customer_role IS NOT NULL
            `);
            logger.info('✓ Migrated customer_role -> author_role');
        }

        if (hasTestimonialText && hasUpdated('content')) {
            await pool.query(`
                UPDATE testimonials
                SET content = testimonial_text
                WHERE content IS NULL AND testimonial_text IS NOT NULL
            `);
            logger.info('✓ Migrated testimonial_text -> content');
        }

        if (hasIsActive && hasUpdated('status')) {
            await pool.query(`
                UPDATE testimonials
                SET status = CASE 
                    WHEN is_active IS TRUE THEN 'ACTIVE'
                    WHEN is_active IS FALSE THEN 'INACTIVE'
                    ELSE COALESCE(status, 'ACTIVE')
                END
            `);
            logger.info('✓ Migrated is_active -> status');
        }

        // Drop NOT NULL constraints on legacy columns so new rows using only new columns don't fail
        if (hasCustomerName) {
            await pool.query(`
                ALTER TABLE testimonials
                ALTER COLUMN customer_name DROP NOT NULL
            `);
            logger.info('✓ Dropped NOT NULL constraint on testimonials.customer_name');
        }

        if (hasTestimonialText) {
            await pool.query(`
                ALTER TABLE testimonials
                ALTER COLUMN testimonial_text DROP NOT NULL
            `);
            logger.info('✓ Dropped NOT NULL constraint on testimonials.testimonial_text');
        }

        console.log('✅ Testimonials schema migration completed successfully!');
        logger.info('Testimonials schema migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Testimonials schema migration failed:', error.message);
        logger.error('Testimonials schema migration failed', error);
        process.exit(1);
    }
}

// Run migration
updateTestimonialsSchema();

