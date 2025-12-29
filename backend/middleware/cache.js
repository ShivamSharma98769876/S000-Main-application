const logger = require('../config/logger');

// Simple in-memory cache
// For production, consider Redis or similar
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 300; // 5 minutes default
    }

    set(key, value, ttl = this.defaultTTL) {
        const expiry = Date.now() + (ttl * 1000);
        this.cache.set(key, { value, expiry });
        logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    }

    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            return null;
        }

        // Check if expired
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            logger.debug(`Cache expired: ${key}`);
            return null;
        }

        logger.debug(`Cache hit: ${key}`);
        return item.value;
    }

    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            logger.debug(`Cache deleted: ${key}`);
        }
        return deleted;
    }

    clear() {
        const size = this.cache.size;
        this.cache.clear();
        logger.info(`Cache cleared: ${size} items removed`);
    }

    // Clear expired entries
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info(`Cache cleanup: ${cleaned} expired items removed`);
        }
        return cleaned;
    }

    size() {
        return this.cache.size;
    }

    // Get cache statistics
    stats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        for (const item of this.cache.values()) {
            if (now > item.expiry) {
                expired++;
            } else {
                valid++;
            }
        }

        return {
            total: this.cache.size,
            valid,
            expired
        };
    }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Cleanup expired entries every 5 minutes
setInterval(() => {
    cacheManager.cleanup();
}, 5 * 60 * 1000);

// Middleware for caching responses
const cacheMiddleware = (ttl = 300) => {
    return (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Skip caching for authenticated requests (unless explicitly enabled)
        if (req.user && !req.query.cache) {
            return next();
        }

        // Generate cache key from URL and query params
        const cacheKey = `${req.originalUrl || req.url}`;

        // Try to get from cache
        const cachedResponse = cacheManager.get(cacheKey);
        if (cachedResponse) {
            res.set('X-Cache', 'HIT');
            return res.json(cachedResponse);
        }

        // Store original res.json
        const originalJson = res.json.bind(res);

        // Override res.json to cache the response
        res.json = (body) => {
            cacheManager.set(cacheKey, body, ttl);
            res.set('X-Cache', 'MISS');
            return originalJson(body);
        };

        next();
    };
};

// Invalidate cache for specific patterns
const invalidateCache = (pattern) => {
    let deleted = 0;
    const regex = new RegExp(pattern);

    for (const key of cacheManager.cache.keys()) {
        if (regex.test(key)) {
            cacheManager.delete(key);
            deleted++;
        }
    }

    logger.info(`Cache invalidated: ${deleted} items matching pattern "${pattern}"`);
    return deleted;
};

module.exports = {
    cacheManager,
    cacheMiddleware,
    invalidateCache
};



