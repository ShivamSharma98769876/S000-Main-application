# How to Open SQLite Database Files

This guide explains how to open and troubleshoot SQLite database files in this project.

## Database Locations

The project uses SQLite databases. Common locations:

- **Main Database**: `data/tradingpro.db` (project root)
- **Backup Database**: `backend/data/tradingpro.db`
- **Session Database**: `backend/data/sessions.db`

## Quick Inspection Script

Use the built-in script to inspect the database:

```bash
# Open default database (data/tradingpro.db)
node backend/scripts/open-db.js

# Open specific database
node backend/scripts/open-db.js backend/data/tradingpro.db
```

This script will:
- Check if the file exists
- Verify file permissions
- Test database connection
- List all tables and row counts
- Show database configuration

## Method 1: DB Browser for SQLite (Recommended GUI)

### Installation
1. Download from: https://sqlitebrowser.org/
2. Install the application

### Usage
1. Open DB Browser for SQLite
2. Click "Open Database"
3. Navigate to: `data/tradingpro.db` (or your database location)
4. Browse tables, run queries, edit data

## Method 2: VS Code Extension

### Installation
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "SQLite Viewer" or "SQLite"
4. Install the extension

### Usage
1. Right-click on `.db` file in VS Code
2. Select "Open Database" or "SQLite: Open Database"
3. Browse tables in the sidebar

## Method 3: Command Line (SQLite CLI)

### Installation
1. Download SQLite from: https://www.sqlite.org/download.html
2. Or use Node.js: `npm install -g sqlite3`

### Usage
```bash
# Open database
sqlite3 data/tradingpro.db

# Run queries
sqlite3 data/tradingpro.db "SELECT * FROM users LIMIT 5;"

# Interactive mode
sqlite3 data/tradingpro.db
> .tables          # List tables
> .schema users    # Show table schema
> SELECT * FROM users;
> .quit
```

## Method 4: Node.js Script

You can also use Node.js with `better-sqlite3`:

```javascript
const Database = require('better-sqlite3');
const db = new Database('data/tradingpro.db');

// Query data
const users = db.prepare('SELECT * FROM users').all();
console.log(users);

// Close connection
db.close();
```

## Common Issues and Solutions

### Issue 1: "Database is locked"

**Cause**: Another process is using the database (server, another tool, etc.)

**Solutions**:
1. **Stop the Node.js server** if it's running:
   ```bash
   # Find and stop the process
   # On Windows: Task Manager or `taskkill /F /IM node.exe`
   ```

2. **Close other database tools** (DB Browser, VS Code extensions, etc.)

3. **Check for WAL files**: If you see `.db-wal` or `.db-shm` files, the database is in WAL mode and may be locked
   - Wait a few seconds for transactions to complete
   - Or safely close the database connection

4. **Force unlock** (use with caution):
   ```bash
   # Delete WAL files (only if you're sure no process is using the DB)
   rm data/tradingpro.db-wal
   rm data/tradingpro.db-shm
   ```

### Issue 2: "Cannot open database file"

**Cause**: File doesn't exist or wrong path

**Solutions**:
1. Check the file path:
   ```bash
   # On Windows
   dir data\tradingpro.db
   
   # On Linux/Mac
   ls -la data/tradingpro.db
   ```

2. Use absolute path:
   ```bash
   node backend/scripts/open-db.js "C:\full\path\to\tradingpro.db"
   ```

3. Check if database was created:
   ```bash
   # The database should be created automatically when the server starts
   # If missing, start the server once
   npm run dev
   ```

### Issue 3: "Permission denied"

**Cause**: File permissions issue

**Solutions**:
1. **Windows**: 
   - Right-click file → Properties → Security
   - Ensure your user has "Read" and "Write" permissions
   - If in OneDrive folder, ensure files are synced locally

2. **Linux/Mac**:
   ```bash
   chmod 644 data/tradingpro.db
   ```

3. **OneDrive Issues**:
   - If the project is in OneDrive, files might be "online-only"
   - Right-click folder → "Always keep on this device"
   - Or move project outside OneDrive

### Issue 4: "Database disk image is malformed"

**Cause**: Database corruption

**Solutions**:
1. **Restore from backup**:
   ```bash
   # Check for backup files
   ls backend/data/tradingpro_old.db
   ```

2. **Recover database**:
   ```bash
   sqlite3 tradingpro.db ".recover" | sqlite3 tradingpro_recovered.db
   ```

3. **Check integrity**:
   ```bash
   sqlite3 tradingpro.db "PRAGMA integrity_check;"
   ```

### Issue 5: "File is read-only"

**Cause**: File or folder is read-only

**Solutions**:
1. Check file properties (Windows: Right-click → Properties → uncheck "Read-only")
2. Check folder permissions
3. If in OneDrive, ensure files are synced and not "online-only"

## Database File Types

When using WAL mode (Write-Ahead Logging), you'll see additional files:

- `tradingpro.db` - Main database file
- `tradingpro.db-wal` - Write-Ahead Log (temporary transactions)
- `tradingpro.db-shm` - Shared Memory file (temporary)

**Important**: Don't delete `.db-wal` or `.db-shm` files while the database is in use!

## Best Practices

1. **Always close database connections** when done
2. **Backup before major changes**: Copy the `.db` file
3. **Use read-only mode** when just browsing: `new Database(path, { readonly: true })`
4. **Stop the server** before opening in GUI tools to avoid locks
5. **Keep backups** of important databases

## Quick Reference

```bash
# Inspect database
node backend/scripts/open-db.js

# List tables
sqlite3 data/tradingpro.db ".tables"

# Show schema
sqlite3 data/tradingpro.db ".schema users"

# Query data
sqlite3 data/tradingpro.db "SELECT * FROM users LIMIT 5;"

# Check integrity
sqlite3 data/tradingpro.db "PRAGMA integrity_check;"

# Export to SQL
sqlite3 data/tradingpro.db ".dump" > backup.sql

# Import from SQL
sqlite3 new_database.db < backup.sql
```

## Getting Help

If you're still having issues:

1. Run the inspection script: `node backend/scripts/open-db.js`
2. Check server logs for database errors
3. Verify file exists and permissions
4. Ensure no other processes are using the database

