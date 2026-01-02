# Restore PostgreSQL Database from Backup

## Backup File Location
```
data/postgres-export/Tradingpro-back.backup
```

## Method 1: Using pg_restore (Recommended)

### Step 1: Install PostgreSQL Client Tools

**Windows:**
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Install PostgreSQL (includes pg_restore)
3. Or use Chocolatey: `choco install postgresql`
4. Or use Scoop: `scoop install postgresql`

**Verify Installation:**
```cmd
pg_restore --version
```

### Step 2: Restore Database

**Option A: Using the restore script (automated)**
```cmd
node backend/scripts/restore-postgres-backup.js
```

**Option B: Manual restore**
```cmd
# Set password (or use .pgpass file)
set PGPASSWORD=your-password

# Restore database
pg_restore --verbose --clean --if-exists --no-owner --no-privileges ^
  --host=postgresql-206372-0.cloudclusters.net ^
  --port=10073 ^
  --username=shivams ^
  --dbname=tradingpro ^
  "data\postgres-export\Tradingpro-back.backup"
```

**Option C: Using connection string**
```cmd
set PGPASSWORD=your-password
pg_restore --verbose --clean --if-exists --no-owner --no-privileges ^
  --dbname="postgresql://shivams:password@postgresql-206372-0.cloudclusters.net:10073/tradingpro" ^
  "data\postgres-export\Tradingpro-back.backup"
```

## Method 2: Using psql (If backup is in SQL format)

If you have a `.sql` file instead:

```cmd
# Set password
set PGPASSWORD=your-password

# Restore
psql --host=postgresql-206372-0.cloudclusters.net ^
     --port=10073 ^
     --username=shivams ^
     --dbname=tradingpro ^
     --file="data\postgres-export\tradingpro-backup.sql"
```

## Method 3: Using Node.js Script (After installing pg_restore)

Once pg_restore is installed, run:

```cmd
node backend/scripts/restore-postgres-backup.js
```

This script will:
1. ✅ Restore the database
2. ✅ Fix the session table (add unique constraint)
3. ✅ Verify the restoration
4. ✅ Show table and row counts

## After Restoration

### Fix Session Table

The restore script automatically fixes the session table, but if you need to do it manually:

```sql
-- Connect to database
psql --host=postgresql-206372-0.cloudclusters.net --port=10073 --username=shivams --dbname=tradingpro

-- Add unique constraint
ALTER TABLE session 
ADD CONSTRAINT session_sid_unique UNIQUE (sid);
```

Or run:
```cmd
node backend/scripts/fix-existing-session-table.js
```

### Verify Restoration

```cmd
node backend/scripts/check-db-integrity.js
```

## Troubleshooting

### Error: "pg_restore: command not found"
- **Solution**: Install PostgreSQL client tools (see Step 1 above)

### Error: "password authentication failed"
- **Solution**: Check your database password in environment variables

### Error: "connection refused"
- **Solution**: 
  1. Check database host and port
  2. Verify firewall allows connections
  3. Check if database server is running

### Error: "database does not exist"
- **Solution**: Create the database first:
  ```sql
  CREATE DATABASE tradingpro;
  ```

### Error: "there is no unique or exclusion constraint"
- **Solution**: Run the session table fix:
  ```cmd
  node backend/scripts/fix-existing-session-table.js
  ```

## Quick Commands

```cmd
# Check if pg_restore is available
pg_restore --version

# Check database connection
psql --host=postgresql-206372-0.cloudclusters.net --port=10073 --username=shivams --dbname=tradingpro -c "SELECT version();"

# List tables after restore
psql --host=postgresql-206372-0.cloudclusters.net --port=10073 --username=shivams --dbname=tradingpro -c "\dt"
```

## Environment Variables

Make sure these are set in your `.env` or `env` file:

```env
DATABASE_URL=postgresql://shivams:password@postgresql-206372-0.cloudclusters.net:10073/tradingpro

# OR

DB_HOST=postgresql-206372-0.cloudclusters.net
DB_PORT=10073
DB_NAME=tradingpro
DB_USER=shivams
DB_PASSWORD=your-password
```

## Notes

- The backup file is 1.02 MB
- Restoration may take a few minutes depending on data size
- The script automatically fixes the session table after restoration
- All existing data will be replaced with backup data

