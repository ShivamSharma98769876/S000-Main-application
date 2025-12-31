# Quick Fix: Create Missing Database Tables on Azure

## Problem
Your app is running but missing these database tables:
- `error_logs`
- `email_queue`
- `performance_metrics`

## Solution: Run the Quick Fix Script

Since your app is already running and `better-sqlite3` is available, you can create just the missing tables.

### Option 1: Via Azure SSH (Recommended)

1. **Connect via SSH:**
   - Go to Azure Portal → Your App Service → **SSH** (in left menu)
   - Or use: `az webapp ssh --name A000-Main-App --resource-group YourResourceGroup`

2. **Run the script:**
   ```bash
   cd /home/site/wwwroot
   node scripts/create-missing-tables.js
   ```

3. **Verify:**
   ```bash
   # Check if tables were created
   sqlite3 /home/site/data/tradingpro.db ".tables" | grep -E "(error_logs|email_queue|performance_metrics)"
   ```

### Option 2: Via Kudu Console

1. **Access Kudu:**
   - Go to Azure Portal → Your App Service → **Advanced Tools** → **Go**
   - Click **Debug console** → **Bash** (or **CMD**)

2. **Navigate and run:**
   ```bash
   cd /home/site/wwwroot
   node scripts/create-missing-tables.js
   ```

### Option 3: Run Full Migration (if needed)

If you want to create ALL tables (not just the missing ones):

```bash
cd /home/site/wwwroot
node scripts/migrate-sqlite-schema.js
```

## After Running the Script

1. **Restart your app service** (optional, but recommended):
   - Azure Portal → Your App Service → **Restart**

2. **Check logs** - the errors should be gone:
   - Azure Portal → Your App Service → **Log stream**

## Expected Output

When you run the script, you should see:
```
Creating missing database tables...
Database path: /home/site/data/tradingpro.db
Creating error_logs table...
✓ error_logs table created
Creating email_queue table...
✓ email_queue table created
Creating performance_metrics table...
✓ performance_metrics table created
Creating indexes...
✓ Indexes created

Verifying tables...
✓ error_logs exists
✓ email_queue exists
✓ performance_metrics exists

✅ All missing tables created successfully!
You can now restart your Azure App Service.
```

## Troubleshooting

### If you get "Cannot find module 'better-sqlite3'"

The module should be available since your app is running. If not:

```bash
cd /home/site/wwwroot
npm install better-sqlite3 --production
node scripts/create-missing-tables.js
```

### If database path is wrong

Check where your database is located:

```bash
find /home/site -name "tradingpro.db" 2>/dev/null
```

Then set the environment variable:

```bash
export SQLITE_DB_PATH=/home/site/data/tradingpro.db
node scripts/create-missing-tables.js
```

## Next Steps

After creating the tables, you still need to:

1. **Set SESSION_SECRET** in Azure Portal:
   - Configuration → Application settings
   - Add: `SESSION_SECRET` = (generate a random 32+ character string)

2. **Restart the app service**

3. **Verify** - check logs, errors should be gone!

