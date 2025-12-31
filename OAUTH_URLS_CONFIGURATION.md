# OAuth URLs Configuration

## Overview

All OAuth URLs are now **auto-detected** based on the environment. No hardcoded URLs are used.

## OAuth URLs

### 1. OAuth Initiation URL
**Endpoint:** `/api/v1/auth/oauth/google`

**Full URL Examples:**
- **Production (Azure):** `https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net/api/v1/auth/oauth/google`
- **Development:** `http://localhost:3000/api/v1/auth/oauth/google`

**How it works:**
- Frontend JavaScript (`public/js/config.js`) auto-detects the environment
- Uses `window.location.origin` in production
- Uses `http://localhost:3000` in development
- Constructs: `${API_BASE_URL}/auth/oauth/google`

### 2. OAuth Callback URL
**Endpoint:** `/api/v1/auth/oauth/google/callback`

**Full URL Examples:**
- **Production (Azure):** `https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net/api/v1/auth/oauth/google/callback`
- **Development:** `http://localhost:3000/api/v1/auth/oauth/google/callback`

**How it's configured:**
- Auto-detected in `backend/config/passport.js`
- Uses `WEBSITE_HOSTNAME` environment variable if available
- Falls back to `WEBSITE_SITE_NAME` if needed
- Can be overridden with `GOOGLE_CALLBACK_URL` environment variable

### 3. Frontend Redirect URLs
After successful OAuth, users are redirected to:
- **Dashboard:** `/dashboard.html` (if profile complete)
- **Registration:** `/register.html` (if profile incomplete)
- **Error:** `/login.html?error=...` (if authentication fails)

**Full URL Examples:**
- **Production:** `https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net/dashboard.html`
- **Development:** `http://localhost:8000/dashboard.html`

**How it's configured:**
- Auto-detected in `backend/routes/auth.routes.js`
- Uses `FRONTEND_URL` environment variable if set
- Auto-detects from Azure environment variables if not set
- Falls back to `http://localhost:8000` for development

## Environment Variables (Optional)

You can override auto-detection by setting these in Azure Portal:

### Google OAuth
```
GOOGLE_CALLBACK_URL=https://your-app.azurewebsites.net/api/v1/auth/oauth/google/callback
```

### Frontend URL
```
FRONTEND_URL=https://your-app.azurewebsites.net
```

## Auto-Detection Logic

### For Azure (Production)
1. Checks `WEBSITE_HOSTNAME` (e.g., `a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net`)
2. Falls back to `WEBSITE_SITE_NAME` + region detection
3. Uses HTTPS protocol

### For Development
1. Checks for `localhost` or `127.0.0.1` in hostname
2. Uses HTTP protocol
3. Uses default ports (3000 for API, 8000 for frontend)

## Google OAuth Console Configuration

In your Google Cloud Console, make sure to add:

**Authorized redirect URIs:**
```
https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net/api/v1/auth/oauth/google/callback
```

**Authorized JavaScript origins:**
```
https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net
```

## Verification

After deployment, check the logs for:
```
Google OAuth callback URL configured { callbackUrl: '...', source: 'auto-detected' }
```

This confirms the callback URL was auto-detected correctly.

## Summary

✅ **No hardcoded URLs** - Everything is auto-detected
✅ **Works in both production and development**
✅ **Can be overridden with environment variables if needed**
✅ **Frontend uses `config.js` to auto-detect API base URL**
✅ **Backend auto-detects callback and frontend URLs**

