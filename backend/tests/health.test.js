const request = require('supertest');
const express = require('express');
const healthRoutes = require('../routes/health.routes');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/v1', healthRoutes);

describe('Health Check Endpoints', () => {
    describe('GET /api/v1/health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/v1/health')
                .expect('Content-Type', /json/);
            
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body.status).toBe('healthy');
        });
    });

    describe('GET /api/v1/live', () => {
        it('should return liveness status', async () => {
            const response = await request(app)
                .get('/api/v1/live')
                .expect(200)
                .expect('Content-Type', /json/);
            
            expect(response.body.status).toBe('alive');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });

    describe('GET /api/v1/version', () => {
        it('should return version information', async () => {
            const response = await request(app)
                .get('/api/v1/version')
                .expect(200)
                .expect('Content-Type', /json/);
            
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('nodeVersion');
            expect(response.body).toHaveProperty('platform');
        });
    });

    describe('GET /api/v1/metrics', () => {
        it('should return system metrics', async () => {
            const response = await request(app)
                .get('/api/v1/metrics')
                .expect(200)
                .expect('Content-Type', /json/);
            
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('memory');
            expect(response.body.memory).toHaveProperty('heapUsed');
            expect(response.body.memory).toHaveProperty('heapTotal');
        });
    });
});


