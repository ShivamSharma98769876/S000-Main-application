# JWT Token Naming Conventions

## Overview
This document explains the naming conventions used for JWT tokens throughout the application to ensure clarity and consistency.

## Naming Strategy

### Backend Code
- **Variable Names**: Use `jwtToken` instead of generic `token` for clarity
- **Comments**: Always specify "JWT token" instead of just "token"
- **URL Parameters**: Use `jwt` as the parameter name (e.g., `?jwt=<token>`)

### Frontend Code
- **Function Names**: `getAuthToken()` - returns JWT token (kept for backward compatibility)
- **Variable Names**: Use `jwtToken` in new code, `token` is acceptable in existing code
- **localStorage Key**: `authToken` - stores JWT token (kept for backward compatibility)
- **URL Parameters**: Support both `?jwt=<token>` (new) and `?token=<token>` (legacy) for compatibility

## Why "JWT" Instead of "Token"?

1. **Clarity**: "JWT token" explicitly indicates the token type (JSON Web Token)
2. **Security**: Makes it clear we're using JWT, not session tokens or other auth methods
3. **Documentation**: Easier for developers to understand the authentication mechanism
4. **Debugging**: Clearer error messages and logs

## Current Implementation

### Backend
```javascript
// ✅ Good - Clear and explicit
const jwtToken = jwtService.generateAuthToken(userData);
const redirectUrl = `${baseUrl}?jwt=${encodeURIComponent(jwtToken)}`;

// ❌ Avoid - Too generic
const token = jwtService.generateAuthToken(userData);
const redirectUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;
```

### Frontend
```javascript
// ✅ Good - Supports both for backward compatibility
const jwtTokenFromUrl = urlParams.get('jwt') || urlParams.get('token');
localStorage.setItem('authToken', jwtTokenFromUrl); // Key kept as 'authToken' for compatibility

// ✅ Good - Clear variable naming
const jwtToken = getAuthToken();
headers['Authorization'] = `Bearer ${jwtToken}`;
```

## Migration Notes

- **URL Parameter**: Changed from `?token=` to `?jwt=` for new redirects
- **Backward Compatibility**: Frontend still supports `?token=` parameter
- **localStorage Key**: Kept as `authToken` to avoid breaking existing sessions
- **Variable Names**: Gradually migrating from `token` to `jwtToken` in new code

## Benefits

1. **Self-Documenting Code**: Variable names clearly indicate JWT usage
2. **Easier Debugging**: Logs and errors explicitly mention "JWT token"
3. **Better Security**: Makes it clear we're using JWT, not other token types
4. **Future-Proof**: If we add other token types, naming won't conflict

