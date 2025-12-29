const { query } = require('../config/database');

async function migrateEmailQueue() {
    try {
        console.log('Creating email_queue table...');
        
        await query(`
            CREATE TABLE IF NOT EXISTS email_queue (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                recipient VARCHAR(255) NOT NULL,
                data JSONB NOT NULL,
                priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
                status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
                retry_count INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TIMESTAMP NOT NULL,
                sent_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        console.log('Creating indexes for email_queue...');
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_email_queue_status 
            ON email_queue(status);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_email_queue_created_at 
            ON email_queue(created_at);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_email_queue_priority 
            ON email_queue(priority, created_at);
        `);
        
        console.log('✅ Email queue table created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating email queue table:', error);
        process.exit(1);
    }
}

migrateEmailQueue();


