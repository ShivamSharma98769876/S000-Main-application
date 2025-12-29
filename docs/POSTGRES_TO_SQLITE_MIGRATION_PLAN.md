# PostgreSQL to SQLite Migration Plan

## Overview
This document outlines the complete migration plan from PostgreSQL to SQLite (latest version) for the TradingPro application.

## Prerequisites

1. **Backup PostgreSQL Database**
   ```bash
   pg_dump -U postgres -d tradingpro > backup_postgres_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Install SQLite3** (if not already installed)
   - Windows: Download from https://www.sqlite.org/download.html
   - Or use Node.js: `npm install better-sqlite3`

3. **Install Required NPM Packages**
   ```bash
   npm install better-sqlite3
   npm uninstall pg connect-pg-simple
   ```

## Migration Steps

### Phase 1: Preparation (No Downtime)

1. **Create SQLite Schema**
   - Run: `node backend/scripts/migrate-sqlite-schema.js`
   - This creates all tables with SQLite-compatible syntax

2. **Export Data from PostgreSQL**
   - Run: `node backend/scripts/export-postgres-data.js`
   - Exports all data to JSON files

3. **Import Data to SQLite**
   - Run: `node backend/scripts/import-sqlite-data.js`
   - Imports all data from JSON files to SQLite

### Phase 2: Code Migration (Minimal Downtime)

1. **Update Database Configuration**
   - Replace `backend/config/database.js` with SQLite version
   - Update connection pooling logic

2. **Update Migration Scripts**
   - Convert all PostgreSQL-specific syntax to SQLite
   - Update CHECK constraints, foreign keys, etc.

3. **Update Session Store**
   - Replace `connect-pg-simple` with `connect-sqlite3` or `better-sqlite3`

4. **Test Database Operations**
   - Run test suite
   - Verify all CRUD operations work

### Phase 3: Deployment

1. **Switch Database**
   - Update environment variables
   - Point application to SQLite database file

2. **Verify Application**
   - Test all features
   - Monitor for errors

3. **Keep PostgreSQL Backup**
   - Retain backup for 30 days minimum

## Key Differences: PostgreSQL vs SQLite

### Data Types
- `BIGSERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- `NUMERIC(10,2)` → `REAL` or `TEXT` (for precision)
- `TIMESTAMP` → `DATETIME` or `TEXT`
- `BOOLEAN` → `INTEGER` (0/1)
- `JSONB` → `TEXT` (store as JSON string)
- `VARCHAR(n)` → `TEXT` (SQLite doesn't enforce length)

### Constraints
- `CHECK` constraints work similarly
- Foreign keys need `PRAGMA foreign_keys = ON;`
- `UNIQUE` constraints work the same

### Functions
- `NOW()` → `datetime('now')`
- `SUBSTRING()` → `substr()`
- `COALESCE()` → works the same
- `UPPER()` → works the same

### Transactions
- SQLite supports transactions
- Use `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`

### Limitations
- No concurrent writes (SQLite locks entire database)
- No user management
- No network access (file-based)
- Smaller maximum database size (though still very large)

## Rollback Plan

If issues occur:

1. **Immediate Rollback**
   - Restore PostgreSQL connection in `database.js`
   - Restart application

2. **Data Recovery**
   - Restore from PostgreSQL backup
   - Re-import if needed

## Testing Checklist

- [ ] User authentication (OAuth)
- [ ] User profile management
- [ ] Product catalog
- [ ] Shopping cart
- [ ] Order creation and management
- [ ] Subscription management
- [ ] Payment processing
- [ ] Admin panel functionality
- [ ] Content management (offers, testimonials)
- [ ] System configuration
- [ ] Email queue
- [ ] Monitoring and logging
- [ ] Session management

## Performance Considerations

1. **Indexes**: Ensure all important columns are indexed
2. **WAL Mode**: Enable Write-Ahead Logging for better concurrency
3. **Connection Pooling**: SQLite doesn't need pooling, but limit connections
4. **Backup Strategy**: Regular backups of SQLite file

## Post-Migration Tasks

1. Update documentation
2. Update deployment scripts
3. Set up automated SQLite backups
4. Monitor performance
5. Remove PostgreSQL dependencies

## Timeline Estimate

- **Phase 1 (Preparation)**: 2-4 hours
- **Phase 2 (Code Migration)**: 4-6 hours
- **Phase 3 (Testing)**: 2-4 hours
- **Phase 4 (Deployment)**: 1-2 hours

**Total Estimated Time**: 9-16 hours

## Support

For issues during migration, refer to:
- SQLite Documentation: https://www.sqlite.org/docs.html
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3

