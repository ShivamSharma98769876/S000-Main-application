# JWT Configuration - Environment Variables

Add the following environment variables to your `backend/.env` file:

```env
# JWT Configuration
JWT_PRIVATE_KEY_PATH=./config/keys/private.pem
JWT_PUBLIC_KEY_PATH=./config/keys/public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
JWT_EXPIRY=10m

# Child App URLs
CHILD_APP_URL=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
CHILD_APP_ALLOWED_ORIGINS=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
```

## Setup Steps

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Generate RSA keys:**
   ```bash
   node scripts/generate-keys.js
   ```

3. **Add environment variables** to your `.env` file (see above)

4. **Share public key** with child app team via secure channel (Azure Key Vault, encrypted email, etc.)

## Important Notes

- ⚠️ **NEVER commit** `private.pem` to the repository
- The public key (`public.pem`) should be shared securely with the child app team
- Keys are stored in `backend/config/keys/` directory
- The `.gitignore` file has been updated to exclude `.pem` files

