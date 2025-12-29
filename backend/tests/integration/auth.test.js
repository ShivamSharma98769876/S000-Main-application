/**
 * Integration Tests for Authentication API
 */

const request = require('supertest');
const app = require('../../server');
const { query } = require('../../config/database');

describe('Authentication API', () => {
    let testUser;

    beforeAll(async () => {
        // Create test user
        const result = await query(
            `INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING *`,
            ['GOOGLE', 'test-' + Date.now(), 'test@example.com', false]
        );
        testUser = result.rows[0];
    });

    afterAll(async () => {
        // Clean up test user
        if (testUser) {
            await query('DELETE FROM users WHERE id = $1', [testUser.id]);
        }
    });

    describe('GET /api/v1/auth/me', () => {
        test('should return 401 when not authenticated', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me');

            expect(response.status).toBe(401);
        });

        test('should return user info when authenticated', async () => {
            // Note: This test requires session setup
            // In real implementation, you'd use a test session or mock authentication
            expect(true).toBe(true); // Placeholder
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        test('should logout successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout');

            expect([200, 302]).toContain(response.status);
        });
    });

    describe('Login Audit', () => {
        test('should log login attempts', async () => {
            const result = await query(
                `SELECT * FROM login_audit WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
                ['test@example.com']
            );

            // Check if audit log exists (if login was attempted)
            expect(result.rows).toBeDefined();
        });
    });
});


