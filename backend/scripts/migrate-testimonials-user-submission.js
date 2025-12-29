const { pool } = require('../config/database');
const logger = require('../config/logger');

async function runTestimonialsMigration() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Add user_id column if it doesn't exist
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'user_id'
                ) THEN
                    ALTER TABLE testimonials ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
                END IF;
            END $$;
        `);

        // Ensure new schema columns exist (author_name, author_role, author_initials, content)
        await client.query(`
            DO $$ 
            BEGIN
                -- Add author_name if it doesn't exist
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'author_name'
                ) THEN
                    ALTER TABLE testimonials ADD COLUMN author_name VARCHAR(255);
                    
                    -- Migrate from customer_name if it exists
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'testimonials' AND column_name = 'customer_name'
                    ) THEN
                        UPDATE testimonials SET author_name = customer_name WHERE author_name IS NULL;
                    END IF;
                    
                    ALTER TABLE testimonials ALTER COLUMN author_name SET NOT NULL;
                END IF;
                
                -- Add author_role if it doesn't exist
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'author_role'
                ) THEN
                    ALTER TABLE testimonials ADD COLUMN author_role VARCHAR(255);
                    
                    -- Migrate from customer_role if it exists
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'testimonials' AND column_name = 'customer_role'
                    ) THEN
                        UPDATE testimonials SET author_role = COALESCE(customer_role, 'Trader') WHERE author_role IS NULL;
                    ELSE
                        UPDATE testimonials SET author_role = 'Trader' WHERE author_role IS NULL;
                    END IF;
                    
                    ALTER TABLE testimonials ALTER COLUMN author_role SET NOT NULL;
                END IF;
                
                -- Add author_initials if it doesn't exist
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'author_initials'
                ) THEN
                    ALTER TABLE testimonials ADD COLUMN author_initials VARCHAR(10);
                    
                    -- Generate initials from author_name
                    UPDATE testimonials SET author_initials = UPPER(SUBSTRING(author_name, 1, 2)) WHERE author_initials IS NULL;
                    
                    ALTER TABLE testimonials ALTER COLUMN author_initials SET NOT NULL;
                END IF;
                
                -- Add content if it doesn't exist
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'content'
                ) THEN
                    ALTER TABLE testimonials ADD COLUMN content TEXT;
                    
                    -- Migrate from testimonial_text if it exists
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'testimonials' AND column_name = 'testimonial_text'
                    ) THEN
                        UPDATE testimonials SET content = testimonial_text WHERE content IS NULL;
                    END IF;
                    
                    ALTER TABLE testimonials ALTER COLUMN content SET NOT NULL;
                END IF;
            END $$;
        `);

        // Check if status column exists, if not add it
        await client.query(`
            DO $$ 
            BEGIN
                -- Check if status column exists
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'status'
                ) THEN
                    -- Add status column
                    ALTER TABLE testimonials ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
                    
                    -- Migrate is_active to status if is_active exists
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'testimonials' AND column_name = 'is_active'
                    ) THEN
                        UPDATE testimonials SET status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END;
                    END IF;
                END IF;
            END $$;
        `);

        // Update status constraint to include PENDING
        await client.query(`
            DO $$ 
            BEGIN
                -- Drop existing constraint if it exists
                IF EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'testimonials_status_check'
                ) THEN
                    ALTER TABLE testimonials DROP CONSTRAINT testimonials_status_check;
                END IF;
                
                -- Add new constraint with PENDING status
                ALTER TABLE testimonials 
                ADD CONSTRAINT testimonials_status_check 
                CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING'));
            END $$;
        `);

        // Create index on user_id
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_testimonials_user_id ON testimonials(user_id);
        `);

        // Create index on status for better query performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_testimonials_status ON testimonials(status, display_order);
        `);

        // Make old columns nullable to avoid constraint violations
        await client.query(`
            DO $$ 
            BEGIN
                -- Make customer_name nullable if it exists
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'customer_name'
                    AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE testimonials ALTER COLUMN customer_name DROP NOT NULL;
                END IF;
                
                -- Make customer_role nullable if it exists
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'customer_role'
                    AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE testimonials ALTER COLUMN customer_role DROP NOT NULL;
                END IF;
                
                -- Make testimonial_text nullable if it exists
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'testimonials' AND column_name = 'testimonial_text'
                    AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE testimonials ALTER COLUMN testimonial_text DROP NOT NULL;
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        logger.info('✓ Testimonials table updated for user submissions');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('❌ Testimonials migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    runTestimonialsMigration()
        .then(() => {
            logger.info('✅ Testimonials migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runTestimonialsMigration };

