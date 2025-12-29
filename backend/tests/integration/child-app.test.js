const request = require('supertest');
const jwtService = require('../../services/jwt.service');

// Note: This test requires the server to be running or a test server instance
// For full integration testing, you may need to set up a test database

describe('Child App Integration', () => {
    let authCookie;
    let testToken;

    // Note: These tests assume you have a test user and can authenticate
    // You may need to adjust based on your test setup

    beforeAll(async () => {
        // This would need to be adapted to your actual auth setup
        // For now, we'll test the JWT service directly
    });

    describe('JWT Service', () => {
        test('Generate token with valid user data', () => {
            const user = {
                id: 1,
                email: 'test@example.com',
                full_name: 'Test User',
                profile_completed: true
            };

            const token = jwtService.generateToken(user);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });

        test('Token contains correct payload', () => {
            const user = {
                id: 1,
                email: 'test@example.com',
                full_name: 'Test User',
                profile_completed: true
            };

            const token = jwtService.generateToken(user);
            const decoded = jwtService.decodeToken(token);

            expect(decoded.payload.user_id).toBe(user.id);
            expect(decoded.payload.email).toBe(user.email);
            expect(decoded.payload.full_name).toBe(user.full_name);
            expect(decoded.payload.iss).toBe('tradingpro-main-app');
            expect(decoded.payload.aud).toBe('tradingpro-child-app');
        });

        test('Verify valid token', () => {
            const user = {
                id: 1,
                email: 'test@example.com',
                full_name: 'Test User',
                profile_completed: true
            };

            const token = jwtService.generateToken(user);
            const decoded = jwtService.verifyToken(token);

            expect(decoded.user_id).toBe(user.id);
            expect(decoded.email).toBe(user.email);
        });

        test('Reject invalid token', () => {
            const invalidToken = 'invalid.token.here';
            
            expect(() => {
                jwtService.verifyToken(invalidToken);
            }).toThrow();
        });

        test('Refresh token works', () => {
            const user = {
                id: 1,
                email: 'test@example.com',
                full_name: 'Test User',
                profile_completed: true
            };

            const oldToken = jwtService.generateToken(user);
            
            // Wait a moment to ensure different timestamps
            setTimeout(() => {
                const newToken = jwtService.refreshToken(oldToken);
                expect(newToken).toBeDefined();
                expect(newToken).not.toBe(oldToken);
                
                const decoded = jwtService.verifyToken(newToken);
                expect(decoded.user_id).toBe(user.id);
            }, 100);
        });
    });

    describe('Token Endpoints', () => {
        // These tests would require a running server instance
        // Uncomment and adapt when running integration tests

        /*
        test('Generate token endpoint requires authentication', async () => {
            const res = await request(app)
                .get('/api/v1/child-app/generate-token');

            expect(res.status).toBe(401);
        });

        test('Verify token endpoint validates token', async () => {
            const user = {
                id: 1,
                email: 'test@example.com',
                full_name: 'Test User',
                profile_completed: true
            };

            const token = jwtService.generateToken(user);

            const res = await request(app)
                .post('/api/v1/child-app/verify-token')
                .send({ token });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.valid).toBe(true);
        });
        */
    });
});

