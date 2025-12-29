# How to Find OAuth Request in Network Tab

## Method 1: Search/Filter

1. **Network tab** is open
2. Look for a **filter/search box** at the top of the Network tab
3. Type: `callback` or `oauth` or `google`
4. This will filter to show only matching requests
5. Look for any request with "callback" or "oauth" in the name

## Method 2: Look for 302 Status

1. In **Network tab**, look at the **Status** column
2. Find any request with **Status: 302** (redirect)
3. That's likely the OAuth callback!
4. Click on it

## Method 3: Look for Requests During Login

1. **Clear Network log** (🚫 icon)
2. **Click "Login with Google"**
3. Watch the Network tab as requests appear
4. Look for:
   - Any request to `google.com` or `accounts.google.com` (OAuth provider)
   - Any request with "callback" in the name
   - Any request with Status 302 (redirect)

## Method 4: Check All Requests

1. In Network tab, make sure **"All"** filter is selected (not "XHR" or "Fetch")
2. Scroll through all requests
3. Look for:
   - `/api/v1/auth/oauth/google/callback`
   - `/oauth/google/callback`
   - Any request with "callback" in URL

## What the Request Looks Like

The request might be named:
- `/oauth/google/callback`
- `/api/v1/auth/oauth/google/callback`
- `callback?code=...` (with query parameters)
- Just `callback` (shortened name)

## Alternative: Check After Redirect

If you can't find the callback request:

1. After OAuth login, you should be redirected to `/dashboard.html`
2. In Network tab, find the `/dashboard.html` request
3. **Before** that request, there should be the OAuth callback
4. Or check requests **before** the dashboard loads

## Quick Test

1. **Clear Network log**
2. **Login with Google**
3. **Count requests** - you should see:
   - Request to Google (accounts.google.com)
   - Request back to your server (callback)
   - Request to dashboard.html
4. The **middle one** (callback) is what we need!

## Still Can't Find It?

Try this:
1. In Network tab, click the **filter dropdown** (might say "All")
2. Make sure **"All"** is selected
3. Look for requests with **Status: 302**
4. Click on any 302 request - that's likely it!

Let me know what requests you see in the Network tab after clicking "Login with Google"!

