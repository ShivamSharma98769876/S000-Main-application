# Debug: Cookie Not Being Sent

## Current Issue
- OAuth login succeeds
- Session is created (`sessionID` exists)
- But cookies are NOT being sent with requests (`cookies: "No cookies"`)

## Root Cause Analysis

The issue is that **cookies are port-specific**. Even though we're using the same hostname (`127.0.0.1`), cookies set on port 3000 won't automatically work on port 8000.

However, when making requests FROM port 8000 TO port 3000, the browser SHOULD send cookies that were set by port 3000.

## Debugging Steps

### Step 1: Check if Cookie is Set in Response

After OAuth login, check the Network tab in DevTools:

1. Open DevTools (F12)
2. Go to Network tab
3. Complete OAuth login
4. Look for the redirect response (302) from `/oauth/google/callback`
5. Check Response Headers for `Set-Cookie` header

**Expected:**
```
Set-Cookie: sessionId=xxxxx; Path=/; HttpOnly; SameSite=Lax
```

**If missing:** Cookie isn't being set in the response.

### Step 2: Check Cookie Storage

1. Open DevTools (F12)
2. Application tab → Cookies
3. Check `http://127.0.0.1:3000`
4. Look for `sessionId` cookie

**If missing:** Cookie isn't being stored by browser.

### Step 3: Test Cookie Manually

After OAuth, run this in console:

```javascript
// Check if cookie exists
document.cookie

// Should show: sessionId=xxxxx
```

### Step 4: Check Backend Logs

Look for these log entries after OAuth:

```
Session saved: { sessionID: '...', userId: 2 }
Cookie header will be set: { cookieName: 'sessionId', ... }
Redirecting after OAuth: { ... }
```

## Possible Solutions

### Solution 1: Verify Cookie is Set

The cookie should be set automatically by `express-session`. If it's not:

1. Check `req.session.cookie` exists
2. Verify session middleware is working
3. Check if cookie is in response headers

### Solution 2: Use Same Port (Workaround)

For development, serve frontend from backend:

```javascript
// In backend/server.js
app.use(express.static(path.join(__dirname, '../public')));
```

Then access: `http://127.0.0.1:3000` (not port 8000)

### Solution 3: Use Proxy (Recommended for Development)

Use a proxy to serve both on same origin:

```javascript
// webpack.config.js or vite.config.js
proxy: {
  '/api': 'http://127.0.0.1:3000'
}
```

### Solution 4: Check SameSite Policy

If `SameSite: Lax` is blocking, try `SameSite: None` with `Secure: true` (requires HTTPS):

```javascript
sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
secure: process.env.NODE_ENV === 'production'
```

## Quick Test

Run this after OAuth to see what's happening:

```javascript
// Check cookies
console.log('All cookies:', document.cookie);

// Check session storage
console.log('Session storage:', sessionStorage);

// Test if cookie would be sent
fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Debug session:', data);
  console.log('Cookies sent:', data.cookies);
  console.log('Has session:', data.hasSession);
  console.log('Session ID:', data.sessionID);
});
```

## Expected Behavior

After OAuth:
1. ✅ Cookie is set in response (`Set-Cookie` header)
2. ✅ Cookie is stored in browser (Application → Cookies)
3. ✅ Cookie is sent with requests (Network tab → Request Headers → Cookie)
4. ✅ Session is authenticated (`isAuthenticated: true`)

## Next Steps

1. Check Network tab for `Set-Cookie` header
2. Check Application tab for stored cookie
3. Check backend logs for cookie configuration
4. Share findings for further debugging

