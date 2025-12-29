# Child App SSO Integration - Reference Implementation

This directory contains reference implementations for integrating SSO authentication in the child application.

## Files

- `middleware/sso-auth.js` - SSO authentication middleware
- `routes/example-usage.js` - Example route protection usage

## Setup Instructions

### 1. Install Dependencies

```bash
npm install jsonwebtoken
```

### 2. Receive Public Key

Get the public key (`public.pem`) from the main app team via secure channel and store it in:
```
config/keys/main-app-public.pem
```

### 3. Configure Environment Variables

Add to your `.env` file:

```env
MAIN_APP_URL=http://127.0.0.1:3000
MAIN_APP_PUBLIC_KEY_PATH=./config/keys/main-app-public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
```

### 4. Copy Middleware

Copy `middleware/sso-auth.js` to your child app's middleware directory.

### 5. Protect Routes

Use the middleware to protect routes as shown in `routes/example-usage.js`.

## Token Sources

The middleware checks for tokens in this order:

1. **Authorization Header**: `Authorization: Bearer <token>`
2. **URL Parameter**: `?sso_token=<token>`
3. **Cookie**: `sso_token=<token>`

## Error Handling

The middleware returns appropriate HTTP status codes:

- `401` - No token provided or invalid/expired token
- `403` - Profile not completed (when using `requireProfileComplete`)
- `500` - Internal server error

All error responses include a `redirect` field pointing to the main app login page.

## Testing

1. Get a JWT token from the main app
2. Test protected routes with the token
3. Verify error handling for expired/invalid tokens

## Support

For questions or issues, contact the main app development team.

