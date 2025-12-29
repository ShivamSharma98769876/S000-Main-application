# Browser Testing: Session ID Transfer

Quick guide for testing session ID transfer directly in the browser.

## Method 1: Browser Console Test

### Step 1: Login and Open Dashboard
1. Open `http://127.0.0.1:8000/dashboard.html`
2. Login with your credentials
3. Open Browser Developer Tools (F12)
4. Go to Console tab

### Step 2: Generate Token and Inspect
Paste this code in the console:

```javascript
// Generate token
fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  console.log('✅ Token generated:', data.token.substring(0, 50) + '...');
  
  // Decode token to see payload
  const parts = data.token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  
  console.log('\n📦 Token Payload:');
  console.log(JSON.stringify(payload, null, 2));
  
  console.log('\n🔑 Session ID in token:', payload.session_id);
  console.log('👤 User ID:', payload.user_id);
  console.log('📧 Email:', payload.email);
  
  // Verify session_id exists
  if (payload.session_id) {
    console.log('\n✅ SUCCESS: Session ID is present in token!');
  } else {
    console.error('\n❌ FAILED: Session ID is missing!');
  }
})
.catch(error => {
  console.error('❌ Error:', error);
});
```

### Step 3: Test Launch Endpoint
```javascript
// Test launch endpoint
fetch('http://127.0.0.1:3000/api/v1/child-app/launch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    return_url: '/dashboard'
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Launch successful');
  
  // Extract token from redirect URL
  const url = new URL(data.redirect_url);
  const token = url.searchParams.get('sso_token');
  
  if (token) {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    console.log('🔑 Session ID in launch token:', payload.session_id);
    console.log('✅ Session ID transfer verified!');
  }
})
.catch(error => {
  console.error('❌ Error:', error);
});
```

## Method 2: Network Tab Inspection

1. Open Developer Tools (F12)
2. Go to Network tab
3. Click "Launch Advanced Tools" button on dashboard
4. Find the request to `/api/v1/child-app/launch`
5. Check Response tab - you'll see the `redirect_url` with token
6. Copy the token from the URL
7. Go to https://jwt.io and paste the token
8. Verify `session_id` is in the payload

## Method 3: Application Tab - Cookies

1. Open Developer Tools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Check Cookies → `http://127.0.0.1:3000`
4. Find `sessionId` cookie - this is your session ID
5. Generate a token using Method 1
6. Compare the `session_id` in the token with the cookie value

## Expected Results

✅ **Success Indicators:**
- Token contains `session_id` field
- `session_id` is a valid UUID or session identifier
- Token includes `user_id`, `email`, `iss`, `aud`
- Token can be verified with public key
- Launch endpoint includes token in redirect URL

❌ **Failure Indicators:**
- Token missing `session_id` field
- Token cannot be decoded
- Token signature verification fails
- Launch endpoint returns error

## Quick Verification Script

Save this as a bookmarklet or run in console:

```javascript
(async function() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
      credentials: 'include'
    });
    const data = await res.json();
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    
    alert(`Session ID: ${payload.session_id}\nUser ID: ${payload.user_id}\nEmail: ${payload.email}`);
  } catch (e) {
    alert('Error: ' + e.message);
  }
})();
```

