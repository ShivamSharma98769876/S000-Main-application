# Cookie Stored But Not Sent - Fix Guide

## Problem Confirmed ✅
- ✅ Cookie IS stored: `sessionId=s%3ABmmo2LtR2aikcM9IpRgKjBGMdUQnbJg6...`
- ❌ Cookie is NOT being sent in requests

## Root Cause
The cookie is stored but the browser isn't sending it. This could be:
1. Cookie domain/path mismatch
2. SameSite policy blocking it
3. Request not including credentials
4. Cookie attributes preventing send

## Quick Fix: Check Cookie Attributes

In Application tab → Cookies → `sessionId`:

Check these attributes:
- **Domain:** Should be `127.0.0.1` (or empty)
- **Path:** Should be `/`
- **HttpOnly:** ✅ (checked)
- **SameSite:** Should be `Lax` or `None`
- **Secure:** Should be ❌ (unchecked) in development

**If SameSite is `Strict`:** That's the problem! It should be `Lax`.

## Solution: Update Cookie SameSite

The cookie might have been set with `SameSite: Strict` which blocks it from being sent.

Let me check and fix the cookie configuration.

