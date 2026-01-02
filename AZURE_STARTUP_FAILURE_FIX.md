# Azure Startup Failure - Container Exit Code 1

## Problem
Your Azure App Service container is failing to start (exit code 1). This is most commonly caused by **database connection failure**.

## Quick Fix Steps

### Step 1: Check Azure Logs for Exact Error

1. Go to **Azure Portal** → **Your App Service** → **Log stream**
2. Look for error messages like:
   - `❌ Database connection failed`
   - `Database configuration required for Azure deployment`
   - `ECONNREFUSED 127.0.0.1:5432`

### Step 2: Set Database Environment Variables

Go to **Azure Portal** → **Your App Service** → **Configuration** → **Application settings**

**Add these settings:**

#### Option A: DATABASE_URL (Recommended)
```
Name: DATABASE_URL
Value: postgresql://username:password@host:port/database?sslmode=require
```

#### Option B: Individual Parameters
```
Name: DB_HOST
Value: postgresql-206372-0.cloudclusters.net

Name: DB_PORT
Value: 10073

Name: DB_NAME
Value: tradingpro

Name: DB_USER
Value: shivams

Name: DB_PASSWORD
Value: your-password
```

### Step 3: Set Other Required Variables

```
Name: NODE_ENV
Value: production

Name: SESSION_SECRET
Value: your-random-secret-key-min-32-characters-long

Name: PORT
Value: (leave empty - Azure sets this automatically)
```

### Step 4: Save and Restart

1. Click **Save** at the top
2. Wait for the app to restart
3. Check **Log stream** again

## Common Errors and Solutions

### Error: "Database connection failed: connect ECONNREFUSED 127.0.0.1:5432"
**Cause**: Database environment variables not set  
**Solution**: Set `DATABASE_URL` or `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` in Azure Portal

### Error: "Database configuration required for Azure deployment"
**Cause**: Missing database configuration  
**Solution**: Set database environment variables (see Step 2)

### Error: "password authentication failed"
**Cause**: Wrong database password  
**Solution**: Verify password in Azure Portal → Configuration

### Error: "timeout expired" or "connection timeout"
**Cause**: Database firewall blocking connection  
**Solution**: 
1. Go to PostgreSQL Server → **Connection security**
2. Enable **Allow access to Azure services**
3. Add Azure App Service IP to firewall rules

### Error: "SSL required"
**Cause**: Azure PostgreSQL requires SSL  
**Solution**: Make sure connection string includes `?sslmode=require`

## Verify Configuration

After setting environment variables, check the logs. You should see:

```
✅ Database connection verified
🚀 Server running on port...
📊 API Base URL: ...
```

## Check Logs in Azure

### Method 1: Log Stream (Real-time)
1. Azure Portal → App Service → **Log stream**
2. Watch for errors in real-time

### Method 2: Application Logs
1. Azure Portal → App Service → **Logs** → **Application Logging**
2. Enable **Application Logging (Filesystem)**
3. View logs in **Log stream** or download

### Method 3: Kudu Console
1. Azure Portal → App Service → **Advanced Tools** → **Go**
2. Click **Debug console** → **CMD**
3. Navigate to `LogFiles/Application`
4. View error logs

## Testing Database Connection

You can test the database connection from Azure:

1. Go to **Kudu Console** (Advanced Tools → Go)
2. Click **Debug console** → **CMD**
3. Navigate to `site/wwwroot/backend`
4. Run: `node scripts/test-db-connection.js`

## Additional Checks

### 1. Verify Database Server is Running
- Check PostgreSQL server status in Azure Portal
- Verify firewall rules allow connections

### 2. Check Port Configuration
- Azure sets `PORT` automatically - don't override it
- App listens on `0.0.0.0` to accept connections

### 3. Verify Node.js Version
- Azure should auto-detect Node.js version
- Check in **Configuration** → **General settings** → **Stack settings**

### 4. Check Startup Command
- Azure should auto-detect `npm start`
- Verify in **Configuration** → **General settings** → **Startup Command**

## Still Not Working?

1. **Check detailed logs** in Kudu Console
2. **Test database connection** manually
3. **Verify all environment variables** are set correctly
4. **Check PostgreSQL server** is accessible from Azure
5. **Review firewall rules** on PostgreSQL server

## Quick Diagnostic Commands

From Kudu Console (Debug console → CMD):

```bash
# Check environment variables
echo %DATABASE_URL%
echo %DB_HOST%

# Test Node.js
node --version
npm --version

# Check if server.js exists
dir server.js

# Test database connection
cd backend
node scripts/test-db-connection.js
```

