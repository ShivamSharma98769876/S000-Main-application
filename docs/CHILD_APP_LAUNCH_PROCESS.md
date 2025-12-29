# Child Application Launch Process

This document describes the complete process for launching the child application from the main application with JWT token authentication.

## Overview

When a user clicks "Execute Strategy" in the main application, the system:
1. Retrieves the JWT token from localStorage
2. Validates the token with the backend
3. Generates a child app URL with the token as a query parameter
4. Redirects the user to the child app
5. Child app validates the token and shows the home page

## Flow Diagram

```
┌─────────────────┐
│  Main App       │
│  Dashboard      │
└────────┬────────┘
         │
         │ User clicks "Execute Strategy"
         ▼
┌─────────────────┐
│  Frontend       │
│  executeStrategy│
│  function       │
└────────┬────────┘
         │
         │ 1. Get JWT token from localStorage
         │ 2. Call GET /api/v1/child-app/get-url
         │    with Authorization: Bearer <token>
         ▼
┌─────────────────┐
│  Backend API    │
│  /child-app/    │
│  get-url        │
└────────┬────────┘
         │
         │ 1. Verify JWT token
         │ 2. Build child app URL with sso_token param
         │ 3. Return URL
         ▼
┌─────────────────┐
│  Frontend       │
│  Redirect       │
└────────┬────────┘
         │
         │ window.location.href = childAppUrl
         ▼
┌─────────────────┐
│  Child App      │
│  Landing Page   │
└────────┬────────┘
         │
         │ 1. Extract sso_token from URL
         │ 2. Call POST /api/v1/child-app/verify-token
         │    (or validate locally with public key)
         │ 3. If valid, redirect to home page
         ▼
┌─────────────────┐
│  Child App      │
│  Home Page      │
└─────────────────┘
```

## Main Application Implementation

### Frontend Code (dashboard.html)

```javascript
async function executeStrategy(subscriptionId, productName) {
    try {
        // Get JWT token from localStorage
        const token = getAuthToken();
        
        if (!token) {
            alert('Authentication required. Please login again.');
            window.location.href = 'login.html';
            return;
        }

        // Show loading indicator
        showLoading('Launching strategy application...');

        // Call child app launch endpoint with JWT token
        const response = await fetch(`${API_BASE_URL}/child-app/get-url`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        hideLoading();

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to launch child application');
        }

        const data = await response.json();
        
        if (data.success && data.url) {
            // Redirect to child app with JWT token in URL
            console.log('Redirecting to child app:', data.url);
            window.location.href = data.url;
        } else {
            throw new Error('Invalid response from server');
        }

    } catch (error) {
        hideLoading();
        console.error('Error launching child app:', error);
        alert(`Failed to launch strategy application: ${error.message}\n\nPlease try again or contact support.`);
    }
}
```

### Backend API Endpoint

**Endpoint:** `GET /api/v1/child-app/get-url`

**Authentication:** Requires JWT token in `Authorization: Bearer <token>` header

**Response:**
```json
{
    "success": true,
    "url": "https://child-app-url.com/?sso_token=eyJhbGci...",
    "expiresIn": "7d"
}
```

**Implementation:** See `backend/routes/child-app.routes.js` (lines 230-268)

## Child Application Implementation

### Step 1: Extract Token from URL

When the child app loads, it should extract the `sso_token` from the URL:

```javascript
// Extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const ssoToken = urlParams.get('sso_token');

if (!ssoToken) {
    // Redirect to main app login
    window.location.href = 'https://main-app-url.com/login.html';
    return;
}
```

### Step 2: Validate Token

The child app has two options for token validation:

#### Option A: Validate Locally (Recommended for Production)

Use the public key from the main app to validate the token:

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Load public key
const publicKey = fs.readFileSync(
    path.join(__dirname, '../config/keys/main-app-public.pem'),
    'utf8'
);

// Verify token
try {
    const decoded = jwt.verify(ssoToken, publicKey, {
        issuer: 'tradingpro-user-auth',
        audience: 'tradingpro-child-app',
        algorithms: ['RS256']
    });
    
    // Token is valid, proceed to home page
    // Store user info in session/localStorage
    sessionStorage.setItem('user', JSON.stringify({
        user_id: decoded.user_id,
        email: decoded.email,
        full_name: decoded.full_name
    }));
    
    // Redirect to home page
    window.location.href = '/home.html';
    
} catch (error) {
    // Token invalid or expired
    console.error('Token validation failed:', error);
    window.location.href = 'https://main-app-url.com/login.html?error=invalid_token';
}
```

#### Option B: Validate via API (For Development/Testing)

Call the main app's verification endpoint:

```javascript
async function validateToken(token) {
    try {
        const response = await fetch('https://main-app-url.com/api/v1/child-app/verify-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();
        
        if (data.success && data.valid) {
            // Token is valid
            // Store user info
            sessionStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect to home page
            window.location.href = '/home.html';
        } else {
            // Token invalid
            window.location.href = 'https://main-app-url.com/login.html?error=invalid_token';
        }
    } catch (error) {
        console.error('Token validation error:', error);
        window.location.href = 'https://main-app-url.com/login.html?error=validation_error';
    }
}

// Call on page load
validateToken(ssoToken);
```

### Step 3: Remove Token from URL

After extracting and validating the token, remove it from the URL for security:

```javascript
// Remove token from URL
const newUrl = window.location.pathname;
window.history.replaceState({}, document.title, newUrl);
```

### Step 4: Display Home Page

Once the token is validated and user info is stored, redirect to or display the home page.

## Complete Child App Landing Page Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strategy Application</title>
</head>
<body>
    <div id="loading">Validating authentication...</div>
    <div id="content" style="display: none;">
        <h1>Welcome to Strategy Application</h1>
        <p>You have been successfully authenticated.</p>
    </div>

    <script>
        (async function() {
            // Extract token from URL
            const urlParams = new URLSearchParams(window.location.search);
            const ssoToken = urlParams.get('sso_token');

            if (!ssoToken) {
                window.location.href = 'https://main-app-url.com/login.html?error=no_token';
                return;
            }

            try {
                // Validate token via API
                const response = await fetch('https://main-app-url.com/api/v1/child-app/verify-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token: ssoToken })
                });

                const data = await response.json();

                if (data.success && data.valid) {
                    // Store user info
                    sessionStorage.setItem('user', JSON.stringify(data.user));
                    sessionStorage.setItem('authToken', ssoToken);

                    // Remove token from URL
                    window.history.replaceState({}, document.title, window.location.pathname);

                    // Show content and redirect to home
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('content').style.display = 'block';
                    
                    // Redirect to home page after 1 second
                    setTimeout(() => {
                        window.location.href = '/home.html';
                    }, 1000);
                } else {
                    throw new Error('Token validation failed');
                }
            } catch (error) {
                console.error('Authentication error:', error);
                window.location.href = 'https://main-app-url.com/login.html?error=auth_failed';
            }
        })();
    </script>
</body>
</html>
```

## Security Considerations

1. **Token Expiration**: JWT tokens have an expiration time. The child app should handle expired tokens gracefully.

2. **HTTPS Only**: Always use HTTPS in production to protect tokens in transit.

3. **Token Storage**: 
   - Store tokens in `sessionStorage` (cleared on tab close) or `localStorage` (persists)
   - Never log tokens to console in production
   - Remove tokens from URL immediately after extraction

4. **Token Refresh**: If tokens expire, implement a refresh mechanism or redirect back to main app.

5. **CORS**: Ensure proper CORS configuration on the main app API.

## Environment Variables

### Main Application
```env
CHILD_APP_URL=https://child-app-url.com
JWT_PRIVATE_KEY_PATH=./config/keys/private.pem
JWT_PUBLIC_KEY_PATH=./config/keys/public.pem
JWT_ISSUER=tradingpro-user-auth
JWT_AUDIENCE=tradingpro-child-app
AUTH_TOKEN_EXPIRY=7d
```

### Child Application
```env
MAIN_APP_URL=https://main-app-url.com
MAIN_APP_PUBLIC_KEY_PATH=./config/keys/main-app-public.pem
JWT_ISSUER=tradingpro-user-auth
JWT_AUDIENCE=tradingpro-child-app
```

## Testing

### Test Token Generation
```bash
# Get a test token (requires authentication)
curl -X GET http://127.0.0.1:3000/api/v1/child-app/get-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Token Verification
```bash
# Verify a token
curl -X POST http://127.0.0.1:3000/api/v1/child-app/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_JWT_TOKEN"}'
```

## Troubleshooting

### Issue: Token not found in localStorage
**Solution**: User needs to login again. Redirect to login page.

### Issue: Token validation fails
**Solution**: 
- Check token expiration
- Verify public key is correct
- Ensure issuer and audience match

### Issue: CORS errors
**Solution**: Update CORS configuration in main app to allow child app origin.

### Issue: Child app redirects to login
**Solution**: 
- Verify token is being passed correctly
- Check token expiration
- Ensure child app URL is correct

## Support

For issues or questions, contact the main application development team.

