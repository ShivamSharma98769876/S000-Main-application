# Child App Integration - API Endpoints Quick Reference

## Base URL
```
http://127.0.0.1:3000/api/v1
```

## Available Endpoints

### 1. Check Authentication
```bash
GET /api/v1/auth/me
```
**Test:**
```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/me', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log(data));
```

### 2. Generate Child App Token
```bash
GET /api/v1/child-app/generate-token
```
**Requires:** Authentication (session cookie)

**Test:**
```javascript
fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('Token:', data.token);
  const payload = JSON.parse(atob(data.token.split('.')[1]));
  console.log('Session ID:', payload.session_id);
});
```

### 3. Launch Child App
```bash
POST /api/v1/child-app/launch
```
**Requires:** Authentication + CSRF token

**Body:**
```json
{
  "return_url": "/dashboard"
}
```

### 4. Verify Token
```bash
POST /api/v1/child-app/verify-token
```
**Body:**
```json
{
  "token": "YOUR_JWT_TOKEN"
}
```

### 5. Refresh Token
```bash
POST /api/v1/child-app/refresh-token
```
**Body:**
```json
{
  "token": "YOUR_EXPIRED_TOKEN"
}
```

## Quick Test Script

Run this in browser console (after login):

```javascript
// Complete test
async function testEndpoints() {
  console.log('🧪 Testing Child App Endpoints\n');
  
  // 1. Check auth
  console.log('1. Testing /auth/me...');
  const auth = await fetch('http://127.0.0.1:3000/api/v1/auth/me', {
    credentials: 'include'
  });
  console.log('   Status:', auth.status);
  
  if (auth.status === 200) {
    const user = await auth.json();
    console.log('   ✅ Authenticated as:', user.user?.email);
    
    // 2. Generate token
    console.log('\n2. Testing /child-app/generate-token...');
    const tokenRes = await fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
      credentials: 'include'
    });
    
    if (tokenRes.status === 200) {
      const data = await tokenRes.json();
      console.log('   ✅ Token generated');
      
      // Decode token
      const payload = JSON.parse(atob(data.token.split('.')[1]));
      console.log('   Session ID:', payload.session_id);
      console.log('   User ID:', payload.user_id);
      console.log('   Email:', payload.email);
      
      console.log('\n✅ All tests passed!');
    } else {
      console.error('   ❌ Failed:', tokenRes.status);
    }
  } else {
    console.error('   ❌ Not authenticated');
    console.log('   💡 Login at: http://127.0.0.1:8000/login.html');
  }
}

testEndpoints();
```

## Health Check

```bash
GET /health
```

**Test:**
```javascript
fetch('http://127.0.0.1:3000/health')
.then(res => res.json())
.then(data => console.log(data));
```

## Common Errors

- **404 Not Found** - Wrong endpoint URL
- **401 Unauthorized** - Not logged in
- **403 Forbidden** - Missing CSRF token (for POST requests)
- **429 Too Many Requests** - Rate limit exceeded

