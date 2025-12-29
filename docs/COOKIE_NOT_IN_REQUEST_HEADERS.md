# Cookie Not in Request Headers - Fix

## Problem Confirmed
- ✅ Cookie is stored: `s%3AF9xI7-dR3ItbsKELPpbg1AvbnfIO9nZT...`
- ✅ Request is same-origin: `sec-fetch-site: same-origin`
- ❌ **NO `Cookie` header in request!**

## Root Cause
The cookie is stored but the browser isn't sending it. This could be:
1. Cookie format mismatch (express-session expects different format)
2. Cookie was set with wrong attributes
3. Request isn't including credentials

## Check: Cookie Format

The cookie value `s%3AF9xI7-dR3ItbsKELPpbg1AvbnfIO9nZT...` when decoded is:
- `s:F9xI7-dR3ItbsKELPpbg1AvbnfIO9nZT...`

The `s:` prefix is the signed cookie format from express-session. But when we manually set the cookie with `res.cookie('sessionId', req.sessionID, ...)`, we're setting it to just the session ID without the `s:` prefix.

## Issue: Cookie Format Mismatch

When express-session sets the cookie, it uses a signed format like:
- `s:sessionID.signature`

But we're setting it manually as just:
- `sessionID`

This mismatch might cause express-session to not recognize the cookie.

## Solution: Let express-session Set Cookie

Instead of manually setting the cookie, we should let express-session handle it. The issue is that `res.redirect()` might bypass the session middleware's cookie-setting logic.

## Alternative: Match express-session Format

If we must set it manually, we need to match the format that express-session uses. But this is complex because it involves signing.

## Best Solution: Fix express-session Cookie Setting

The real fix is to ensure express-session sets the cookie properly on redirect. Let me check if we can force it to set the cookie before redirect.

