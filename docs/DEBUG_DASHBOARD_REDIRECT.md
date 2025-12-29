# Debug: Dashboard Redirecting to Login

## Problem
- OAuth login succeeds
- Dashboard appears for a second
- Then redirects to login.html

## Root Cause
The dashboard calls `/auth/me` which returns 401 because cookies aren't being sent. The dashboard then redirects to login.

## Debugging Steps

### Step 1: Check Network Tab After OAuth

1. Open DevTools (F12) → **Network** tab
2. Complete OAuth login
3. Look for these requests in order:
   - `/oauth/google/callback` (302 redirect)
   - `/dashboard.html` (200 - page loads)
   - `/api/v1/auth/me` (401 - auth fails)
   - Redirect to `/login.html`

### Step 2: Check OAuth Redirect Response

In the Network tab, find the `/oauth/google/callback` request:

1. Click on it
2. Go to **Response Headers** tab
3. Look for `Set-Cookie` header

**Expected:**
```
Set-Cookie: sessionId=xxxxx; Path=/; HttpOnly; SameSite=Lax
```

**If missing:** Cookie isn't being set by backend.

### Step 3: Check Cookie Storage

1. DevTools → **Application** tab
2. **Cookies** → `http://127.0.0.1:3000`
3. Look for `sessionId` cookie

**If missing:** Cookie isn't being stored by browser.

### Step 4: Check /auth/me Request

In Network tab, find the `/api/v1/auth/me` request:

1. Click on it
2. Go to **Request Headers** tab
3. Look for `Cookie` header

**Expected:**
```
Cookie: sessionId=xxxxx
```

**If missing:** Cookie isn't being sent with request.

### Step 5: Check Console Logs

After OAuth, check browser console for:

```
Auth check response: { status: 401, ... }
❌ Cookie not found! This is a cookie issue.
```

## Quick Test

After OAuth redirect, before dashboard redirects, run in console:

```javascript
// Check cookies
console.log('Cookies:', document.cookie);

// Check debug endpoint
fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Debug Session:', data);
  console.log('Cookies sent:', data.cookies);
  console.log('Has session:', data.hasSession);
  console.log('Is authenticated:', data.isAuthenticated);
});
```

## Common Issues

### Issue 1: Cookie Not Set
**Symptom:** No `Set-Cookie` header in OAuth redirect
**Fix:** Check backend session configuration

### Issue 2: Cookie Not Stored
**Symptom:** Cookie not in Application → Cookies
**Fix:** Check cookie attributes (SameSite, Secure, Domain)

### Issue 3: Cookie Not Sent
**Symptom:** No `Cookie` header in `/auth/me` request
**Fix:** Check CORS configuration and `credentials: 'include'`

## Expected Flow

1. ✅ User clicks "Login with Google"
2. ✅ Redirects to Google OAuth
3. ✅ Google redirects back to `/oauth/google/callback`
4. ✅ Backend sets cookie (`Set-Cookie` header)
5. ✅ Browser stores cookie (Application → Cookies)
6. ✅ Redirects to `/dashboard.html`
7. ✅ Dashboard loads and calls `/auth/me`
8. ✅ Browser sends cookie (`Cookie` header)
9. ✅ Backend authenticates user
10. ✅ Dashboard displays content

## Current Flow (Broken)

1. ✅ Steps 1-4 work
2. ❌ Step 5 fails (cookie not stored)
3. ✅ Step 6 works (redirects to dashboard)
4. ✅ Step 7 works (calls `/auth/me`)
5. ❌ Step 8 fails (cookie not sent)
6. ❌ Step 9 fails (401 Unauthorized)
7. ❌ Step 10 fails (redirects to login)

## Next Steps

1. Check Network tab for `Set-Cookie` header
2. Check Application tab for stored cookie
3. Check Network tab for `Cookie` header in `/auth/me` request
4. Share findings for further debugging

