const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const logger = require('../config/logger');

// Health check endpoint
router.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    };

    try {
        // Check database connection
        const dbCheck = await query('SELECT 1 as health');
        health.database = dbCheck.rows.length > 0 ? 'connected' : 'disconnected';
    } catch (error) {
        health.database = 'disconnected';
        health.status = 'unhealthy';
        logger.error('Health check: Database connection failed', error);
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    health.memory = {
        used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%'
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Readiness probe
router.get('/ready', async (req, res) => {
    try {
        // Check if database is accessible
        await query('SELECT 1');
        
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Readiness check failed', error);
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Liveness probe
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        };

        // System metrics
        const memUsage = process.memoryUsage();
        metrics.memory = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            rss: memUsage.rss,
            external: memUsage.external
        };

        metrics.cpu = process.cpuUsage();

        // Database metrics
        try {
            const userCount = await query('SELECT COUNT(*) as count FROM users');
            const productCount = await query('SELECT COUNT(*) as count FROM products WHERE status = $1', ['ACTIVE']);
            const orderCount = await query('SELECT COUNT(*) as count FROM orders');
            const pendingOrderCount = await query('SELECT COUNT(*) as count FROM orders WHERE status = $1', ['PENDING']);
            const subscriptionCount = await query('SELECT COUNT(*) as count FROM subscriptions WHERE status = $1', ['ACTIVE']);

            metrics.database = {
                users: parseInt(userCount.rows[0].count),
                activeProducts: parseInt(productCount.rows[0].count),
                totalOrders: parseInt(orderCount.rows[0].count),
                pendingOrders: parseInt(pendingOrderCount.rows[0].count),
                activeSubscriptions: parseInt(subscriptionCount.rows[0].count)
            };
        } catch (error) {
            metrics.database = { error: 'Unable to fetch database metrics' };
            logger.error('Error fetching database metrics', error);
        }

        res.json(metrics);
    } catch (error) {
        logger.error('Error generating metrics', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to generate metrics'
        });
    }
});

// Version endpoint
router.get('/version', (req, res) => {
    res.json({
        version: '1.0.0',
        buildDate: '2025-12-06',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
    });
});

module.exports = router;


