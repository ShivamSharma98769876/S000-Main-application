# Cookie Not Set in Redirect - Final Analysis

## Problem Confirmed
- ✅ Session created: `sessionID: "h6yfaSk8jSo4q-T6xWdKdMhst9qMgQI_"`
- ✅ Session saved: Passport data present
- ✅ `isAuthenticated: true` after OAuth
- ❌ **"No Set-Cookie header before redirect!"**
- ❌ Browser receives old cookie: `sessionID: "luB5lT18KNLB0LSGDp2uZlT6F4qccUyM"`

## Root Cause
`express-session` middleware doesn't automatically write cookies to redirect responses. The cookie is set when the response ends, but `res.redirect()` sends the response immediately.

## Why res.cookie() Doesn't Work
Even though we call `res.cookie()`, the cookie header might not be set because:
1. Headers might already be sent
2. express-session might override it
3. The redirect happens before cookie is written

## Solution: Check Network Tab

**CRITICAL:** Even though logs say "No Set-Cookie header", the cookie MIGHT actually be in the response!

### Test This:
1. Open DevTools → Network tab
2. Complete OAuth login
3. Find `/oauth/google/callback` request (302)
4. **Check Response Headers** (not Request Headers)
5. Look for `Set-Cookie` header

**If Set-Cookie IS in the response:**
- The cookie is being set!
- The issue is the browser not storing/replacing it
- Solution: Clear old cookies manually

**If Set-Cookie is NOT in the response:**
- Cookie truly isn't being set
- Need different approach (middleware wrapper, etc.)

## Quick Test

After OAuth, before dashboard redirects, check Network tab:

1. Find `/oauth/google/callback` → Response Headers → `Set-Cookie`
2. Find `/api/v1/auth/me` → Request Headers → `Cookie`

**Share results:**
- Is `Set-Cookie` in OAuth redirect response? (Yes/No)
- Is `Cookie` in `/auth/me` request? (Yes/No)
- What session ID is in the cookie?

This will tell us if:
- Cookie is set but browser not using it (clear cookies)
- Cookie is not set at all (need different fix)

