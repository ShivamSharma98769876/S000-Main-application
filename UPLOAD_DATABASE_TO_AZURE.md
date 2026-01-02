# How to Upload Your Local Database to Azure

## Overview

You can upload your local database file to Azure to restore your data. This guide provides multiple methods.

## Prerequisites

1. **Stop your local server** (if running) to ensure database is not in use
2. **Check database integrity** locally first
3. **Have your database file ready** (usually `data/tradingpro.db`)

## Quick Start

### Step 1: Check Your Local Database

```bash
cd backend
npm run db:check
```

This will verify your database is healthy and show table/row counts.

### Step 2: Get Upload Instructions

```bash
npm run db:upload-help
```

Or specify your database path:
```bash
node scripts/upload-db-to-azure.js "C:\path\to\your\tradingpro.db"
```

This will show detailed upload instructions and verify your database.

## Method 1: Via Azure Portal (Kudu Console) - Recommended

### Step 1: Access Kudu Console

1. Go to **Azure Portal** → Your App Service (`A000-Main-App`)
2. Navigate to **Advanced Tools** → **Go**
3. Click **Debug console** → **Bash** (or **CMD** for Windows)

### Step 2: Prepare Directory

```bash
cd /home/site/wwwroot
mkdir -p data
cd data
```

### Step 3: Upload File

**Option A: Using Kudu File Manager**
1. In Kudu, go to **Debug console** → **CMD**
2. Navigate to `D:\home\site\wwwroot\data`
3. Click the **folder icon** at the top
4. Drag and drop your `tradingpro.db` file

**Option B: Using Kudu API**
You can use a tool like Postman or curl to upload via Kudu API.

### Step 4: Verify Upload

```bash
ls -la /home/site/wwwroot/data/tradingpro.db
```

Should show the file with correct size.

### Step 5: Set Permissions (Linux)

```bash
chmod 644 /home/site/wwwroot/data/tradingpro.db
```

### Step 6: Restore Database

```bash
cd /home/site/wwwroot
node scripts/restore-db-from-file.js data/tradingpro.db
```

Or if you uploaded with a different name:
```bash
node scripts/restore-db-from-file.js data/your-uploaded-file.db
```

### Step 7: Restart App Service

- Azure Portal → Your App Service → **Restart**

## Method 2: Via FTP/SFTP

### Step 1: Get FTP Credentials

1. Azure Portal → Your App Service → **Deployment Center**
2. Click **FTPS credentials**
3. Copy:
   - **FTPS endpoint**
   - **Username**
   - **Password**

### Step 2: Connect with FTP Client

Use FileZilla, WinSCP, or any FTP client:

- **Host:** Your FTPS endpoint
- **Port:** 21 (or 990 for FTPS)
- **Username:** From step 1
- **Password:** From step 1
- **Protocol:** FTP or FTPS

### Step 3: Upload File

1. Navigate to: `/site/wwwroot/data/`
2. Create `data` folder if it doesn't exist
3. Upload `tradingpro.db` to this location

### Step 4: Restore Database

Connect via SSH/Kudu and run:
```bash
cd /home/site/wwwroot
node scripts/restore-db-from-file.js data/tradingpro.db
```

## Method 3: Via Azure CLI

### Step 1: Install Azure CLI

If not installed: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

### Step 2: Login

```bash
az login
```

### Step 3: Upload File

```bash
# Create a zip file with your database
cd data
zip tradingpro.db.zip tradingpro.db

# Upload via Azure CLI (this is complex, Method 1 is easier)
# Alternatively, use Azure Storage and download from there
```

**Note:** Azure CLI doesn't have a direct file upload command for App Service. Use Method 1 or 2 instead.

## Method 4: Via Azure Storage (Advanced)

1. Upload database to Azure Blob Storage
2. Download from Storage to App Service via SSH
3. Restore using the restore script

## Important Notes

### Before Upload

1. **Stop the application** on Azure (or it may corrupt during upload)
   - Azure Portal → App Service → **Stop**

2. **Merge WAL files** (if present):
   ```bash
   sqlite3 tradingpro.db "PRAGMA wal_checkpoint(FULL);"
   ```
   This ensures all data is in the main database file.

3. **Verify integrity**:
   ```bash
   npm run db:check
   ```

### After Upload

1. **Verify file exists and has correct size**
2. **Set correct permissions** (644 for Linux)
3. **Run restore script** to verify integrity
4. **Restart App Service**

### File Location on Azure

- **Linux:** `/home/site/wwwroot/data/tradingpro.db`
- **Windows:** `D:\home\site\wwwroot\data\tradingpro.db`

## Troubleshooting

### "Permission denied" when uploading

- Check file permissions: `chmod 644 data/tradingpro.db`
- Ensure you're uploading to the correct directory

### "Database disk image is malformed" after upload

- Verify the uploaded file size matches the original
- Re-upload the file
- Check if WAL files were merged before upload

### File not found after upload

- Verify the path: `/home/site/wwwroot/data/tradingpro.db`
- Check file permissions
- Ensure you're in the correct directory

## Verification

After upload and restore, verify:

```bash
cd /home/site/wwwroot
node scripts/check-db-integrity.js
```

Should show:
- ✓ Database integrity: OK
- ✓ All tables accessible
- ✓ Correct row counts

## Summary

**Easiest Method:**
1. Use Kudu Console file upload (Method 1)
2. Run restore script: `node scripts/restore-db-from-file.js data/tradingpro.db`
3. Restart App Service

**Your database will be restored with all your local data!**

