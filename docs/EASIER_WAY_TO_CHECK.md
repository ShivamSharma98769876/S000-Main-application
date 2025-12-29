# Easier Way - Check After Login

If you can't find the OAuth callback request, here's an easier way:

## Simple Method: Check After Dashboard Loads

1. **Open DevTools** (F12)
2. **Network tab** → Clear log
3. **Login with Google** (complete the flow)
4. After dashboard appears (even if it redirects), check:

### Check Application Tab (Easiest)

1. **Application tab** (or Storage)
2. **Cookies** → `http://127.0.0.1:3000`
3. **Do you see `sessionId` cookie?**
   - ✅ **Yes** → Cookie is stored! Problem is elsewhere
   - ❌ **No** → Cookie isn't being set

### Check /auth/me Request

1. **Network tab**
2. Look for `/api/v1/auth/me` request (should be 401)
3. **Click it** → **Headers** → **Request Headers**
4. **Do you see `Cookie` header?**
   - ✅ **Yes** → Cookie is being sent! Problem is authentication
   - ❌ **No** → Cookie isn't being sent

## Even Simpler: Just Check Application Tab

**This is the fastest check:**

1. **Application tab**
2. **Cookies** → `http://127.0.0.1:3000`
3. **Is there a `sessionId` cookie?**

**If NO cookie:**
- Cookie isn't being set
- Check Network tab for Set-Cookie header

**If YES cookie:**
- Cookie is stored
- Check if it's being sent in requests

## What to Report

Just tell me:
1. **Application tab** → Cookies → Do you see `sessionId`? (Yes/No)
2. **Network tab** → `/auth/me` request → Request Headers → Do you see `Cookie`? (Yes/No)

That's enough to diagnose the issue!

