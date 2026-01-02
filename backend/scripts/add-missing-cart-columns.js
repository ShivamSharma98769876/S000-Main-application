/**
 * Add missing columns to cart_items table
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

async function addMissingColumns() {
    try {
        // Check current columns
        const result = await query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'cart_items'
        `);
        
        const columns = result.rows.map(r => r.column_name);
        console.log('Current columns:', columns.join(', '));
        
        // Add unit_price if missing
        if (!columns.includes('unit_price')) {
            await query(`
                ALTER TABLE cart_items 
                ADD COLUMN unit_price DECIMAL(10,2)
            `);
            console.log('✓ Added unit_price column');
            
            // Set unit_price from price if available
            if (columns.includes('price')) {
                await query(`
                    UPDATE cart_items 
                    SET unit_price = price 
                    WHERE unit_price IS NULL
                `);
            }
        } else {
            console.log('✓ unit_price column already exists');
        }
        
        // Add subtotal if missing
        if (!columns.includes('subtotal')) {
            await query(`
                ALTER TABLE cart_items 
                ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0
            `);
            console.log('✓ Added subtotal column');
            
            // Set subtotal from price if available
            if (columns.includes('price')) {
                await query(`
                    UPDATE cart_items 
                    SET subtotal = price 
                    WHERE subtotal = 0 OR subtotal IS NULL
                `);
            }
        } else {
            console.log('✓ subtotal column already exists');
        }
        
        console.log('\n✅ All required columns are now present!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

addMissingColumns();

