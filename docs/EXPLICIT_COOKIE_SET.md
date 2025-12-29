# Explicit Cookie Setting Fix

## Problem
Even on the same port (3000), cookies aren't being sent with requests, causing 401 errors.

## Solution Applied
Added explicit cookie setting in OAuth callback to ensure cookie is sent with redirect response.

## What Changed
- Added `res.cookie()` call to explicitly set the session cookie
- This ensures the cookie is in the response headers
- Cookie is set with same configuration as session middleware

## Next Steps

### 1. Restart Backend Server
```bash
# Stop current server (Ctrl+C)
cd backend
npm run dev
```

### 2. Test OAuth Login
1. Go to `http://127.0.0.1:3000/login.html`
2. Click "Login with Google"
3. Complete OAuth
4. Check Network tab for `Set-Cookie` header in redirect response
5. Dashboard should work!

## Debugging

### Check Network Tab
1. Open DevTools → Network tab
2. Complete OAuth login
3. Find `/oauth/google/callback` request (302)
4. Check Response Headers for `Set-Cookie` header

**Expected:**
```
Set-Cookie: sessionId=xxxxx; Path=/; HttpOnly; SameSite=Lax
```

### Check Application Tab
1. DevTools → Application → Cookies
2. Check `http://127.0.0.1:3000`
3. Look for `sessionId` cookie

### Check /auth/me Request
1. Network tab → Find `/api/v1/auth/me` request
2. Check Request Headers for `Cookie` header

**Expected:**
```
Cookie: sessionId=xxxxx
```

## Why This Should Work
- ✅ Same port (3000) - no cross-port issues
- ✅ Explicit cookie setting - ensures cookie is in response
- ✅ Same origin - cookies work correctly
- ✅ Proper cookie attributes - HttpOnly, SameSite, Path

## If Still Not Working

Check backend logs for:
```
Session saved: { sessionID: '...', cookieHeader: '...' }
Redirecting after OAuth: { cookieSet: true, cookieHeader: '...' }
```

If `cookieHeader` shows the cookie, it's being set. If not, there's an issue with cookie setting.

