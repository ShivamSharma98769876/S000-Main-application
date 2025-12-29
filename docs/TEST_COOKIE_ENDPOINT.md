# Test Cookie Endpoint

## Quick Test

I've added a test endpoint to verify if cookies can be set at all.

## Test Steps

1. **Open browser console** (F12 → Console tab)
2. **Run this command:**
   ```javascript
   fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie-set', { credentials: 'include' })
     .then(res => res.json())
     .then(data => {
       console.log('Response:', data);
       console.log('Set-Cookie header:', data.setCookieHeader);
     });
   ```

3. **Check Network tab:**
   - Find `test-cookie-set` request
   - Check Response Headers for `Set-Cookie`
   - Is it present?

4. **Check Application tab:**
   - Go to Cookies → `http://127.0.0.1:3000`
   - Is `sessionId` cookie stored?

## What This Tells Us

- **If Set-Cookie is present**: Cookies CAN be set, issue is specific to OAuth flow
- **If Set-Cookie is NOT present**: Cookies cannot be set at all, need to check express-session configuration

## Also Check OAuth Callback

1. **Clear Network tab**
2. **Set filter to "All"** (not just XHR/Fetch)
3. **Complete OAuth login**
4. **Look for ANY request with "callback" in the name**
5. **Or look for requests with status 200 or 302**

The callback might be:
- `/api/v1/auth/oauth/google/callback`
- Or just `/oauth/google/callback`
- Or it might be filtered out

Please share:
1. What does the test endpoint show? (Set-Cookie header value)
2. Can you find ANY request related to OAuth callback? (even if filtered)

