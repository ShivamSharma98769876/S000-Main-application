# Quick Test: Session ID Transfer (Fixed Version)

## Issue: 401 Unauthorized

If you get a 401 error, you need to be logged in first. Follow these steps:

## Step 1: Verify You're Logged In

Run this in the browser console to check your authentication:

```javascript
// Check if you're authenticated
fetch('http://127.0.0.1:3000/api/v1/auth/me', {
  credentials: 'include'
})
.then(res => {
  console.log('Auth Status:', res.status);
  if (res.status === 200) {
    console.log('✅ You are logged in');
    return res.json();
  } else {
    console.error('❌ Not authenticated. Please login first at http://127.0.0.1:8000/login.html');
    throw new Error('Not authenticated');
  }
})
.then(data => {
  console.log('User info:', data);
});
```

## Step 2: Test Token Generation (With Error Handling)

Use this improved version that handles errors:

```javascript
fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
  credentials: 'include'
})
.then(res => {
  console.log('Response status:', res.status);
  
  if (res.status === 401) {
    console.error('❌ 401 Unauthorized - You need to login first!');
    console.log('👉 Go to: http://127.0.0.1:8000/login.html');
    throw new Error('Not authenticated');
  }
  
  if (!res.ok) {
    console.error('❌ Error:', res.status, res.statusText);
    return res.text().then(text => {
      console.error('Response:', text);
      throw new Error('Request failed');
    });
  }
  
  return res.json();
})
.then(data => {
  if (!data || !data.token) {
    console.error('❌ No token in response:', data);
    return;
  }
  
  console.log('✅ Token received:', data.token.substring(0, 50) + '...');
  
  // Decode token
  try {
    const parts = data.token.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid token format');
      return;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    
    console.log('\n📦 Token Payload:');
    console.log(JSON.stringify(payload, null, 2));
    
    console.log('\n🔑 Session ID:', payload.session_id);
    console.log('👤 User ID:', payload.user_id);
    console.log('📧 Email:', payload.email);
    
    if (payload.session_id) {
      console.log('\n✅ SUCCESS: Session ID is being transferred!');
      console.log('✅ Session ID value:', payload.session_id);
    } else {
      console.error('\n❌ FAILED: Session ID missing from token!');
    }
  } catch (error) {
    console.error('❌ Error decoding token:', error);
  }
})
.catch(error => {
  console.error('❌ Request failed:', error.message);
  console.log('\n💡 Troubleshooting:');
  console.log('1. Make sure you are logged in');
  console.log('2. Check that cookies are enabled');
  console.log('3. Verify the backend server is running on port 3000');
  console.log('4. Try logging in again at http://127.0.0.1:8000/login.html');
});
```

## Step 3: Check Your Session Cookie

To see your current session:

```javascript
// Check cookies
document.cookie.split(';').forEach(cookie => {
  const [name, value] = cookie.trim().split('=');
  if (name === 'sessionId' || name.includes('session')) {
    console.log('Session cookie found:', name, '=', value.substring(0, 20) + '...');
  }
});
```

## Alternative: Test from Dashboard Page

If you're on the dashboard page (`dashboard.html`), you can use the existing function:

```javascript
// This uses the same API_BASE_URL as the dashboard
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

fetch(`${API_BASE_URL}/child-app/generate-token`, {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  if (data.success && data.token) {
    const parts = data.token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    console.log('Session ID:', payload.session_id);
    console.log('Full payload:', payload);
  } else {
    console.error('Error:', data);
  }
});
```

## Complete Test Flow

1. **Login first:**
   - Go to `http://127.0.0.1:8000/login.html`
   - Login with your credentials
   - You should be redirected to dashboard

2. **Then test:**
   - Open console (F12)
   - Run the test script above
   - Check for session_id in the output

## Expected Output (Success)

```
Response status: 200
✅ Token received: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...

📦 Token Payload:
{
  "session_id": "abc123-def456-ghi789",
  "user_id": 1,
  "email": "user@example.com",
  "full_name": "User Name",
  "profile_completed": true,
  "iss": "tradingpro-main-app",
  "aud": "tradingpro-child-app",
  "exp": 1234567890,
  "iat": 1234567890
}

🔑 Session ID: abc123-def456-ghi789
👤 User ID: 1
📧 Email: user@example.com

✅ SUCCESS: Session ID is being transferred!
✅ Session ID value: abc123-def456-ghi789
```

