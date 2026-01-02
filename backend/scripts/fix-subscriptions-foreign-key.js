/**
 * Fix subscriptions table foreign key to reference subscription_orders instead of orders
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
const logger = require('../config/logger');

async function fixForeignKey() {
    try {
        logger.info('Fixing subscriptions table foreign key...');
        
        // Check current foreign key
        const fkeys = await query(`
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = 'subscriptions'
                AND tc.constraint_type = 'FOREIGN KEY'
                AND kcu.column_name = 'order_id'
        `);
        
        if (fkeys.rows.length > 0) {
            const constraint = fkeys.rows[0];
            console.log(`Found foreign key: ${constraint.constraint_name}`);
            console.log(`  Column: ${constraint.column_name}`);
            console.log(`  References: ${constraint.foreign_table_name}.id`);
            
            if (constraint.foreign_table_name === 'orders') {
                console.log('\n⚠️  Foreign key points to wrong table (orders). Fixing...');
                
                // Drop the old foreign key
                await query(`
                    ALTER TABLE subscriptions 
                    DROP CONSTRAINT IF EXISTS ${constraint.constraint_name}
                `);
                console.log(`✓ Dropped constraint: ${constraint.constraint_name}`);
                
                // Add new foreign key pointing to subscription_orders
                await query(`
                    ALTER TABLE subscriptions 
                    ADD CONSTRAINT subscriptions_order_id_fkey 
                    FOREIGN KEY (order_id) 
                    REFERENCES subscription_orders(id) 
                    ON DELETE CASCADE
                `);
                console.log('✓ Added new foreign key: subscriptions_order_id_fkey -> subscription_orders.id');
                
                logger.info('Subscriptions foreign key fixed');
                console.log('\n✅ Foreign key fixed successfully!');
            } else if (constraint.foreign_table_name === 'subscription_orders') {
                console.log('\n✓ Foreign key already points to correct table (subscription_orders)');
            }
        } else {
            console.log('\n⚠️  No foreign key found on order_id column');
            console.log('Adding foreign key constraint...');
            
            // Add foreign key if it doesn't exist
            await query(`
                ALTER TABLE subscriptions 
                ADD CONSTRAINT subscriptions_order_id_fkey 
                FOREIGN KEY (order_id) 
                REFERENCES subscription_orders(id) 
                ON DELETE CASCADE
            `);
            console.log('✓ Added foreign key: subscriptions_order_id_fkey -> subscription_orders.id');
        }
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to fix subscriptions foreign key', error);
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixForeignKey();

