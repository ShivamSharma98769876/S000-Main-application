# Final Cookie Test - Verify Cookie is Working

## Test Steps

### Step 1: Test Cookie Setting
After restarting backend, run this in browser console:

```javascript
// Test if we can set a cookie
fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Test cookie response:', data);
  
  // Now check if cookie was set
  return fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
    credentials: 'include'
  });
})
.then(res => res.json())
.then(data => {
  console.log('Debug session:', data);
  console.log('Cookies received:', data.cookies);
  console.log('Has session:', data.hasSession);
  console.log('Is authenticated:', data.isAuthenticated);
});
```

### Step 2: Check Application Tab
1. DevTools → Application → Cookies
2. Check `http://127.0.0.1:3000`
3. Look for:
   - `test-cookie` (from test endpoint)
   - `sessionId` (from OAuth)

### Step 3: Complete OAuth Flow
1. Go to `http://127.0.0.1:3000/login.html`
2. Click "Login with Google"
3. Complete OAuth
4. **Before dashboard redirects**, quickly run:

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/debug-session', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('=== After OAuth ===');
  console.log('Cookies:', data.cookies);
  console.log('Session ID:', data.sessionID);
  console.log('Is Authenticated:', data.isAuthenticated);
  console.log('Passport data:', data.passport);
  console.log('User:', data.user);
  
  if (data.cookies === 'No cookies') {
    console.error('❌ PROBLEM: Cookies not being sent!');
    console.log('Check Network tab for Set-Cookie header in OAuth redirect');
  } else if (!data.isAuthenticated) {
    console.error('❌ PROBLEM: Cookie sent but not authenticated!');
    console.log('Passport might not be deserializing user correctly');
    console.log('Passport data:', data.passport);
  } else {
    console.log('✅ SUCCESS: Everything working!');
  }
});
```

## What to Check

1. **Is test cookie set?** (Application → Cookies)
2. **Is sessionId cookie set?** (Application → Cookies)
3. **Are cookies being sent?** (Network → Request Headers → Cookie)
4. **Is Passport data in session?** (debug-session → passport)

## Expected Results

**If working:**
- ✅ Cookies visible in Application tab
- ✅ Cookies in Request Headers
- ✅ `isAuthenticated: true`
- ✅ `passport` data in session
- ✅ `user` object present

**If not working:**
- ❌ No cookies in Application tab → Cookie not being set
- ❌ Cookies in Application but not in Request → Cookie not being sent
- ❌ Cookies sent but `isAuthenticated: false` → Passport issue

## Share Results

After running tests, share:
1. What cookies are in Application tab?
2. What does debug-session return?
3. What do backend logs show?

This will help identify the exact issue.

