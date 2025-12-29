# Session ID Mismatch Fix

## Problem Identified

The logs show:
- **OAuth creates new session:** `sessionID: "2vO1F3Vr2hPz4OupdtrSZfE80xYevfQY"` ✅
- **But `/auth/me` receives old session:** `sessionID: "luB5lT18KNLB0LSGDp2uZlT6F4qccUyM"` ❌

The browser is sending an **OLD session cookie** instead of the new one!

## Root Cause

The cookie isn't being updated in the browser. This could be because:
1. The `Set-Cookie` header isn't in the redirect response
2. The browser isn't replacing the old cookie
3. There's a cookie domain/path mismatch

## Solution

### Step 1: Check Network Tab
1. Open DevTools → Network tab
2. Complete OAuth login
3. Find `/oauth/google/callback` request (302 redirect)
4. Check **Response Headers** for `Set-Cookie` header

**Expected:**
```
Set-Cookie: sessionId=s%3A2vO1F3Vr2hPz4OupdtrSZfE80xYevfQY.xxx; Path=/; HttpOnly; SameSite=Lax
```

### Step 2: Check Application Tab
1. DevTools → Application → Cookies
2. Check `http://127.0.0.1:3000`
3. Look for `sessionId` cookie
4. **Check the value** - does it match the new session ID?

### Step 3: Clear Old Cookies
The old cookie might be stuck. Try:
1. DevTools → Application → Cookies
2. Delete ALL cookies for `http://127.0.0.1:3000`
3. Try OAuth login again

### Step 4: Test Debug Endpoint
After OAuth, run this in console:

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Session ID in cookie:', data.parsedCookies.sessionId);
  console.log('Session ID in session:', data.sessionID);
  console.log('Match:', data.parsedCookies.sessionId?.includes(data.sessionID));
  
  if (!data.parsedCookies.sessionId?.includes(data.sessionID)) {
    console.error('❌ MISMATCH: Cookie has old session ID!');
    console.log('   Cookie session:', data.parsedCookies.sessionId);
    console.log('   Actual session:', data.sessionID);
  } else {
    console.log('✅ Session IDs match!');
  }
});
```

## Expected Behavior

After OAuth:
1. ✅ New session created: `2vO1F3Vr2hPz4OupdtrSZfE80xYevfQY`
2. ✅ Cookie set with new session ID
3. ✅ Browser stores new cookie
4. ✅ `/auth/me` receives new cookie
5. ✅ Authentication works!

## If Cookie Still Not Updating

Try:
1. **Clear all cookies** for `127.0.0.1:3000`
2. **Use incognito mode** to test
3. **Check browser console** for cookie warnings
4. **Verify `Set-Cookie` header** is in redirect response

The issue is that the browser has an old cookie cached. Once it's cleared, the new cookie should work!

