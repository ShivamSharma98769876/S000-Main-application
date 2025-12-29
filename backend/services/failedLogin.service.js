const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Failed Login Tracking Service
 * Monitors and alerts on suspicious login attempts
 */

class FailedLoginService {
    constructor() {
        this.thresholds = {
            perIP: 5,           // Max failed attempts per IP in time window
            perEmail: 3,        // Max failed attempts per email in time window
            timeWindow: 3600000 // 1 hour in milliseconds
        };
    }

    /**
     * Track a failed login attempt
     */
    async trackFailedLogin(email, provider, ip, userAgent, reason) {
        try {
            // Save to database
            await query(
                `INSERT INTO failed_login_attempts (email, provider, ip_address, user_agent, reason, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [email || null, provider, ip, userAgent, reason]
            );

            logger.logSecurityEvent('FAILED_LOGIN', {
                email,
                provider,
                ip,
                reason
            });

            // Check if we need to create alerts
            await this.checkForAlerts(email, ip);

        } catch (error) {
            logger.error('Error tracking failed login', error);
        }
    }

    /**
     * Check if failed login patterns warrant an alert
     */
    async checkForAlerts(email, ip) {
        const oneHourAgo = new Date(Date.now() - this.thresholds.timeWindow);

        // Check IP-based threshold
        if (ip) {
            const ipCount = await query(
                `SELECT COUNT(*) as count 
                 FROM failed_login_attempts 
                 WHERE ip_address = $1 AND created_at > $2`,
                [ip, oneHourAgo]
            );

            const ipAttempts = parseInt(ipCount.rows[0].count);
            
            if (ipAttempts >= this.thresholds.perIP) {
                await this.createAlert('BRUTE_FORCE_IP', 'HIGH', 
                    `${ipAttempts} failed login attempts from IP ${ip} in the last hour`,
                    { ip, attempts: ipAttempts }
                );
            }
        }

        // Check email-based threshold
        if (email) {
            const emailCount = await query(
                `SELECT COUNT(*) as count 
                 FROM failed_login_attempts 
                 WHERE email = $1 AND created_at > $2`,
                [email, oneHourAgo]
            );

            const emailAttempts = parseInt(emailCount.rows[0].count);
            
            if (emailAttempts >= this.thresholds.perEmail) {
                await this.createAlert('BRUTE_FORCE_EMAIL', 'MEDIUM', 
                    `${emailAttempts} failed login attempts for email ${email} in the last hour`,
                    { email, attempts: emailAttempts }
                );
            }
        }
    }

    /**
     * Create a system alert
     */
    async createAlert(alertType, severity, message, metadata) {
        try {
            // Check if similar alert already exists and is unresolved
            const existing = await query(
                `SELECT id FROM system_alerts 
                 WHERE alert_type = $1 
                 AND resolved = FALSE 
                 AND created_at > NOW() - INTERVAL '1 hour'
                 LIMIT 1`,
                [alertType]
            );

            // Don't create duplicate alerts
            if (existing.rows.length > 0) {
                return;
            }

            await query(
                `INSERT INTO system_alerts (alert_type, severity, message, metadata, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [alertType, severity, message, JSON.stringify(metadata)]
            );

            logger.warn('System Alert Created', {
                alertType,
                severity,
                message,
                metadata
            });

            // TODO: Send notification to admins (email, Slack, etc.)
            
        } catch (error) {
            logger.error('Error creating alert', error);
        }
    }

    /**
     * Check if IP is blocked
     */
    async isIPBlocked(ip) {
        const fifteenMinutesAgo = new Date(Date.now() - 900000); // 15 minutes

        const result = await query(
            `SELECT COUNT(*) as count 
             FROM failed_login_attempts 
             WHERE ip_address = $1 AND created_at > $2`,
            [ip, fifteenMinutesAgo]
        );

        const attempts = parseInt(result.rows[0].count);
        
        // Block if more than 10 attempts in 15 minutes
        return attempts >= 10;
    }

    /**
     * Get failed login statistics
     */
    async getStatistics(hours = 24) {
        try {
            const stats = await query(`
                SELECT 
                    COUNT(*) as total_attempts,
                    COUNT(DISTINCT ip_address) as unique_ips,
                    COUNT(DISTINCT email) as unique_emails,
                    COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
                    COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24_hours
                FROM failed_login_attempts
                WHERE created_at > NOW() - INTERVAL '${hours} hours'
            `);

            const topIPs = await query(`
                SELECT ip_address, COUNT(*) as attempts
                FROM failed_login_attempts
                WHERE created_at > NOW() - INTERVAL '${hours} hours'
                GROUP BY ip_address
                ORDER BY attempts DESC
                LIMIT 10
            `);

            const topEmails = await query(`
                SELECT email, COUNT(*) as attempts
                FROM failed_login_attempts
                WHERE created_at > NOW() - INTERVAL '${hours} hours'
                AND email IS NOT NULL
                GROUP BY email
                ORDER BY attempts DESC
                LIMIT 10
            `);

            return {
                summary: stats.rows[0],
                topIPs: topIPs.rows,
                topEmails: topEmails.rows
            };
        } catch (error) {
            logger.error('Error getting failed login statistics', error);
            throw error;
        }
    }
}

// Singleton instance
const failedLoginService = new FailedLoginService();

module.exports = failedLoginService;


