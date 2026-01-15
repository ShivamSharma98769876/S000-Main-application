# Azure Environment Variables Configuration Guide

## ✅ **YES - You MUST set all environment variables in Azure Portal**

Since `.env` is in `.gitignore` and won't be deployed, **all configuration must be set as environment variables** in Azure App Service.

---

## 🔧 How to Set Environment Variables in Azure

1. Go to **Azure Portal** → Your App Service (`A000-Main-App`)
2. Navigate to **Configuration** → **Application settings**
3. Click **+ New application setting** for each variable
4. Enter **Name** and **Value**
5. Click **Save** (top of page)
6. **Restart** your app service

---

## 📋 Required Environment Variables

### 🔴 **CRITICAL - Must Set Immediately**

These are required for the app to function:

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `SESSION_SECRET` | Secret key for session encryption | `your-random-32-char-string` | ✅ **YES** |
| `NODE_ENV` | Environment mode | `production` | ✅ **YES** |
| `PORT` | Server port (Azure sets this automatically) | `8080` | ⚠️ Auto-set |
| `CHILD_APP_URL` | URL of child application | `https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net` | ✅ **YES** |
| `CHILD_APP_ALLOWED_ORIGINS` | Allowed CORS origins for child app | `https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net` | ✅ **YES** |

### 🔐 **JWT Authentication (Required for SSO)**

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `JWT_PRIVATE_KEY` | RSA private key for JWT signing | `-----BEGIN PRIVATE KEY-----\n...` | ✅ **YES** |
| `JWT_PUBLIC_KEY` | RSA public key for JWT verification | `-----BEGIN PUBLIC KEY-----\n...` | ✅ **YES** |
| `JWT_ISSUER` | JWT issuer identifier | `stocksage-main-app` | ⚠️ Optional (has default) |
| `JWT_AUDIENCE` | JWT audience identifier | `stocksage-child-app` | ⚠️ Optional (has default) |
| `JWT_EXPIRY` | JWT token expiration | `1000m` | ⚠️ Optional (has default) |

**Note:** For JWT keys, you can either:
- Set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` as environment variables (recommended)
- Or upload the key files to Azure and set `JWT_PRIVATE_KEY_PATH` and `JWT_PUBLIC_KEY_PATH`

### 📧 **Email Configuration (Optional but Recommended)**

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` | ⚠️ Optional |
| `SMTP_PORT` | SMTP server port | `587` | ⚠️ Optional (default: 587) |
| `SMTP_USER` | SMTP username/email | `your-email@gmail.com` | ⚠️ Optional |
| `SMTP_PASSWORD` | SMTP password/app password | `your-app-password` | ⚠️ Optional |
| `SMTP_SECURE` | Use TLS/SSL | `false` | ⚠️ Optional (default: false) |

**Note:** If not set, email functionality will be disabled (app will still work).

### 🗄️ **Database Configuration**

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `SQLITE_DB_PATH` | Path to SQLite database file | `/home/site/data/tradingpro.db` | ⚠️ Optional (has default) |

**Note:** Azure default path is `/home/site/data/tradingpro.db`. Only change if you need a different location.

### 🌐 **CORS & Security**

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `FRONTEND_URL` | Frontend application URL | `https://your-frontend.azurewebsites.net` | ⚠️ Optional |
| `COOKIE_DOMAIN` | Cookie domain (usually leave empty) | (empty) | ⚠️ Optional |
| `SESSION_MAX_AGE` | Session max age in milliseconds | `86400000` (24 hours) | ⚠️ Optional |

### 📊 **Logging & Monitoring**

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `LOG_LEVEL` | Logging level | `info` | ⚠️ Optional (default: info) |
| `DEBUG_COOKIES` | Enable cookie debugging | `false` | ⚠️ Optional |

### 🔧 **Development/Debug (Optional)**

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `ENABLE_SWAGGER` | Enable Swagger UI in production | `false` | ⚠️ Optional |

---

## 🚀 Quick Setup Checklist

### Step 1: Critical Variables (Do First)
- [ ] `SESSION_SECRET` - Generate a random 32+ character string
- [ ] `NODE_ENV` = `production`
- [ ] `CHILD_APP_URL` = Your child app URL
- [ ] `CHILD_APP_ALLOWED_ORIGINS` = Your child app URL

### Step 2: JWT Keys (Required for SSO)
- [ ] `JWT_PRIVATE_KEY` = Your private key (full key including headers)
- [ ] `JWT_PUBLIC_KEY` = Your public key (full key including headers)

### Step 3: Optional but Recommended
- [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (if you need emails)
- [ ] `LOG_LEVEL` = `info` or `warn` (for production)

### Step 4: Save & Restart
- [ ] Click **Save** in Azure Portal
- [ ] **Restart** your app service
- [ ] Check logs to verify everything works

---

## 🔑 Generating SESSION_SECRET

You can generate a secure `SESSION_SECRET` using:

**Option 1: Node.js (on your local machine)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: Online generator**
- Use any secure random string generator
- Minimum 32 characters recommended

**Option 3: PowerShell (Windows)**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

---

## 📝 JWT Keys Format

When setting `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in Azure:

1. **Include the full key** including headers:
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
   ...
   -----END PRIVATE KEY-----
   ```

2. **Use newlines** - Azure Portal supports multi-line values
   - Or use `\n` in the value (Azure will interpret it)

3. **No quotes needed** - Just paste the key as-is

---

## 🔍 Verifying Your Configuration

After setting variables, check your logs:

1. Go to **Azure Portal** → Your App Service → **Log stream**
2. Look for:
   - ✅ `JWT Service initialized from environment variables`
   - ✅ `Server started on port 8080 in production mode`
   - ❌ No `secret option required for sessions` errors
   - ❌ No `JWT keys not found` errors

---

## ⚠️ Important Notes

1. **Never commit `.env` file** - It's in `.gitignore` for security
2. **Environment variables override `.env` file** - Azure will use env vars first
3. **Restart required** - Always restart app service after changing env vars
4. **Case sensitive** - Variable names are case-sensitive
5. **No spaces** - Don't add spaces around the `=` sign in Azure Portal

---

## 🆘 Troubleshooting

### "secret option required for sessions"
- **Fix:** Set `SESSION_SECRET` in Azure Portal

### "JWT keys not found"
- **Fix:** Set `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` in Azure Portal

### "CHILD_APP_URL is not configured"
- **Fix:** Set `CHILD_APP_URL` in Azure Portal

### Variables not taking effect
- **Fix:** Restart your app service after saving

---

## 📚 Reference: Local vs Azure

| Configuration | Local Development | Azure Production |
|--------------|-------------------|------------------|
| **Source** | `backend/.env` file | Azure Portal → Application settings |
| **SESSION_SECRET** | In `.env` file | Environment variable |
| **JWT Keys** | Files in `config/keys/` | Environment variables |
| **CHILD_APP_URL** | In `.env` file | Environment variable |
| **Database** | Local file path | `/home/site/data/tradingpro.db` |

---

## ✅ Summary

**YES, you must set all environment variables in Azure Portal** because:
1. `.env` file is in `.gitignore` and won't be deployed
2. Azure App Service uses environment variables for configuration
3. It's more secure (secrets not in code repository)
4. It's the standard practice for cloud deployments

**Minimum required variables:**
- `SESSION_SECRET`
- `NODE_ENV=production`
- `CHILD_APP_URL`
- `CHILD_APP_ALLOWED_ORIGINS`
- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`

Set these first, then add optional ones as needed!

