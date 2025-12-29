# Cookie Fix Instructions - FINAL SOLUTION

## ✅ Problem Identified

Your `.env` file had:
```
FRONTEND_URL=http://localhost:8000
```

But backend is on `127.0.0.1:3000`. Browsers treat `localhost` and `127.0.0.1` as **different origins**, so cookies aren't shared.

## ✅ Solution Applied

Updated `.env` to:
```
FRONTEND_URL=http://127.0.0.1:8000
```

## Next Steps

### 1. Restart Backend Server
```bash
# Stop current server (Ctrl+C)
cd backend
npm run dev
```

### 2. Access Frontend with Correct URL
**IMPORTANT:** Use `http://127.0.0.1:8000` (NOT `localhost:8000`)

```bash
# Start frontend server
cd public
python -m http.server 8000
```

Then open: **`http://127.0.0.1:8000`** (not localhost)

### 3. Clear Browser Cookies
1. Open DevTools (F12)
2. Application tab → Cookies
3. Delete cookies for:
   - `http://localhost:8000`
   - `http://127.0.0.1:8000`
   - `http://127.0.0.1:3000`
4. Close and reopen browser (optional but recommended)

### 4. Test OAuth Login
1. Go to: **`http://127.0.0.1:8000/login.html`**
2. Click "Login with Google"
3. Complete OAuth flow
4. Should redirect to dashboard

### 5. Verify It Works
Open browser console and run:

```javascript
// Test authentication
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
  if (data && data.user) {
    console.log('User:', data.user);
    
    // Test session ID transfer
    return fetch('http://127.0.0.1:3000/api/v1/child-app/generate-token', {
      credentials: 'include'
    });
  }
})
.then(res => {
  if (res && res.ok) {
    return res.json();
  }
})
.then(data => {
  if (data && data.token) {
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    console.log('\n✅ Session ID in token:', payload.session_id);
    console.log('✅ User ID:', payload.user_id);
    console.log('✅ Email:', payload.email);
    console.log('\n🎉 Everything is working!');
  }
});
```

## Why This Works

- **Before**: `localhost:8000` → `127.0.0.1:3000` (different origins, cookies blocked)
- **After**: `127.0.0.1:8000` → `127.0.0.1:3000` (same hostname, cookies work)

Cookies set on `127.0.0.1:3000` will now be sent when making requests from `127.0.0.1:8000` to `127.0.0.1:3000`.

## Expected Result

After restarting and testing:
- ✅ OAuth login sets cookie
- ✅ Cookie is sent with requests
- ✅ `/auth/me` returns 200 (not 401)
- ✅ Session ID is included in JWT token
- ✅ Session ID transfer is working!

## Important Reminder

**Always use `127.0.0.1:8000` (not `localhost:8000`)** when accessing the frontend to ensure cookies work correctly.

