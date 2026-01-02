# How to Find Your PostgreSQL Server Name

## Quick Answer

Your PostgreSQL server name is in one of these formats:
- `your-server-name.postgres.database.azure.com`
- Or just `your-server-name` (the short name)

## Method 1: Azure Portal (Easiest)

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to**: All resources → Search for "PostgreSQL" or "Database"
3. **Click on your PostgreSQL Server**
4. **On the Overview page**, you'll see:
   - **Server name** at the top (this is what you need!)
   - Format: `your-server-name.postgres.database.azure.com`

## Method 2: Connection Strings (Most Detailed)

1. **Go to Azure Portal** → Your PostgreSQL Server
2. **Click "Connection strings"** in the left menu
3. **Copy the PostgreSQL connection string**
4. It looks like:
   ```
   postgresql://username:password@SERVER-NAME:5432/database?sslmode=require
   ```
5. The **SERVER-NAME** part is your database server name

## Method 3: Properties Page

1. **Go to Azure Portal** → Your PostgreSQL Server
2. **Click "Properties"** in the left menu
3. Look for **"Fully qualified domain name"** - this is your server name

## Method 4: Check Your Current Configuration

If you've already set it up, you can check:

### In Azure Portal:
1. Go to **Your App Service** → **Configuration** → **Application settings**
2. Look for:
   - `DATABASE_URL` - The server name is in the connection string
   - `DB_HOST` - This IS your server name

### In Your Code:
Run this command to check what's currently configured:
```bash
node backend/scripts/check-db-server-name.js
```

## Example Server Names

Your server name will look like one of these:
- `mydb-server.postgres.database.azure.com` (full name)
- `mydb-server` (short name - also works)

## What You Need for Azure App Service

When setting up your App Service, you need to add:

### Option 1: DATABASE_URL (Recommended)
```
DATABASE_URL=postgresql://username:password@your-server-name.postgres.database.azure.com:5432/database?sslmode=require
```

### Option 2: Individual Parameters
```
DB_HOST=your-server-name.postgres.database.azure.com
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username@your-server-name
DB_PASSWORD=your-password
```

**Note**: For `DB_USER`, you might need to include `@your-server-name` depending on your Azure PostgreSQL setup.

## Still Can't Find It?

1. Check your Azure resource group
2. Look for resources of type "PostgreSQL server" or "Azure Database for PostgreSQL"
3. The server name is usually visible in the resource list

## Need Help?

If you can't find it, you can:
1. Check Azure Portal → All resources → Filter by "PostgreSQL"
2. Check your deployment scripts or documentation
3. Contact your Azure administrator

