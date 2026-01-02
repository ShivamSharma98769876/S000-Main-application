/**
 * Check cart_items table columns
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
            WHERE table_name = 'cart_items'
            ORDER BY ordinal_position
        `);
        
        console.log('\n=== cart_items Table Columns ===\n');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name} (${row.data_type}) - nullable: ${row.is_nullable}`);
        });
        
        const columns = result.rows.map(r => r.column_name);
        
        console.log('\n=== Column Check ===\n');
        console.log(`Has duration_type: ${columns.includes('duration_type')}`);
        console.log(`Has duration_units: ${columns.includes('duration_units')}`);
        console.log(`Has duration_unit: ${columns.includes('duration_unit')}`);
        console.log(`Has duration_value: ${columns.includes('duration_value')}`);
        
        if (columns.includes('duration_type') || columns.includes('duration_units')) {
            console.log('\n⚠️  WARNING: Table has old column names!');
            console.log('   Run: node backend/scripts/fix-cart-items-schema.js');
        } else if (columns.includes('duration_unit') && columns.includes('duration_value')) {
            console.log('\n✓ Table has correct column names');
        } else {
            console.log('\n⚠️  WARNING: Table is missing duration columns!');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkColumns();

