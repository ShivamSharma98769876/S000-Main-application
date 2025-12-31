const { db, query } = require('../config/database');
const logger = require('../config/logger');

async function updateUpcomingToActive() {
    try {
        logger.info('Updating UPCOMING subscriptions to ACTIVE...');

        // Get all UPCOMING subscriptions that haven't expired
        const upcomingSubs = await query(
            `SELECT id, start_date, end_date, status 
             FROM subscriptions 
             WHERE status = 'UPCOMING' 
             AND end_date >= date('now')`
        );

        console.log(`Found ${upcomingSubs.rows.length} UPCOMING subscriptions to update`);

        if (upcomingSubs.rows.length === 0) {
            console.log('No UPCOMING subscriptions found that need updating.');
            logger.info('No UPCOMING subscriptions to update');
            return;
        }

        // Update each subscription to ACTIVE
        let updatedCount = 0;
        for (const sub of upcomingSubs.rows) {
            await query(
                `UPDATE subscriptions 
                 SET status = 'ACTIVE', updated_at = datetime('now')
                 WHERE id = $1`,
                [sub.id]
            );
            updatedCount++;
            console.log(`✓ Updated subscription ${sub.id} from UPCOMING to ACTIVE`);
        }

        console.log(`\n✅ Successfully updated ${updatedCount} subscription(s) from UPCOMING to ACTIVE`);
        logger.info(`Updated ${updatedCount} subscriptions from UPCOMING to ACTIVE`);

    } catch (error) {
        logger.error('Failed to update UPCOMING subscriptions', error);
        console.error('❌ Failed to update subscriptions:', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

if (require.main === module) {
    updateUpcomingToActive();
}

module.exports = { updateUpcomingToActive };

