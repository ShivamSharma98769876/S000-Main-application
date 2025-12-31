# Deployment Fix: Database Files Exclusion

## Problem
The deployment was failing with:
```
rsync: [receiver] rename "/home/site/wwwroot/data/.sessions.db.dEKt9U" -> "data/sessions.db": No such file or directory (2)
```

This happened because:
1. Database files (`.db`, `.db-shm`, `.db-wal`) were being included in the deployment package
2. The `data` directory didn't exist on the Azure server
3. rsync tried to sync database files to a non-existent directory

## Solution Applied

### 1. Updated `.gitignore`
Added database files to `.gitignore` to prevent them from being committed:
```
*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3
data/
backend/data/
```

### 2. Created `.deploymentignore`
Created `backend/.deploymentignore` to exclude database files from Azure deployment:
- All `.db`, `.db-shm`, `.db-wal`, `.sqlite`, `.sqlite3` files
- `data/` directories
- Logs, environment files, node_modules, etc.

### 3. Updated `deploy.cmd`
Modified the Kudu sync command to exclude database files:
```batch
-i ".git;.hg;.deployment;deploy.cmd;*.db;*.db-shm;*.db-wal;*.sqlite;*.sqlite3;data/"
```

Also added code to create the `data` directory if it doesn't exist:
```batch
IF NOT EXIST "%DEPLOYMENT_TARGET%\data" (
  mkdir "%DEPLOYMENT_TARGET%\data"
)
```

### 4. Updated GitHub Actions Workflow
Modified `.github/workflows/main_a000-main-app.yml` to exclude database files when preparing the deployment package:
- Uses `find` to copy files while excluding:
  - `*.db`, `*.db-shm`, `*.db-wal`, `*.sqlite`, `*.sqlite3`
  - `data/` directories
  - `node_modules/`, `.git/`

### 5. Updated `server.js`
Added code to ensure the `data` directory exists before initializing the session store:
```javascript
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info('Created data directory', { path: dataDir });
}
```

## How Database Files Are Created

Database files are created automatically on the server when:
1. **Main database** (`tradingpro.db`): Created by `backend/config/database.js` when the app starts
2. **Session database** (`sessions.db`): Created by `connect-sqlite3` when the first session is created
3. **Data directory**: Created by:
   - `deploy.cmd` during deployment
   - `server.js` on startup (if not already created)
   - `database.js` when opening the database

## Verification

After deployment, verify:
1. The `data` directory exists: `/home/site/wwwroot/data`
2. Database files are created automatically when the app starts
3. No database files are in the deployment package

## Important Notes

- **Database files should NEVER be deployed** - they contain runtime data
- **Database files are created on the server** when the app starts
- **The data directory is created automatically** if it doesn't exist
- **For production**, consider using Azure SQL Database or PostgreSQL instead of SQLite for better scalability

## Next Steps

1. Commit the changes:
   ```bash
   git add backend/.gitignore backend/.deploymentignore backend/deploy.cmd backend/server.js .github/workflows/main_a000-main-app.yml
   git commit -m "Fix: Exclude database files from deployment"
   git push
   ```

2. The next deployment should succeed without the rsync error

3. After deployment, check the logs to verify:
   - Data directory was created
   - Database files were created successfully
   - No errors related to database initialization

