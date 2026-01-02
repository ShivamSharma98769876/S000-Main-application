# Restore Corrupted Local Database

Your local database at `C:\Users\SharmaS8\Downloads\tradingpro.db` is corrupted.

## ✅ Backup Created

A backup was automatically created at:
```
C:\Users\SharmaS8\Downloads\tradingpro.db.backup.1767250880016
```

## Recovery Options

### Option 1: Use SQLite Command-Line Tool (Recommended)

#### Step 1: Install SQLite
1. Download SQLite from: https://www.sqlite.org/download.html
2. Download: **sqlite-tools-win-x64-*.zip** (Precompiled Binaries for Windows)
3. Extract to a folder (e.g., `C:\sqlite`)
4. Add to PATH or use full path

#### Step 2: Recover Database
```cmd
cd C:\Users\SharmaS8\Downloads
sqlite3 tradingpro.db ".recover" > recovered.sql
```

#### Step 3: Create New Database from Recovered SQL
```cmd
sqlite3 tradingpro_recovered.db < recovered.sql
```

#### Step 4: Verify Recovered Database
```cmd
cd backend
node scripts/check-db-integrity.js "C:\Users\SharmaS8\Downloads\tradingpro_recovered.db"
```

#### Step 5: Replace Corrupted Database
If recovered database is good:
```cmd
copy tradingpro.db tradingpro.db.corrupted
copy tradingpro_recovered.db tradingpro.db
```

### Option 2: Use Online SQLite Recovery Tool

1. Upload your corrupted database to an online SQLite recovery service
2. Download the recovered database
3. Verify it works

**⚠️ Warning**: Only use trusted services for sensitive data!

### Option 3: Restore from Azure Database

If your Azure database is working:

1. **Download from Azure** (via Kudu):
   - Azure Portal → App Service → Advanced Tools → Go
   - Navigate to: `/home/site/wwwroot/data/tradingpro.db`
   - Download the file

2. **Replace local database**:
   ```cmd
   copy "C:\Users\SharmaS8\Downloads\tradingpro.db" "C:\Users\SharmaS8\Downloads\tradingpro.db.corrupted"
   copy "downloaded-from-azure.db" "C:\Users\SharmaS8\Downloads\tradingpro.db"
   ```

### Option 4: Recreate Database (Data Loss)

If you don't have a backup and recovery fails:

```cmd
cd backend
npm run db:recreate
npm run db:migrate:sqlite
npm run db:seed
```

**⚠️ This will delete all data!**

## Quick Commands

### Check Database Integrity
```cmd
cd backend
node scripts/recover-local-db.js "C:\Users\SharmaS8\Downloads\tradingpro.db"
```

### Recreate Database (if recovery fails)
```cmd
cd backend
npm run db:recreate
npm run db:migrate:sqlite
```

## Recommended Steps

1. **Try Option 1 first** (SQLite recovery tool)
2. **If that fails**, try **Option 3** (download from Azure)
3. **Last resort**: Use **Option 4** (recreate)

## After Recovery

1. **Verify database**:
   ```cmd
   cd backend
   node scripts/check-db-integrity.js
   ```

2. **Test application**:
   ```cmd
   npm run dev
   ```

3. **Upload to Azure** (if needed):
   ```cmd
   npm run db:upload
   ```

