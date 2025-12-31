# Azure Deployment Summary

## ✅ Fixed Issues

1. **Removed `startup-command` from workflow** - This parameter is not supported when using `publish-profile` authentication. The startup command must be set in Azure Portal instead.

2. **Workflow now correctly:**
   - Builds Node.js application from `backend/` directory
   - Creates deployment package with files at root level
   - Deploys to Azure without startup command (set in Portal)

## 🔧 Required Azure Portal Configuration

### Step 1: Set Runtime Stack to Node.js

**Azure Portal → Your App Service → Configuration → General settings:**

- **Stack**: `Node.js` (NOT Python!)
- **Major version**: `18 LTS` or `20 LTS`
- **Minor version**: `Latest`
- Click **Save**

### Step 2: Set Startup Command

**In the same General settings page:**

- **Startup Command**: 
  ```
  cd /home/site/wwwroot && npm start
  ```
  
  OR (if npm start doesn't work):
  ```
  cd /home/site/wwwroot && node server.js
  ```

- Click **Save**

### Step 3: Restart App Service

- Go to **Overview** → Click **Restart**
- Wait for restart to complete

## 📋 Complete Checklist

Before deployment will work:

- [ ] **Runtime Stack** set to **Node.js** (not Python)
- [ ] **Startup Command** set to `cd /home/site/wwwroot && npm start`
- [ ] **Environment Variables** configured (see `AZURE_PORTAL_CONFIGURATION.md`)
- [ ] App Service **restarted** after configuration changes

## 🚀 Deployment Process

1. **GitHub Actions** will:
   - Build the application
   - Create deployment package
   - Deploy to Azure

2. **Azure** will:
   - Extract the package to `/home/site/wwwroot`
   - Run `npm install` (if `SCM_DO_BUILD_DURING_DEPLOYMENT=true`)
   - Execute the startup command you configured in Portal

## ⚠️ Important Notes

- **Startup command cannot be set in GitHub Actions workflow** when using `publish-profile` authentication
- **Must be configured manually in Azure Portal**
- The startup command must include `cd /home/site/wwwroot &&` to ensure npm runs from the correct directory
- After changing configuration, **always restart** the app service

## 🔍 Troubleshooting

### App not starting?

1. Check **Log stream** in Azure Portal
2. Verify startup command is set correctly
3. Ensure `package.json` exists in deployed files
4. Check that Node.js stack is selected (not Python)

### Still seeing Python errors?

1. Double-check **Stack** is set to **Node.js**
2. Verify `.oryx` and `oryx-manifest.toml` files are in deployment
3. Restart the app service

### npm can't find package.json?

- Ensure startup command includes: `cd /home/site/wwwroot &&`
- Verify files are deployed to `/home/site/wwwroot`
- Check deployment logs to confirm files are in correct location

