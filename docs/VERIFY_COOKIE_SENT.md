# Verify Cookie is Being Sent

## Current Status
- ✅ Cookie stored: `s%3AG_QR1mAeXNS1irbLqHrRhKHsQc321rJW...`
- ❌ `/auth/me` returns 401
- ❓ Cookie might not be sent OR backend doesn't recognize it

## Test: Check if Cookie is Sent

Run this in browser console:

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('=== COOKIE TEST ===');
  console.log('Cookies received:', data.cookiesReceived);
  console.log('Session ID:', data.sessionID);
});
```

**What does `cookiesReceived` show?**
- If it shows `sessionId=...` → Cookie IS being sent ✅
- If it shows "No cookies" → Cookie is NOT being sent ❌

## Check Backend Logs

After running the test above, check your **backend terminal** for the log:

```
Auth /me check | {"cookies":"...","sessionID":"...","isAuthenticated":false}
```

**What does `cookies` show in the log?**
- If it shows the cookie → Cookie is sent, but authentication fails
- If it shows "No cookies" → Cookie is not sent

## Possible Issues

### Issue 1: Cookie Not Sent
If `cookiesReceived` shows "No cookies":
- Browser isn't sending the cookie
- Check cookie domain/path attributes
- Check if SameSite is blocking it

### Issue 2: Cookie Sent But Not Recognized
If `cookiesReceived` shows the cookie but auth fails:
- Cookie format might be wrong
- Session might not exist in database
- Passport might not be deserializing correctly

## Next Steps

1. **Run the test above** and share what `cookiesReceived` shows
2. **Check backend terminal** for the detailed log
3. **Share both results** so we can identify the exact issue

