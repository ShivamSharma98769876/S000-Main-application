# Cookie Fix Guide - Cross-Port Development

## Problem
Cookies set on `127.0.0.1:3000` (backend) aren't being sent with requests from `127.0.0.1:8000` (frontend).

## Solution Applied

### 1. Updated Cookie Configuration
- **Development**: `sameSite: 'lax'`, `secure: false`, no domain set
- **Production**: `sameSite: 'lax'`, `secure: true`, domain from env

### 2. Key Changes
- Removed domain restriction in development
- Set `path: '/'` explicitly
- Kept `httpOnly: true` for security
- `sameSite: 'lax'` allows top-level navigation (OAuth redirects)

## How It Works

1. **OAuth Callback** sets cookie on `127.0.0.1:3000`
2. **Browser stores cookie** for `127.0.0.1:3000`
3. **Frontend requests** from `127.0.0.1:8000` to `127.0.0.1:3000` include the cookie
4. **Backend receives cookie** and authenticates the user

## Testing

### Step 1: Restart Backend Server
```bash
cd backend
npm run dev
```

### Step 2: Test OAuth Login
1. Go to `http://127.0.0.1:8000/login.html`
2. Click "Login with Google"
3. Complete OAuth flow
4. You should be redirected to dashboard

### Step 3: Verify Cookie
Open browser console and run:
```javascript
// Check if authenticated
fetch('http://127.0.0.1:3000/api/v1/auth/me', {
  credentials: 'include'
})
.then(res => {
  console.log('Status:', res.status);
  if (res.status === 200) {
    console.log('✅ Cookie is working!');
    return res.json();
  } else {
    console.log('❌ Still not working');
  }
})
.then(data => {
  if (data) {
    console.log('User:', data.user);
  }
});
```

### Step 4: Test Session ID Transfer
```javascript
// Test session ID transfer
fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
  credentials: 'include'
})
.then(res => res.json())
.then(data => {
  if (data.success && data.token) {
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    console.log('✅ Session ID in token:', payload.session_id);
    console.log('✅ User ID:', payload.user_id);
    console.log('✅ Email:', payload.email);
    console.log('\n🎉 Session ID transfer is working!');
  }
});
```

## Browser Cookie Storage

Check cookie in DevTools:
1. Open DevTools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Cookies → `http://127.0.0.1:3000`
4. Look for `sessionId` cookie
5. Verify:
   - Domain: `127.0.0.1` (or empty)
   - Path: `/`
   - HttpOnly: ✅
   - SameSite: `Lax`
   - Secure: ❌ (in development)

## Troubleshooting

### If cookies still not working:

1. **Clear browser cookies**:
   - DevTools → Application → Cookies → Clear all
   - Try OAuth again

2. **Check CORS**:
   - Verify `credentials: true` in backend CORS config (already set)
   - Verify `credentials: 'include'` in frontend fetch (already set)

3. **Check browser console**:
   - Look for CORS errors
   - Check Network tab for cookie headers

4. **Try different browser**:
   - Some browsers handle cookies differently
   - Try Chrome, Firefox, or Edge

5. **Check backend logs**:
   - Look for "OAuth login successful" log
   - Check "Session saved" log
   - Verify sessionID is created

## Expected Behavior

After fix:
- ✅ OAuth login sets cookie
- ✅ Cookie is stored for `127.0.0.1:3000`
- ✅ Requests from `127.0.0.1:8000` include cookie
- ✅ `/auth/me` returns 200 (not 401)
- ✅ Session ID is in JWT token

## Production Notes

In production:
- Use HTTPS (required for `secure: true`)
- Set `COOKIE_DOMAIN` environment variable
- Ensure frontend and backend are on same domain (or configure CORS properly)

