# Cookie Attributes Correct But Not Sent

## Cookie Attributes ✅
- Domain: `127.0.0.1` ✅
- Path: `/` ✅
- SameSite: `Lax` ✅
- Secure: unchecked ✅

**All attributes are correct!** But cookie still not being sent.

## Possible Causes

### Cause 1: Session ID Mismatch
The cookie has an OLD session ID, but backend created a NEW session during OAuth.

**Check this:**
1. Look at the cookie value: `s%3ABmmo2LtR2aikcM9IpRgKjBGMdUQnbJg6...`
2. Decode it: `s:Bmmo2LtR2aikcM9IpRgKjBGMdUQnbJg6` (session ID is after `s:`)
3. Check backend logs for the NEW session ID created during OAuth
4. Do they match?

**If they DON'T match:** The cookie has old session ID, backend has new one.

### Cause 2: Cookie Not Updated
The cookie was set with old session ID, and new cookie wasn't set during OAuth redirect.

**Fix:** Clear the old cookie and try OAuth again.

## Quick Fix: Clear Cookie and Retry

1. **Application tab** → **Cookies** → `http://127.0.0.1:3000`
2. **Right-click** on `sessionId` cookie
3. **Delete** it
4. **Try OAuth login again**
5. **Check if new cookie is set**

## Test: Check Session ID Match

After OAuth, check:

1. **Backend logs** - What session ID was created? (Look for "Session saved" log)
2. **Cookie value** - What session ID is in the cookie? (Decode `s%3A` to get session ID)
3. **Do they match?**

If they don't match, that's the problem - the cookie has old session, backend has new one.

