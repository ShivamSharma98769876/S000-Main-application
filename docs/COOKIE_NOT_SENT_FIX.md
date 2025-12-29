# Fix: Cookie Set But Not Sent

## Problem Confirmed
- ✅ Session is created (`sessionID` exists)
- ✅ Cookie configuration is correct (`sameSite: 'lax'`, `path: '/'`)
- ❌ **Cookies are NOT being sent** (`"cookies":"No cookies"`)

## Root Cause
The cookie is being set on `127.0.0.1:3000` during OAuth redirect, but when the browser makes requests FROM `127.0.0.1:8000` TO `127.0.0.1:3000`, the cookie is not being sent.

This is a **browser security feature** - cookies are port-specific by default.

## Solution: Verify Cookie in Network Tab

### Step 1: Check OAuth Redirect Response
1. Open DevTools (F12) → **Network** tab
2. Complete OAuth login
3. Find the `/oauth/google/callback` request (302 redirect)
4. Click on it
5. Go to **Response Headers** tab
6. **Look for `Set-Cookie` header**

**Expected:**
```
Set-Cookie: sessionId=Pi-V33w7jLOgMOseFqrEAUv0USwWD0uc; Path=/; HttpOnly; SameSite=Lax
```

### Step 2: Check Cookie Storage
1. DevTools → **Application** tab
2. **Cookies** → `http://127.0.0.1:3000`
3. **Look for `sessionId` cookie**

**If cookie exists:** Cookie is stored but not being sent
**If cookie missing:** Cookie isn't being stored

### Step 3: Check /auth/me Request
1. In Network tab, find `/api/v1/auth/me` request (401)
2. Click on it
3. Go to **Request Headers** tab
4. **Look for `Cookie` header**

**Expected:**
```
Cookie: sessionId=Pi-V33w7jLOgMOseFqrEAUv0USwWD0uc
```

**If missing:** Cookie isn't being sent (this is the current issue)

## Why This Happens

Browsers have strict cookie policies:
- Cookies set on `127.0.0.1:3000` are stored for that origin
- When making requests FROM `127.0.0.1:8000` TO `127.0.0.1:3000`, the browser should send cookies
- But if the cookie domain/path doesn't match, it won't be sent

## Possible Fixes

### Fix 1: Check Cookie Domain
The cookie might be set with the wrong domain. Check if `domain` is explicitly set in cookie config.

### Fix 2: Use Same Origin (Workaround)
Serve frontend from backend on same port:
```javascript
// In backend/server.js
app.use(express.static(path.join(__dirname, '../public')));
```
Then access: `http://127.0.0.1:3000` (not port 8000)

### Fix 3: Use Proxy (Recommended)
Use a development proxy to serve both on same origin.

### Fix 4: Check Browser Settings
Some browsers/extensions block cookies. Try:
- Incognito mode
- Different browser
- Disable extensions

## Immediate Test

After OAuth, before dashboard redirects, run in console:

```javascript
// Check if cookie exists
console.log('Cookies:', document.cookie);
console.log('Has sessionId:', document.cookie.includes('sessionId'));

// Check Application tab
// DevTools → Application → Cookies → http://127.0.0.1:3000
// Look for sessionId cookie

// Check Network tab
// Find /oauth/google/callback → Response Headers → Set-Cookie
// Find /api/v1/auth/me → Request Headers → Cookie
```

## What to Share

1. Is `Set-Cookie` header present in OAuth redirect?
2. Is cookie stored in Application → Cookies?
3. Is `Cookie` header present in `/auth/me` request?
4. What browser are you using?

This will help identify if it's:
- Cookie not being set (backend issue)
- Cookie not being stored (browser issue)
- Cookie not being sent (SameSite/CORS issue)

