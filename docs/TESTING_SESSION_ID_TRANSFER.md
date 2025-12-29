# Testing Session ID Transfer

This guide shows how to verify that the main application is correctly transferring the session ID to the child app via JWT tokens.

## Test Methods

### Method 1: Test Token Generation Endpoint

#### Step 1: Login to Main App
First, you need to authenticate and get a session cookie:

```bash
# Login via browser or API
# After login, you'll have a session cookie
```

#### Step 2: Generate Token and Check Session ID
```bash
# Replace YOUR_SESSION_COOKIE with actual session cookie from login
curl -X GET http://127.0.0.1:3000/api/v1/child-app/generate-token \
  -H "Cookie: sessionId=YOUR_SESSION_COOKIE" \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "10m",
  "child_app_url": "https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net"
}
```

#### Step 3: Decode Token to Verify Session ID
Use JWT.io or decode the token to verify it contains `session_id`:

**Using JWT.io:**
1. Go to https://jwt.io
2. Paste the token from the response
3. Check the payload - it should contain:
   ```json
   {
     "session_id": "abc123...",
     "user_id": 1,
     "email": "user@example.com",
     "full_name": "User Name",
     "profile_completed": true,
     "iat": 1234567890,
     "exp": 1234567890,
     "iss": "tradingpro-main-app",
     "aud": "tradingpro-child-app"
   }
   ```

**Using Node.js:**
```javascript
const jwt = require('jsonwebtoken');
const token = 'YOUR_TOKEN_HERE';
const decoded = jwt.decode(token, { complete: true });
console.log('Session ID:', decoded.payload.session_id);
console.log('Full Payload:', JSON.stringify(decoded.payload, null, 2));
```

### Method 2: Test via Browser Console

1. **Login to Dashboard:**
   - Open `http://127.0.0.1:8000/dashboard.html`
   - Login with your credentials

2. **Open Browser Console (F12)**

3. **Generate Token:**
   ```javascript
   fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
     credentials: 'include'
   })
   .then(res => res.json())
   .then(data => {
     console.log('Token:', data.token);
     
     // Decode token to see session_id
     const parts = data.token.split('.');
     const payload = JSON.parse(atob(parts[1]));
     console.log('Session ID in token:', payload.session_id);
     console.log('Full payload:', payload);
   });
   ```

### Method 3: Test Launch Endpoint

Test the full launch flow which includes session ID:

```bash
curl -X POST http://127.0.0.1:3000/api/v1/child-app/launch \
  -H "Cookie: sessionId=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"return_url": "/dashboard"}' \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "redirect_url": "https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net?sso_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Extract the token from `redirect_url` and decode it to verify `session_id`.

### Method 4: Automated Test Script

Create a test script to verify session ID transfer.

