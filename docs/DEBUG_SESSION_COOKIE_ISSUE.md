# Debugging Session Cookie Issue

## The Problem
After OAuth login, the session cookie is set on `127.0.0.1:3000` (backend), but requests from `127.0.0.1:8000` (frontend) aren't sending the cookie, causing 401 errors.

## Root Cause
Cookies are port-specific. A cookie set on port 3000 won't automatically be sent with requests from port 8000, even with `credentials: 'include'`.

## Solution: Verify Cookie is Being Set

### Step 1: Check Response Headers
After OAuth callback, check if `Set-Cookie` header is present:

```javascript
// In browser console, check Network tab:
// 1. Go to Network tab in DevTools
// 2. Find the OAuth callback request
// 3. Check Response Headers for "Set-Cookie: sessionId=..."
```

### Step 2: Verify Cookie in Application Tab
1. Open DevTools → Application tab (Chrome) or Storage tab (Firefox)
2. Go to Cookies → `http://127.0.0.1:3000`
3. Look for `sessionId` cookie
4. Check its properties:
   - Domain: should be `127.0.0.1` or empty
   - Path: should be `/`
   - HttpOnly: ✅ (this is normal)
   - SameSite: `Lax`

### Step 3: Test Cookie Sending
Run this in console on your app page (`127.0.0.1:8000`):

```javascript
// Check if cookie exists for backend domain
fetch('http://127.0.0.1:3000/api/v1/auth/me', {
  credentials: 'include',
  headers: {
    'Origin': 'http://127.0.0.1:8000'
  }
})
.then(res => {
  console.log('Status:', res.status);
  console.log('Response headers:', [...res.headers.entries()]);
  return res.text();
})
.then(text => console.log('Response:', text));
```

## Alternative: Test Directly on Backend Port

If cookies aren't working cross-port, test the token generation directly:

### Method 1: Use Browser on Backend Port
1. Open a new tab
2. Go to: `http://127.0.0.1:3000/api/v1/auth/oauth/google`
3. Complete OAuth
4. You'll be redirected but stay on port 3000
5. Then test token generation

### Method 2: Use Postman/curl with Cookie
1. After OAuth, copy the `sessionId` cookie from Application tab
2. Use it in requests:

```bash
curl -X GET http://127.0.0.1:3000/api/v1/child-app/generate-token \
  -H "Cookie: sessionId=YOUR_SESSION_ID_HERE"
```

## Quick Fix: Test Session ID Transfer

Even if `/auth/me` returns 401, you can still test if the session ID is being transferred by checking the token generation logic directly.

Run this to see what `req.sessionID` contains:

```javascript
// This will show you what session ID the backend sees
// (if you can access backend logs)
```

## Expected Behavior

After OAuth callback:
1. Backend sets cookie: `Set-Cookie: sessionId=abc123; Path=/; HttpOnly`
2. Browser stores cookie for `127.0.0.1:3000`
3. Frontend requests to `127.0.0.1:3000` should include cookie
4. If cookie is included, `/auth/me` should return 200

## If Cookie Still Not Working

The issue might be that the cookie domain needs to be explicitly set. Check your `.env`:

```env
COOKIE_DOMAIN=127.0.0.1
```

Or try setting it to empty/undefined for development.

