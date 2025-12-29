# Fix: localhost vs 127.0.0.1 Cookie Issue

## Problem
- Frontend: `http://localhost:8000`
- Backend: `127.0.0.1:3000`
- Cookies not being sent because browsers treat `localhost` and `127.0.0.1` as **different origins**

## Solution: Use Same Hostname Everywhere

### Option 1: Use 127.0.0.1 Everywhere (Recommended)

1. **Update `.env` file:**
   ```env
   FRONTEND_URL=http://127.0.0.1:8000
   ```

2. **Access frontend via:**
   ```
   http://127.0.0.1:8000
   ```
   NOT `http://localhost:8000`

3. **Restart backend server**

### Option 2: Use localhost Everywhere

1. **Update `.env` file:**
   ```env
   FRONTEND_URL=http://localhost:8000
   ```

2. **Update backend to use localhost:**
   - Change backend URL to `http://localhost:3000`
   - Update CORS to allow `http://localhost:8000`

3. **Access both via localhost:**
   - Frontend: `http://localhost:8000`
   - Backend: `http://localhost:3000`

## Quick Fix Steps

### Step 1: Check Your .env File
```bash
cd backend
# Check FRONTEND_URL
grep FRONTEND_URL .env
```

### Step 2: Update .env (if needed)
```env
# Use 127.0.0.1 (not localhost)
FRONTEND_URL=http://127.0.0.1:8000
```

### Step 3: Access Frontend with Correct URL
- ✅ Use: `http://127.0.0.1:8000`
- ❌ Don't use: `http://localhost:8000`

### Step 4: Restart Backend
```bash
# Stop server (Ctrl+C)
cd backend
npm run dev
```

### Step 5: Clear Browser Cookies
1. Open DevTools (F12)
2. Application → Cookies
3. Delete all cookies for both `localhost` and `127.0.0.1`
4. Try OAuth login again

## Why This Happens

Browsers enforce **Same-Origin Policy**:
- `http://localhost:8000` ≠ `http://127.0.0.1:3000` (different origins)
- `http://127.0.0.1:8000` ≠ `http://127.0.0.1:3000` (different ports, but same hostname)

However, cookies set on `127.0.0.1:3000` **WILL be sent** when:
- Making requests FROM `127.0.0.1:8000` TO `127.0.0.1:3000`
- Using `credentials: 'include'` in fetch

The issue is mixing `localhost` and `127.0.0.1`.

## Test After Fix

```javascript
// Run this on http://127.0.0.1:8000 (NOT localhost:8000)
fetch('http://127.0.0.1:3000/api/v1/auth/me', {
  credentials: 'include'
})
.then(res => {
  console.log('Status:', res.status);
  if (res.status === 200) {
    console.log('✅ Cookie is working!');
  } else {
    console.log('❌ Still not working');
  }
  return res.json();
})
.then(data => {
  if (data.user) {
    console.log('User:', data.user);
  }
});
```

## Important Notes

1. **Always use the same hostname** (either `127.0.0.1` or `localhost`, not both)
2. **Cookies are port-specific** - cookie set on port 3000 won't work on port 8000
3. **But cookies ARE sent** when making requests from port 8000 to port 3000
4. **The key is same hostname** - don't mix `localhost` and `127.0.0.1`

## Expected Result

After fix:
- ✅ OAuth login sets cookie on `127.0.0.1:3000`
- ✅ Requests from `127.0.0.1:8000` to `127.0.0.1:3000` include cookie
- ✅ `/auth/me` returns 200 (not 401)
- ✅ Session ID is in JWT token

