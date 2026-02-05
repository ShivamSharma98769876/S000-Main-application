/**
 * Run migration: update daily_pnl table with Z_client_id, Streatgy and new unique constraint.
 * Run from backend: node scripts/update-daily-pnl-schema.js
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

const sqlPath = path.join(__dirname, 'update-daily-pnl-schema.sql');

async function run() {
    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await query(sql);
        logger.info('daily_pnl schema updated successfully');
        console.log('✅ daily_pnl schema updated successfully');
        process.exit(0);
    } catch (err) {
        logger.error('update-daily-pnl-schema failed', err);
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

run();
