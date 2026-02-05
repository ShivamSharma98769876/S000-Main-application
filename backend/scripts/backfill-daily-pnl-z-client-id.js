/**
 * Backfill daily_pnl.Z_client_id from user_profiles.zerodha_client_id using user_id.
 * daily_pnl.user_id references user_profiles(id), so we join on that.
 * Run from backend: node scripts/backfill-daily-pnl-z-client-id.js
 */

const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const { query } = require('../config/database');
const logger = require('../config/logger');

async function run() {
    try {
        const result = await query(`
            UPDATE daily_pnl d
            SET "Z_client_id" = up.zerodha_client_id
            FROM user_profiles up
            WHERE up.id = d.user_id
              AND up.zerodha_client_id IS NOT NULL
              AND up.zerodha_client_id <> ''
        `);
        const updated = result.rowCount ?? 0;
        logger.info('Backfill daily_pnl Z_client_id completed', { rowCount: updated });
        console.log(`✅ Updated Z_client_id for ${updated} row(s) in daily_pnl from user_profiles.`);
        process.exit(0);
    } catch (err) {
        logger.error('backfill-daily-pnl-z-client-id failed', err);
        console.error('❌ Backfill failed:', err.message);
        process.exit(1);
    }
}

run();
