# Azure Final Setup - Fix Remaining Issues

## ✅ Current Status

Your application is **running** on Azure! 🎉
- ✅ Node.js is working
- ✅ Database is connected
- ✅ JWT keys are configured

## 🔧 Two Issues to Fix

### Issue 1: Missing SESSION_SECRET

**Error:** `secret option required for sessions`

**Fix:**

1. Go to **Azure Portal** → Your App Service → **Configuration** → **Application settings**
2. Click **+ New application setting**
3. Add:
   - **Name**: `SESSION_SECRET`
   - **Value**: Generate a strong random secret (see below)
   - **Deployment slot setting**: ✅ (recommended)
4. Click **Save**
5. **Restart** the app service

**Generate a secure SESSION_SECRET:**

On your local machine, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use an online generator, or create a long random string like:
```
my-super-secret-session-key-12345-abcdef-xyz-789-production-azure-2024
```

**Important:** Use a different secret for production than development!

---

### Issue 2: Missing Database Tables

**Errors:** 
- `no such table: error_logs`
- `no such table: email_queue`

**Fix: Run Database Migration**

You need to run the SQLite migration script to create the missing tables.

#### Option A: Run Migration via Azure Kudu Console (Recommended)

1. **Access Kudu Console:**
   - Go to **Azure Portal** → Your App Service
   - Navigate to **Advanced Tools** → Click **Go**
   - Click **Debug console** → **CMD** or **PowerShell**

2. **Navigate to app directory:**
   ```bash
   cd D:\home\site\wwwroot
   ```

3. **Run migration script:**
   ```bash
   node scripts/migrate-sqlite-schema.js
   ```

   OR if that doesn't work, run the specific migrations:
   ```bash
   node scripts/migrate-monitoring.js
   node scripts/migrate-email-queue.js
   ```

4. **Verify tables created:**
   ```bash
   # Check if tables exist (if you have sqlite3 installed)
   sqlite3 D:\home\site\data\tradingpro.db ".tables"
   ```

#### Option B: Run Migration via SSH (If Available)

1. **Enable SSH** in Azure Portal (if not already enabled)
2. **Connect via SSH:**
   ```bash
   az webapp ssh --name A000-Main-App --resource-group YourResourceGroup
   ```
3. **Run migration:**
   ```bash
   cd /home/site/wwwroot
   node scripts/migrate-sqlite-schema.js
   ```

#### Option C: Create Tables Manually via SQL

If the scripts don't work, you can create the tables manually:

1. **Access Kudu Console** → **Debug console** → **CMD**
2. **Navigate to database location:**
   ```bash
   cd D:\home\site\data
   ```
3. **Use SQLite to create tables** (if sqlite3 is available):
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
   ```

---

## 📋 Complete Checklist

After fixing both issues:

- [ ] **SESSION_SECRET** added to Azure Portal Application Settings
- [ ] **Database tables** created (`error_logs`, `email_queue`)
- [ ] **App Service restarted** after changes
- [ ] **Logs verified** - no more session or database errors

## ✅ Verification

After completing the fixes, check the logs:

1. Go to **Log stream** in Azure Portal
2. You should see:
   - ✅ No "secret option required for sessions" errors
   - ✅ No "no such table" errors
   - ✅ Server running successfully
   - ✅ All services initialized

## 🚀 Expected Log Output

After fixes, you should see:
```
✅ JWT Service initialized successfully
✅ Server started on port 8080
✅ No session errors
✅ No database table errors
```

## 📝 Additional Environment Variables

While you're in Azure Portal, make sure you have all these set:

**Required:**
- `NODE_ENV` = `production`
- `SESSION_SECRET` = (your generated secret) ⚠️ **MISSING - ADD THIS**
- `CHILD_APP_URL` = `https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net`
- `CHILD_APP_ALLOWED_ORIGINS` = `https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net`

**JWT (Already Set):**
- `JWT_PRIVATE_KEY` = (your private key)
- `JWT_PUBLIC_KEY` = (your public key)
- `JWT_ISSUER` = `tradingpro-main-app`
- `JWT_AUDIENCE` = `tradingpro-child-app`
- `JWT_EXPIRY` = `600m`

**Database:**
- `SQLITE_DB_PATH` = `/home/site/data/tradingpro.db` (or let it use default)

**Optional (for email functionality):**
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_USER` = Your email
- `SMTP_PASSWORD` = Your app password
- `EMAIL_FROM` = Your email
- `ADMIN_EMAIL` = Admin email

## 🆘 Troubleshooting

### Migration script not found?

- Check that files are deployed: `ls D:\home\site\wwwroot\scripts\`
- Verify `migrate-sqlite-schema.js` exists
- If missing, the deployment might not have included scripts folder

### Database path issues?

- Check where database is located: `ls D:\home\site\data\`
- Verify `SQLITE_DB_PATH` environment variable is set correctly
- Default path should be `/home/site/data/tradingpro.db`

### Still seeing errors?

1. **Check logs** in Azure Portal → Log stream
2. **Verify environment variables** are set correctly
3. **Restart app service** after any changes
4. **Check database file permissions**

