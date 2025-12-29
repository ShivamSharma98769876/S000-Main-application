const monitoringService = require('../services/monitoring.service');
const logger = require('../config/logger');

/**
 * Performance Monitoring Middleware
 * Tracks response times and slow endpoints
 */

const performanceMonitor = (req, res, next) => {
    const startTime = Date.now();
    
    // Track request
    monitoringService.trackRequest();
    
    // Capture original end function
    const originalEnd = res.end;
    const originalJson = res.json;
    
    // Override res.end to capture response time
    res.end = function(...args) {
        const duration = Date.now() - startTime;
        
        // Track performance
        monitoringService.trackPerformance(
            `${req.method} ${req.route?.path || req.path}`,
            duration,
            {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                userId: req.user?.id,
                ip: req.ip
            }
        );
        
        // Log slow requests (> 1 second)
        if (duration > 1000) {
            logger.warn('Slow Request Detected', {
                method: req.method,
                url: req.originalUrl,
                duration: `${duration}ms`,
                statusCode: res.statusCode,
                userId: req.user?.id
            });
        }
        
        // Call original end
        originalEnd.apply(res, args);
    };
    
    // Also override res.json
    res.json = function(...args) {
        const duration = Date.now() - startTime;
        
        monitoringService.trackPerformance(
            `${req.method} ${req.route?.path || req.path}`,
            duration,
            {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                userId: req.user?.id,
                ip: req.ip
            }
        );
        
        originalJson.apply(res, args);
    };
    
    // Handle errors
    res.on('error', (error) => {
        monitoringService.trackError(error, {
            url: req.originalUrl,
            method: req.method,
            userId: req.user?.id,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    });
    
    next();
};

/**
 * Database Query Performance Tracker
 * Wraps database queries to track performance
 */
const trackQuery = async (queryFn, queryText, params) => {
    const startTime = Date.now();
    
    try {
        const result = await queryFn(queryText, params);
        const duration = Date.now() - startTime;
        
        // Log slow queries (> 500ms)
        if (duration > 500) {
            logger.warn('Slow Database Query', {
                duration: `${duration}ms`,
                query: queryText.substring(0, 100) + '...',
                rowCount: result.rows?.length
            });
        }
        
        // Track performance
        monitoringService.trackPerformance(
            'database_query',
            duration,
            {
                queryType: queryText.split(' ')[0].toUpperCase(),
                rowCount: result.rows?.length
            }
        );
        
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // Track failed query
        logger.error('Database Query Failed', {
            duration: `${duration}ms`,
            query: queryText.substring(0, 100) + '...',
            error: error.message
        });
        
        throw error;
    }
};

module.exports = {
    performanceMonitor,
    trackQuery
};


