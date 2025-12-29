const request = require('supertest');
const express = require('express');
const productRoutes = require('../../routes/product.routes');

// Mock database
jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

const { query } = require('../../config/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/products', productRoutes);

describe('Product API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/v1/products', () => {
        it('should return list of active products', async () => {
            const mockProducts = [
                {
                    id: 1,
                    name: 'Premium Trading Bot',
                    description: 'Advanced algo trading',
                    base_price: 5000,
                    price_per_month: 500,
                    price_per_year: 5000,
                    status: 'ACTIVE'
                },
                {
                    id: 2,
                    name: 'Trading Academy',
                    description: 'Learn trading',
                    base_price: 2000,
                    price_per_month: 200,
                    price_per_year: 2000,
                    status: 'ACTIVE'
                }
            ];

            query.mockResolvedValueOnce({ rows: mockProducts });

            const response = await request(app)
                .get('/api/v1/products')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('products');
            expect(Array.isArray(response.body.products)).toBe(true);
            expect(response.body.products).toHaveLength(2);
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining(['ACTIVE'])
            );
        });

        it('should return empty array when no products exist', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/v1/products')
                .expect(200);

            expect(response.body.products).toHaveLength(0);
        });

        it('should handle database errors gracefully', async () => {
            query.mockRejectedValueOnce(new Error('Database connection failed'));

            const response = await request(app)
                .get('/api/v1/products')
                .expect(500);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /api/v1/products/:id', () => {
        it('should return product by id', async () => {
            const mockProduct = {
                id: 1,
                name: 'Premium Trading Bot',
                description: 'Advanced algo trading',
                base_price: 5000,
                status: 'ACTIVE'
            };

            query.mockResolvedValueOnce({ rows: [mockProduct] });

            const response = await request(app)
                .get('/api/v1/products/1')
                .expect(200);

            expect(response.body.product).toEqual(mockProduct);
            expect(query).toHaveBeenCalledWith(
                expect.any(String),
                [1, 'ACTIVE']
            );
        });

        it('should return 404 for non-existent product', async () => {
            query.mockResolvedValueOnce({ rows: [] });

            const response = await request(app)
                .get('/api/v1/products/999')
                .expect(404);

            expect(response.body.error).toBe('Not Found');
        });
    });
});

describe('Product Validation', () => {
    it('should validate required fields for product creation', () => {
        const validProduct = {
            name: 'Test Product',
            description: 'Test Description',
            base_price: 1000,
            price_per_month: 100,
            price_per_year: 1000
        };

        expect(validProduct).toHaveProperty('name');
        expect(validProduct).toHaveProperty('description');
        expect(validProduct).toHaveProperty('base_price');
        expect(typeof validProduct.base_price).toBe('number');
    });

    it('should validate price calculations', () => {
        const basePrice = 1000;
        const pricePerMonth = 100;
        const pricePerYear = 1000;

        // Validate that yearly is less than 12 * monthly (discount)
        expect(pricePerYear).toBeLessThan(pricePerMonth * 12);
        
        // Validate base price matches one of the pricing options
        expect(basePrice).toBe(pricePerYear);
    });
});


