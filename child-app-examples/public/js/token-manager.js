class TokenManager {
    constructor() {
        this.token = null;
        this.refreshTimer = null;
        this.mainAppUrl = 'http://127.0.0.1:3000'; // Main app URL
    }

    /**
     * Initialize token from URL or storage
     */
    async initialize() {
        // Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const ssoToken = urlParams.get('sso_token');

        if (ssoToken) {
            // Validate and store token
            await this.setToken(ssoToken);
            
            // Clean URL (remove token from address bar)
            window.history.replaceState({}, document.title, window.location.pathname);
        } else {
            // Try to restore from sessionStorage
            const storedToken = sessionStorage.getItem('child_app_token');
            if (storedToken) {
                try {
                    await this.verifyToken(storedToken);
                    this.token = storedToken;
                    this.scheduleRefresh();
                } catch (error) {
                    console.error('Stored token invalid:', error);
                    this.redirectToMainApp();
                }
            } else {
                // No token found - redirect to main app
                this.redirectToMainApp();
            }
        }
    }

    /**
     * Set and validate token
     */
    async setToken(token) {
        try {
            // Verify token with child app backend
            const response = await fetch('/api/verify-sso', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Token validation failed');
            }

            const data = await response.json();

            if (data.success) {
                this.token = token;
                sessionStorage.setItem('child_app_token', token);
                
                // Store user info
                sessionStorage.setItem('user_email', data.user.email);
                sessionStorage.setItem('user_id', data.user.id);

                // Schedule refresh before expiry
                this.scheduleRefresh();

                console.log('Token validated and stored successfully');
                return true;
            }

            throw new Error('Invalid token response');

        } catch (error) {
            console.error('Token validation error:', error);
            this.redirectToMainApp();
            return false;
        }
    }

    /**
     * Verify token is still valid
     */
    async verifyToken(token) {
        const response = await fetch('/api/verify-sso', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Token invalid');
        }

        return await response.json();
    }

    /**
     * Schedule token refresh (8 minutes for 10-minute token)
     */
    scheduleRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }

        // Refresh at 80% of token lifetime (8 min for 10 min token)
        const refreshInterval = 8 * 60 * 1000;

        this.refreshTimer = setTimeout(() => {
            this.refreshToken();
        }, refreshInterval);

        console.log('Token refresh scheduled in', refreshInterval / 1000, 'seconds');
    }

    /**
     * Refresh token via main app
     */
    async refreshToken() {
        try {
            console.log('Refreshing token...');

            const response = await fetch(`${this.mainAppUrl}/api/v1/child-app/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ token: this.token })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();

            if (data.success) {
                await this.setToken(data.token);
                console.log('Token refreshed successfully');
            } else {
                throw new Error('Invalid refresh response');
            }

        } catch (error) {
            console.error('Token refresh error:', error);
            this.redirectToMainApp();
        }
    }

    /**
     * Get current token for API calls
     */
    getToken() {
        return this.token;
    }

    /**
     * Redirect to main app login
     */
    redirectToMainApp() {
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `${this.mainAppUrl}/login?redirect=${returnUrl}`;
    }

    /**
     * Clear token and logout
     */
    logout() {
        this.token = null;
        sessionStorage.clear();
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.redirectToMainApp();
    }
}

// Global instance
const tokenManager = new TokenManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await tokenManager.initialize();
});

