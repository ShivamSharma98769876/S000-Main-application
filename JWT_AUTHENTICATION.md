# JWT Authentication Implementation

## Overview
This application uses **JWT (JSON Web Tokens) as the primary and required authentication method** for all protected API endpoints.

## Authentication Flow

### 1. User Login (OAuth)
- User authenticates via Google/Apple OAuth
- Backend generates a JWT token after successful authentication
- Token is included in the redirect URL: `?token=<jwt_token>`
- Frontend extracts token from URL and stores it in `localStorage`

### 2. API Requests
- Frontend includes JWT token in `Authorization` header:
  ```
  Authorization: Bearer <jwt_token>
  ```
- All protected routes require this header

### 3. Token Validation
- Backend validates JWT token on every request
- Token is verified using RS256 algorithm with public/private key pair
- User data is fetched from database to ensure user still exists
- Token payload includes: `user_id`, `email`, `full_name`, `profile_completed`, `is_admin`, `zerodha_client_id`

## Protected Routes

All API routes use the `isAuthenticated` middleware which **requires JWT tokens**:

### User Routes
- `POST /api/v1/users/me/profile` - Update profile
- `GET /api/v1/users/me/profile` - Get profile
- `PUT /api/v1/users/me/profile` - Update profile

### Product Routes
- `GET /api/v1/products` - List products
- `GET /api/v1/products/:id` - Get product
- `POST /api/v1/products` - Create product (Admin)
- `PUT /api/v1/products/:id` - Update product (Admin)
- `DELETE /api/v1/products/:id` - Delete product (Admin)

### Cart Routes
- `GET /api/v1/cart` - Get cart
- `POST /api/v1/cart/items` - Add item
- `PUT /api/v1/cart/items/:itemId` - Update item
- `DELETE /api/v1/cart/items/:itemId` - Remove item
- `DELETE /api/v1/cart` - Clear cart

### Order Routes
- `POST /api/v1/orders` - Create order
- `POST /api/v1/orders/:orderId/payment-proof` - Upload payment proof
- `GET /api/v1/orders/me` - Get user orders
- `GET /api/v1/orders/me/:orderId` - Get order details

### Subscription Routes
- `GET /api/v1/subscriptions/me` - Get user subscriptions
- `GET /api/v1/subscriptions` - List all subscriptions (Admin)

### Admin Routes
- All admin routes require both `isAuthenticated` and `isAdmin` middleware
- Admin status is checked from JWT token payload (`is_admin: true`)

### Child App Routes
- `GET /api/v1/child-app/generate-token` - Generate inter-app token
- `POST /api/v1/child-app/launch` - Launch child app with SSO

## Authentication Middleware

### `isAuthenticated`
- **Requires**: JWT token in `Authorization: Bearer <token>` header
- **Validates**: Token signature, expiration, and user existence
- **Returns**: 401 if token is missing, invalid, or expired
- **No session fallback**: JWT is the only authentication method

### `isAdmin`
- **Requires**: `isAuthenticated` to pass first
- **Checks**: `is_admin` flag in JWT token payload or user database record
- **Returns**: 403 if user is not admin

### `isProfileComplete`
- **Requires**: `isAuthenticated` to pass first
- **Checks**: `profile_completed` flag in user profile
- **Returns**: 403 if profile is incomplete

## JWT Token Structure

```json
{
  "user_id": 123,
  "email": "user@example.com",
  "full_name": "John Doe",
  "profile_completed": true,
  "is_admin": false,
  "zerodha_client_id": null,
  "iat": 1234567890,
  "exp": 1234571490,
  "iss": "tradingpro-user-auth",
  "aud": "tradingpro-main-app"
}
```

## Token Expiration
- Tokens have an expiration time (default: 24 hours)
- Expired tokens return 401 with message: "Token expired. Please log in again"
- Frontend should handle token expiration and redirect to login

## Security Features
1. **RS256 Algorithm**: Uses asymmetric encryption (public/private key pair)
2. **Token Verification**: Every request validates token signature and expiration
3. **User Validation**: Fetches user from database to ensure user still exists
4. **No Session Dependency**: Pure stateless JWT authentication
5. **Audience Validation**: Tokens are scoped to specific applications

## Frontend Implementation

### Storing Token
```javascript
// After OAuth redirect
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
if (token) {
    localStorage.setItem('authToken', token);
}
```

### Using Token
```javascript
// In API requests
const token = localStorage.getItem('authToken');
fetch(`${API_BASE_URL}/users/me/profile`, {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});
```

### Handling Expiration
```javascript
if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
}
```

## Migration Notes
- **Previous**: Used session-based authentication with Passport.js
- **Current**: JWT-only authentication (session fallback removed)
- **OAuth Flow**: Still uses Passport.js for OAuth, but immediately converts to JWT
- **Database**: PostgreSQL (no session storage needed)

## Testing Authentication
```bash
# Get token from OAuth login, then:
curl -H "Authorization: Bearer <your_jwt_token>" \
     http://localhost:3000/api/v1/auth/me
```

## Error Responses

### Missing Token
```json
{
  "error": "Unauthorized",
  "message": "JWT token required. Please include Authorization: Bearer <token> header"
}
```

### Invalid/Expired Token
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired JWT token. Please log in again"
}
```

### User Not Found
```json
{
  "error": "Unauthorized",
  "message": "User not found"
}
```

