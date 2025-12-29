# Child App SSO Middleware - Reference Implementation

This document contains the reference implementation for the child app SSO authentication middleware. Share this with the child app development team.

## ⚠️ SECURE TRANSFER REQUIRED

### Step 1: Share Public Key

1. Copy `backend/config/keys/public.pem` from the main app
2. Transfer via:
   - Azure Key Vault (recommended)
   - Encrypted email
   - Secure file sharing service
   
**DO NOT:**
- Commit to repository
- Send via plain email
- Share via Slack/Teams

### Step 2: Store Public Key in Child App

Once received, store the public key in the child app:
- Location: `config/keys/main-app-public.pem`
- Ensure the directory exists
- Add to `.gitignore` to prevent accidental commits

---

## Middleware Implementation

See `child-app-examples/middleware/sso-auth.js` for the complete implementation.

## Route Protection Examples

See `child-app-examples/routes/example-usage.js` for usage examples.

## Environment Variables

The child app needs these environment variables:

```env
MAIN_APP_URL=http://127.0.0.1:3000
MAIN_APP_PUBLIC_KEY_PATH=./config/keys/main-app-public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
NODE_ENV=production
```

## Testing

1. Get a test JWT token from the main app:
   ```bash
   curl -X GET http://127.0.0.1:3000/api/v1/child-app/generate-token \
     -H "Cookie: sessionId=YOUR_SESSION_ID"
   ```

2. Test the middleware with the token:
   ```bash
   curl -X GET http://child-app-url/dashboard \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## Support

For questions or issues, contact the main app development team.

