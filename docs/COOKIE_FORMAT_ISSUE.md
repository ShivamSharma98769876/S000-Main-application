# Cookie Format Issue - Signed vs Unsigned

## Problem
- Cookie stored: `s%3ABmmo2LtR2aikcM9IpRgKjBGMdUQnbJg6...`
- Cookie NOT being sent

## Cookie Value Analysis

The cookie value `s%3ABmmo2LtR2aikcM9IpRgKjBGMdUQnbJg6...` when decoded is:
- `s:Bmmo2LtR2aikcM9IpRgKjBGMdUQnbJg6...`

The `s:` prefix suggests this might be a **signed cookie** format, but we're setting it as just the session ID.

## Issue: Cookie Format Mismatch

When we call `res.cookie('sessionId', req.sessionID, ...)`, we're setting the cookie to just the session ID.

But `express-session` with `connect-pg-simple` might expect a different format, or the cookie might have been set by express-session in a signed format.

## Solution: Let express-session Handle Cookie

Instead of manually setting the cookie, we should let `express-session` handle it automatically. The issue is that `res.redirect()` might be bypassing the session middleware's cookie-setting logic.

## Test: Check Session ID Match

1. **Backend logs** - After OAuth, what session ID is created?
   - Look for: "Session saved, redirecting" → `sessionID: "xxxxx"`

2. **Cookie value** - What session ID is in the cookie?
   - Decode: `s%3A` = `s:`
   - Session ID is after `s:`

3. **Do they match?**
   - If NO → Cookie has old session ID
   - If YES → Different issue

## Quick Fix: Clear Cookie and Retry

1. **Application tab** → **Cookies** → Delete `sessionId`
2. **Try OAuth login again**
3. **Check if cookie is sent now**

If it works after clearing, the issue was an old cookie with wrong session ID.

