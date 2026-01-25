const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
// Session store - using PostgreSQL
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const http = require('http');
const https = require('https');
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
const visitorRoutes = require('./routes/visitor.routes');

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

// Catch unhandled errors and promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    logger.error('Unhandled Rejection', { reason, promise });
    // Don't exit in development - let nodemon restart
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    logger.error('Uncaught Exception', error);
    process.exit(1);
});

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware (skip for reverse-proxy routes)
app.use((req, res, next) => {
    if (req.path.startsWith('/s001') || req.path.startsWith('/s002')) {
        return next();
    }
    return securityHeaders(req, res, next);
});

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
            'https://stocksage.trade',
            'https://www.stocksage.trade',
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

// Reverse proxy for child apps (keeps custom domain on main app)
const normalizeProxyBaseUrl = (value) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

const createProxyHandler = (targetBaseUrl, label) => (req, res) => {
    const normalizedBaseUrl = normalizeProxyBaseUrl(targetBaseUrl);
    if (!normalizedBaseUrl) {
        logger.warn('Proxy target not configured', { label, path: req.originalUrl });
        return res.status(502).json({
            error: 'Bad Gateway',
            message: `${label} proxy target is not configured`
        });
    }

    let targetUrl;
    try {
        targetUrl = new URL(req.url, normalizedBaseUrl);
    } catch (error) {
        logger.error('Invalid proxy target URL', { label, targetBaseUrl: normalizedBaseUrl, error: error.message });
        return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Invalid proxy target URL'
        });
    }

    const isHttps = targetUrl.protocol === 'https:';
    const proxyRequest = (isHttps ? https : http).request(
        targetUrl,
        {
            method: req.method,
            headers: {
                ...req.headers,
                host: targetUrl.host
            }
        },
        (proxyRes) => {
            const contentType = proxyRes.headers['content-type'] || '';
            const basePath = req.baseUrl || '';
            const baseHref = basePath.endsWith('/') ? basePath : `${basePath}/`;
            const basePathPrefix = basePath || '';

            const rewriteAbsolutePaths = (html) => {
                if (!basePathPrefix) return html;
                const prefix = basePathPrefix.replace(/\/$/, '');

                // Rewrite common absolute attributes
                html = html.replace(
                    /(href|src|action|data-src|poster)=("|\')\/(?!\/)/gi,
                    `$1=$2${prefix}/`
                );

                // Rewrite srcset values that start with /
                html = html.replace(/srcset=("|\')([^"\']*)\1/gi, (match, quote, value) => {
                    const rewritten = value
                        .split(',')
                        .map(part => {
                            const trimmed = part.trim();
                            if (trimmed.startsWith('/')) {
                                return `${prefix}${trimmed}`;
                            }
                            return trimmed;
                        })
                        .join(', ');
                    return `srcset=${quote}${rewritten}${quote}`;
                });

                return html;
            };

            const injectProxyBaseScript = (html) => {
                if (!basePathPrefix) return html;
                const prefix = basePathPrefix.replace(/\/$/, '');
                const script = `
<script>
  (function() {
    var base = '${prefix}';
    if (!base) return;
    // Patch fetch to prefix /api calls with the proxy base
    if (window.fetch) {
      var originalFetch = window.fetch;
      window.fetch = function(resource, init) {
        if (typeof resource === 'string' && resource.startsWith('/api/')) {
          resource = base + resource;
        }
        return originalFetch.call(this, resource, init);
      };
    }
    // Patch XMLHttpRequest to prefix /api calls with the proxy base
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === 'string' && url.startsWith('/api/')) {
        url = base + url;
      }
      return open.apply(this, arguments.length > 2 ? [method, url, arguments[2], arguments[3], arguments[4]] : [method, url]);
    };
  })();
</script>`;
                if (/<head[^>]*>/i.test(html)) {
                    return html.replace(/<head([^>]*)>/i, `<head$1>${script}`);
                }
                return script + html;
            };

            // Rewrite redirect locations to keep custom domain + prefix
            if (proxyRes.headers.location) {
                try {
                    const locationUrl = new URL(proxyRes.headers.location, normalizedBaseUrl);
                    if (locationUrl.origin === new URL(normalizedBaseUrl).origin) {
                        const proxyOrigin = `${req.protocol}://${req.get('host')}`;
                        proxyRes.headers.location = `${proxyOrigin}${baseHref}${locationUrl.pathname.replace(/^\//, '')}${locationUrl.search}`;
                    }
                } catch (error) {
                    logger.warn('Failed to rewrite proxy location header', {
                        label,
                        location: proxyRes.headers.location,
                        error: error.message
                    });
                }
            }

            if (contentType.includes('text/html')) {
                const chunks = [];
                proxyRes.on('data', (chunk) => chunks.push(chunk));
                proxyRes.on('end', () => {
                    let body = Buffer.concat(chunks).toString('utf8');
                    if (!/base href=/i.test(body)) {
                        body = body.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);
                    }
                    body = rewriteAbsolutePaths(body);
                    body = injectProxyBaseScript(body);

                    res.status(proxyRes.statusCode || 500);
                    Object.entries(proxyRes.headers).forEach(([key, value]) => {
                        if (value !== undefined && key.toLowerCase() !== 'content-length') {
                            res.setHeader(key, value);
                        }
                    });
                    res.send(body);
                });
                return;
            }

            if (contentType.includes('text/css')) {
                const chunks = [];
                proxyRes.on('data', (chunk) => chunks.push(chunk));
                proxyRes.on('end', () => {
                    let body = Buffer.concat(chunks).toString('utf8');
                    if (basePathPrefix) {
                        const prefix = basePathPrefix.replace(/\/$/, '');
                        body = body.replace(/url\(\s*\/(?!\/)/gi, `url(${prefix}/`);
                    }

                    res.status(proxyRes.statusCode || 500);
                    Object.entries(proxyRes.headers).forEach(([key, value]) => {
                        if (value !== undefined && key.toLowerCase() !== 'content-length') {
                            res.setHeader(key, value);
                        }
                    });
                    res.send(body);
                });
                return;
            }

            res.status(proxyRes.statusCode || 500);
            Object.entries(proxyRes.headers).forEach(([key, value]) => {
                if (value !== undefined) {
                    res.setHeader(key, value);
                }
            });
            proxyRes.pipe(res);
        }
    );

    proxyRequest.on('error', (error) => {
        logger.error('Proxy request failed', {
            label,
            target: targetUrl.toString(),
            error: error.message
        });
        res.status(502).json({
            error: 'Bad Gateway',
            message: 'Failed to reach upstream service'
        });
    });

    req.pipe(proxyRequest);
};

// Register proxy routes BEFORE body parsing to allow streaming
app.use('/s001', createProxyHandler(process.env.PROXY_S001_URL, 'S001'));
app.use('/s002', createProxyHandler(process.env.PROXY_S002_URL, 'S002'));

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

// Session middleware - MUST be before static files to ensure cookies work
// Using PostgreSQL session store
const sessionConfig = {
    store: new pgSession({
        pool: pool, // Use the same connection pool as the main database
        tableName: 'session' // Table name for sessions
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

// Log the public directory path for debugging
logger.info('Static files directory', { 
    path: publicDir, 
    exists: fs.existsSync(publicDir),
    isAzure: !!(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME),
    files: fs.existsSync(publicDir) ? fs.readdirSync(publicDir).slice(0, 10) : []
});

// Explicit root route handler to serve index.html (before static middleware)
app.get('/', (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        logger.debug('Serving index.html from root route', { path: indexPath });
        res.sendFile(indexPath);
    } else {
        logger.warn('index.html not found', { path: indexPath, publicDir, cwd: process.cwd(), __dirname });
        res.status(404).json({
            error: 'Not Found',
            message: 'Landing page not found. Please ensure public/index.html exists.',
            debug: {
                publicDir,
                indexPath,
                exists: fs.existsSync(publicDir),
                cwd: process.cwd()
            }
        });
    }
});

// Serve static files (this will handle other static assets)
app.use(express.static(publicDir, {
    index: false,  // Don't auto-serve index.html, we handle it explicitly above
    extensions: ['html', 'htm', 'css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico']
}));

// Serve uploaded files
// Use the same path as multer uploads to ensure consistency
// server.js is in backend/, so uploads/ should be backend/uploads/
// This works for both Azure and local (Azure deploys backend/ as root)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info('Created upload directory', { path: uploadDir });
}
app.use('/uploads', express.static(uploadDir, {
    setHeaders: (res, filePath) => {
        // Set proper content type for images
        if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp');
        }
    }
}));

// Log upload directory info
const uploadDirResolved = path.resolve(uploadDir);
logger.info('Serving uploads from', { 
    path: uploadDir, 
    resolved: uploadDirResolved,
    exists: fs.existsSync(uploadDir),
    files: fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).filter(f => f.startsWith('qr-code')).slice(0, 5) : []
});

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
app.use('/api/v1/visitor', visitorRoutes); // Visitor counter

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
            customSiteTitle: 'StockSage API Docs'
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

// Simple health check endpoint (for Azure startup probe - must respond quickly)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler - catch all unmatched routes
app.use((req, res) => {
    // Ignore harmless browser/DevTools requests
    const ignoredPaths = [
        '/.well-known/appspecific/com.chrome.devtools.json',
        '/favicon.ico',
        '/robots.txt'
    ];
    
    const shouldIgnore = ignoredPaths.some(path => req.path === path);
    
    // Only log 404s for actual API/resource requests, not browser noise
    if (!shouldIgnore) {
        logger.warn('404 Not Found', {
            method: req.method,
            url: req.originalUrl,
            path: req.path,
            query: req.query,
            ip: req.ip
        });
    }
    
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

// Start server immediately (don't wait for database connection)
// This ensures health checks work even if database is temporarily unavailable
// Database connection will be tested asynchronously
startServer();

// Test database connection asynchronously (don't block server startup)
pool.query('SELECT 1')
    .then(() => {
        logger.info('Database connection verified');
    })
    .catch((err) => {
        console.error('⚠️  Database connection failed:', err.message);
        const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME);
        logger.error('Database connection failed', {
            message: err.message,
            code: err.code,
            isAzure,
            hasDatabaseUrl: !!process.env.DATABASE_URL,
            hasDbHost: !!process.env.DB_HOST,
            hasDbUser: !!process.env.DB_USER,
            hasDbPassword: !!process.env.DB_PASSWORD,
            websiteSiteName: process.env.WEBSITE_SITE_NAME,
            websiteHostname: process.env.WEBSITE_HOSTNAME
        });
        
        // Provide helpful error message for Azure (but don't exit)
        if (isAzure) {
            console.error('\n⚠️  Azure Deployment Detected - Database Connection Failed');
            console.error('═══════════════════════════════════════════════════════════');
            console.error('Please set database configuration in Azure Portal:');
            console.error('  1. Go to Azure Portal → Your App Service → Configuration');
            console.error('  2. Click "Application settings" tab');
            console.error('  3. Add Application Settings:');
            console.error('     - DATABASE_URL (recommended) OR');
            console.error('     - DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
            console.error('  4. Click "Save" at the top');
            console.error('  5. Wait for app to restart');
            console.error('═══════════════════════════════════════════════════════════');
            console.error('\nCurrent environment variables:');
            console.error(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET'}`);
            console.error(`  DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
            console.error(`  DB_PORT: ${process.env.DB_PORT || 'NOT SET'}`);
            console.error(`  DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
            console.error(`  DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
            console.error(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? 'SET (length: ' + process.env.DB_PASSWORD.length + ')' : 'NOT SET'}`);
            console.error(`\nError Details:`);
            console.error(`  Code: ${err.code || 'N/A'}`);
            console.error(`  Message: ${err.message}`);
            if (err.code === 'ECONNREFUSED') {
                console.error(`\n💡 This means the database host is not reachable.`);
                console.error(`   Check: DB_HOST or DATABASE_URL hostname is correct`);
            } else if (err.code === '28P01') {
                console.error(`\n💡 Authentication failed.`);
                console.error(`   Check: DB_USER and DB_PASSWORD are correct`);
            } else if (err.code === 'ENOTFOUND') {
                console.error(`\n💡 Database host not found.`);
                console.error(`   Check: DB_HOST hostname is correct`);
            }
            console.error('\n📋 View full logs in Azure Portal → Log stream');
            console.error('⚠️  Server is running but database is not connected.');
            console.error('   Health check will show database as disconnected.');
        }
        
        // Don't exit - let server start and show database as disconnected in health check
    });

function startServer() {
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
}


