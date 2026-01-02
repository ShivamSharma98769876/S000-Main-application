# JWT Key Paths in Azure

## Path Resolution Order (On Azure)

The code checks for JWT keys in this **exact order**:

### 1. **Azure File System** (Priority 1 - Checked First)
```
/home/site/wwwroot/config/keys/private.pem
/home/site/wwwroot/config/keys/public.pem
```

**Full absolute paths:**
- Private Key: `/home/site/wwwroot/config/keys/private.pem`
- Public Key: `/home/site/wwwroot/config/keys/public.pem`

**In Azure Kudu Console, this translates to:**
- `site\wwwroot\config\keys\private.pem`
- `site\wwwroot\config\keys\public.pem`

### 2. **Environment Variables** (Priority 2 - If file system keys not found)
- `JWT_PRIVATE_KEY` (from Azure Portal → Configuration → Application settings)
- `JWT_PUBLIC_KEY` (from Azure Portal → Configuration → Application settings)

### 3. **Relative Path** (Priority 3 - Fallback for local development)
```
/home/site/wwwroot/backend/config/keys/private.pem
/home/site/wwwroot/backend/config/keys/public.pem
```

## Current Behavior

Based on your screenshots showing keys in `/home/site/wwwroot/config/keys/`, the code will:

1. ✅ **First check**: `/home/site/wwwroot/config/keys/private.pem` and `public.pem`
2. ✅ **If found**: Use those keys (ignoring environment variables)
3. ✅ **Validate**: Check that keys are valid RSA keys in PEM format
4. ❌ **If not found**: Fall back to environment variables

## How to Verify Which Path is Being Used

Check your Azure logs for one of these messages:

**If using file system keys:**
```
✅ Found JWT keys in Azure file system, using file system keys
   privateKeyPath: /home/site/wwwroot/config/keys/private.pem
   publicKeyPath: /home/site/wwwroot/config/keys/public.pem
```

**If using environment variables:**
```
✅ Checking JWT keys from environment variables
   hasJWT_PRIVATE_KEY: true
   hasJWT_PUBLIC_KEY: true
```

## Summary

**On Azure, the code validates JWT_PRIVATE_KEY from:**
1. **File System**: `/home/site/wwwroot/config/keys/private.pem` (PRIORITY)
2. **Environment Variable**: `process.env.JWT_PRIVATE_KEY` (FALLBACK)

Since you have keys in the file system, the code will use those and ignore the environment variables.

