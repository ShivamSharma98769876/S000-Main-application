# Fix Azure JWT Keys - Step by Step

## Problem
The error `error:1E08010C:DECODER routines::unsupported` indicates the keys in `/home/site/wwwroot/config/keys/` are corrupted or have wrong formatting.

## Solution

### Step 1: Access Azure Kudu Console

1. Go to **Azure Portal** → **Your App Service**
2. Click **Advanced Tools** → **Go** (opens Kudu)
3. Click **Debug console** → **CMD**

### Step 2: Navigate to Backend Directory

```bash
cd site\wwwroot\backend
```

### Step 3: Run Verification Script

```bash
node scripts/verify-and-fix-azure-keys.js
```

This script will:
- ✅ Check if keys exist
- ✅ Validate key format
- ✅ Try to parse as RSA keys
- ✅ Fix common issues (line endings, etc.)
- ✅ Write fixed keys back if needed

### Step 4: Check the Output

The script will show:
- ✅ If keys are valid
- ❌ If keys are corrupted (with details)
- 🔧 If it can auto-fix the keys

### Step 5: If Keys Are Still Invalid

If the script can't fix the keys, regenerate them:

```bash
# Generate new keys
node scripts/generate-keys.js

# Copy to config folder
mkdir -p site\wwwroot\config\keys
copy backend\config\keys\private.pem site\wwwroot\config\keys\private.pem
copy backend\config\keys\public.pem site\wwwroot\config\keys\public.pem
```

### Step 6: Verify Keys Again

```bash
node scripts/verify-and-fix-azure-keys.js
```

### Step 7: Restart App Service

After fixing keys, restart your App Service from Azure Portal.

## Common Issues

### Issue 1: Windows Line Endings
**Symptom**: Keys have `\r\n` instead of `\n`
**Fix**: The script will auto-fix this

### Issue 2: Missing Newlines
**Symptom**: Key is all on one line
**Fix**: Regenerate keys

### Issue 3: Corrupted Key Content
**Symptom**: Key doesn't start with `-----BEGIN PRIVATE KEY-----`
**Fix**: Regenerate keys

### Issue 4: Wrong Key Type
**Symptom**: Key is symmetric secret instead of RSA
**Fix**: Regenerate keys using `generate-keys.js`

## Expected Output

**Success:**
```
✅ Both key files exist
✅ Keys read successfully
✅ Private key parsed successfully
✅ Public key parsed successfully
✅ All checks passed! Keys are valid RSA keys.
```

**Failure (will show details):**
```
❌ Failed to parse private key as RSA key
   Error: error:1E08010C:DECODER routines::unsupported
```

## After Fixing

Check your app logs for:
```
✅ Found JWT keys in Azure file system, using file system keys
✅ JWT private key validated as RSA key
✅ JWT Service initialized successfully
```

