# Quick Command to Upload Database to Azure

## Easiest Method: Kudu File Manager (No Command Needed)

### Step 1: Stop App Service
- Azure Portal → App Service → **Stop**

### Step 2: Access Kudu
- Azure Portal → App Service → **Advanced Tools** → **Go**
- Click **Debug console** → **CMD**

### Step 3: Navigate to Data Directory
```cmd
cd D:\home\site\wwwroot
mkdir data
cd data
```

### Step 4: Upload File
1. Click the **📁 folder icon** in Kudu toolbar
2. Navigate to: `D:\home\site\wwwroot\data`
3. **Drag and drop** your `tradingpro.db` file
4. Wait for upload

### Step 5: Restart App Service
- Azure Portal → App Service → **Start**

## Automated Method: Using Script

### Prerequisites
1. Download **Publish Profile** from Azure:
   - Azure Portal → App Service → **Get publish profile**
   - Save the `.PublishSettings` file

2. **Stop App Service** first!

### Run Upload Script

```bash
cd backend
node scripts/upload-db-kudu.js "C:\full\path\to\tradingpro.db" "C:\full\path\to\publishprofile.PublishSettings"
```

**Example with your paths:**
```bash
cd backend
node scripts/upload-db-kudu.js "C:\Users\SharmaS8\OneDrive - Unisys\Shivam Imp Documents-2024 June\PythonProgram\S000-Main-application\S000-Main-application\data\tradingpro.db" "C:\Users\SharmaS8\Downloads\A000-Main-App.PublishSettings"
```

## Using curl (Manual Command)

If you have the publish profile credentials:

```bash
# Extract from publish profile:
# publishUrl="a000-main-app-g5f2byheauhyeudv.scm.southindia-01.azurewebsites.net"
# userName="$A000-Main-App"
# userPWD="your-password"

curl -X PUT \
  "https://a000-main-app-g5f2byheauhyeudv.scm.southindia-01.azurewebsites.net/api/vfs/site/wwwroot/data/tradingpro.db" \
  -u "$A000-Main-App:your-password" \
  -H "Content-Type: application/octet-stream" \
  -H "If-Match: *" \
  --data-binary "@C:\path\to\your\tradingpro.db"
```

## Using PowerShell (Windows)

```powershell
# Get credentials from publish profile
$profile = Get-Content "C:\path\to\publishprofile.PublishSettings" | Select-String -Pattern 'publishUrl|userName|userPWD'

# Extract values (manual step)
$publishUrl = "your-scm-url.scm.azurewebsites.net"
$userName = "$A000-Main-App"
$userPwd = "your-password"

# Create auth header
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${userName}:${userPwd}"))

# Upload file
$filePath = "C:\path\to\tradingpro.db"
$targetPath = "site/wwwroot/data/tradingpro.db"
$uri = "https://${publishUrl}/api/vfs/${targetPath}"

Invoke-RestMethod -Uri $uri `
    -Method Put `
    -Headers @{
        "Authorization" = "Basic $base64Auth"
        "Content-Type" = "application/octet-stream"
        "If-Match" = "*"
    } `
    -InFile $filePath
```

## Quick Reference

**Your Local Database:**
```
C:\Users\SharmaS8\OneDrive - Unisys\Shivam Imp Documents-2024 June\PythonProgram\S000-Main-application\S000-Main-application\data\tradingpro.db
```

**Azure Target:**
```
/home/site/wwwroot/data/tradingpro.db
```

## After Upload

1. **Set permissions** (via SSH/Kudu):
   ```bash
   chmod 644 /home/site/wwwroot/data/tradingpro.db
   ```

2. **Verify file:**
   ```bash
   ls -la /home/site/wwwroot/data/tradingpro.db
   ```

3. **Restart App Service**

4. **Test:**
   ```bash
   node scripts/check-db-integrity.js
   ```

## Recommended: Use Kudu File Manager

The **easiest method** is still the Kudu file manager drag-and-drop - no commands needed!

