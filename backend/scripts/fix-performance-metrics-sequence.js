/**
 * Fix performance_metrics table sequence issue
 * This script resets the sequence to match the current max ID
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

async function fixSequence() {
    try {
        console.log('Checking performance_metrics table...');
        
        // Get current max ID
        const maxIdResult = await query(`
            SELECT COALESCE(MAX(id), 0) as max_id 
            FROM performance_metrics
        `);
        
        const maxId = parseInt(maxIdResult.rows[0].max_id) || 0;
        console.log(`Current max ID: ${maxId}`);
        
        // Get current sequence value
        const seqResult = await query(`
            SELECT last_value, is_called 
            FROM performance_metrics_id_seq
        `);
        
        const lastValue = parseInt(seqResult.rows[0].last_value);
        const isCalled = seqResult.rows[0].is_called;
        console.log(`Current sequence value: ${lastValue}, is_called: ${isCalled}`);
        
        // Reset sequence to max ID + 1
        const newSeqValue = maxId + 1;
        await query(`
            SELECT setval('performance_metrics_id_seq', $1, false)
        `, [newSeqValue]);
        
        console.log(`✓ Sequence reset to ${newSeqValue}`);
        console.log('✅ Sequence fix completed!');
        
        process.exit(0);
    } catch (error) {
        // If sequence doesn't exist, create it
        if (error.message.includes('does not exist') || error.code === '42P01') {
            console.log('Sequence does not exist, creating it...');
            
            try {
                // Get current max ID
                const maxIdResult = await query(`
                    SELECT COALESCE(MAX(id), 0) as max_id 
                    FROM performance_metrics
                `);
                
                const maxId = parseInt(maxIdResult.rows[0].max_id) || 0;
                const newSeqValue = maxId + 1;
                
                // Create sequence
                await query(`
                    CREATE SEQUENCE IF NOT EXISTS performance_metrics_id_seq
                    START WITH $1
                    OWNED BY performance_metrics.id
                `, [newSeqValue]);
                
                // Set the default for the column
                await query(`
                    ALTER TABLE performance_metrics 
                    ALTER COLUMN id SET DEFAULT nextval('performance_metrics_id_seq')
                `);
                
                console.log(`✓ Created sequence starting at ${newSeqValue}`);
                console.log('✅ Sequence created successfully!');
                
                process.exit(0);
            } catch (createError) {
                console.error('Error creating sequence:', createError.message);
                process.exit(1);
            }
        } else {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
}

fixSequence();

