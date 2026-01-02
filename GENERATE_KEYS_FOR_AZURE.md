# Generate JWT Keys for Azure

## Option 1: Generate Locally and Copy to Azure (Recommended)

### Step 1: Generate Keys

Run this script on your local machine:

```bash
cd backend
node scripts/generate-keys-for-azure.js
```

This will:
- Generate RSA keys
- Display them in a format ready to copy
- Save them locally for backup

### Step 2: Copy to Azure Portal

1. Go to **Azure Portal** → **Your App Service** → **Configuration** → **Application settings**
2. Click **+ New application setting**

**Add Setting 1:**
- **Name**: `JWT_PRIVATE_KEY`
- **Value**: Copy the entire private key (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
- Click **OK**

**Add Setting 2:**
- **Name**: `JWT_PUBLIC_KEY`
- **Value**: Copy the entire public key (including `-----BEGIN PUBLIC KEY-----` and `-----END PUBLIC KEY-----`)
- Click **OK**

3. Click **Save** at the top
4. **Restart** the App Service

### Step 3: Verify

Check logs - you should see:
```
✅ JWT Service initialized from environment variables
✅ JWT private key validated as RSA key
```

---

## Option 2: Generate Directly on Azure (Alternative)

If you prefer to generate keys directly on Azure:

### Step 1: Access Kudu Console

1. Go to **Azure Portal** → **Your App Service**
2. Navigate to **Advanced Tools** → Click **Go** (opens Kudu)
3. Click **Debug console** → **CMD** or **PowerShell**

### Step 2: Navigate to Backend Directory

```bash
cd site\wwwroot\backend
```

### Step 3: Generate Keys

```bash
node scripts/generate-keys.js
```

### Step 4: Read the Keys

**For Private Key:**
```bash
type config\keys\private.pem
```

**For Public Key:**
```bash
type config\keys\public.pem
```

### Step 5: Copy to Application Settings

1. Copy the entire output of each command
2. Go to **Azure Portal** → **Configuration** → **Application settings**
3. Add `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` as described in Option 1

---

## Option 3: Use Azure Cloud Shell

1. Go to **Azure Portal** → Click **Cloud Shell** icon (top bar)
2. Choose **Bash** or **PowerShell**
3. Upload your project or clone it
4. Run: `node backend/scripts/generate-keys-for-azure.js`
5. Copy the output to Azure Portal

---

## Troubleshooting

### Error: "Keys not found"
- Make sure you ran `node scripts/generate-keys-for-azure.js` first
- Check that `backend/config/keys/` directory exists

### Error: "Invalid key format"
- Make sure you copied the ENTIRE key including BEGIN/END markers
- Don't add quotes or extra spaces
- The key should be exactly as generated

### Error: "Key too short"
- RSA keys are typically 1600+ characters
- Make sure you copied all lines, not just the first few

### Keys Not Working After Copying
- Verify you copied the entire key (all lines)
- Check for hidden characters or line breaks
- Try regenerating and copying again
- Make sure you clicked "Save" and restarted the app

---

## Quick Check

After setting keys, verify in logs:
```
✅ JWT Service initialized from environment variables
✅ JWT private key validated as RSA key
✅ JWT Service initialized successfully
```

If you see errors, the logs will now show exactly what's wrong with the key format.

