# Azure Deployment Guide for Node.js Application

## Overview

This is a **Node.js application**, not Python. The dependency management files are:
- **`backend/package.json`** - Defines all dependencies (equivalent to `requirements.txt` for Python)
- **`backend/package-lock.json`** - Locks dependency versions for consistent installs

## Files for Azure Deployment

### Required Files

1. **`backend/package.json`** ✅ (Already exists)
   - Contains all npm dependencies
   - Azure will automatically run `npm install` during deployment

2. **`backend/package-lock.json`** ✅ (Already exists)
   - Ensures consistent dependency versions

3. **`backend/web.config`** ✅ (Created)
   - Required for Windows Azure App Service
   - Configures IIS to handle Node.js requests

4. **`backend/.deployment`** ✅ (Created)
   - Tells Azure where to deploy from

5. **`backend/deploy.cmd`** ✅ (Created)
   - Custom deployment script (optional but recommended)

### Azure App Service Configuration

#### 1. Application Settings (Environment Variables)

Go to **Azure Portal → Your App Service → Configuration → Application settings** and add:

**Required:**
```
NODE_ENV=production
PORT=8080 (or let Azure set this automatically)
CHILD_APP_URL=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
CHILD_APP_ALLOWED_ORIGINS=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
```

**Database:**
```
DATABASE_URL=your-postgresql-connection-string
# OR if using SQLite (not recommended for production):
SQLITE_DB_PATH=/home/data/tradingpro.db
```

**JWT Keys:**
```
JWT_PRIVATE_KEY_PATH=./config/keys/private.pem
JWT_PUBLIC_KEY_PATH=./config/keys/public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
JWT_EXPIRY=600m
```

**Session:**
```
SESSION_SECRET=your-production-secret-key-here
SESSION_MAX_AGE=86400000
```

**OAuth (Google):**
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-azure-app.azurewebsites.net/api/v1/auth/oauth/google/callback
```

**Email:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
ADMIN_EMAIL=admin@yourdomain.com
```

**Frontend URL:**
```
FRONTEND_URL=https://your-frontend-url.com
CORS_ORIGIN=https://your-frontend-url.com
```

#### 2. Startup Command

In **Azure Portal → Configuration → General settings → Startup Command**, set:

```
node server.js
```

Or leave it empty - Azure will auto-detect `package.json` and use the `start` script.

#### 3. Node.js Version

In **Azure Portal → Configuration → General settings**, set:
- **Stack**: Node.js
- **Version**: 18.x or 20.x (check `package.json` engines field)

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

Update the existing workflow file (`.github/workflows/main_a000-main-app.yml`) to use Node.js instead of Python:

```yaml
name: Build and deploy Node.js app to Azure Web App

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./backend
        run: npm ci
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: node-app
          path: |
            backend/
            !backend/node_modules/

  deploy:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: node-app
      
      - name: 'Deploy to Azure Web App'
        uses: azure/webapps-deploy@v3
        with:
          app-name: 'A000-Main-App'
          slot-name: 'Production'
          publish-profile: ${{ secrets.AZUREAPPSERVICE_PUBLISHPROFILE_BCCDD66C2B2240B2B334EBFDA892DF8F }}
```

### Method 2: Azure CLI

```bash
# Install Azure CLI if not installed
# Then login
az login

# Deploy from local machine
cd backend
az webapp up --name A000-Main-App --resource-group YourResourceGroup --runtime "NODE:18-lts"
```

### Method 3: VS Code Azure Extension

1. Install "Azure App Service" extension in VS Code
2. Right-click on `backend` folder
3. Select "Deploy to Web App"
4. Follow the prompts

### Method 4: Git Deployment

1. In Azure Portal → Deployment Center
2. Connect your GitHub repository
3. Set build provider to "GitHub Actions" or "Kudu"
4. Azure will auto-detect Node.js and run `npm install`

## Important Notes

### 1. Dependencies Installation

Azure will automatically:
- Detect `package.json` in the `backend` folder
- Run `npm install --production` during deployment
- Install all dependencies listed in `package.json`

### 2. Private Keys

**⚠️ IMPORTANT:** Never commit private keys to Git!

- Upload `config/keys/private.pem` via Azure Portal → Advanced Tools (Kudu) → File Manager
- Or use Azure Key Vault for sensitive files
- Or set key content as environment variable and write it to file on startup

### 3. Database

For production, use:
- **Azure Database for PostgreSQL** (recommended)
- Or **Azure SQL Database**
- SQLite is NOT recommended for production on Azure

### 4. File Storage

For file uploads, consider:
- **Azure Blob Storage** (configured in `backend/config/storage.js`)
- Set `STORAGE_TYPE=azure` and configure connection string

### 5. Logs

Logs are written to:
- `backend/logs/` directory
- Azure App Service Logs (enable in Portal → App Service Logs)

## Troubleshooting

### Dependencies Not Installing

1. Check that `package.json` is in the root of deployment folder
2. Verify Node.js version matches `engines` in `package.json`
3. Check deployment logs in Azure Portal → Deployment Center

### Application Not Starting

1. Check startup command: `node server.js`
2. Verify `PORT` environment variable (Azure sets this automatically)
3. Check application logs in Azure Portal → Log stream

### Environment Variables Not Working

1. Verify variables are set in Configuration → Application settings
2. Restart the app after adding/changing variables
3. Check that variable names match exactly (case-sensitive)

## Quick Checklist

- [ ] `package.json` exists in `backend/` folder
- [ ] `package-lock.json` exists
- [ ] `web.config` created (for Windows App Service)
- [ ] Environment variables set in Azure Portal
- [ ] Node.js version configured (18.x or 20.x)
- [ ] Startup command set (or auto-detected)
- [ ] Database connection string configured
- [ ] JWT keys uploaded to server
- [ ] OAuth callback URLs updated for production
- [ ] Frontend URL configured in CORS settings

## Support

For Azure-specific issues:
- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Node.js on Azure](https://docs.microsoft.com/azure/app-service/quickstart-nodejs)

