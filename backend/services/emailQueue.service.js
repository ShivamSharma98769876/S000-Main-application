const { query } = require('../config/database');
const logger = require('../config/logger');
const emailService = require('./email.service');

/**
 * Email Queue Service
 * Provides reliable email delivery with retry logic and failure handling
 */

class EmailQueue {
    constructor() {
        this.processing = false;
        this.retryDelay = 5000; // 5 seconds
        this.maxRetries = 3;
    }

    /**
     * Add email to queue
     */
    async addToQueue(type, recipient, data, priority = 'NORMAL') {
        try {
            const result = await query(
                `INSERT INTO email_queue (type, recipient, data, priority, status, retry_count, created_at)
                 VALUES ($1, $2, $3, $4, $5, 0, NOW())
                 RETURNING id`,
                [type, recipient, JSON.stringify(data), priority, 'PENDING']
            );
            
            logger.info('Email added to queue', { 
                queueId: result.rows[0].id, 
                type, 
                recipient 
            });
            
            // Trigger processing if not already running
            if (!this.processing) {
                this.processQueue();
            }
            
            return result.rows[0].id;
        } catch (error) {
            logger.error('Error adding email to queue', error);
            throw error;
        }
    }

    /**
     * Process queued emails
     */
    async processQueue() {
        if (this.processing) {
            return;
        }

        this.processing = true;
        logger.info('Email queue processing started');

        try {
            while (true) {
                // Get next pending email (ordered by priority and creation time)
                let result;
                try {
                    result = await query(
                        `SELECT * FROM email_queue 
                         WHERE status = 'PENDING' AND retry_count < $1
                         ORDER BY 
                            CASE priority 
                                WHEN 'HIGH' THEN 1 
                                WHEN 'NORMAL' THEN 2 
                                WHEN 'LOW' THEN 3 
                            END,
                            created_at ASC
                         LIMIT 1`,
                        [this.maxRetries]
                    );
                } catch (dbError) {
                    // Handle database connection errors gracefully
                    if (dbError.message.includes('timeout') || 
                        dbError.message.includes('ECONNRESET') ||
                        dbError.message.includes('Connection terminated')) {
                        logger.warn('Database connection timeout during email queue processing - will retry on next cycle', {
                            error: dbError.message
                        });
                        break; // Exit gracefully, will retry on next interval
                    }
                    throw dbError; // Re-throw other errors
                }

                if (result.rows.length === 0) {
                    // No more emails to process
                    break;
                }

                const emailJob = result.rows[0];
                await this.processEmail(emailJob);
                
                // Small delay between emails to avoid overwhelming the email service
                await this.sleep(1000);
            }
        } catch (error) {
            // Only log as error if it's not a connection timeout (already handled above)
            if (!error.message.includes('timeout') && 
                !error.message.includes('ECONNRESET') &&
                !error.message.includes('Connection terminated')) {
                logger.error('Error processing email queue', error);
            }
        } finally {
            this.processing = false;
            logger.info('Email queue processing completed');
        }
    }

    /**
     * Process a single email
     */
    async processEmail(emailJob) {
        const { id, type, recipient, data, retry_count } = emailJob;
        
        try {
            logger.info('Processing email', { queueId: id, type, recipient });
            
            // Parse data (handle both string and already-parsed object)
            let emailData;
            if (typeof data === 'string') {
                emailData = JSON.parse(data);
            } else {
                emailData = data;
            }
            
            // Send email based on type
            let result;
            switch (type) {
                case 'PAYMENT_RECEIVED':
                    result = await emailService.sendPaymentReceivedEmail(
                        recipient,
                        emailData.userName,
                        emailData.orderId,
                        emailData.amount
                    );
                    break;
                    
                case 'ADMIN_NEW_ORDER':
                    result = await emailService.sendAdminNewOrderEmail(
                        emailData.orderId,
                        emailData.userName,
                        emailData.userEmail,
                        emailData.amount,
                        emailData.itemCount
                    );
                    break;
                    
                case 'ORDER_APPROVED':
                    result = await emailService.sendOrderApprovedEmail(
                        recipient,
                        emailData.userName,
                        emailData.orderId,
                        emailData.subscriptions
                    );
                    break;
                    
                case 'ORDER_REJECTED':
                    result = await emailService.sendOrderRejectedEmail(
                        recipient,
                        emailData.userName,
                        emailData.orderId,
                        emailData.reason
                    );
                    break;
                    
                default:
                    throw new Error(`Unknown email type: ${type}`);
            }
            
            // Mark as sent
            await query(
                `UPDATE email_queue 
                 SET status = 'SENT', sent_at = NOW(), updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );
            
            logger.info('Email sent successfully', { queueId: id, type, recipient });
            
        } catch (error) {
            // Extract error message properly
            const errorMessage = error.message || error.toString() || 'Unknown error';
            logger.error('Error sending email', { queueId: id, error: errorMessage, stack: error.stack });
            
            // Increment retry count
            const newRetryCount = retry_count + 1;
            
            if (newRetryCount >= this.maxRetries) {
                // Max retries reached, mark as failed
                await query(
                    `UPDATE email_queue 
                     SET status = 'FAILED', retry_count = $1, error_message = $2, updated_at = NOW()
                     WHERE id = $3`,
                    [newRetryCount, errorMessage, id]
                );
                
                logger.error('Email failed after max retries', { queueId: id, type, recipient, error: errorMessage });
            } else {
                // Increment retry count and schedule for retry
                await query(
                    `UPDATE email_queue 
                     SET retry_count = $1, error_message = $2, updated_at = NOW()
                     WHERE id = $3`,
                    [newRetryCount, errorMessage, id]
                );
                
                logger.warn('Email will be retried', { 
                    queueId: id, 
                    retryCount: newRetryCount,
                    maxRetries: this.maxRetries,
                    error: errorMessage
                });
            }
        }
    }

    /**
     * Retry failed emails
     */
    async retryFailed() {
        try {
            const result = await query(
                `UPDATE email_queue 
                 SET status = 'PENDING', retry_count = 0, error_message = NULL, updated_at = NOW()
                 WHERE status = 'FAILED'
                 RETURNING id`,
                []
            );
            
            logger.info(`Reset ${result.rows.length} failed emails for retry`);
            
            if (result.rows.length > 0) {
                this.processQueue();
            }
            
            return result.rows.length;
        } catch (error) {
            logger.error('Error retrying failed emails', error);
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        try {
            const result = await query(
                `SELECT 
                    status,
                    COUNT(*) as count
                 FROM email_queue
                 GROUP BY status`,
                []
            );
            
            const stats = {
                pending: 0,
                sent: 0,
                failed: 0,
                total: 0
            };
            
            result.rows.forEach(row => {
                stats[row.status.toLowerCase()] = parseInt(row.count);
                stats.total += parseInt(row.count);
            });
            
            return stats;
        } catch (error) {
            logger.error('Error getting queue stats', error);
            throw error;
        }
    }

    /**
     * Clean up old sent emails (older than 30 days)
     */
    async cleanup(daysToKeep = 30) {
        try {
            const result = await query(
                `DELETE FROM email_queue 
                 WHERE status = 'SENT' 
                 AND sent_at < NOW() - INTERVAL '${daysToKeep} days'
                 RETURNING id`,
                []
            );
            
            logger.info(`Cleaned up ${result.rows.length} old emails from queue`);
            return result.rows.length;
        } catch (error) {
            logger.error('Error cleaning up email queue', error);
            throw error;
        }
    }

    /**
     * Helper: Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
const emailQueue = new EmailQueue();

// Auto-process queue every 30 seconds
setInterval(() => {
    if (!emailQueue.processing) {
        emailQueue.processQueue().catch(err => {
            logger.error('Error in scheduled queue processing', err);
        });
    }
}, 30000);

module.exports = emailQueue;


