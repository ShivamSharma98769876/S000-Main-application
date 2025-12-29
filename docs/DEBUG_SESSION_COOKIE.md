# Debugging Session Cookie Issue

## Problem
After OAuth login, the session cookie isn't being sent with subsequent requests, causing 401 errors.

## Quick Fix: Test After Redirect

The issue is likely a timing/cookie issue. Try this:

### Method 1: Wait and Retry
After OAuth redirect completes:

```javascript
// Wait a moment for cookie to be set, then test
setTimeout(() => {
  fetch('http://127.0.0.1:3000/api/v1/auth/me', {
    credentials: 'include'
  })
  .then(res => {
    console.log('Status:', res.status);
    if (res.status === 200) {
      console.log('✅ Session working!');
      return res.json();
    } else {
      console.error('❌ Still not authenticated');
    }
  })
  .then(data => console.log('User:', data));
}, 1000);
```

### Method 2: Check Cookies
First, verify the cookie exists:

```javascript
// Check all cookies
console.log('All cookies:', document.cookie);

// Check specific session cookie
const cookies = document.cookie.split(';').reduce((acc, cookie) => {
  const [name, value] = cookie.trim().split('=');
  acc[name] = value;
  return acc;
}, {});

console.log('Session cookie:', cookies.sessionId);
console.log('All cookies object:', cookies);
```

### Method 3: Manual Cookie Test
If cookie exists but requests fail, test with explicit cookie:

```javascript
// Get cookie value
const sessionCookie = document.cookie
  .split(';')
  .find(c => c.trim().startsWith('sessionId='))
  ?.split('=')[1];

if (sessionCookie) {
  console.log('Found session cookie:', sessionCookie.substring(0, 20) + '...');
  
  // Test with explicit cookie header
  fetch('http://127.0.0.1:3000/api/v1/auth/me', {
    credentials: 'include',
    headers: {
      'Cookie': `sessionId=${sessionCookie}`
    }
  })
  .then(res => res.json())
  .then(data => console.log('User:', data));
} else {
  console.error('❌ No session cookie found');
}
```

## Root Cause Analysis

The session cookie might not be set due to:

1. **Domain mismatch**: Backend (127.0.0.1:3000) vs Frontend (127.0.0.1:8000)
2. **Path mismatch**: Cookie path doesn't match API path
3. **SameSite policy**: Cookie not sent cross-origin
4. **Cookie not persisted**: Cookie cleared or not saved

## Solution: Update Session Configuration

The session cookie needs to work across `127.0.0.1:3000` (backend) and `127.0.0.1:8000` (frontend).

Check your `backend/.env` for:
```env
FRONTEND_URL=http://127.0.0.1:8000
COOKIE_DOMAIN=127.0.0.1
```

## Test Session ID Transfer (After Fix)

Once session is working, test session ID transfer:

```javascript
// Complete test
async function testSessionId() {
  // 1. Check auth
  const auth = await fetch('http://127.0.0.1:3000/api/v1/auth/me', {
    credentials: 'include'
  });
  
  if (auth.status !== 200) {
    console.error('❌ Not authenticated');
    return;
  }
  
  // 2. Generate token
  const tokenRes = await fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
    credentials: 'include'
  });
  
  const data = await tokenRes.json();
  
  // 3. Decode token
  const payload = JSON.parse(atob(data.token.split('.')[1]));
  console.log('Session ID in token:', payload.session_id);
  console.log('Full payload:', payload);
}

testSessionId();
```

