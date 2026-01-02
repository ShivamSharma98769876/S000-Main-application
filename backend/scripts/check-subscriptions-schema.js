/**
 * Check subscriptions table schema
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

async function checkSchema() {
    try {
        // Check subscriptions table columns
        const columns = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'subscriptions'
            ORDER BY ordinal_position
        `);
        
        console.log('\n=== subscriptions Table Columns ===\n');
        columns.rows.forEach(row => {
            console.log(`  ${row.column_name} (${row.data_type}) - nullable: ${row.is_nullable}`);
        });
        
        // Check foreign key constraints
        const fkeys = await query(`
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = 'subscriptions'
                AND tc.constraint_type = 'FOREIGN KEY'
        `);
        
        console.log('\n=== Foreign Key Constraints ===\n');
        fkeys.rows.forEach(row => {
            console.log(`  ${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkSchema();

