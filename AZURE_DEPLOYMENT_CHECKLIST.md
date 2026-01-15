# Azure Deployment Checklist

This document ensures all configurations work correctly on both local and Azure environments.

## ✅ Environment Detection

The system automatically detects Azure vs local environment using:
- `WEBSITE_SITE_NAME` - Azure App Service site name
- `WEBSITE_HOSTNAME` - Azure App Service hostname
- `NODE_ENV` - Environment mode

## ✅ Path Configurations

### Public Directory (Frontend)
- **Local**: `../public` (one level up from backend/)
- **Azure**: `public` (same directory as server.js)
- **Detection**: Uses `WEBSITE_SITE_NAME` or `WEBSITE_HOSTNAME`

### Upload Directory
- **Local**: `backend/uploads/` (from server.js) or `../uploads` (from routes)
- **Azure**: `backend/uploads/` (same structure)
- **Note**: Can be overridden with `UPLOAD_DIR` environment variable

### File Paths
All file paths use `path.join()` for cross-platform compatibility (Windows/Linux).

## ✅ Database Configuration

### Connection String
- Supports `DATABASE_URL` (PostgreSQL connection string)
- Falls back to individual parameters: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- SSL enabled automatically on Azure (detected via `WEBSITE_SITE_NAME` or `WEBSITE_HOSTNAME`)

### Environment Variables
- Loads from `backend/env` file first (if exists)
- Falls back to `.env` file
- Azure App Service: Set via Azure Portal → Configuration → Application Settings

## ✅ Port Configuration

- **Local**: Defaults to port 3000
- **Azure**: Uses `PORT` environment variable (automatically set by Azure)

## ✅ Static File Serving

### Frontend Files
- Served from `/` route (index.html)
- Static assets from `public/` directory
- Path detection: Azure vs Local

### Uploaded Files
- Served from `/uploads` route
- Files stored in `uploads/` directory
- Content-Type headers set automatically (PNG, JPEG, WEBP)

## ✅ CORS Configuration

- **Local**: Allows `http://localhost:3000` and `http://127.0.0.1:3000`
- **Azure**: Uses `FRONTEND_URL` environment variable or auto-detects from `WEBSITE_HOSTNAME`
- Frontend and backend on same origin (no CORS issues)

## ✅ OAuth Configuration

### Google OAuth
- Auto-detects callback URL on Azure
- Uses `WEBSITE_HOSTNAME` or `WEBSITE_SITE_NAME`
- Falls back to `localhost:3000` for development

### Frontend URL
- Auto-detects from Azure environment variables
- Can be overridden with `FRONTEND_URL` environment variable

## ✅ API Base URL

Frontend automatically detects API base URL:
- **Local**: `http://localhost:3000/api/v1` or `http://127.0.0.1:3000/api/v1`
- **Azure**: `https://your-app.azurewebsites.net/api/v1`
- Detection via `config.js` (checks hostname and protocol)

## ✅ Required Azure Environment Variables

Set these in Azure Portal → Configuration → Application Settings:

### Database
```
DATABASE_URL=postgresql://user:password@host:port/database
# OR
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=tradingpro
DB_USER=postgres
DB_PASSWORD=your-password
```

### Security
```
SESSION_SECRET=your-random-secret-key-min-32-characters
NODE_ENV=production
```

### Optional
```
UPLOAD_DIR=/path/to/uploads  # If you want custom upload location
MAX_FILE_SIZE=5242880  # 5MB in bytes
FRONTEND_URL=https://your-app.azurewebsites.net
ADMIN_EMAIL=info@stocksage.trade
```

## ✅ File Upload Configuration

### Payment Proofs
- Stored in `uploads/` directory
- Max size: 5MB (configurable via `MAX_FILE_SIZE`)
- Allowed types: JPEG, PNG, WEBP

### QR Codes
- Stored in `uploads/` directory
- Max size: 5MB
- Allowed types: JPEG, PNG, WEBP

## ✅ Session Configuration

- Uses PostgreSQL session store (`connect-pg-simple`)
- Session secret from `SESSION_SECRET` environment variable
- Secure cookies in production

## ✅ Error Handling

- Development: Detailed error messages
- Production: Generic error messages (security)
- Logs all errors to Winston logger

## ✅ Logging

- Logs directory: `backend/logs/`
- Log levels: error, warn, info, debug
- Separate log files for different log types

## ✅ Health Checks

- Health endpoint: `/api/v1/health`
- Database connection check
- Returns status and timestamp

## ✅ Deployment Steps

1. **Set Environment Variables** in Azure Portal
2. **Deploy Code** to Azure App Service
3. **Verify Database Connection** (check logs)
4. **Test Health Endpoint**: `https://your-app.azurewebsites.net/api/v1/health`
5. **Test Frontend**: `https://your-app.azurewebsites.net`
6. **Test File Uploads**: Upload payment proof or QR code
7. **Check Logs**: Azure Portal → Log stream

## ✅ Verification Checklist

After deployment, verify:

- [ ] Health endpoint returns 200 OK
- [ ] Frontend loads correctly
- [ ] API endpoints respond
- [ ] Database queries work
- [ ] File uploads work (payment proof, QR code)
- [ ] Static files serve correctly
- [ ] OAuth redirects work (if configured)
- [ ] Emails send correctly (if configured)
- [ ] Logs are being written

## ✅ Troubleshooting

### Files Not Uploading
- Check `UPLOAD_DIR` environment variable
- Verify `uploads/` directory exists and is writable
- Check file size limits (`MAX_FILE_SIZE`)

### Database Connection Issues
- Verify `DATABASE_URL` or individual DB parameters
- Check SSL configuration (required on Azure)
- Verify firewall rules allow Azure IPs

### Static Files Not Loading
- Check `public/` directory path
- Verify `web.config` rewrite rules
- Check file permissions

### CORS Issues
- Verify `FRONTEND_URL` is set correctly
- Check CORS origin configuration
- Ensure frontend and backend are on same origin

## ✅ Notes

- All paths use `path.join()` for cross-platform compatibility
- Environment detection is automatic (no manual configuration needed)
- SSL is automatically enabled on Azure
- Port is automatically set by Azure (`PORT` environment variable)
- Upload directory is automatically created if it doesn't exist

