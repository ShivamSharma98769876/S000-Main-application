# Fix: "nodemon: not found" Error

## Problem
Azure is trying to run `nodemon` which is a development-only dependency. The error:
```
sh: 1: nodemon: not found
```

This happens when the startup command is set to `npm run dev` instead of `npm start`.

## Solution: Update Azure Portal Startup Command

### Step 1: Go to Azure Portal
1. Navigate to **Azure Portal** → Your App Service (`A000-Main-App`)
2. Go to **Configuration** → **General settings**

### Step 2: Update Startup Command
1. Find the **Startup Command** field
2. **Remove** any command that includes:
   - `npm run dev`
   - `nodemon`
   - `backend/npm run dev`
   
3. **Set** the startup command to one of these:

   **Option 1 (Recommended):**
   ```
   npm start
   ```
   
   **Option 2 (If Option 1 doesn't work):**
   ```
   node server.js
   ```
   
   **Option 3 (If files are in a subdirectory):**
   ```
   cd /home/site/wwwroot && npm start
   ```

### Step 3: Verify Runtime Stack
While you're in General settings, also verify:
- **Stack**: Should be **Node.js** (NOT Python!)
- **Major version**: **18 LTS** or **20 LTS**
- **Minor version**: **Latest**

### Step 4: Save and Restart
1. Click **Save** at the top
2. Go to **Overview** page
3. Click **Restart**
4. Wait for restart to complete

## Why This Happens

- `nodemon` is in `devDependencies` (line 71 of `package.json`)
- When Azure runs `npm install --production`, dev dependencies are NOT installed
- `npm start` uses `node server.js` (production-ready)
- `npm run dev` uses `nodemon server.js` (development-only)

## Verification

After fixing, check the logs:
1. Go to **Log stream** in Azure Portal
2. You should see:
   ```
   Server started on port 8080 in production mode
   ```
   NOT:
   ```
   nodemon: not found
   ```

## Quick Fix via Azure CLI

If you have Azure CLI installed:

```bash
# Set startup command to npm start
az webapp config set \
  --name A000-Main-App \
  --resource-group YourResourceGroup \
  --startup-file "npm start"

# Restart the app
az webapp restart \
  --name A000-Main-App \
  --resource-group YourResourceGroup
```

## Current package.json Scripts

Your `package.json` has:
- ✅ `"start": "node server.js"` - **Use this in production**
- ❌ `"dev": "nodemon server.js"` - **Only for local development**

Always use `npm start` in production!

