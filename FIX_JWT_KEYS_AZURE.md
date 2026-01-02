# Fix JWT Keys Error on Azure

## Error
```
Error: secretOrPrivateKey must be an asymmetric key when using RS256
```

## Problem
The JWT service requires RSA keys (private and public) but they're either:
1. Not set in Azure environment variables
2. Set incorrectly (wrong format)
3. Using a symmetric secret instead of RSA keys

## Solution: Set JWT Keys in Azure

### Step 1: Generate RSA Keys (if you don't have them)

On your local machine:
```bash
cd backend
node scripts/generate-keys.js
```

This creates:
- `backend/config/keys/private.pem`
- `backend/config/keys/public.pem`

### Step 2: Get Key Contents

**Windows (PowerShell):**
```powershell
cd backend
Get-Content config/keys/private.pem -Raw
Get-Content config/keys/public.pem -Raw
```

**Linux/Mac:**
```bash
cd backend
cat config/keys/private.pem
cat config/keys/public.pem
```

### Step 3: Add to Azure Portal

1. Go to **Azure Portal** → **Your App Service** → **Configuration** → **Application settings**
2. Click **+ New application setting**

**Add Setting 1:**
- **Name**: `JWT_PRIVATE_KEY`
- **Value**: Paste the **ENTIRE** content of `private.pem`, including:
  ```
  -----BEGIN PRIVATE KEY-----
  ... (all the key content) ...
  -----END PRIVATE KEY-----
  ```
- **Deployment slot setting**: ✅ (recommended)

**Add Setting 2:**
- **Name**: `JWT_PUBLIC_KEY`
- **Value**: Paste the **ENTIRE** content of `public.pem`, including:
  ```
  -----BEGIN PUBLIC KEY-----
  ... (all the key content) ...
  -----END PUBLIC KEY-----
  ```
- **Deployment slot setting**: ✅ (recommended)

3. Click **Save** at the top
4. **Restart** the App Service

### Step 4: Verify

Check the logs - you should see:
```
JWT Service initialized from environment variables
JWT Service initialized successfully
```

## Important Notes

### Key Format Requirements

✅ **Correct Format:**
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
(multiple lines of base64 encoded key)
...
-----END PRIVATE KEY-----
```

❌ **Wrong Format:**
- Just the base64 string without headers
- A symmetric secret (like a password)
- Missing BEGIN/END markers
- Extra spaces or line breaks in the middle

### For Multi-line Values in Azure

When pasting multi-line values in Azure Portal:
1. Make sure to include **ALL** lines
2. Include the `-----BEGIN` and `-----END` lines
3. Don't add extra quotes or escaping
4. The value should be exactly as it appears in the file

### Alternative: Use Secret References (Advanced)

If you prefer, you can store keys in Azure Key Vault and reference them:
```
JWT_PRIVATE_KEY=@Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/jwt-private-key/)
JWT_PUBLIC_KEY=@Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/jwt-public-key/)
```

## Troubleshooting

### Error: "JWT_PRIVATE_KEY is not in valid PEM format"
- **Cause**: Key is missing BEGIN/END markers or is not in PEM format
- **Fix**: Make sure you copied the entire key including headers

### Error: "JWT keys not found"
- **Cause**: Environment variables not set
- **Fix**: Add `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in Azure Portal

### Error: "secretOrPrivateKey must be an asymmetric key"
- **Cause**: Using a symmetric secret instead of RSA private key
- **Fix**: Generate RSA keys using `generate-keys.js` and use those

## Quick Check

After setting the keys, check logs for:
```
✅ JWT Service initialized from environment variables
✅ JWT Service initialized successfully
```

If you see errors, verify:
1. Keys are set in Azure Portal
2. Keys include BEGIN/END markers
3. Keys are in PEM format (not just base64)
4. App service was restarted after adding keys

