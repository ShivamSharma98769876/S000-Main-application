# Critical Session Fix - Regenerate Session

## Problem
Dashboard appears for 2 seconds then redirects to login. This means:
- Session is created but not persisting
- Cookie might be set but session data not saved
- Passport user not being serialized correctly

## Root Cause
The session might not be properly initialized when `req.logIn()` is called. We need to regenerate the session to ensure it's properly set up.

## Solution Applied
Added session regeneration before saving. This ensures:
1. Session is properly initialized
2. Session ID is generated
3. Passport user is serialized
4. Cookie is set correctly

## What Changed
- Added `req.session.regenerate()` before saving
- Re-login after regeneration to ensure Passport serializes user
- Better logging to track session state

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
4. Check backend logs for:
   - "OAuth login successful"
   - "Session saved after regenerate"
   - "Redirecting after OAuth"

### 3. Check Network Tab
1. Open DevTools → Network tab
2. Find `/oauth/google/callback` request
3. Check Response Headers for `Set-Cookie` header
4. Find `/api/v1/auth/me` request
5. Check Request Headers for `Cookie` header

### 4. Check Application Tab
1. DevTools → Application → Cookies
2. Check `http://127.0.0.1:3000`
3. Look for `sessionId` cookie

## Expected Logs

After OAuth, you should see:
```
OAuth login successful: { userId: 2, sessionID: '...', isAuthenticated: true }
Session saved after regenerate: { sessionID: '...', userId: 2, isAuthenticated: true }
Redirecting after OAuth: { sessionID: '...', isAuthenticated: true }
```

When accessing `/auth/me`:
```
Auth /me check: { hasSession: true, sessionID: '...', isAuthenticated: true, cookies: 'sessionId=...' }
```

## If Still Not Working

Check backend logs for:
1. Is `isAuthenticated: true` after OAuth?
2. Is `isAuthenticated: true` when accessing `/auth/me`?
3. Is cookie being sent in request headers?

If `isAuthenticated` is false, the session isn't being deserialized correctly. This could be a Passport configuration issue.

