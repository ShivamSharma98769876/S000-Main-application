# Check Backend Logs - Critical Debug

## The Issue
Cookie is stored but not being sent. Let's check what the backend sees.

## Step 1: Check Backend Logs

After OAuth login, when `/auth/me` is called, check your **backend console logs**.

Look for this log entry:
```
Auth /me check | {"cookies":"...","sessionID":"...","isAuthenticated":false}
```

**What does it show for `cookies`?**
- If it shows `"cookies":"No cookies"` → Cookie is NOT being sent ❌
- If it shows `"cookies":"sessionId=..."` → Cookie IS being sent ✅

## Step 2: Check Cookie Domain Match

The cookie domain is `127.0.0.1`. Check:

1. **Application tab** → **Cookies** → `sessionId`
2. **Domain:** What does it say exactly?
   - Should be: `127.0.0.1` (no port)
   - Or: empty/blank

3. **Network tab** → `/auth/me` request
4. **Request URL:** What does it say?
   - Should be: `http://127.0.0.1:3000/api/v1/auth/me`

**Do they match?**
- Domain: `127.0.0.1`
- Request: `http://127.0.0.1:3000`

If domain is `127.0.0.1:3000` (with port), that's wrong! It should be just `127.0.0.1`.

## Step 3: Test Manual Cookie

In browser console, run:

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Cookies received by backend:', data.cookiesReceived);
  console.log('Session ID:', data.sessionID);
});
```

**What does `cookiesReceived` show?**
- If it shows the cookie → Cookie is being sent ✅
- If it shows "No cookies" → Cookie is NOT being sent ❌

## Step 4: Check Cookie Path

1. **Application tab** → **Cookies** → `sessionId`
2. **Path:** What does it say?
   - Should be: `/`

3. **Request path:** `/api/v1/auth/me`
4. **Does cookie path match?**
   - Cookie path: `/` (matches all paths) ✅
   - Request path: `/api/v1/auth/me` (starts with `/`) ✅

## What to Report

Please share:
1. **Backend logs** - What does `cookies` show in the log?
2. **Cookie Domain** - Exact value in Application tab
3. **Test cookie response** - What does `cookiesReceived` show?

This will tell us if:
- Cookie is sent but backend doesn't see it → Backend parsing issue
- Cookie is not sent → Browser issue

