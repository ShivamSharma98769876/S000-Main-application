# Update FRONTEND_URL to Port 3000

## Problem
OAuth redirects to `http://127.0.0.1:8000/dashboard.html` instead of `http://127.0.0.1:3000/dashboard.html`

## Solution
Updated `FRONTEND_URL` in `.env` file from port 8000 to port 3000.

## What Changed
- **Before:** `FRONTEND_URL=http://127.0.0.1:8000`
- **After:** `FRONTEND_URL=http://127.0.0.1:3000`

## Next Steps

### 1. Restart Backend Server
The backend needs to be restarted to load the new environment variable:

```bash
# Stop current server (Ctrl+C)
cd backend
npm run dev
```

### 2. Test OAuth Login
1. Go to `http://127.0.0.1:3000/login.html`
2. Click "Login with Google"
3. Complete OAuth
4. Should redirect to `http://127.0.0.1:3000/dashboard.html` ✅

## Important
- **Always access frontend on port 3000** now
- **Don't use port 8000** anymore
- **Backend serves frontend** on port 3000

## All URLs
- Login: `http://127.0.0.1:3000/login.html`
- Dashboard: `http://127.0.0.1:3000/dashboard.html`
- Register: `http://127.0.0.1:3000/register.html`
- API: `http://127.0.0.1:3000/api/v1/...`

