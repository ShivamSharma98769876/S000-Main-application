-- Migration SQL to add child_app_url_local and child_app_url_cloud columns to products table
-- Run this directly in your PostgreSQL database if the Node.js script has issues

-- Add child_app_url_local column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'child_app_url_local'
    ) THEN
        ALTER TABLE products ADD COLUMN child_app_url_local TEXT;
        RAISE NOTICE 'Added child_app_url_local column';
    ELSE
        RAISE NOTICE 'Column child_app_url_local already exists';
    END IF;
END $$;

-- Add child_app_url_cloud column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'child_app_url_cloud'
    ) THEN
        ALTER TABLE products ADD COLUMN child_app_url_cloud TEXT;
        RAISE NOTICE 'Added child_app_url_cloud column';
    ELSE
        RAISE NOTICE 'Column child_app_url_cloud already exists';
    END IF;
END $$;

-- Migrate data from old child_app_url column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'child_app_url'
    ) THEN
        UPDATE products 
        SET child_app_url_cloud = child_app_url 
        WHERE child_app_url IS NOT NULL 
        AND child_app_url_cloud IS NULL;
        RAISE NOTICE 'Migrated data from child_app_url to child_app_url_cloud';
    END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_child_app_url_local 
ON products(child_app_url_local) 
WHERE child_app_url_local IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_child_app_url_cloud 
ON products(child_app_url_cloud) 
WHERE child_app_url_cloud IS NOT NULL;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
END $$;

