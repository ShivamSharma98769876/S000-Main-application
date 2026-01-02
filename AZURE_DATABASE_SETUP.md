# Azure Database Configuration Guide

## Problem
If you see this error on Azure:
```
❌ Database connection failed: connect ECONNREFUSED 127.0.0.1:5432
```

This means the application is trying to connect to localhost instead of your Azure PostgreSQL database.

## Solution

### Step 1: Get Your Database Connection String

1. Go to **Azure Portal** → **Your PostgreSQL Server**
2. Click on **Connection strings** in the left menu
3. Copy the **PostgreSQL connection string** (it looks like):
   ```
   postgresql://username:password@hostname:5432/database?sslmode=require
   ```

### Step 2: Set Environment Variables in Azure

1. Go to **Azure Portal** → **Your App Service** → **Configuration**
2. Click on **Application settings** tab
3. Click **+ New application setting**

#### Option A: Use DATABASE_URL (Recommended)

Add a new setting:
- **Name**: `DATABASE_URL`
- **Value**: Your PostgreSQL connection string from Step 1
- Click **OK**

#### Option B: Use Individual Parameters

Add these settings:
- **Name**: `DB_HOST` → **Value**: Your database hostname (e.g., `your-db.postgres.database.azure.com`)
- **Name**: `DB_PORT` → **Value**: `5432`
- **Name**: `DB_NAME` → **Value**: Your database name
- **Name**: `DB_USER` → **Value**: Your database username
- **Name**: `DB_PASSWORD` → **Value**: Your database password

### Step 3: Save and Restart

1. Click **Save** at the top
2. Wait for the app to restart
3. Check the logs to verify connection

## Verification

After setting the environment variables, check the logs:

1. Go to **Azure Portal** → **Your App Service** → **Log stream**
2. You should see:
   ```
   ✅ Database connection verified
   🚀 Server running on port...
   ```

If you still see connection errors, verify:
- Database server firewall allows Azure services
- Connection string is correct
- Database credentials are correct

## Required Environment Variables

### Minimum Required (choose one):

**Option 1: DATABASE_URL**
```
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

**Option 2: Individual Parameters**
```
DB_HOST=your-db.postgres.database.azure.com
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
```

### Additional Recommended Settings:

```
NODE_ENV=production
SESSION_SECRET=your-random-secret-key-min-32-characters
```

## Troubleshooting

### Error: "connect ECONNREFUSED 127.0.0.1:5432"
- **Cause**: Database environment variables not set
- **Solution**: Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD

### Error: "password authentication failed"
- **Cause**: Wrong database credentials
- **Solution**: Verify username and password in Azure Portal

### Error: "timeout expired"
- **Cause**: Database firewall blocking connection
- **Solution**: 
  1. Go to PostgreSQL Server → **Connection security**
  2. Enable **Allow access to Azure services**
  3. Add your App Service IP if needed

### Error: "SSL required"
- **Cause**: Azure PostgreSQL requires SSL
- **Solution**: Make sure connection string includes `?sslmode=require` or use `DATABASE_URL` (SSL is auto-enabled)

## Quick Check Script

You can verify your database configuration by checking the logs. The application will log:
- Whether it detected Azure environment
- Which database configuration method is being used
- Connection status

Look for these log messages:
```
Database configuration { isAzure: true, hasDatabaseUrl: true, ... }
Database pool configuration { host: '...', ... }
✅ Database connection verified
```

## Notes

- The application automatically detects Azure environment
- SSL is automatically enabled for Azure connections
- Connection pooling is configured for optimal performance
- The app will not start if database connection fails (fail-fast)

