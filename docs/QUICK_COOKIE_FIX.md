# Quick Cookie Fix - Step by Step

## The Problem
Cookies aren't being sent from `127.0.0.1:8000` to `127.0.0.1:3000` even though both use the same hostname.

## Immediate Solution: Check Network Tab

### Step 1: Check if Cookie is Set
1. Open DevTools (F12)
2. Go to **Network** tab
3. Complete OAuth login
4. Find the **302 redirect** response from `/oauth/google/callback`
5. Check **Response Headers** for `Set-Cookie`

**What to look for:**
```
Set-Cookie: sessionId=xxxxx; Path=/; HttpOnly; SameSite=Lax
```

### Step 2: Check if Cookie is Stored
1. DevTools → **Application** tab
2. **Cookies** → `http://127.0.0.1:3000`
3. Look for `sessionId` cookie

### Step 3: Check if Cookie is Sent
1. After OAuth, make a request to `/auth/me`
2. In Network tab, check the **Request Headers**
3. Look for `Cookie: sessionId=xxxxx`

## If Cookie is NOT Set

The cookie might not be set in the response. Check backend logs for:
```
Session saved: { sessionID: '...', userId: 2 }
Cookie header will be set: { ... }
```

## If Cookie IS Set But Not Sent

This is a browser security issue. Try:

### Option 1: Clear All Cookies and Try Again
1. DevTools → Application → Cookies
2. Delete ALL cookies for `127.0.0.1`
3. Close browser completely
4. Reopen and try OAuth again

### Option 2: Use Incognito/Private Mode
Test in incognito mode to rule out browser extensions or cached settings.

### Option 3: Try Different Browser
Test in Chrome, Firefox, or Edge to see if it's browser-specific.

## Quick Test Script

Run this in browser console after OAuth:

```javascript
// 1. Check if cookie exists
console.log('Cookies:', document.cookie);

// 2. Check debug endpoint
fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('\n=== Debug Session ===');
  console.log('Has Session:', data.hasSession);
  console.log('Session ID:', data.sessionID);
  console.log('Is Authenticated:', data.isAuthenticated);
  console.log('Cookies Received:', data.cookies);
  console.log('Session Data:', data.sessionData);
  
  if (data.cookies === 'No cookies') {
    console.log('\n❌ PROBLEM: Cookies not being sent!');
    console.log('Check Network tab for Set-Cookie header in OAuth redirect');
  } else {
    console.log('\n✅ Cookies are being sent!');
  }
});
```

## Expected Results

**If working:**
- ✅ `Set-Cookie` header in OAuth redirect response
- ✅ Cookie stored in Application → Cookies
- ✅ `Cookie` header in `/auth/me` request
- ✅ `isAuthenticated: true`

**If not working:**
- ❌ No `Set-Cookie` header → Cookie not being set
- ❌ Cookie not in storage → Browser rejecting cookie
- ❌ No `Cookie` header → Cookie not being sent

## Share Results

After running the test, share:
1. Is `Set-Cookie` header present in OAuth redirect?
2. Is cookie stored in Application → Cookies?
3. Is `Cookie` header present in `/auth/me` request?
4. What does the debug endpoint return?

This will help identify the exact issue.

