const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoring.service');
const { query } = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * Monitoring and Metrics Routes
 * Admin-only endpoints for system monitoring
 */

// Get system health status
router.get('/health', async (req, res) => {
    try {
        const health = await monitoringService.getHealthStatus();
        
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
    } catch (error) {
        logger.error('Error getting health status', error);
        res.status(503).json({
            status: 'error',
            message: 'Failed to check health status',
            error: error.message
        });
    }
});

// Get system metrics (admin only)
router.get('/metrics', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const metrics = await monitoringService.getSystemMetrics();
        res.json({ metrics });
    } catch (error) {
        logger.error('Error getting system metrics', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get system metrics'
        });
    }
});

// Get recent errors (admin only)
router.get('/errors/recent', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const result = await query(
            `SELECT * FROM error_logs 
             ORDER BY created_at DESC 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        
        const countResult = await query('SELECT COUNT(*) FROM error_logs');
        const totalCount = parseInt(countResult.rows[0].count);
        
        res.json({
            errors: result.rows,
            pagination: {
                limit,
                offset,
                totalCount,
                hasMore: (offset + limit) < totalCount
            }
        });
    } catch (error) {
        logger.error('Error fetching recent errors', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch errors'
        });
    }
});

// Get error statistics (admin only)
router.get('/errors/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(*) as total_errors,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24_hours,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days
            FROM error_logs
        `);
        
        const topErrors = await query(`
            SELECT error_name, COUNT(*) as count
            FROM error_logs
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY error_name
            ORDER BY count DESC
            LIMIT 10
        `);
        
        res.json({
            statistics: stats.rows[0],
            topErrors: topErrors.rows
        });
    } catch (error) {
        logger.error('Error getting error statistics', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get error statistics'
        });
    }
});

// Get performance metrics (admin only)
router.get('/performance', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const operation = req.query.operation;
        
        let queryText = `
            SELECT * FROM performance_metrics 
            WHERE 1=1
        `;
        const params = [];
        
        if (operation) {
            params.push(operation);
            queryText += ` AND operation = $${params.length}`;
        }
        
        queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        
        const result = await query(queryText, params);
        
        // Get average duration by operation
        const avgDuration = await query(`
            SELECT operation, AVG(duration) as avg_duration, COUNT(*) as count
            FROM performance_metrics
            WHERE created_at > NOW() - INTERVAL '1 hour'
            GROUP BY operation
            ORDER BY avg_duration DESC
            LIMIT 10
        `);
        
        res.json({
            recentMetrics: result.rows,
            slowestOperations: avgDuration.rows
        });
    } catch (error) {
        logger.error('Error getting performance metrics', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get performance metrics'
        });
    }
});

// Get failed login attempts (admin only)
router.get('/failed-logins', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const hours = parseInt(req.query.hours) || 24;
        
        const result = await query(
            `SELECT * FROM failed_login_attempts 
             WHERE created_at > NOW() - INTERVAL '${hours} hours'
             ORDER BY created_at DESC 
             LIMIT $1`,
            [limit]
        );
        
        // Get statistics
        const stats = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT ip_address) as unique_ips,
                COUNT(DISTINCT email) as unique_emails
            FROM failed_login_attempts
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        
        // Get top failed IPs
        const topIps = await query(`
            SELECT ip_address, COUNT(*) as count
            FROM failed_login_attempts
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY ip_address
            ORDER BY count DESC
            LIMIT 10
        `);
        
        res.json({
            failedAttempts: result.rows,
            statistics: stats.rows[0],
            topFailedIPs: topIps.rows
        });
    } catch (error) {
        logger.error('Error getting failed login attempts', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get failed login attempts'
        });
    }
});

// Get system alerts (admin only)
router.get('/alerts', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const resolved = req.query.resolved === 'true';
        
        const result = await query(
            `SELECT * FROM system_alerts 
             WHERE resolved = $1
             ORDER BY created_at DESC 
             LIMIT 100`,
            [resolved]
        );
        
        res.json({
            alerts: result.rows
        });
    } catch (error) {
        logger.error('Error getting system alerts', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get system alerts'
        });
    }
});

// Resolve an alert (admin only)
router.post('/alerts/:id/resolve', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `UPDATE system_alerts 
             SET resolved = TRUE, resolved_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Alert not found'
            });
        }
        
        logger.info('Alert resolved', { alertId: id, adminId: req.user.id });
        
        res.json({
            message: 'Alert resolved successfully',
            alert: result.rows[0]
        });
    } catch (error) {
        logger.error('Error resolving alert', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to resolve alert'
        });
    }
});

// Cleanup old monitoring data (admin only)
router.post('/cleanup', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const daysToKeep = parseInt(req.body.daysToKeep) || 30;
        
        const result = await monitoringService.cleanupOldMetrics(daysToKeep);
        
        logger.info('Monitoring data cleaned up', { 
            daysToKeep,
            adminId: req.user.id,
            ...result
        });
        
        res.json({
            message: 'Cleanup completed successfully',
            ...result
        });
    } catch (error) {
        logger.error('Error cleaning up monitoring data', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to cleanup monitoring data'
        });
    }
});

// Email delivery monitoring (admin only)
router.get('/email-delivery', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        
        // Get email statistics
        const stats = await query(`
            SELECT 
                status,
                COUNT(*) as count,
                AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_delivery_time
            FROM email_queue
            WHERE created_at > NOW() - INTERVAL '${hours} hours'
            GROUP BY status
        `);
        
        // Get recent failures
        const failures = await query(`
            SELECT * FROM email_queue
            WHERE status = 'FAILED'
            AND created_at > NOW() - INTERVAL '${hours} hours'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        // Get email types statistics
        const types = await query(`
            SELECT type, COUNT(*) as count
            FROM email_queue
            WHERE created_at > NOW() - INTERVAL '${hours} hours'
            GROUP BY type
            ORDER BY count DESC
        `);
        
        res.json({
            statistics: stats.rows,
            recentFailures: failures.rows,
            byType: types.rows
        });
    } catch (error) {
        logger.error('Error getting email delivery metrics', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to get email delivery metrics'
        });
    }
});

module.exports = router;


