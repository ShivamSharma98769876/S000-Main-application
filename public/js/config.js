/**
 * API Configuration
 * Auto-detects environment and sets the correct API base URL
 */

(function() {
    'use strict';
    
    // Detect if we're running on Azure (production) or localhost (development)
    const isProduction = window.location.hostname !== 'localhost' && 
                         window.location.hostname !== '127.0.0.1' &&
                         !window.location.hostname.startsWith('192.168.') &&
                         !window.location.hostname.startsWith('10.') &&
                         window.location.protocol === 'https:';
    
    // Get the current origin (protocol + hostname + port)
    const origin = window.location.origin;
    
    // Set API base URL
    // Production (Azure): Use current origin (https://your-app.azurewebsites.net)
    // Development: Use the same origin as the page (handles both localhost and 127.0.0.1)
    const API_BASE_URL = isProduction 
        ? `${origin}/api/v1`
        // : `${origin}/api/v1`; // Use same origin in development to avoid CSP issues
        : `http://localhost:3000/api/v1`;
    // Make it available globally
    window.API_BASE_URL = API_BASE_URL;
    
    // Log for debugging (only in development)
    if (!isProduction) {
        console.log('🔧 API Configuration:', {
            environment: isProduction ? 'production' : 'development',
            hostname: window.location.hostname,
            origin: origin,
            apiBaseUrl: API_BASE_URL
        });
    }
})();

