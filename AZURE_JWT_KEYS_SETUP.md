# Azure JWT Keys Setup Guide

## ✅ Good News!

Your application is now **running successfully** on Azure! 🎉

The only remaining issue is the JWT keys need to be uploaded to Azure.

## 🔑 Two Options for JWT Keys

### Option 1: Environment Variables (Recommended for Azure)

Store the keys as environment variables in Azure Portal. This is more secure and easier to manage.

#### Step 1: Get Your Keys

On your local machine, read the key files:

```bash
# On Windows (PowerShell)
cd backend
Get-Content config/keys/private.pem | Out-String
Get-Content config/keys/public.pem | Out-String
```

Or on Linux/Mac:
```bash
cd backend
cat config/keys/private.pem
cat config/keys/public.pem
```

#### Step 2: Add to Azure Portal

1. Go to **Azure Portal** → Your App Service → **Configuration** → **Application settings**
2. Click **+ New application setting**
3. Add these two settings:

   **Setting 1:**
   - **Name**: `JWT_PRIVATE_KEY`
   - **Value**: Paste the entire content of `private.pem` (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
   - **Deployment slot setting**: ✅ (recommended)

   **Setting 2:**
   - **Name**: `JWT_PUBLIC_KEY`
   - **Value**: Paste the entire content of `public.pem` (including `-----BEGIN RSA PUBLIC KEY-----` and `-----END RSA PUBLIC KEY-----`)
   - **Deployment slot setting**: ✅ (recommended)

4. Click **Save**
5. **Restart** the app service

#### Step 3: Verify

Check the logs - you should see:
```
JWT Service initialized from environment variables
```

---

### Option 2: Upload Files via Kudu (Alternative)

If you prefer to use files instead of environment variables:

#### Step 1: Access Kudu Console

1. Go to **Azure Portal** → Your App Service
2. Navigate to **Advanced Tools** → Click **Go** (opens Kudu)
3. Click **Debug console** → **CMD** or **PowerShell**

#### Step 2: Create Directory Structure

In the Kudu console, navigate to:
```
D:\home\site\wwwroot\config\keys
```

Or create it:
```bash
mkdir -p D:\home\site\wwwroot\config\keys
```

#### Step 3: Upload Files

1. In Kudu, go to **Tools** → **Zip Push Deploy**
2. Or use **File Manager** to upload files directly
3. Upload:
   - `private.pem` → `D:\home\site\wwwroot\config\keys\private.pem`
   - `public.pem` → `D:\home\site\wwwroot\config\keys\public.pem`

#### Step 4: Set Permissions

Ensure the files are readable:
```bash
chmod 600 D:\home\site\wwwroot\config\keys\private.pem
chmod 644 D:\home\site\wwwroot\config\keys\public.pem
```

#### Step 5: Restart App Service

Restart the app service from Azure Portal.

---

## 🔒 Security Best Practices

### For Production:

1. **Use Azure Key Vault** (Most Secure)
   - Store keys in Azure Key Vault
   - Reference them in App Service settings
   - Keys are encrypted and managed centrally

2. **Use Environment Variables** (Good)
   - Store keys as App Service settings
   - Mark as "Deployment slot setting"
   - Never commit to Git

3. **Use File System** (Less Secure)
   - Only if you can't use Key Vault or environment variables
   - Ensure proper file permissions
   - Keep keys out of Git

## 📋 Quick Checklist

- [ ] Keys generated locally (`node scripts/generate-keys.js`)
- [ ] Keys added to Azure Portal as environment variables OR uploaded via Kudu
- [ ] App Service restarted
- [ ] Logs show "JWT Service initialized successfully"

## 🐛 Troubleshooting

### Still seeing "JWT keys not found"?

1. **Check environment variables:**
   - Go to Azure Portal → Configuration → Application settings
   - Verify `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` exist
   - Check that values include the full key (with BEGIN/END lines)

2. **Check file paths (if using files):**
   - Verify files exist at `/home/site/wwwroot/config/keys/`
   - Check file permissions
   - Ensure paths match environment variables

3. **Check logs:**
   - Go to **Log stream** in Azure Portal
   - Look for JWT initialization messages
   - Check for any file system errors

### Keys not working?

- Ensure keys are the same pair (private and public must match)
- Verify no extra whitespace or line breaks in environment variables
- Check that BEGIN/END markers are included
- Regenerate keys if needed: `node scripts/generate-keys.js`

## ✅ After Setup

Once JWT keys are configured, your application should:
- ✅ Start without errors
- ✅ Generate JWT tokens for child app SSO
- ✅ Verify tokens from child app
- ✅ Handle authentication correctly

Check the logs to confirm:
```
JWT Service initialized successfully
```

