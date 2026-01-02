# Start PostgreSQL Service

## Issue
The application crashed because PostgreSQL is not running.

**Error:** `ECONNREFUSED 127.0.0.1:5432`

## Solution

### Option 1: Start via Services (Easiest)

1. Press `Win + R`
2. Type: `services.msc`
3. Press Enter
4. Find **PostgreSQL** service (might be named like):
   - `postgresql-x64-15`
   - `postgresql-x64-14`
   - `PostgreSQL 15`
   - `PostgreSQL 14`
5. Right-click → **Start**
6. Wait for status to change to **Running**

### Option 2: Start via Command Line

**Find the service name first:**
```cmd
Get-Service | Where-Object {$_.Name -like "*postgres*"}
```

**Then start it:**
```cmd
# Replace SERVICE_NAME with the actual service name from above
net start SERVICE_NAME
```

**Common service names:**
- `postgresql-x64-15`
- `postgresql-x64-14`
- `postgresql-x64-13`

### Option 3: If PostgreSQL is Not Installed

If you don't see PostgreSQL in services, you need to install it:

1. Download PostgreSQL: https://www.postgresql.org/download/windows/
2. Run the installer
3. Remember the password you set (default user: `postgres`)
4. After installation, start the service using Option 1 or 2

## Verify PostgreSQL is Running

After starting the service, test the connection:

```cmd
cd backend
npm run db:test
```

**Expected output:**
```
✓ Connection successful!
✓ Query test successful!
```

## If Database Doesn't Exist

If PostgreSQL is running but the database doesn't exist:

```cmd
# Connect to PostgreSQL
psql -U postgres

# You'll be prompted for password
# Enter the password you set during installation

# Create database
CREATE DATABASE tradingpro;

# Exit
\q
```

## Run Migrations

After PostgreSQL is running and database exists:

```cmd
cd backend
npm run db:migrate
npm run db:migrate:email-queue
npm run db:migrate:monitoring
```

## Start the Application

```cmd
cd backend
npm run dev
```

## Quick Checklist

- [ ] PostgreSQL service is running
- [ ] Database `tradingpro` exists
- [ ] Environment variables are set (`.env` or `env` file)
- [ ] Migrations have been run
- [ ] Application starts without errors

