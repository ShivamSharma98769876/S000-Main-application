# SQLite Migration Quick Start Guide

## Quick Migration Steps

### 1. Install Dependencies
```bash
cd backend
npm install better-sqlite3
```

### 2. Backup PostgreSQL (IMPORTANT!)
```bash
pg_dump -U postgres -d tradingpro > backup_postgres_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Create SQLite Schema
```bash
npm run db:migrate:sqlite
```

### 4. Export PostgreSQL Data
```bash
npm run db:export:postgres
```

### 5. Import Data to SQLite
```bash
npm run db:import:sqlite
```

### 6. Verify Migration
```bash
npm run db:verify:sqlite
```

### 7. Switch Database Configuration

**Option A: Replace database.js**
```bash
# Backup current config
mv backend/config/database.js backend/config/database-postgres.js

# Use SQLite config
cp backend/config/database-sqlite.js backend/config/database.js
```

**Option B: Update .env**
```env
# Add to .env
SQLITE_DB_PATH=./data/tradingpro.db

# Comment out PostgreSQL vars (keep as backup)
# DB_HOST=127.0.0.1
# DB_PORT=5432
# DB_NAME=tradingpro
# DB_USER=postgres
# DB_PASSWORD=Itsme123
```

### 8. Update Session Store

In `backend/server.js`, replace:
```javascript
const pgSession = require('connect-pg-simple')(session);
```

With:
```javascript
const SQLiteStore = require('connect-sqlite3')(session);
// Or use better-sqlite3 with custom store
```

Update session config:
```javascript
store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
})
```

### 9. Test Application
```bash
npm run dev
```

## File Locations

- **SQLite Database**: `backend/data/tradingpro.db`
- **Exported Data**: `backend/data/postgres-export/`
- **Backup Config**: `backend/config/database-postgres.js`
- **SQLite Config**: `backend/config/database-sqlite.js`

## Rollback

If you need to rollback:

1. Restore `database.js`:
   ```bash
   cp backend/config/database-postgres.js backend/config/database.js
   ```

2. Restart application

3. Restore PostgreSQL backup if needed:
   ```bash
   psql -U postgres -d tradingpro < backup_postgres_YYYYMMDD_HHMMSS.sql
   ```

## Troubleshooting

### Database locked error
- SQLite locks the entire database during writes
- Ensure only one process accesses the database
- Check for long-running transactions

### Foreign key errors
- Ensure foreign keys are enabled: `PRAGMA foreign_keys = ON;`
- Check data integrity in exported JSON files

### Type conversion issues
- Check `import-sqlite-data.js` for type conversions
- Verify boolean values are converted to 0/1
- Verify dates are in ISO format

## Performance Tips

1. **Enable WAL Mode** (already done in schema)
   ```sql
   PRAGMA journal_mode = WAL;
   ```

2. **Set Busy Timeout**
   ```sql
   PRAGMA busy_timeout = 5000;
   ```

3. **Regular Backups**
   ```bash
   cp backend/data/tradingpro.db backend/data/tradingpro_backup_$(date +%Y%m%d).db
   ```

4. **Vacuum Database** (periodically)
   ```sql
   VACUUM;
   ```

## Support

For detailed information, see:
- `docs/POSTGRES_TO_SQLITE_MIGRATION_PLAN.md` - Full migration plan
- `MIGRATION_CHECKLIST.md` - Step-by-step checklist

