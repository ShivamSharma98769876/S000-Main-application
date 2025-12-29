# Cookie Name Mismatch Issue

## Problem
- Cookie exists in Application tab: `sessionld` 
- But request shows: `cookies: ''` (empty)
- Getting 401 Unauthorized

## Issue: Cookie Name Mismatch

The cookie in Application tab is named `sessionld` but the backend expects `sessionId`.

**Check:**
1. Application tab → Cookies → What is the exact cookie name?
   - Is it `sessionld` (with lowercase 'l')?
   - Or `sessionId` (with uppercase 'I')?

2. Backend expects: `sessionId` (with uppercase 'I')

## Fix: Check Cookie Name

The cookie name should be `sessionId` (with uppercase 'I'), not `sessionld`.

If it's `sessionld`, that's the problem - the backend won't recognize it.

## Solution

1. **Delete the wrong cookie:**
   - Application tab → Cookies → Delete `sessionld` (if it exists)

2. **Clear all cookies:**
   - Application tab → Cookies → Right-click → Clear all

3. **Try OAuth again:**
   - This should create a new cookie with the correct name `sessionId`

## Verify

After OAuth, check:
- Application tab → Cookies → Cookie name should be `sessionId` (not `sessionld`)
- Network tab → `/auth/me` → Request Headers → Should show `Cookie: sessionId=...`

If cookie name is correct but still not sent, it's a different issue.

