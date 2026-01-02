/**
 * Make duration_unit and duration_value NOT NULL in subscription_order_items
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

async function fixNullable() {
    try {
        // First, ensure all rows have values
        await query(`
            UPDATE subscription_order_items 
            SET duration_unit = 'MONTH' 
            WHERE duration_unit IS NULL
        `);
        
        await query(`
            UPDATE subscription_order_items 
            SET duration_value = 1 
            WHERE duration_value IS NULL
        `);
        
        // Now make them NOT NULL
        await query(`
            ALTER TABLE subscription_order_items 
            ALTER COLUMN duration_unit SET NOT NULL
        `);
        
        await query(`
            ALTER TABLE subscription_order_items 
            ALTER COLUMN duration_value SET NOT NULL
        `);
        
        console.log('✅ Made duration_unit and duration_value NOT NULL');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

fixNullable();

