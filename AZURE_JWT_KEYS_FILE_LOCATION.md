# JWT Keys File Location on Azure

## Key Locations (Checked in Order)

The JWT service now checks for keys in this order:

1. **Environment Variables** (Azure Portal → Configuration → Application settings)
   - `JWT_PRIVATE_KEY`
   - `JWT_PUBLIC_KEY`

2. **Azure File System** (`/home/site/wwwroot/config/keys/`)
   - `private.pem`
   - `public.pem`

3. **Relative Path** (`backend/config/keys/`)
   - `private.pem`
   - `public.pem`

## Option 1: Use Environment Variables (Recommended)

Set in Azure Portal → Configuration → Application settings (as you've done).

## Option 2: Upload Keys to Azure File System

If environment variables aren't working, you can upload keys as files:

### Step 1: Generate Keys on Azure

In Azure Kudu Console:
```bash
cd site\wwwroot\backend
node scripts/generate-keys.js
```

### Step 2: Create Directory

```bash
mkdir -p site\wwwroot\config\keys
```

### Step 3: Copy Keys

```bash
copy backend\config\keys\private.pem site\wwwroot\config\keys\private.pem
copy backend\config\keys\public.pem site\wwwroot\config\keys\public.pem
```

### Step 4: Verify

```bash
dir site\wwwroot\config\keys
```

You should see:
- `private.pem`
- `public.pem`

### Step 5: Restart App

The app will automatically find and use these keys.

## Verification

After placing keys in either location, check logs for:
```
✅ JWT Service initialized from file system
✅ JWT private key validated as RSA key
```

## Which Method to Use?

- **Environment Variables**: More secure, easier to manage, recommended
- **File System**: Good fallback if environment variables have issues

The service will automatically use whichever is available first.

