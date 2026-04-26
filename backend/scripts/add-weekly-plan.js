/**
 * Migration: Add Weekly subscription plan support.
 *
 * - Adds `price_per_week` column to `products` (default 100).
 * - Updates `duration_unit` CHECK constraints on `cart_items` and
 *   `subscription_order_items` to allow 'WEEK' alongside 'MONTH' / 'YEAR'.
 *
 * Idempotent: safe to run multiple times.
 */
const path = require('path');
const fs = require('fs');

// Load environment variables BEFORE requiring database config
const envPath = path.join(__dirname, '../env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const { query } = require('../config/database');
const logger = require('../config/logger');

async function dropConstraintIfExists(table, constraintLike) {
    // Drops any existing CHECK constraint on duration_unit so we can recreate.
    const res = await query(
        `SELECT conname FROM pg_constraint c
         JOIN pg_class t ON c.conrelid = t.oid
         WHERE t.relname = $1 AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE $2`,
        [table, `%${constraintLike}%`]
    );
    for (const row of res.rows) {
        await query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${row.conname}`);
        logger.info(`Dropped constraint ${row.conname} on ${table}`);
    }
}

async function run() {
    try {
        logger.info('Adding price_per_week column to products...');
        await query(`
            ALTER TABLE products
            ADD COLUMN IF NOT EXISTS price_per_week NUMERIC(10,2) NOT NULL DEFAULT 100
        `);
        console.log('✅ products.price_per_week ensured (default 100)');

        // Backfill any rows that may have NULLs from an older add
        await query(`UPDATE products SET price_per_week = 100 WHERE price_per_week IS NULL`);

        // Relax duration_unit CHECK on cart_items
        logger.info('Updating duration_unit CHECK on cart_items...');
        await dropConstraintIfExists('cart_items', 'duration_unit');
        await query(`
            ALTER TABLE cart_items
            ADD CONSTRAINT cart_items_duration_unit_check
            CHECK (duration_unit IN ('WEEK', 'MONTH', 'YEAR'))
        `);
        console.log('✅ cart_items.duration_unit now allows WEEK');

        // Relax duration_unit CHECK on subscription_order_items
        logger.info('Updating duration_unit CHECK on subscription_order_items...');
        await dropConstraintIfExists('subscription_order_items', 'duration_unit');
        await query(`
            ALTER TABLE subscription_order_items
            ADD CONSTRAINT subscription_order_items_duration_unit_check
            CHECK (duration_unit IN ('WEEK', 'MONTH', 'YEAR'))
        `);
        console.log('✅ subscription_order_items.duration_unit now allows WEEK');

        logger.info('✓ Weekly plan migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Failed to apply weekly plan migration', error);
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

run();
