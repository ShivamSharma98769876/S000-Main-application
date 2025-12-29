# Verify Fetch is Sending Credentials

## Problem
- ✅ Cookie is stored with correct attributes
- ❌ Cookie is NOT being sent in requests

## Check: Is Fetch Using Credentials?

### Step 1: Check Network Tab Request Details

1. **Network tab** → Find `/api/v1/auth/me` request (401)
2. **Click it** → **Headers tab**
3. Scroll to **Request Headers**
4. Look for these headers:
   - `Origin: http://127.0.0.1:3000`
   - `Referer: http://127.0.0.1:3000/dashboard.html`

**Do you see these headers?** (Yes/No)

### Step 2: Check if Request is Cross-Origin

Even though both are on port 3000, check:
1. **Network tab** → `/auth/me` request
2. Look at the **Request URL** - what does it say?
   - Should be: `http://127.0.0.1:3000/api/v1/auth/me`
3. Look at **Origin** header - what does it say?
   - Should be: `http://127.0.0.1:3000`

**If they match:** Same origin, cookie should be sent
**If they don't match:** Cross-origin issue

### Step 3: Test with Manual Fetch

Open browser console and run:

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/me', {
  credentials: 'include'
})
.then(res => {
  console.log('Status:', res.status);
  console.log('Response:', res);
  return res.json();
})
.then(data => {
  console.log('Data:', data);
});
```

**Check Network tab** - does this request include the Cookie header?

## Possible Issue: Cookie Domain

Even though Domain is `127.0.0.1`, the browser might not send it if:
- The request is from a different subdomain
- The cookie was set with a different format

## Quick Test: Clear and Retry

1. **Application tab** → **Cookies** → Delete `sessionId` cookie
2. **Try OAuth login again**
3. **Check if new cookie is set**
4. **Check if new cookie is sent**

This will tell us if it's an old cookie issue or a persistent problem.

