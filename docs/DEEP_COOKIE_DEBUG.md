# Deep Cookie Debug - Cookie Not Being Sent

## Current Status
- ✅ Cookie stored: `s%3AF9xI7-dR3ItbsKELPpbg1AvbnfIO9nZT...`
- ✅ Cookie attributes correct
- ✅ Third-party cookies enabled
- ❌ Cookie still NOT being sent in requests

## Possible Causes

### 1. Cookie Format Mismatch
The cookie has format `s:sessionID.signature` (signed), but maybe express-session isn't recognizing it.

### 2. Cookie Domain/Path Mismatch
Even though attributes look correct, there might be a subtle mismatch.

### 3. Request Not Including Credentials
Even with `credentials: 'include'`, something might be preventing it.

### 4. Cookie Was Set But Not Updated
The cookie might be from an old session that doesn't match the current one.

## Debug Steps

### Step 1: Check Cookie Value Format

In Application tab → Cookies → `sessionId`:
- What is the EXACT value? (Copy it)
- Does it start with `s:` when decoded?

### Step 2: Check Backend Logs

After OAuth, check backend logs for:
- What session ID was created? (Look for "Session saved" log)
- Does it match the cookie value?

### Step 3: Test Manual Cookie Setting

In browser console, try:

```javascript
// Check current cookies
document.cookie

// Try to manually set cookie (won't work if HttpOnly, but test)
fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log('Test cookie response:', data));
```

### Step 4: Check Network Tab Details

In Network tab → `/auth/me` request:
1. **Request Headers** - Is there ANY cookie-related header?
2. **Response Headers** - Is there `Set-Cookie`?
3. **General** - What is the Request URL? (Full URL)

### Step 5: Check Cookie Attributes Again

In Application tab → Cookies → `sessionId`:
- **Domain:** Exact value?
- **Path:** Exact value?
- **HttpOnly:** Checked?
- **SameSite:** Exact value? (Lax, Strict, None?)
- **Secure:** Checked or unchecked?
- **Expires:** What date?

## Test: Clear Everything and Retry

1. **Application tab** → **Cookies** → Delete ALL cookies for `127.0.0.1:3000`
2. **Application tab** → **Local Storage** → Clear all
3. **Application tab** → **Session Storage** → Clear all
4. **Close browser completely**
5. **Reopen browser**
6. **Try OAuth login again**
7. **Check if cookie is sent**

## Alternative: Check Backend Session Reading

The backend might not be reading the cookie correctly. Check backend logs when `/auth/me` is called:
- Does it show `cookies: "No cookies"`?
- Or does it show the cookie value?

This will tell us if:
- Cookie is sent but backend doesn't see it → Backend issue
- Cookie is not sent → Browser issue

