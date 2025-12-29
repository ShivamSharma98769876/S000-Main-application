# Quick Fix: Clear Cookie and Retry

## The Issue
Cookie is stored but not being sent. The cookie might have an **old session ID** that doesn't match the current session.

## Quick Fix (2 minutes)

### Step 1: Clear the Cookie
1. **Application tab** → **Cookies** → `http://127.0.0.1:3000`
2. **Right-click** on `sessionId` cookie
3. **Delete** it
4. Or click the **Delete** button (🗑️)

### Step 2: Try OAuth Again
1. Go to `http://127.0.0.1:3000/login.html`
2. Click **"Login with Google"**
3. Complete OAuth flow

### Step 3: Check Again
1. **Application tab** → **Cookies** → Check if NEW `sessionId` cookie exists
2. **Network tab** → `/auth/me` request → Check if `Cookie` header is present

## Expected Result

After clearing and retrying:
- ✅ New cookie is set (with new session ID)
- ✅ Cookie is sent in requests
- ✅ Authentication works!

## If Still Not Working

If cookie is still not sent after clearing:
1. Check **Network tab** → `/oauth/google/callback` → Response Headers → Is `Set-Cookie` present?
2. Check **Console tab** → Any errors about cookies or CORS?

Try clearing the cookie first - this often fixes session ID mismatch issues!

