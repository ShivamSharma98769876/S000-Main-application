const logger = require('../config/logger');
const { query } = require('../config/database');

/**
 * Monitoring Service
 * Tracks errors, performance metrics, and system health
 */

class MonitoringService {
    constructor() {
        this.metrics = {
            requests: 0,
            errors: 0,
            startTime: Date.now()
        };
        this.errorBuffer = [];
        this.performanceBuffer = [];
        this.maxBufferSize = 100;
    }

    /**
     * Track an error
     */
    trackError(error, context = {}) {
        const errorData = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            timestamp: new Date().toISOString(),
            context: {
                url: context.url,
                method: context.method,
                userId: context.userId,
                ip: context.ip,
                userAgent: context.userAgent,
                ...context
            }
        };

        // Log to Winston
        logger.logError(error, context);

        // Add to buffer
        this.errorBuffer.push(errorData);
        if (this.errorBuffer.length > this.maxBufferSize) {
            this.errorBuffer.shift();
        }

        // Increment error counter
        this.metrics.errors++;

        // Save to database for persistent tracking
        this.saveErrorToDatabase(errorData).catch(err => {
            logger.error('Failed to save error to database', err);
        });

        return errorData;
    }

    /**
     * Save error to database
     */
    async saveErrorToDatabase(errorData) {
        try {
            await query(
                `INSERT INTO error_logs (message, stack, error_name, error_code, context, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [
                    errorData.message,
                    errorData.stack,
                    errorData.name,
                    errorData.code || null,
                    JSON.stringify(errorData.context)
                ]
            );
        } catch (error) {
            // Don't let database errors break error tracking
            logger.error('Error saving to error_logs table', error);
        }
    }

    /**
     * Track performance metric
     */
    trackPerformance(operation, duration, metadata = {}) {
        const perfData = {
            operation,
            duration,
            timestamp: new Date().toISOString(),
            metadata
        };

        // Log if duration exceeds threshold (500ms)
        if (duration > 500) {
            logger.warn('Slow Operation Detected', perfData);
        } else {
            logger.logPerformance(operation, duration, metadata);
        }

        // Add to buffer
        this.performanceBuffer.push(perfData);
        if (this.performanceBuffer.length > this.maxBufferSize) {
            this.performanceBuffer.shift();
        }

        // Save to database
        this.savePerformanceToDatabase(perfData).catch(err => {
            logger.error('Failed to save performance data', err);
        });
    }

    /**
     * Save performance metric to database
     */
    async savePerformanceToDatabase(perfData) {
        try {
            await query(
                `INSERT INTO performance_metrics (operation, duration, metadata, created_at)
                 VALUES ($1, $2, $3, NOW())`,
                [perfData.operation, perfData.duration, JSON.stringify(perfData.metadata)]
            );
        } catch (error) {
            // Handle duplicate key errors by fixing sequence
            if (error.code === '23505' && error.message.includes('performance_metrics_pkey')) {
                logger.warn('Performance metrics sequence out of sync, attempting to fix...');
                try {
                    // Get current max ID and reset sequence
                    const maxIdResult = await query(`
                        SELECT COALESCE(MAX(id), 0) as max_id 
                        FROM performance_metrics
                    `);
                    const maxId = parseInt(maxIdResult.rows[0].max_id) || 0;
                    await query(`SELECT setval('performance_metrics_id_seq', $1, false)`, [maxId + 1]);
                    logger.info('Performance metrics sequence fixed');
                    
                    // Retry the insert
                    await query(
                        `INSERT INTO performance_metrics (operation, duration, metadata, created_at)
                         VALUES ($1, $2, $3, NOW())`,
                        [perfData.operation, perfData.duration, JSON.stringify(perfData.metadata)]
                    );
                } catch (fixError) {
                    logger.error('Failed to fix performance metrics sequence', fixError);
                }
            } else {
                // Silent fail for other errors (performance metrics are non-critical)
                logger.debug('Failed to save performance metric', { error: error.message });
            }
        }
    }

    /**
     * Track request
     */
    trackRequest() {
        this.metrics.requests++;
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit = 10) {
        return this.errorBuffer.slice(-limit);
    }

    /**
     * Get recent performance metrics
     */
    getRecentPerformance(limit = 10) {
        return this.performanceBuffer.slice(-limit);
    }

    /**
     * Get system metrics
     */
    async getSystemMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);

        // Get database metrics
        let dbMetrics = {};
        try {
            const dbStats = await query('SELECT pg_database_size(current_database()) as size');
            const tableStats = await query(`
                SELECT COUNT(*) as table_count 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            
            dbMetrics = {
                size: parseInt(dbStats.rows[0]?.size || 0),
                tableCount: parseInt(tableStats.rows[0]?.table_count || 0)
            };
        } catch (error) {
            logger.error('Failed to get database metrics', error);
        }

        // Get error statistics
        let errorStats = {};
        try {
            const last24h = await query(
                `SELECT COUNT(*) as count 
                 FROM error_logs 
                 WHERE created_at > NOW() - INTERVAL '24 hours'`
            );
            const last1h = await query(
                `SELECT COUNT(*) as count 
                 FROM error_logs 
                 WHERE created_at > NOW() - INTERVAL '1 hour'`
            );
            
            errorStats = {
                last24Hours: parseInt(last24h.rows[0]?.count || 0),
                lastHour: parseInt(last1h.rows[0]?.count || 0)
            };
        } catch (error) {
            logger.error('Failed to get error statistics', error);
        }

        // Get email queue metrics
        let emailMetrics = {};
        try {
            const emailStats = await query(
                `SELECT status, COUNT(*) as count 
                 FROM email_queue 
                 GROUP BY status`
            );
            
            emailMetrics = emailStats.rows.reduce((acc, row) => {
                acc[row.status.toLowerCase()] = parseInt(row.count);
                return acc;
            }, { pending: 0, sent: 0, failed: 0 });
        } catch (error) {
            logger.error('Failed to get email metrics', error);
        }

        return {
            uptime: {
                milliseconds: uptime,
                hours: uptimeHours,
                startTime: new Date(this.metrics.startTime).toISOString()
            },
            requests: {
                total: this.metrics.requests,
                averagePerMinute: (this.metrics.requests / (uptime / 60000)).toFixed(2)
            },
            errors: {
                total: this.metrics.errors,
                recent: errorStats,
                errorRate: ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2) + '%'
            },
            database: dbMetrics,
            email: emailMetrics,
            memory: {
                used: process.memoryUsage().heapUsed,
                total: process.memoryUsage().heapTotal,
                external: process.memoryUsage().external
            },
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                nodeVersion: process.version
            }
        };
    }

    /**
     * Get health status
     */
    async getHealthStatus() {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // Database health check
        try {
            await query('SELECT 1');
            health.checks.database = { status: 'healthy', message: 'Connected' };
        } catch (error) {
            health.checks.database = { status: 'unhealthy', message: error.message };
            health.status = 'unhealthy';
        }

        // Email queue health check
        try {
            const pending = await query(
                `SELECT COUNT(*) as count 
                 FROM email_queue 
                 WHERE status = 'PENDING' AND retry_count >= 3`
            );
            
            const stuckCount = parseInt(pending.rows[0]?.count || 0);
            if (stuckCount > 10) {
                health.checks.emailQueue = { 
                    status: 'degraded', 
                    message: `${stuckCount} emails stuck in queue` 
                };
                if (health.status === 'healthy') health.status = 'degraded';
            } else {
                health.checks.emailQueue = { status: 'healthy', message: 'Processing normally' };
            }
        } catch (error) {
            health.checks.emailQueue = { status: 'unhealthy', message: error.message };
            health.status = 'unhealthy';
        }

        // Memory health check
        const memUsage = process.memoryUsage();
        const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        if (memPercent > 90) {
            health.checks.memory = { 
                status: 'critical', 
                message: `Memory usage at ${memPercent.toFixed(1)}%` 
            };
            health.status = 'critical';
        } else if (memPercent > 75) {
            health.checks.memory = { 
                status: 'warning', 
                message: `Memory usage at ${memPercent.toFixed(1)}%` 
            };
            if (health.status === 'healthy') health.status = 'degraded';
        } else {
            health.checks.memory = { status: 'healthy', message: `Memory usage at ${memPercent.toFixed(1)}%` };
        }

        // Error rate check
        const errorRate = (this.metrics.errors / Math.max(this.metrics.requests, 1)) * 100;
        if (errorRate > 10) {
            health.checks.errorRate = { 
                status: 'critical', 
                message: `Error rate at ${errorRate.toFixed(2)}%` 
            };
            health.status = 'critical';
        } else if (errorRate > 5) {
            health.checks.errorRate = { 
                status: 'warning', 
                message: `Error rate at ${errorRate.toFixed(2)}%` 
            };
            if (health.status === 'healthy') health.status = 'degraded';
        } else {
            health.checks.errorRate = { status: 'healthy', message: `Error rate at ${errorRate.toFixed(2)}%` };
        }

        return health;
    }

    /**
     * Clear old metrics from database
     */
    async cleanupOldMetrics(daysToKeep = 30) {
        try {
            const errorResult = await query(
                `DELETE FROM error_logs 
                 WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
                 RETURNING id`
            );
            
            const perfResult = await query(
                `DELETE FROM performance_metrics 
                 WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
                 RETURNING id`
            );
            
            logger.info('Cleaned up old metrics', {
                errorsDeleted: errorResult.rows.length,
                performanceDeleted: perfResult.rows.length
            });
            
            return {
                errorsDeleted: errorResult.rows.length,
                performanceDeleted: perfResult.rows.length
            };
        } catch (error) {
            logger.error('Failed to cleanup old metrics', error);
            throw error;
        }
    }
}

// Singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;


