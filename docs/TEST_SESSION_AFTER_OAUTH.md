# Testing Session ID Transfer After OAuth Login

## The Issue
After OAuth login, the session cookie might not be immediately available. Here's how to test properly.

## Step-by-Step Test

### Step 1: Complete OAuth Login
1. Go to `http://127.0.0.1:8000/login.html`
2. Click "Login with Google"
3. Complete OAuth flow
4. You should be redirected to dashboard

### Step 2: Wait for Page Load
After redirect, wait 1-2 seconds for the page to fully load and cookies to be set.

### Step 3: Run This Test in Browser Console

```javascript
// Complete test with session verification
async function testSessionIdTransfer() {
  console.log('🧪 Starting Session ID Transfer Test\n');
  
  // Step 1: Check authentication
  console.log('Step 1: Checking authentication...');
  const authRes = await fetch('http://127.0.0.1:3000/api/v1/auth/me', {
    credentials: 'include'
  });
  
  if (authRes.status !== 200) {
    console.error('❌ Not authenticated. Status:', authRes.status);
    console.log('💡 Try:');
    console.log('   1. Refresh the page');
    console.log('   2. Check Application tab → Cookies → http://127.0.0.1:3000');
    console.log('   3. Look for "sessionId" cookie');
    return;
  }
  
  const userData = await authRes.json();
  console.log('✅ Authenticated as:', userData.user?.email || userData.email);
  console.log('   User ID:', userData.user?.id || userData.id);
  
  // Step 2: Check session cookie
  console.log('\nStep 2: Checking session cookie...');
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {});
  
  if (cookies.sessionId) {
    console.log('✅ Session cookie found:', cookies.sessionId.substring(0, 30) + '...');
  } else {
    console.log('⚠️  Session cookie not found in document.cookie');
    console.log('   (This is OK if cookie is httpOnly - check Application tab)');
  }
  
  // Step 3: Generate token
  console.log('\nStep 3: Generating JWT token...');
  const tokenRes = await fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
    credentials: 'include'
  });
  
  if (tokenRes.status === 401) {
    console.error('❌ 401 Unauthorized - Session not working');
    console.log('💡 The session cookie might not be sent with requests');
    console.log('   Check: Application tab → Cookies → http://127.0.0.1:3000');
    return;
  }
  
  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    console.error('❌ Error:', tokenRes.status, errorText);
    return;
  }
  
  const tokenData = await tokenRes.json();
  
  if (!tokenData.success || !tokenData.token) {
    console.error('❌ Invalid response:', tokenData);
    return;
  }
  
  console.log('✅ Token generated successfully');
  
  // Step 4: Decode token
  console.log('\nStep 4: Decoding token to verify session_id...');
  try {
    const parts = tokenData.token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    
    console.log('\n📦 Token Payload:');
    console.log(JSON.stringify(payload, null, 2));
    
    // Step 5: Verify session_id
    console.log('\nStep 5: Verifying session_id...');
    if (payload.session_id) {
      console.log('✅ SUCCESS: session_id is present in token!');
      console.log('   Session ID:', payload.session_id);
      console.log('   User ID:', payload.user_id);
      console.log('   Email:', payload.email);
      
      // Compare with cookie if available
      if (cookies.sessionId) {
        if (payload.session_id === cookies.sessionId) {
          console.log('✅ Session ID matches cookie value');
        } else {
          console.log('ℹ️  Session ID in token differs from cookie (this is OK)');
          console.log('   Token session_id:', payload.session_id);
          console.log('   Cookie sessionId:', cookies.sessionId);
        }
      }
      
      console.log('\n🎉 TEST PASSED: Session ID is being transferred in JWT token!');
    } else {
      console.error('❌ FAILED: session_id is missing from token payload!');
      console.log('   Available fields:', Object.keys(payload));
    }
  } catch (error) {
    console.error('❌ Error decoding token:', error);
  }
}

// Run the test
testSessionIdTransfer();
```

## Alternative: Test from Dashboard Page

If you're already on the dashboard page, you can use the existing API_BASE_URL:

```javascript
// Use the dashboard's API_BASE_URL
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

fetch(`${API_BASE_URL}/child-app/generate-token`, {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  if (data.success && data.token) {
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    console.log('Session ID:', payload.session_id);
    console.log('Full payload:', payload);
  }
});
```

## Troubleshooting Session Cookie

If you get 401 errors, check:

### 1. Verify Cookie Exists
```javascript
// Check Application tab → Cookies → http://127.0.0.1:3000
// Look for "sessionId" cookie
```

### 2. Check Cookie Settings
The cookie should have:
- Name: `sessionId`
- Domain: `127.0.0.1` (or empty for current domain)
- Path: `/`
- HttpOnly: ✅ (can't access via JavaScript - this is normal)
- SameSite: `Lax`

### 3. Test Cookie Manually
```javascript
// Check if cookie is being sent
fetch('http://127.0.0.1:3000/api/v1/auth/me', {
  credentials: 'include',
  headers: {
    'Cookie': document.cookie // Explicitly send all cookies
  }
})
.then(res => {
  console.log('Status:', res.status);
  return res.json();
})
.then(data => console.log('Response:', data));
```

## Expected Output (Success)

```
🧪 Starting Session ID Transfer Test

Step 1: Checking authentication...
✅ Authenticated as: user@example.com
   User ID: 4

Step 2: Checking session cookie...
✅ Session cookie found: abc123def456...

Step 3: Generating JWT token...
✅ Token generated successfully

Step 4: Decoding token to verify session_id...

📦 Token Payload:
{
  "session_id": "abc123-def456-ghi789",
  "user_id": 4,
  "email": "user@example.com",
  ...
}

Step 5: Verifying session_id...
✅ SUCCESS: session_id is present in token!
   Session ID: abc123-def456-ghi789
   User ID: 4
   Email: user@example.com

🎉 TEST PASSED: Session ID is being transferred in JWT token!
```

