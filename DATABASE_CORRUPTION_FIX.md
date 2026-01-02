# Fix: Database Disk Image is Malformed

## Problem
Error: `database disk image is malformed`

This means your SQLite database file is corrupted. This can happen due to:
- File system issues
- Disk space problems
- Concurrent write conflicts
- WAL file corruption
- Unexpected shutdowns

## Quick Fix (Azure)

### Option 1: Recover Database (Recommended)

1. **Connect to Azure via SSH or Kudu Console:**
   - Azure Portal → Your App Service → **SSH** or **Advanced Tools** → **Go** → **Debug console** → **Bash**

2. **Run recovery script:**
   ```bash
   cd /home/site/wwwroot
   node scripts/recover-database.js
   ```

3. **Run migrations to recreate tables:**
   ```bash
   node scripts/migrate-sqlite-schema.js
   ```

4. **Restart the App Service**

### Option 2: Delete and Recreate (If no data to preserve)

1. **Connect via SSH/Kudu:**
   ```bash
   cd /home/site/wwwroot
   ```

2. **Delete corrupted database:**
   ```bash
   rm data/tradingpro.db
   rm data/tradingpro.db-wal
   rm data/tradingpro.db-shm
   ```

3. **Restart App Service** - Database will be created automatically

4. **Run migrations:**
   ```bash
   node scripts/migrate-sqlite-schema.js
   ```

### Option 3: Check Integrity First

1. **Check database integrity:**
   ```bash
   cd /home/site/wwwroot
   node scripts/check-db-integrity.js
   ```

2. **If corrupted, run recovery:**
   ```bash
   node scripts/recover-database.js
   node scripts/migrate-sqlite-schema.js
   ```

## Prevention

To prevent future corruption:

1. **Ensure adequate disk space** on Azure
2. **Use WAL mode** (already enabled)
3. **Proper shutdown** - let the app close database connections gracefully
4. **Regular backups** - backup the database file periodically

## What the Recovery Script Does

1. ✅ Checks database integrity
2. ✅ Creates backup of corrupted database (with timestamp)
3. ✅ Removes corrupted database and WAL/SHM files
4. ✅ Creates new empty database
5. ✅ Enables foreign keys and WAL mode
6. ⚠️  You must run migrations to recreate tables

## After Recovery

1. **Run migrations:**
   ```bash
   npm run db:migrate:sqlite
   ```

2. **If you had data, restore from backup:**
   - The backup is saved as `tradingpro.db.backup.[timestamp]`
   - You can try to recover data using SQLite recovery tools

3. **Restart the application**

## Verification

After recovery, verify:
```bash
node scripts/check-db-integrity.js
```

Should show:
```
✓ Database integrity: OK
✓ Basic queries work
✓ Users table exists
```

## Important Notes

- ⚠️  **Data Loss:** If you delete and recreate, all data will be lost
- 💾 **Backup First:** The recovery script creates a backup automatically
- 🔄 **Migrations Required:** After recovery, you must run migrations to recreate tables
- 📊 **Production:** For production, consider using Azure SQL Database instead of SQLite

