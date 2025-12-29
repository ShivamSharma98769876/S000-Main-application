# Session Cookie Fix - Cross-Port Issue

## The Problem
Cookies set on `127.0.0.1:3000` (backend) aren't being sent with requests from `127.0.0.1:8000` (frontend), even though both are on the same domain.

## Root Cause
While cookies CAN work across ports on the same domain, there are several factors that can prevent it:

1. **Cookie Domain**: If domain is explicitly set, it might not work
2. **SameSite Policy**: `Lax` should work, but might block in some cases
3. **Cookie Path**: Must match the API path
4. **Timing**: Cookie might not be set before redirect completes

## Solution: Check Backend Logs

After restarting the server, check the logs when you:
1. Complete OAuth login
2. Try to access `/api/v1/auth/me`

You should see detailed logging showing:
- Session ID after login
- Whether session exists
- Whether cookies are being sent
- Authentication status

## Expected Log Output

After OAuth callback:
```
OAuth login successful: { userId: 2, sessionID: 'abc123...', hasSession: true }
Session saved: { sessionID: 'abc123...', userId: 2 }
```

When accessing `/auth/me`:
```
Auth /me check: { 
  hasSession: true, 
  sessionID: 'abc123...', 
  isAuthenticated: true,
  cookies: 'sessionId=abc123...',
  user: 2
}
```

## If Session Still Not Working

### Option 1: Check Cookie in Browser
1. After OAuth, open DevTools → Application → Cookies
2. Check `http://127.0.0.1:3000` for `sessionId` cookie
3. Verify it has:
   - Domain: `127.0.0.1` (or empty)
   - Path: `/`
   - HttpOnly: ✅
   - SameSite: `Lax`

### Option 2: Test with Debug Endpoint
```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Session Debug:', data);
  // Check if sessionID exists
});
```

### Option 3: Verify Session in Database
Check if session is being stored:
```sql
SELECT * FROM session WHERE sess->>'passport' IS NOT NULL 
ORDER BY expire DESC LIMIT 5;
```

## Important Note

**The session ID transfer code is correct!** 

Even if `/auth/me` returns 401, the token generation endpoint uses `req.sessionID` which will work once the session cookie issue is resolved.

The code at `backend/routes/child-app.routes.js:34` correctly uses:
```javascript
const token = jwtService.generateToken(userData, req.sessionID);
```

So `session_id` WILL be in the JWT token once the session cookie works.

## Next Steps

1. **Check the logs** after restarting server
2. **Verify cookie exists** in Application tab
3. **Test debug endpoint** to see session state
4. **Once cookie works**, session ID transfer will work automatically

