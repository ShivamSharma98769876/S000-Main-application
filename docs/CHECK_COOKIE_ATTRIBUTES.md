# Check Cookie Attributes - Critical

## What We Know
- ✅ Cookie IS stored: `sessionId=s%3ABmmo2LtR2aikcM9IpRgKjBGMdUQnbJg6...`
- ❌ Cookie is NOT being sent in requests

## Check Cookie Attributes

In **Application tab** → **Cookies** → `sessionId`:

Look at these attributes and tell me what they are:

1. **Domain:** What does it say? (Should be `127.0.0.1` or empty)
2. **Path:** What does it say? (Should be `/`)
3. **HttpOnly:** Is it checked? (Should be ✅)
4. **SameSite:** What does it say? (`Lax`, `Strict`, or `None`)
5. **Secure:** Is it checked? (Should be ❌ in development)

## Common Issues

### Issue 1: SameSite is Strict
- **Symptom:** Cookie stored but not sent
- **Fix:** Should be `Lax` or `None`

### Issue 2: Domain Mismatch
- **Symptom:** Cookie domain doesn't match request domain
- **Fix:** Domain should be `127.0.0.1` or empty

### Issue 3: Path Mismatch
- **Symptom:** Cookie path doesn't match request path
- **Fix:** Path should be `/`

## What to Report

Please check the cookie attributes and tell me:
1. **Domain:** [value]
2. **Path:** [value]
3. **SameSite:** [value]
4. **Secure:** [checked/unchecked]

This will help identify why the cookie isn't being sent!

