# Quick DevTools Check - 3 Steps

## Step 1: Check OAuth Redirect (30 seconds)

1. **Open DevTools** (F12)
2. **Network tab** → Clear log (🚫 icon)
3. **Login with Google**
4. Find `/oauth/google/callback` request (302)
5. **Click it** → **Headers tab** → **Response Headers**
6. **Look for `Set-Cookie`**

**Report:** Is `Set-Cookie` header present? (Yes/No)

## Step 2: Check Cookie Storage (20 seconds)

1. **Application tab** (or Storage in Firefox)
2. **Cookies** → `http://127.0.0.1:3000`
3. **Look for `sessionId` cookie**

**Report:** Is `sessionId` cookie stored? (Yes/No)

## Step 3: Check /auth/me Request (20 seconds)

1. **Network tab**
2. Find `/api/v1/auth/me` request (401)
3. **Click it** → **Headers tab** → **Request Headers**
4. **Look for `Cookie`**

**Report:** Is `Cookie` header present? (Yes/No)

---

## Quick Report Format

Copy and fill this:

```
Set-Cookie in OAuth redirect: [Yes/No]
Cookie in Application tab: [Yes/No]
Cookie in /auth/me request: [Yes/No]
```

That's it! This will tell us exactly where the problem is.

