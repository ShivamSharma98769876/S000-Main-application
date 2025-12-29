# Critical: Check Network Tab for Cookie

## The Issue
The cookie is being configured correctly, but it's **NOT being sent** with requests.

## What to Check RIGHT NOW

### Step 1: Check OAuth Redirect Response
1. Open DevTools (F12) → **Network** tab
2. **Clear network log** (trash icon)
3. Complete OAuth login again
4. Find the `/oauth/google/callback` request (302 redirect)
5. **Click on it**
6. Go to **Response Headers** tab (or Headers tab → Response Headers section)
7. **Look for `Set-Cookie` header**

**What you should see:**
```
Set-Cookie: sessionId=Pi-V33w7jLOgMOseFqrEAUv0USwWD0uc; Path=/; HttpOnly; SameSite=Lax
```

**If you see this:** ✅ Cookie is being set
**If you DON'T see this:** ❌ Cookie isn't being set (backend issue)

### Step 2: Check Cookie Storage
1. DevTools → **Application** tab
2. **Cookies** → Expand `http://127.0.0.1:3000`
3. **Look for `sessionId` cookie**

**What you should see:**
- Name: `sessionId`
- Value: `Pi-V33w7jLOgMOseFqrEAUv0USwWD0uc` (or similar)
- Domain: `127.0.0.1`
- Path: `/`
- HttpOnly: ✅
- SameSite: `Lax`

**If you see this:** ✅ Cookie is stored
**If you DON'T see this:** ❌ Cookie isn't being stored (browser issue)

### Step 3: Check /auth/me Request
1. In Network tab, find `/api/v1/auth/me` request (401)
2. **Click on it**
3. Go to **Request Headers** tab (or Headers tab → Request Headers section)
4. **Look for `Cookie` header**

**What you should see:**
```
Cookie: sessionId=Pi-V33w7jLOgMOseFqrEAUv0USwWD0uc
```

**If you see this:** ✅ Cookie is being sent
**If you DON'T see this:** ❌ Cookie isn't being sent (this is the current issue)

## Quick Test Script

Run this in console after OAuth (before dashboard redirects):

```javascript
// 1. Check document.cookie (won't show HttpOnly cookies, but useful for debugging)
console.log('document.cookie:', document.cookie);

// 2. Check debug endpoint
fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('\n=== Cookie Debug ===');
  console.log('Cookies received by backend:', data.cookies);
  console.log('Has session:', data.hasSession);
  console.log('Session ID:', data.sessionID);
  console.log('Is authenticated:', data.isAuthenticated);
  
  if (data.cookies === 'No cookies') {
    console.log('\n❌ PROBLEM: Cookies not being sent!');
    console.log('\nNext steps:');
    console.log('1. Check Network tab → OAuth redirect → Response Headers → Set-Cookie');
    console.log('2. Check Application tab → Cookies → http://127.0.0.1:3000');
    console.log('3. Check Network tab → /auth/me → Request Headers → Cookie');
  } else {
    console.log('\n✅ Cookies are being sent!');
  }
});
```

## What to Report

Please check and report:

1. **Is `Set-Cookie` header present in OAuth redirect?** (Yes/No)
2. **Is cookie stored in Application → Cookies?** (Yes/No)
3. **Is `Cookie` header present in `/auth/me` request?** (Yes/No)
4. **What does the debug endpoint return?** (Copy the output)

This will tell us exactly where the problem is:
- No Set-Cookie → Backend not setting cookie
- Set-Cookie but no storage → Browser rejecting cookie
- Storage but no Cookie header → Browser not sending cookie

