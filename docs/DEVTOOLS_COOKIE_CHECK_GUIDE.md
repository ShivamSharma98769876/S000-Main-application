# DevTools Cookie Check Guide - Step by Step

## Step 1: Open DevTools

1. Open your browser (Chrome/Edge recommended)
2. Go to `http://127.0.0.1:3000/login.html`
3. Press **F12** (or Right-click → Inspect)
4. DevTools should open at the bottom or side

## Step 2: Clear Network Log

1. In DevTools, click the **Network** tab
2. Click the **Clear** button (🚫 icon) to clear previous requests
3. Make sure **"Preserve log"** is checked (so requests don't disappear)

## Step 3: Start OAuth Login

1. Click **"Login with Google"** button
2. Complete the OAuth flow
3. Watch the Network tab - you'll see requests appearing

## Step 4: Check OAuth Redirect Response

### Find the OAuth Callback Request

1. In Network tab, look for a request named:
   - `/oauth/google/callback` or
   - `/api/v1/auth/oauth/google/callback`
2. It should show **Status: 302** (redirect)
3. **Click on it** to see details

### Check Response Headers

1. With the request selected, look at the tabs below:
   - **Headers** tab (should be selected)
   - **Preview** tab
   - **Response** tab
2. In the **Headers** tab, scroll down to **Response Headers** section
3. **Look for `Set-Cookie`** header

**What to look for:**
```
Set-Cookie: sessionId=xxxxx; Path=/; HttpOnly; SameSite=Lax
```

**Report:**
- ✅ **Found it?** Copy the full `Set-Cookie` value
- ❌ **Not found?** Say "No Set-Cookie header"

## Step 5: Check Cookie Storage

1. In DevTools, click the **Application** tab (or **Storage** in Firefox)
2. In the left sidebar, expand **Cookies**
3. Click on `http://127.0.0.1:3000`
4. Look for a cookie named `sessionId`

**What to check:**
- **Name:** `sessionId`
- **Value:** Should be something like `s:xxxxx.xxxxx`
- **Domain:** `127.0.0.1`
- **Path:** `/`
- **HttpOnly:** ✅ (checked)
- **SameSite:** `Lax`

**Report:**
- ✅ **Cookie exists?** What is the Value?
- ❌ **No cookie?** Say "No sessionId cookie found"

## Step 6: Check /auth/me Request

1. Go back to **Network** tab
2. Look for a request named:
   - `/me` or
   - `/api/v1/auth/me`
3. It should show **Status: 401** (Unauthorized)
4. **Click on it**

### Check Request Headers

1. In the **Headers** tab, scroll to **Request Headers** section
2. **Look for `Cookie`** header

**What to look for:**
```
Cookie: sessionId=xxxxx
```

**Report:**
- ✅ **Found it?** Copy the full `Cookie` value
- ❌ **Not found?** Say "No Cookie header"

## Step 7: Check Console for Errors

1. Click the **Console** tab in DevTools
2. Look for any red error messages
3. Look for messages about cookies or CORS

**Report any errors you see**

## Quick Checklist

After OAuth login, check these in order:

- [ ] **Network tab** → `/oauth/google/callback` → Response Headers → `Set-Cookie` exists?
- [ ] **Application tab** → Cookies → `http://127.0.0.1:3000` → `sessionId` cookie exists?
- [ ] **Network tab** → `/api/v1/auth/me` → Request Headers → `Cookie` header exists?
- [ ] **Console tab** → Any errors?

## What to Report

Please share:

1. **Set-Cookie header:**
   - Present? (Yes/No)
   - If yes, what's the value? (copy it)

2. **Cookie in Application tab:**
   - Present? (Yes/No)
   - If yes, what's the value?

3. **Cookie in /auth/me request:**
   - Present? (Yes/No)
   - If yes, what's the value?

4. **Any console errors?**
   - List any errors you see

## Visual Guide

### Network Tab Layout:
```
┌─────────────────────────────────────┐
│ Network                             │
├─────────────────────────────────────┤
│ Name          Status  Type          │
│ /oauth/...    302     document      │ ← Click this
│ /auth/me      401     fetch         │ ← Click this
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ Headers | Preview | Response         │
├─────────────────────────────────────┤
│ Response Headers:                    │
│   Set-Cookie: sessionId=...          │ ← Look here
│ Request Headers:                      │
│   Cookie: sessionId=...              │ ← Look here
└─────────────────────────────────────┘
```

### Application Tab Layout:
```
┌─────────────────────────────────────┐
│ Application                          │
├─────────────────────────────────────┤
│ Cookies                              │
│   ▼ http://127.0.0.1:3000           │ ← Expand this
│     sessionId                        │ ← Look for this
└─────────────────────────────────────┘
```

## Common Issues

### Issue 1: Set-Cookie Not in Response
- **Symptom:** No `Set-Cookie` in OAuth redirect response
- **Meaning:** Cookie isn't being set by backend
- **Fix:** Backend needs to set cookie

### Issue 2: Cookie Not in Application Tab
- **Symptom:** `Set-Cookie` exists but no cookie in Application tab
- **Meaning:** Browser rejected the cookie
- **Fix:** Check cookie attributes (SameSite, Secure, Domain)

### Issue 3: Cookie Not in Request
- **Symptom:** Cookie in Application tab but not in `/auth/me` request
- **Meaning:** Browser not sending cookie
- **Fix:** Check CORS, SameSite, Domain settings

## Next Steps

After you check these, share the results and I'll help fix the specific issue!

