// Test setup file
// This runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-key';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/tradingpro_test';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
    // Mock user for testing
    mockUser: {
        id: 1,
        email: 'test@example.com',
        oauth_provider: 'google',
        oauth_id: 'test123',
        is_admin: false,
        has_completed_profile: true
    },
    
    // Mock admin for testing
    mockAdmin: {
        id: 2,
        email: 'admin@example.com',
        oauth_provider: 'google',
        oauth_id: 'admin123',
        is_admin: true,
        has_completed_profile: true
    },
    
    // Mock product for testing
    mockProduct: {
        id: 1,
        name: 'Test Product',
        description: 'Test Description',
        base_price: 1000.00,
        price_per_month: 100.00,
        price_per_year: 1000.00,
        status: 'ACTIVE'
    }
};

// Cleanup after all tests
afterAll(async () => {
    // Add any cleanup logic here
    // e.g., close database connections
});


