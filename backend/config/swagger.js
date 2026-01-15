const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'StockSage API Documentation',
            version: '1.0.0',
            description: 'Complete API documentation for StockSage - Trading Subscription Platform',
            contact: {
                name: 'StockSage Support',
                email: 'info@StockSage.trade'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production' 
                    ? (process.env.API_BASE_URL || `https://${process.env.WEBSITE_SITE_NAME || 'your-app'}.azurewebsites.net`)
                    : `http://localhost:${process.env.PORT || 3000}`,
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'connect.sid',
                    description: 'Session cookie for authentication'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        oauth_provider: { type: 'string', example: 'google' },
                        oauth_id: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        is_admin: { type: 'boolean', default: false },
                        has_completed_profile: { type: 'boolean', default: false },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Product: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        base_price: { type: 'number', format: 'decimal' },
                        price_per_month: { type: 'number', format: 'decimal' },
                        price_per_year: { type: 'number', format: 'decimal' },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Order: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        user_id: { type: 'integer' },
                        product_id: { type: 'integer' },
                        duration_value: { type: 'integer' },
                        duration_unit: { type: 'string', enum: ['MONTH', 'YEAR'] },
                        total_amount: { type: 'number', format: 'decimal' },
                        payment_proof_path: { type: 'string' },
                        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
                        rejection_reason: { type: 'string', nullable: true },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                Offer: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        discount_text: { type: 'string' },
                        badge_text: { type: 'string', nullable: true },
                        validity_text: { type: 'string', nullable: true },
                        cta_text: { type: 'string' },
                        cta_link: { type: 'string', nullable: true },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
                        display_order: { type: 'integer' }
                    }
                },
                Testimonial: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        author_name: { type: 'string' },
                        author_role: { type: 'string' },
                        author_initials: { type: 'string' },
                        content: { type: 'string' },
                        rating: { type: 'integer', minimum: 1, maximum: 5 },
                        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
                        display_order: { type: 'integer' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            },
            responses: {
                UnauthorizedError: {
                    description: 'Authentication required',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                ForbiddenError: {
                    description: 'Admin privileges required',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                NotFoundError: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                ValidationError: {
                    description: 'Validation failed',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                }
            }
        },
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Users', description: 'User profile management' },
            { name: 'Products', description: 'Product catalog' },
            { name: 'Cart', description: 'Shopping cart operations' },
            { name: 'Orders', description: 'Order management' },
            { name: 'Subscriptions', description: 'Active subscriptions' },
            { name: 'Admin', description: 'Admin operations' },
            { name: 'Content', description: 'Content management' },
            { name: 'Health', description: 'Health and monitoring' }
        ]
    },
    apis: ['./routes/*.js', './server.js'] // Path to files with Swagger annotations
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;


