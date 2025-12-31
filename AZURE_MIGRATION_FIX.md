# Fix: better-sqlite3 Module Not Found

## Problem

When running `node scripts/migrate-sqlite-schema.js` in Azure Kudu Console, you get:
```
Error: Cannot find module 'better-sqlite3'
```

This happens because `node_modules` are not installed in the deployment, or the dependencies need to be installed.

## Solution Options

### Option 1: Install Dependencies First (Recommended)

In Azure Kudu Console:

1. **Navigate to app directory:**
   ```bash
   cd D:\home\site\wwwroot
   ```

2. **Install dependencies:**
   ```bash
   npm install --production
   ```

3. **Wait for installation to complete** (may take 2-5 minutes)

4. **Then run migration:**
   ```bash
   node scripts/migrate-sqlite-schema.js
   ```

### Option 2: Create Tables Manually via SQL

If npm install doesn't work, create the tables directly using SQL:

1. **Access Kudu Console** → **Debug console** → **CMD**

2. **Check if sqlite3 CLI is available:**
   ```bash
   sqlite3 --version
   ```

3. **If sqlite3 is available, create tables:**
   ```bash
   cd D:\home\site\data
   sqlite3 tradingpro.db
   ```

4. **Then run these SQL commands:**
   ```sql
   -- Create error_logs table
   CREATE TABLE IF NOT EXISTS error_logs (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       message TEXT NOT NULL,
       stack TEXT,
       error_name TEXT,
       error_code TEXT,
       context TEXT,
       created_at DATETIME NOT NULL DEFAULT (datetime('now'))
   );

   -- Create email_queue table
   CREATE TABLE IF NOT EXISTS email_queue (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       type TEXT NOT NULL,
       recipient TEXT NOT NULL,
       data TEXT NOT NULL,
       priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
       status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
       retry_count INTEGER DEFAULT 0,
       error_message TEXT,
       created_at DATETIME NOT NULL,
       sent_at DATETIME,
       updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
   );

   -- Verify tables created
   .tables

   -- Exit
   .exit
   ```

### Option 3: Use Azure App Service Console (SSH)

If SSH is enabled:

1. **Connect via SSH:**
   ```bash
   az webapp ssh --name A000-Main-App --resource-group YourResourceGroup
   ```

2. **Install dependencies:**
   ```bash
   cd /home/site/wwwroot
   npm install --production
   ```

3. **Run migration:**
   ```bash
   node scripts/migrate-sqlite-schema.js
   ```

### Option 4: Create Simple Migration Script

Create a simpler script that uses Node.js built-in modules or a different approach.

## Quick Fix: Manual SQL Creation

**Fastest solution** - Create a simple SQL file and execute it:

1. **In Kudu Console**, navigate to:
   ```bash
   cd D:\home\site\wwwroot
   ```

2. **Create a SQL file:**
   ```bash
   # Create create-tables.sql file
   echo CREATE TABLE IF NOT EXISTS error_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, stack TEXT, error_name TEXT, error_code TEXT, context TEXT, created_at DATETIME NOT NULL DEFAULT (datetime('now'))); > create-tables.sql
   ```

   Or better, use a text editor in Kudu to create the file with the SQL commands.

3. **If you have sqlite3 CLI**, execute:
   ```bash
   cd D:\home\site\data
   sqlite3 tradingpro.db < D:\home\site\wwwroot\create-tables.sql
   ```

## Recommended Approach

**Best solution:** Ensure dependencies are installed during deployment.

1. **Check Azure Portal** → **Configuration** → **General settings**
2. **Verify** `SCM_DO_BUILD_DURING_DEPLOYMENT` is set to `true`
3. This should automatically run `npm install` during deployment

If it's not working:
1. Go to **Deployment Center** → **Logs**
2. Check if `npm install` ran during deployment
3. If not, the deployment might need to be fixed

## Alternative: Run Migration on Next Deployment

Add the migration to run automatically after deployment:

1. **Create a startup script** that runs migrations
2. **Or** add it to the deployment process
3. **Or** run it manually after each deployment

## Verify Tables Created

After creating tables, verify they exist:

```bash
# If sqlite3 CLI is available
cd D:\home\site\data
sqlite3 tradingpro.db ".tables"

# Should show: error_logs email_queue (and other tables)
```

## Next Steps

1. Try **Option 1** first (npm install, then run migration)
2. If that fails, use **Option 2** (manual SQL creation)
3. Verify tables exist
4. Restart app service
5. Check logs - errors should be gone

