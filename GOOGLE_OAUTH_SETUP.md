# Google OAuth Setup Guide

## Problem: Internal Server Error on OAuth

If you're getting `{"error":"Error","message":"Internal Server Error"}` when accessing `/api/v1/auth/oauth/google`, it's likely because Google OAuth credentials are not configured.

## Required Environment Variables

You **MUST** set these in Azure Portal:

### 1. Go to Azure Portal
- Navigate to your App Service: `A000-Main-App`
- Go to **Configuration** → **Application settings**

### 2. Add These Environment Variables

**Required:**
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Optional (auto-detected if not set):**
```
GOOGLE_CALLBACK_URL=https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net/api/v1/auth/oauth/google/callback
FRONTEND_URL=https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net
```

## How to Get Google OAuth Credentials

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API** (or **Google Identity Services**)

### Step 2: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Configure:
   - **Name:** TradingPro Main App
   - **Authorized JavaScript origins:**
     ```
     https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net
     http://localhost:8000 (for local development)
     ```
   - **Authorized redirect URIs:**
     ```
     https://a000-main-app-g5f2byheauhyeudv.southindia-01.azurewebsites.net/api/v1/auth/oauth/google/callback
     http://localhost:3000/api/v1/auth/oauth/google/callback (for local development)
     ```
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### Step 3: Add to Azure
1. In Azure Portal → App Service → Configuration
2. Add:
   - `GOOGLE_CLIENT_ID` = (paste Client ID)
   - `GOOGLE_CLIENT_SECRET` = (paste Client Secret)
3. Click **Save**
4. **Restart** the App Service

## Verification

After setting the environment variables and restarting:

1. **Check logs** - You should see:
   ```
   Google OAuth strategy configured { callbackUrl: '...', hasClientId: true, hasClientSecret: true }
   Google OAuth strategy registered successfully
   ```

2. **Test the endpoint:**
   - Visit: `https://your-app.azurewebsites.net/api/v1/auth/oauth/google`
   - Should redirect to Google login (not return error)

## Error Messages

### "Google OAuth is not configured"
- **Cause:** `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing
- **Fix:** Add both environment variables in Azure Portal

### "Google OAuth strategy is not registered"
- **Cause:** Strategy failed to register (check logs for details)
- **Fix:** Check server logs for the specific error

### "Internal Server Error"
- **Cause:** Could be missing credentials, database error, or other issue
- **Fix:** 
  1. Check Azure logs for detailed error
  2. Verify environment variables are set
  3. Verify database is accessible
  4. Check that callback URL matches Google Console configuration

## Auto-Detection

The application now auto-detects:
- ✅ **Callback URL** - From `WEBSITE_HOSTNAME` or `WEBSITE_SITE_NAME`
- ✅ **Frontend URL** - For redirects after OAuth
- ✅ **API Base URL** - In frontend JavaScript

You only need to set:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Everything else is auto-detected!

## Troubleshooting

### Still getting errors?
1. **Check Azure Logs:**
   - Go to App Service → **Log stream**
   - Look for errors related to OAuth

2. **Verify Environment Variables:**
   - Go to Configuration → Application settings
   - Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - No typos or extra spaces

3. **Verify Google Console:**
   - Redirect URI must match exactly
   - JavaScript origin must match your domain
   - OAuth consent screen must be configured

4. **Restart App Service:**
   - After adding environment variables, always restart

## Next Steps

1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Azure
2. Restart the App Service
3. Test the OAuth endpoint
4. Check logs to verify it's working

