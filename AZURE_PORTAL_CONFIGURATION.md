# Azure Portal Configuration - CRITICAL SETUP

## ⚠️ IMPORTANT: You MUST configure these settings in Azure Portal

The deployment will fail if these are not set correctly. Azure is currently detecting Python instead of Node.js.

### Step 1: Set Runtime Stack to Node.js

1. Go to **Azure Portal** → Your App Service (`A000-Main-App`)
2. Navigate to **Configuration** → **General settings**
3. Under **Stack settings**:
   - **Stack**: Select **Node.js** (NOT Python!)
   - **Major version**: Select **18 LTS** (or 20 LTS)
   - **Minor version**: Select **Latest**
4. Click **Save**

### Step 2: Set Startup Command

1. In the same **General settings** page:
2. Under **Startup Command**, enter:
   ```
   cd /home/site/wwwroot && npm start
   ```
   OR
   ```
   cd /home/site/wwwroot && node server.js
   ```
   
   **Important:** The `cd /home/site/wwwroot &&` part ensures npm runs from the correct directory where your `package.json` is located.
   
3. Click **Save**

### Step 3: Verify Application Settings

Go to **Configuration** → **Application settings** and ensure you have:

**Required Settings:**
- `NODE_ENV` = `production`
- `CHILD_APP_URL` = `https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net`
- `CHILD_APP_ALLOWED_ORIGINS` = `https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net`

**Database:**
- `DATABASE_URL` = Your PostgreSQL connection string

**JWT:**
- `JWT_PRIVATE_KEY_PATH` = `./config/keys/private.pem`
- `JWT_PUBLIC_KEY_PATH` = `./config/keys/public.pem`
- `JWT_ISSUER` = `stocksage-main-app`
- `JWT_AUDIENCE` = `stocksage-child-app`
- `JWT_EXPIRY` = `1000m`

**Session:**
- `SESSION_SECRET` = Your production secret key ⚠️ **REQUIRED - Generate a secure random string**
  - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - Or use a long random string (minimum 32 characters)
- `SESSION_MAX_AGE` = `86400000`

**OAuth:**
- `GOOGLE_CLIENT_ID` = Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` = Your Google OAuth secret
- `GOOGLE_CALLBACK_URL` = `https://your-app.azurewebsites.net/api/v1/auth/oauth/google/callback`

**Email:**
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_USER` = Your email
- `SMTP_PASSWORD` = Your app password
- `EMAIL_FROM` = Your email
- `ADMIN_EMAIL` = Admin email

**Frontend:**
- `FRONTEND_URL` = Your frontend URL
- `CORS_ORIGIN` = Your frontend URL

### Step 4: Restart the App Service

After making these changes:
1. Go to **Overview** page
2. Click **Restart**
3. Wait for restart to complete

## Alternative: Using Azure CLI

If you have Azure CLI installed, you can run:

```bash
# Login to Azure
az login

# Set runtime stack to Node.js 18
az webapp config set \
  --name A000-Main-App \
  --resource-group YourResourceGroup \
  --linux-fx-version "NODE|18-lts"

# Set startup command
az webapp config set \
  --name A000-Main-App \
  --resource-group YourResourceGroup \
  --startup-file "npm start"

# Restart the app
az webapp restart \
  --name A000-Main-App \
  --resource-group YourResourceGroup
```

## Current Issue

Based on the error logs:
- ❌ Azure is configured for **Python** (antenv, Python 3.12)
- ❌ Startup command is set to `backend\npm run dev` (incorrect - should be `npm start`)

**Fix:**
1. Change Stack from Python to **Node.js**
2. Change Startup Command to `npm start` or `node server.js`

## Verification

After configuration, check the logs:
1. Go to **Log stream** in Azure Portal
2. You should see Node.js starting, not Python
3. The startup command should show `npm start` or `node server.js`

## Troubleshooting

### Still seeing Python errors?
- Double-check the Stack setting is **Node.js**, not Python
- Restart the app service
- Check deployment logs to ensure `.oryx` and `oryx-manifest.toml` are being created

### Startup command not working?
- Ensure `package.json` has a `start` script: `"start": "node server.js"`
- Try using `node server.js` directly instead of `npm start`
- Check that `server.js` exists in the deployed files

### App not starting?
- Check **Log stream** for errors
- Verify all environment variables are set
- Ensure database connection string is correct
- Check that JWT keys are uploaded to the server

