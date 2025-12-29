const { query } = require('../config/database');
const logger = require('../config/logger');

async function retryFailedEmails() {
    try {
        logger.info('Resetting failed emails for retry...');
        
        const result = await query(`
            UPDATE email_queue 
            SET status = 'PENDING', 
                retry_count = 0, 
                error_message = NULL,
                updated_at = NOW()
            WHERE status = 'FAILED'
            RETURNING id, type, recipient
        `);
        
        console.log(`\n✅ Reset ${result.rows.length} failed email(s) for retry:\n`);
        
        result.rows.forEach(email => {
            console.log(`  - ID ${email.id}: ${email.type} to ${email.recipient}`);
        });
        
        console.log('\n✅ Emails will be reprocessed automatically by the queue.');
        console.log('   Check the logs to monitor progress.');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to retry emails', error);
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    retryFailedEmails();
}


