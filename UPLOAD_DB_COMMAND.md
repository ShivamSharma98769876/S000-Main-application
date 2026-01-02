# Quick Command to Upload Database to Azure

## Method 1: Using Kudu API Script (Automated)

### Prerequisites
1. Get your **Publish Profile** from Azure:
   - Azure Portal → Your App Service → **Get publish profile**
   - Download the `.PublishSettings` file
   - Save it somewhere accessible

2. **Stop your App Service** (important!):
   - Azure Portal → App Service → **Stop**

### Upload Command

```bash
cd backend
node scripts/upload-db-kudu.js "C:\path\to\your\tradingpro.db" "C:\path\to\your\publishprofile.PublishSettings"
```

**Example:**
```bash
node scripts/upload-db-kudu.js "C:\Users\SharmaS8\OneDrive - Unisys\Shivam Imp Documents-2024 June\PythonProgram\S000-Main-application\S000-Main-application\data\tradingpro.db" "C:\Users\SharmaS8\Downloads\A000-Main-App.PublishSettings"
```

### After Upload

1. **Restart App Service**
2. **Verify:**
   ```bash
   # Via SSH/Kudu
   cd /home/site/wwwroot
   node scripts/check-db-integrity.js
   ```

## Method 2: Manual Upload via Kudu Console (Easiest)

### Step 1: Access Kudu

1. Azure Portal → App Service → **Advanced Tools** → **Go**
2. Click **Debug console** → **CMD** (Windows) or **Bash** (Linux)

### Step 2: Prepare Directory

**For Linux:**
```bash
cd /home/site/wwwroot
mkdir -p data
cd data
pwd
# Note the full path shown
```

**For Windows:**
```cmd
cd D:\home\site\wwwroot
mkdir data
cd data
```

### Step 3: Upload File

1. In Kudu, click the **folder icon** (📁) at the top toolbar
2. Navigate to: `D:\home\site\wwwroot\data` (Windows) or `/home/site/wwwroot/data` (Linux)
3. **Drag and drop** your `tradingpro.db` file from your local machine
4. Wait for upload to complete

### Step 4: Verify

```bash
ls -la /home/site/wwwroot/data/tradingpro.db
# Should show the file with correct size
```

### Step 5: Set Permissions (Linux only)

```bash
chmod 644 /home/site/wwwroot/data/tradingpro.db
```

### Step 6: Restart App Service

- Azure Portal → App Service → **Restart**

## Method 3: Using Azure CLI with Kudu API

If you have Azure CLI installed:

```bash
# Login
az login

# Get publish profile credentials
az webapp deployment list-publishing-profiles --name A000-Main-App --resource-group YourResourceGroup --xml > publishprofile.xml

# Extract credentials from XML (or use the script above)
```

Then use the upload script with the publish profile.

## Method 4: Using PowerShell (Windows)

```powershell
# Install Azure PowerShell module if needed
# Install-Module -Name Az -AllowClobber

# Login
Connect-AzAccount

# Get publish profile
$profile = Get-AzWebAppPublishingProfile -ResourceGroupName "YourResourceGroup" -Name "A000-Main-App"

# Upload file (requires additional setup)
# This is complex - use Method 2 (Kudu Console) instead
```

## Quick Reference

**Local Database Path:**
```
C:\Users\SharmaS8\OneDrive - Unisys\Shivam Imp Documents-2024 June\PythonProgram\S000-Main-application\S000-Main-application\data\tradingpro.db
```

**Azure Target Path:**
- Linux: `/home/site/wwwroot/data/tradingpro.db`
- Windows: `D:\home\site\wwwroot\data\tradingpro.db`

## Important Notes

1. ⚠️ **STOP the App Service** before uploading (prevents corruption)
2. ✅ **Merge WAL files** first if present: `sqlite3 tradingpro.db "PRAGMA wal_checkpoint(FULL);"`
3. ✅ **Verify local database** first: `npm run db:check`
4. ✅ **Check file size** after upload matches original
5. ✅ **Set permissions** (644 for Linux)
6. ✅ **Restart** App Service after upload

## Troubleshooting

### "Permission denied" when uploading
- Make sure App Service is stopped
- Check file permissions after upload
- Try uploading to a temp location first, then move

### File upload fails in Kudu
- Try using Bash instead of CMD
- Check file size (large files may timeout)
- Try FTP method instead

### Database still corrupted after upload
- Verify file size matches original
- Re-upload the file
- Check if WAL files need to be merged first

