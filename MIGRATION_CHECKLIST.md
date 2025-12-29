# PostgreSQL to SQLite Migration Checklist

## Pre-Migration

- [ ] **Backup PostgreSQL Database**
  ```bash
  pg_dump -U postgres -d tradingpro > backup_postgres_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Install SQLite Dependencies**
  ```bash
  cd backend
  npm install better-sqlite3
  ```

- [ ] **Review Migration Plan**
  - Read `docs/POSTGRES_TO_SQLITE_MIGRATION_PLAN.md`
  - Understand key differences
  - Plan downtime window

## Phase 1: Schema Creation

- [ ] **Create SQLite Schema**
  ```bash
  node backend/scripts/migrate-sqlite-schema.js
  ```
  - Verify all tables created
  - Check indexes created
  - Verify foreign keys enabled

## Phase 2: Data Export

- [ ] **Export PostgreSQL Data**
  ```bash
  node backend/scripts/export-postgres-data.js
  ```
  - Check export directory: `backend/data/postgres-export/`
  - Verify all table JSON files exist
  - Check metadata.json for row counts

## Phase 3: Data Import

- [ ] **Import Data to SQLite**
  ```bash
  node backend/scripts/import-sqlite-data.js
  ```
  - Verify import completed
  - Check for any errors
  - Verify row counts match

## Phase 4: Verification

- [ ] **Verify Migration**
  ```bash
  node backend/scripts/verify-sqlite-migration.js
  ```
  - All tables exist
  - Row counts match
  - Foreign keys enabled
  - Sample queries work

## Phase 5: Code Migration

- [ ] **Update Database Configuration**
  - [ ] Rename `backend/config/database.js` to `backend/config/database-postgres.js` (backup)
  - [ ] Copy `backend/config/database-sqlite.js` to `backend/config/database.js`
  - [ ] Update all imports to use new database config

- [ ] **Update Package.json**
  - [ ] Remove `pg` and `connect-pg-simple` from dependencies
  - [ ] Add `better-sqlite3` to dependencies
  - [ ] Update migration scripts

- [ ] **Update Session Store**
  - [ ] Replace `connect-pg-simple` with SQLite session store
  - [ ] Update session configuration in `server.js`

- [ ] **Update Environment Variables**
  - [ ] Add `SQLITE_DB_PATH` to `.env`
  - [ ] Remove PostgreSQL connection variables (or keep as backup)

## Phase 6: Testing

- [ ] **Unit Tests**
  ```bash
  npm test
  ```

- [ ] **Integration Tests**
  - [ ] User authentication
  - [ ] User profile management
  - [ ] Product catalog
  - [ ] Shopping cart
  - [ ] Order creation
  - [ ] Subscription management
  - [ ] Payment processing
  - [ ] Admin panel
  - [ ] Content management
  - [ ] Email queue
  - [ ] Monitoring

- [ ] **Manual Testing**
  - [ ] Login/Logout
  - [ ] Create order
  - [ ] View subscriptions
  - [ ] Admin operations
  - [ ] Check logs for errors

## Phase 7: Deployment

- [ ] **Pre-Deployment**
  - [ ] Backup current PostgreSQL database one more time
  - [ ] Document rollback procedure
  - [ ] Notify team of migration

- [ ] **Deployment**
  - [ ] Stop application
  - [ ] Switch database configuration
  - [ ] Start application
  - [ ] Monitor logs

- [ ] **Post-Deployment**
  - [ ] Verify application is running
  - [ ] Test critical paths
  - [ ] Monitor for errors
  - [ ] Check performance

## Rollback Plan

If issues occur:

- [ ] **Immediate Rollback**
  - [ ] Stop application
  - [ ] Restore `database.js` from PostgreSQL version
  - [ ] Restart application
  - [ ] Verify connection to PostgreSQL

- [ ] **Data Recovery** (if needed)
  - [ ] Restore from PostgreSQL backup
  - [ ] Verify data integrity

## Post-Migration

- [ ] **Cleanup**
  - [ ] Remove PostgreSQL dependencies (after 30 days)
  - [ ] Archive export files
  - [ ] Update documentation

- [ ] **Monitoring**
  - [ ] Set up SQLite backup schedule
  - [ ] Monitor database size
  - [ ] Monitor performance
  - [ ] Check for any issues

## Notes

- Migration date: ___________
- Migration performed by: ___________
- Issues encountered: ___________
- Resolution: ___________

