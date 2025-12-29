# 400 Bad Request on OAuth Callback - Fix

## Problem
Getting `400 Bad Request` error on OAuth callback:
```
GET http://localhost:3000/api/v1/auth/oauth/google/callback?code=... 400 (Bad Request)
```

## Possible Causes

### 1. Callback URL Mismatch
The URL uses `localhost:3000` but your callback URL might be configured for `127.0.0.1:3000`.

**Check:**
- Google OAuth Console → Authorized redirect URIs
- Your `.env` file → `GOOGLE_CALLBACK_URL`

**They must match exactly!**

### 2. OAuth Code Already Used
OAuth codes can only be used once. If you refresh or retry, you'll get 400.

**Fix:** Complete OAuth flow in one go, don't refresh.

### 3. Missing or Invalid OAuth Code
The `code` parameter might be missing or invalid.

**Check:** Is the `code` parameter in the URL?

## Check Backend Logs

Check your **backend terminal** for error messages. Look for:
- "Google OAuth error"
- "Bad Request"
- Any error messages

## Quick Fix

### Step 1: Check Callback URL
In your `.env` file, check:
```
GOOGLE_CALLBACK_URL=http://127.0.0.1:3000/api/v1/auth/oauth/google/callback
```

Or if using localhost:
```
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/oauth/google/callback
```

**Important:** The callback URL in `.env` must match:
1. What's configured in Google OAuth Console
2. What Google is redirecting to (check the URL in the error)

### Step 2: Check Google OAuth Console
1. Go to Google Cloud Console
2. APIs & Services → Credentials
3. Find your OAuth 2.0 Client
4. Check "Authorized redirect URIs"
5. Make sure it includes: `http://127.0.0.1:3000/api/v1/auth/oauth/google/callback`
6. Or: `http://localhost:3000/api/v1/auth/oauth/google/callback`

### Step 3: Restart Server
After changing `.env`, restart your backend server.

## Test Again

1. Clear browser cache/cookies
2. Try OAuth login again
3. Complete in one go (don't refresh)

## What to Report

Please share:
1. **Backend terminal error** - What error message do you see?
2. **GOOGLE_CALLBACK_URL** from `.env` - What is it set to?
3. **Google OAuth Console** - What redirect URIs are configured?

This will help identify the exact mismatch!

