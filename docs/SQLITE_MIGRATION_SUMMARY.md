# PostgreSQL to SQLite Migration - Complete Package

## 📦 What's Included

This migration package includes everything you need to migrate from PostgreSQL to SQLite:

### Documentation
1. **`POSTGRES_TO_SQLITE_MIGRATION_PLAN.md`** - Comprehensive migration plan with all details
2. **`SQLITE_QUICK_START.md`** - Quick reference guide for fast migration
3. **`MIGRATION_CHECKLIST.md`** - Step-by-step checklist to track progress

### Scripts
1. **`backend/scripts/migrate-sqlite-schema.js`** - Creates SQLite database schema
2. **`backend/scripts/export-postgres-data.js`** - Exports all data from PostgreSQL to JSON
3. **`backend/scripts/import-sqlite-data.js`** - Imports data from JSON to SQLite
4. **`backend/scripts/verify-sqlite-migration.js`** - Verifies migration success

### Configuration
1. **`backend/config/database-sqlite.js`** - SQLite database configuration (compatible with existing code)

## 🚀 Quick Start

### Step 1: Install Dependencies
```bash
cd backend
npm install better-sqlite3
```

### Step 2: Run Migration
```bash
# 1. Create schema
npm run db:migrate:sqlite

# 2. Export PostgreSQL data
npm run db:export:postgres

# 3. Import to SQLite
npm run db:import:sqlite

# 4. Verify
npm run db:verify:sqlite
```

### Step 3: Switch Database
```bash
# Backup current config
mv backend/config/database.js backend/config/database-postgres.js

# Use SQLite
cp backend/config/database-sqlite.js backend/config/database.js
```

### Step 4: Update Session Store
Update `backend/server.js`:
- Replace `connect-pg-simple` with `connect-sqlite3` or remove session store (if using JWT only)

### Step 5: Test
```bash
npm run dev
```

## 📋 Migration Steps Overview

1. **Preparation** (30 min)
   - Backup PostgreSQL
   - Install dependencies
   - Review plan

2. **Schema Creation** (10 min)
   - Create SQLite schema
   - Verify tables

3. **Data Migration** (30-60 min)
   - Export PostgreSQL data
   - Import to SQLite
   - Verify data integrity

4. **Code Migration** (1-2 hours)
   - Update database config
   - Update session store
   - Test all features

5. **Deployment** (30 min)
   - Switch to SQLite
   - Monitor for issues
   - Keep PostgreSQL backup

## ⚠️ Important Notes

### Differences to Watch For

1. **Data Types**
   - `BIGSERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
   - `BOOLEAN` → `INTEGER` (0/1)
   - `JSONB` → `TEXT` (JSON string)
   - `NUMERIC` → `REAL` or `TEXT`

2. **Functions**
   - `NOW()` → `datetime('now')`
   - `SUBSTRING()` → `substr()`

3. **Limitations**
   - No concurrent writes (database-level locking)
   - File-based (no network access)
   - Smaller max size (but still very large)

### Performance Considerations

- SQLite is fast for read-heavy workloads
- Write performance is good for single-user or low-concurrency scenarios
- Enable WAL mode (already done in schema)
- Regular backups recommended

## 🔄 Rollback Plan

If you need to rollback:

1. Restore `database.js`:
   ```bash
   cp backend/config/database-postgres.js backend/config/database.js
   ```

2. Restart application

3. Restore PostgreSQL backup if needed

## 📊 File Structure

```
backend/
├── config/
│   ├── database.js (current - PostgreSQL)
│   ├── database-postgres.js (backup)
│   └── database-sqlite.js (new - SQLite)
├── scripts/
│   ├── migrate-sqlite-schema.js
│   ├── export-postgres-data.js
│   ├── import-sqlite-data.js
│   └── verify-sqlite-migration.js
└── data/
    ├── tradingpro.db (SQLite database)
    └── postgres-export/ (exported JSON files)

docs/
├── POSTGRES_TO_SQLITE_MIGRATION_PLAN.md
├── SQLITE_QUICK_START.md
└── SQLITE_MIGRATION_SUMMARY.md (this file)

MIGRATION_CHECKLIST.md
```

## ✅ Testing Checklist

After migration, test:
- [ ] User login/logout
- [ ] User profile management
- [ ] Product browsing
- [ ] Shopping cart
- [ ] Order creation
- [ ] Payment processing
- [ ] Subscription management
- [ ] Admin panel
- [ ] Content management
- [ ] Email queue
- [ ] Monitoring/logging

## 🆘 Support

For detailed information:
- **Full Plan**: `docs/POSTGRES_TO_SQLITE_MIGRATION_PLAN.md`
- **Quick Guide**: `docs/SQLITE_QUICK_START.md`
- **Checklist**: `MIGRATION_CHECKLIST.md`

## 📝 Notes

- Migration date: ___________
- Performed by: ___________
- Issues: ___________
- Resolution: ___________

---

**Good luck with your migration!** 🚀

