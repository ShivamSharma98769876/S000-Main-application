# Fix Cookie Name Issue

## Problem Found!
- Cookie in Application tab: `sessionld` (lowercase 'l')
- Backend expects: `sessionId` (uppercase 'I')
- **Mismatch!** Backend won't recognize the cookie.

## Solution

### Step 1: Delete Wrong Cookie
1. **Application tab** → **Cookies** → `http://127.0.0.1:3000`
2. **Right-click** on `sessionld` cookie
3. **Delete** it

### Step 2: Clear All Cookies (Optional)
1. **Application tab** → **Cookies**
2. **Right-click** → **Clear all**

### Step 3: Try OAuth Again
1. Go to `http://127.0.0.1:3000/login.html`
2. Click "Login with Google"
3. Complete OAuth

### Step 4: Verify Cookie Name
After OAuth, check:
- **Application tab** → **Cookies** → Cookie name should be `sessionId` (with uppercase 'I')
- **NOT** `sessionld` (with lowercase 'l')

## Why This Happened

The cookie might have been set with the wrong name, or there's a typo somewhere. The backend is configured to use `sessionId` (uppercase 'I'), so the cookie must match exactly.

## After Fix

Once the cookie name is correct (`sessionId`), the backend will recognize it and authentication should work!

