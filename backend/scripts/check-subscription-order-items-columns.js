/**
 * Check subscription_order_items table columns
 */

const path = require('path');
const fs = require('fs');

const envPaths = [
    path.join(__dirname, '../env'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    require('dotenv').config();
}

const { query } = require('../config/database');

async function checkColumns() {
    try {
        const result = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'subscription_order_items'
            ORDER BY ordinal_position
        `);
        
        console.log('\n=== subscription_order_items Table Columns ===\n');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name} (${row.data_type}) - nullable: ${row.is_nullable}`);
        });
        
        const columns = result.rows.map(r => r.column_name);
        
        console.log('\n=== Column Check ===\n');
        console.log(`Has duration_type: ${columns.includes('duration_type')}`);
        console.log(`Has duration_units: ${columns.includes('duration_units')}`);
        console.log(`Has duration_unit: ${columns.includes('duration_unit')}`);
        console.log(`Has duration_value: ${columns.includes('duration_value')}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkColumns();

