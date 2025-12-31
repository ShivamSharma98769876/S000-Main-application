const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
// Session store - using SQLite since we migrated from PostgreSQL
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const path = require('path');
const fs = require('fs');

// Load environment variables from 'env' file (not '.env')
const envPath = path.join(__dirname, 'env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    // Fallback to default .env if env file doesn't exist
    require('dotenv').config();
}

const { pool } = require('./config/database');
const logger = require('./config/logger');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const adminRoutes = require('./routes/admin.routes');
const adminProductsRoutes = require('./routes/admin-products.routes');
const contentRoutes = require('./routes/content.routes');
const healthRoutes = require('./routes/health.routes');
const bulkRoutes = require('./routes/bulk.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
const insightsRoutes = require('./routes/insights.routes');
const childAppRoutes = require('./routes/child-app.routes');

// Import middleware
const { adminIPWhitelist } = require('./middleware/ipWhitelist');
const { cacheMiddleware } = require('./middleware/cache');
const { csrfToken, csrfProtection, getCsrfToken } = require('./middleware/csrf');
const { 
    securityHeaders, 
    sanitizeInput, 
    sqlInjectionProtection,
    parameterPollutionProtection 
} = require('./middleware/security');
const { performanceMonitor } = require('./middleware/performanceMonitor');
const monitoringService = require('./services/monitoring.service');

// Initialize Express app
const app = express();

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(securityHeaders);

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://127.0.0.1:3000',
            'http://localhost:3000',
            process.env.FRONTEND_URL,
            process.env.CHILD_APP_ALLOWED_ORIGINS,
            'https://*.southindia-01.azurewebsites.net' // Allow all Azure subdomains in this region
        ].filter(Boolean);

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }

        // Check if origin matches any allowed origin
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed.includes('*')) {
                // Handle wildcard patterns
                const pattern = allowed.replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(origin);
            }
            return origin === allowed;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked origin', { origin, allowedOrigins });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization and security
app.use(sanitizeInput);
app.use(sqlInjectionProtection);
app.use(parameterPollutionProtection);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', { stream: logger.stream }));
}

// Ensure data directory exists for database files and sessions
// On Azure: use ./data/ relative to app root
// Locally: use ./data/ relative to backend/
const getDataDir = () => {
    // Check if we're in Azure (has WEBSITE_SITE_NAME or WEBSITE_HOSTNAME)
    if (process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME) {
        // Azure: use data/ relative to app root
        return path.resolve(process.cwd(), 'data');
    }
    // Local development: use ./data/ relative to backend/
    return path.join(__dirname, 'data');
};

const dataDir = getDataDir();
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info('Created data directory', { path: dataDir });
    } catch (error) {
        logger.error('Failed to create data directory', { 
            path: dataDir, 
            error: error.message,
            code: error.code
        });
        // Try alternative location
        const altDataDir = path.resolve(process.cwd(), 'data');
        if (altDataDir !== dataDir && !fs.existsSync(altDataDir)) {
            try {
                fs.mkdirSync(altDataDir, { recursive: true });
                logger.info('Created alternative data directory', { path: altDataDir });
            } catch (altError) {
                logger.error('Failed to create alternative data directory', { 
                    path: altDataDir, 
                    error: altError.message 
                });
            }
        }
    }
} else {
    logger.info('Data directory exists', { path: dataDir });
}

// Session middleware - MUST be before static files to ensure cookies work
// Use the same data directory as the main database
const sessionDataDir = dataDir;
const sessionConfig = {
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: sessionDataDir,
        table: 'session'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Don't use default name
    proxy: process.env.NODE_ENV === 'production', // Trust proxy in production
    rolling: true // Reset expiration on every request
};

// Cookie configuration - different for development vs production
if (process.env.NODE_ENV === 'production') {
    sessionConfig.cookie = {
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
        httpOnly: true, // Prevent XSS
        secure: true, // HTTPS only in production
        sameSite: 'lax', // CSRF protection
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: '/'
    };
} else {
    // Development: Allow cross-port cookies
    // CRITICAL: For cross-port cookies in development, we need to ensure
    // the cookie can be sent from frontend (port 8000) to backend (port 3000)
    sessionConfig.cookie = {
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24 hours
        httpOnly: true, // Prevent XSS
        secure: false, // Allow HTTP in development
        sameSite: 'lax', // Lax allows top-level navigation (like OAuth redirect)
        // IMPORTANT: Don't set domain - this allows cookie to work across ports
        // The cookie domain will default to the request hostname (127.0.0.1:3000)
        // But it will be sent when making requests FROM 127.0.0.1:8000 TO 127.0.0.1:3000
        path: '/',
        // Explicitly don't set domain to allow cross-port cookies
        domain: undefined
    };
    
    // Log cookie configuration for debugging
    if (process.env.DEBUG_COOKIES === 'true') {
        console.log('Session cookie config:', sessionConfig.cookie);
    }
}

app.use(session(sessionConfig));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Configure passport strategies
require('./config/passport');

// Serve static files from public directory (frontend)
// IMPORTANT: This is AFTER session middleware to ensure cookies work properly
// This ensures frontend and backend are on same origin, fixing cookie issues
// On Azure: public/ is in the same directory as server.js
// Locally: public/ is one level up from backend/
const publicDir = process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME
    ? path.join(__dirname, 'public')  // Azure: same directory
    : path.join(__dirname, '../public');  // Local: one level up
app.use(express.static(publicDir));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Performance monitoring (track all requests)
app.use(performanceMonitor);

// Rate limiting (but not for OAuth)
app.use((req, res, next) => {
    // Skip rate limiting for OAuth routes
    if (req.path.includes('/auth/oauth/')) {
        return next();
    }
    rateLimiter(req, res, next);
});

// Health and Monitoring Routes (before other routes, no rate limiting)
app.use('/api/v1', healthRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);

// Mount OAuth routes BEFORE CSRF (OAuth has its own security)
app.use('/api/v1/auth', authRoutes);

// CSRF protection for all other routes
app.use(csrfToken);

// CSRF token endpoint
app.get('/api/v1/csrf-token', getCsrfToken);
app.use('/api/v1/users', userRoutes);

// Public routes with caching
app.use('/api/v1/products', cacheMiddleware(300), productRoutes); // Cache for 5 minutes
app.use('/api/v1/content', cacheMiddleware(600), contentRoutes); // Cache for 10 minutes
app.use('/api/v1/insights', insightsRoutes); // Market insights

// User routes (no caching for personalized data)
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);

// Child App Integration Routes
app.use('/api/v1/child-app', childAppRoutes);

// Admin routes with IP whitelist
app.use('/api/v1/admin', adminIPWhitelist, adminRoutes);
app.use('/api/v1/admin/products', adminIPWhitelist, adminProductsRoutes);
app.use('/api/v1/bulk', adminIPWhitelist, bulkRoutes);

// Swagger API Documentation (conditionally enabled)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    try {
        const swaggerUi = require('swagger-ui-express');
        const swaggerSpec = require('./config/swagger');
        
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'TradingPro API Docs'
        }));
        
        // JSON spec endpoint
        app.get('/api-docs.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });
        
        logger.info('Swagger documentation enabled at /api-docs');
    } catch (error) {
        logger.warn('Swagger UI not available. Install with: npm install swagger-ui-express swagger-jsdoc');
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler - catch all unmatched routes
app.use((req, res) => {
    // Log the 404 for debugging
    logger.warn('404 Not Found', {
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        query: req.query,
        ip: req.ip
    });
    
    res.status(404).json({ 
        error: 'Not Found',
        message: 'The requested resource does not exist',
        path: req.originalUrl,
        method: req.method
    });
});

// Error handling middleware with monitoring
app.use((err, req, res, next) => {
    // Track error in monitoring service
    monitoringService.trackError(err, {
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    
    // Call original error handler
    errorHandler(err, req, res, next);
});

// Catch unhandled errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Stack:', error.stack);
    logger.error('Uncaught Exception', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    if (reason && reason.stack) {
        console.error('Stack:', reason.stack);
    }
    logger.error('Unhandled Rejection', { reason, promise });
    // Don't exit on unhandled rejection in development to see the error
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Start server
const PORT = process.env.PORT || 3000;

// Determine the base URL for logging (use environment variable or detect from request)
const getBaseUrl = () => {
    // In production/cloud, use the actual hostname from environment or Azure
    if (process.env.NODE_ENV === 'production') {
        // Azure App Service provides WEBSITE_HOSTNAME
        if (process.env.WEBSITE_HOSTNAME) {
            const protocol = process.env.WEBSITE_HOSTNAME.includes('localhost') ? 'http' : 'https';
            return `${protocol}://${process.env.WEBSITE_HOSTNAME}`;
        }
        // Fallback to custom environment variable
        if (process.env.API_BASE_URL) {
            return process.env.API_BASE_URL;
        }
        // Use PORT if available (Azure sets this)
        return `https://${process.env.WEBSITE_SITE_NAME || 'your-app'}.azurewebsites.net`;
    }
    // Development: use localhost
    return `http://localhost:${PORT}`;
};

const baseUrl = getBaseUrl();

try {
    const server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server started on port ${PORT} in ${process.env.NODE_ENV} mode`);
        
        if (process.env.NODE_ENV === 'production') {
            // Cloud/production: show actual URLs
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 API Base URL: ${baseUrl}/api/v1`);
            console.log(`🔍 Health check: ${baseUrl}/health`);
        } else {
            // Development: show localhost URLs
            console.log(`🚀 Server running at http://localhost:${PORT}`);
            console.log(`📊 API Base URL: http://localhost:${PORT}/api/v1`);
            console.log(`🔍 Health check: http://localhost:${PORT}/health`);
        }
    });
    
    server.on('error', (error) => {
        console.error('❌ Server Error:', error);
        logger.error('Server Error', error);
        process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('SIGTERM signal received: closing HTTP server');
        server.close(() => {
            logger.info('HTTP server closed');
            if (pool && typeof pool.end === 'function') {
                pool.end(() => {
                    logger.info('Database pool closed');
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        });
    });
} catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('Failed to start server', error);
    process.exit(1);
}


