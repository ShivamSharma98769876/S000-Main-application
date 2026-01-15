# 🚀 Development Environment Deployment Guide

## Complete Step-by-Step Setup for Trading Pro Platform

**Last Updated:** December 7, 2025  
**Version:** 1.0  
**Environment:** Development/Local Testing

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Prerequisites

Before starting, ensure you have the following installed:

### Required Software

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **PostgreSQL** v14.0 or higher
- **Git** (latest version)
- **Code Editor** (VS Code recommended)
- **Web Browser** (Chrome, Firefox, Edge)

### Optional but Recommended

- **pgAdmin** (PostgreSQL GUI)
- **Postman** (API testing)
- **DBeaver** (Database management)

---

## Installation Steps

### Step 1: Verify Node.js and npm Installation

Open your terminal/PowerShell and run:

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version (should be 9+)
npm --version
```

**Expected Output:**
```
v18.0.0 (or higher)
9.0.0 (or higher)
```

**If not installed:**
- Download from: https://nodejs.org/
- Install the LTS (Long Term Support) version
- Restart your terminal after installation

---

### Step 2: Verify PostgreSQL Installation

```bash
# Check PostgreSQL version
psql --version
```

**Expected Output:**
```
psql (PostgreSQL) 14.0 (or higher)
```

**If not installed:**
- **Windows:** Download from https://www.postgresql.org/download/windows/
- **Mac:** `brew install postgresql`
- **Linux:** `sudo apt-get install postgresql`

**Important:** Remember your PostgreSQL password during installation!

---

### Step 3: Create PostgreSQL Database

#### Option A: Using pgAdmin (GUI - Recommended for Beginners)

1. Open **pgAdmin**
2. Connect to your PostgreSQL server
3. Right-click on **"Databases"**
4. Select **"Create"** → **"Database"**
5. Enter database name: `tradingpro`
6. Set owner: `postgres` (or your username)
7. Click **"Save"**

#### Option B: Using Command Line

```bash
# Connect to PostgreSQL
psql -U postgres

# You'll be prompted for password
# Enter the password you set during PostgreSQL installation

# Create database
CREATE DATABASE tradingpro;

# Verify database created
\l

# You should see 'tradingpro' in the list

# Exit
\q
```

**✅ Database created successfully!**

---

### Step 4: Install Backend Dependencies

```bash
# Navigate to backend directory
cd D:\Automation\FIn-Independence\backend

# Install all dependencies
npm install
```

**This installs:**
- Express.js (web framework)
- Passport.js (OAuth authentication)
- PostgreSQL driver (database connection)
- Winston (logging)
- Multer (file uploads)
- Nodemailer (email service)
- And 40+ other packages

**Wait for completion** (may take 2-5 minutes depending on internet speed)

**Expected Output:**
```
added 500+ packages, and audited 600+ packages in 2m
found 0 vulnerabilities
```

**If you see vulnerabilities**, run:
```bash
npm audit fix
```

---

## Configuration

### Step 5: Create Environment Variables File

The `.env` file contains all configuration settings for the application.

```bash
# In backend directory
# Create .env file
notepad .env
```

**Paste the following configuration:**

```env
# ==========================================
# SERVER CONFIGURATION
# ==========================================
NODE_ENV=development
PORT=3000

# ==========================================
# DATABASE CONFIGURATION
# ==========================================
# IMPORTANT: Replace YOUR_PASSWORD with your actual PostgreSQL password
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tradingpro
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tradingpro_test

# ==========================================
# SESSION CONFIGURATION
# ==========================================
# IMPORTANT: Change this to a random string for security
SESSION_SECRET=change-this-to-a-random-secret-key-min-32-characters-long
SESSION_MAX_AGE=86400000

# ==========================================
# OAUTH CONFIGURATION - GOOGLE (Optional for now)
# ==========================================
# Get credentials from: https://console.cloud.google.com/
# Leave as-is for initial testing, configure later
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# ==========================================
# OAUTH CONFIGURATION - APPLE (Optional for now)
# ==========================================
# Get credentials from: https://developer.apple.com/
# Leave as-is for initial testing, configure later
APPLE_CLIENT_ID=com.your-app.service-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY_PATH=./config/AuthKey_XXXXXXXXXX.p8
APPLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/apple/callback

# ==========================================
# FRONTEND URL
# ==========================================
FRONTEND_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:8000

# ==========================================
# EMAIL CONFIGURATION (Optional for now)
# ==========================================
# For Gmail: Use App Password, not regular password
# Setup instructions: https://myaccount.google.com/apppasswords
# Leave as-is for initial testing, configure later
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
EMAIL_FROM=info@smtp.gmail.com
ADMIN_EMAIL=info@smtp.gmail.com

# ==========================================
# FILE UPLOAD CONFIGURATION
# ==========================================
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# ==========================================
# STORAGE CONFIGURATION
# ==========================================
STORAGE_TYPE=local

# ==========================================
# SECURITY CONFIGURATION
# ==========================================
ENABLE_IP_WHITELIST=false
ADMIN_IP_WHITELIST=127.0.0.1,::1

# ==========================================
# RATE LIMITING
# ==========================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ==========================================
# API DOCUMENTATION
# ==========================================
ENABLE_SWAGGER=true

# ==========================================
# LOGGING
# ==========================================
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# ==========================================
# SYSTEM CONFIGURATION
# ==========================================
QR_CODE_URL=https://example.com/qr-code.png
UPI_ID=merchant@upi
MERCHANT_NAME=StockSage India
COMPANY_NAME=StockSage
SUPPORT_EMAIL=info@StockSage.trade
PHONE_NUMBER=+91 8904002365
```

### ⚠️ CRITICAL: Update These Values

**Before running the application, you MUST update:**

1. **DATABASE_URL**
   - Replace `YOUR_PASSWORD` with your actual PostgreSQL password
   - Example: `postgresql://postgres:MyPassword123@localhost:5432/tradingpro`

2. **SESSION_SECRET**
   - Replace with a random string (minimum 32 characters)
   - Example: `my-super-secret-session-key-12345-abcdef-xyz-789`
   - **Important:** Never share this or commit it to Git!

3. **Email Settings (Required for email functionality)**
   - See detailed setup instructions below

4. **OAuth Settings (Optional for initial testing)**
   - Can skip Google/Apple OAuth for now
   - Configure later when ready to test login

**Save the file** (Ctrl+S or Cmd+S)

### 📧 Email Configuration Setup (Gmail)

**Why you need this:**
- Send order confirmation emails to users
- Send admin notifications for new orders
- Send approval/rejection emails

**Step-by-step Gmail setup:**

1. **Enable 2-Factor Authentication (2FA) on your Gmail account**
   - Go to: https://myaccount.google.com/security
   - Under "How you sign in to Google", enable "2-Step Verification"

2. **Create an App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select app: "Mail"
   - Select device: "Other (Custom name)" → Enter "TradingPro Backend"
   - Click "Generate"
   - **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

3. **Update your `backend/.env` file** with these values:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-actual-email@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop
EMAIL_FROM=your-actual-email@gmail.com
ADMIN_EMAIL=admin@tradingpro.com
```

**Replace:**
- `your-actual-email@gmail.com` → Your real Gmail address
- `abcd efgh ijkl mnop` → The 16-character App Password from step 2
- `admin@tradingpro.com` → Email where admin notifications should be sent (can be same as your Gmail)

4. **Save the `.env` file**

5. **Restart the backend server**
   - Stop the server (Ctrl+C)
   - Run: `npm run dev`
   - You should see: `✓ Email transporter is ready` (instead of the ECONNREFUSED error)

**Testing:**
After configuration, when users place orders, emails will be sent automatically to:
- User: Order confirmation
- Admin: New order notification

---

## Database Setup

### Step 6: Run Database Migrations

Migrations create all the required database tables.

```bash
# Make sure you're in the backend directory
cd D:\Automation\FIn-Independence\backend

# Run main migration (creates 12 core tables)
npm run db:migrate
```

**Expected Output:**
```
Creating users table...
Creating user_profiles table...
Creating products table...
Creating carts table...
Creating cart_items table...
Creating subscription_orders table...
Creating subscription_order_items table...
Creating subscriptions table...
Creating login_audit table...
Creating system_config table...
Creating session table...
Creating offers table...
Creating testimonials table...
✅ All tables created successfully!
```

**Run email queue migration:**

```bash
npm run db:migrate:email-queue
```

**Expected Output:**
```
Creating email_queue table...
Creating indexes for email_queue...
✅ Email queue table created successfully!
```

**Run monitoring migration:**

```bash
npm run db:migrate:monitoring
```

**Expected Output:**
```
Creating monitoring tables...
Creating error_logs table...
Creating performance_metrics table...
Creating failed_login_attempts table...
Creating system_alerts table...
Creating indexes...
✅ Monitoring tables created successfully!
```

### Verify Tables Were Created

```bash
# Connect to database
psql -U postgres -d tradingpro

# List all tables
\dt

# You should see 17 tables:
# users, user_profiles, products, carts, cart_items
# subscription_orders, subscription_order_items, subscriptions
# login_audit, system_config, session, offers, testimonials
# email_queue, error_logs, performance_metrics
# failed_login_attempts, system_alerts

# Exit
\q
```

**✅ All 17 tables created!**

---

### Step 7: Seed Initial Data

This creates sample products and an admin user for testing.

```bash
# In backend directory
npm run db:seed
```

**Expected Output:**
```
2025-12-07 18:08:32 [info] : Starting database seeding...
2025-12-07 18:08:32 [info] : Database connection established
2025-12-07 18:08:32 [info] : Products seeded successfully
✅ Products seeded successfully
2025-12-07 18:08:32 [info] : Admin user created
✅ Admin user created
2025-12-07 18:08:32 [info] : Database seeding completed successfully
✅ Database seeding completed successfully
```

**Note:** The seed script only creates products and admin user (if `ADMIN_EMAIL` is set in `.env`). Offers and testimonials are not seeded.

### Verify Seed Data

```bash
# Connect to database
psql -U postgres -d tradingpro

# Check products
SELECT id, name, price_per_month, price_per_year FROM products;

# Should show 4 products with prices

# Check users (admin user - only if ADMIN_EMAIL was set)
SELECT id, email, is_admin FROM users;

# Should show 1 admin user (if ADMIN_EMAIL is configured)

# Exit
\q
```

**✅ Seed data loaded successfully!**

---

## Running the Application

### Step 8: Start the Backend Server

Open a terminal/PowerShell window:

```bash
# Navigate to backend directory
cd D:\Automation\FIn-Independence\backend

# Start the server in development mode (with auto-reload)
npm run dev
```

**Expected Output:**
```
[2025-12-07 10:00:00] [info] : Server started on port 3000 in development mode
🚀 Server running at http://localhost:3000
📊 API Base URL: http://localhost:3000/api/v1
🔍 Health check: http://localhost:3000/health
Swagger documentation enabled at /api-docs
Email queue processing started
```

**✅ Backend server is running!**

**Important:** Keep this terminal window open. Don't close it!

---

### Step 9: Start the Frontend Server

**Open a NEW terminal/PowerShell window** (keep the backend running):

```bash
# Navigate to public directory
cd D:\Automation\FIn-Independence\public

# Start Python HTTP server
python -m http.server 8000
```

**Expected Output:**
```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

**Alternative (if Python not installed):**

```bash
# Install http-server globally
npm install -g http-server

# Run http-server
http-server -p 8000
```

**✅ Frontend server is running!**

**Important:** Keep this terminal window open too!

---

## Testing Guide

### Step 10: Verify Everything is Running

Open your web browser and test each endpoint:

#### ✅ Test 1: Backend Health Check

**URL:** http://localhost:3000/health

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-07T10:00:00.000Z",
  "database": "connected",
  "uptime": 123,
  "version": "1.0.0"
}
```

**Status:** If you see this JSON, backend is working! ✅

---

#### ✅ Test 2: Frontend Landing Page

**URL:** http://localhost:8000

**What to Check:**
- [ ] Page loads without errors
- [ ] Header with logo and navigation visible
- [ ] Hero section displays
- [ ] Products section shows 4 products
- [ ] Offers section appears
- [ ] Testimonials section visible
- [ ] Footer with links present
- [ ] No JavaScript errors in browser console (F12)

**Status:** If page loads correctly, frontend is working! ✅

---

#### ✅ Test 3: API Products Endpoint

**URL:** http://localhost:3000/api/v1/products

**Expected Response:** JSON array with 4 products

```json
{
  "products": [
    {
      "id": 1,
      "name": "Trading Signals Premium",
      "price_per_month": "1999.00",
      "price_per_year": "19990.00",
      ...
    },
    ...
  ]
}
```

**Status:** If you see products JSON, API is working! ✅

---

#### ✅ Test 4: Monitoring Health Check

**URL:** http://localhost:3000/api/v1/monitoring/health

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-07T10:00:00.000Z",
  "checks": {
    "database": { "status": "healthy", "message": "Connected" },
    "emailQueue": { "status": "healthy", "message": "Processing normally" },
    "memory": { "status": "healthy", "message": "Memory usage at 25.5%" },
    "errorRate": { "status": "healthy", "message": "Error rate at 0.00%" }
  }
}
```

**Status:** If all checks are healthy, monitoring is working! ✅

---

#### ✅ Test 5: Swagger API Documentation

**URL:** http://localhost:3000/api-docs

**What to Check:**
- [ ] Swagger UI loads
- [ ] API endpoints are listed
- [ ] Can expand endpoints to see details

**Status:** If Swagger UI loads, API docs are working! ✅

---

### Step 11: Database Verification

Verify all data is correctly loaded:

```bash
# Connect to database
psql -U postgres -d tradingpro

# Check table counts
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM products) as products,
  (SELECT COUNT(*) FROM offers) as offers,
  (SELECT COUNT(*) FROM testimonials) as testimonials;

# Expected output:
#  users | products | offers | testimonials 
# -------+----------+--------+--------------
#      1 |        4 |      3 |            3

# List all tables with row counts
SELECT 
    schemaname,
    tablename,
    n_tup_ins as "Total Rows"
FROM 
    pg_stat_user_tables
ORDER BY 
    tablename;

# Exit
\q
```

---

### Step 12: Check Application Logs

Verify logging is working:

```bash
# Navigate to backend directory
cd D:\Automation\FIn-Independence\backend

# Check if logs directory exists
dir logs

# View combined log
type logs\combined.log

# View error log (should be empty or minimal)
type logs\error.log

# View access log
type logs\access.log
```

**What to look for:**
- Server startup messages
- HTTP request logs
- No critical errors

---

### Step 13: Create Test Admin User

To access admin features, create an admin account:

```bash
# Connect to database
psql -U postgres -d tradingpro

# Create admin user (if not already created by seed)
INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
VALUES ('google', 'dev-admin-001', 'admin@test.com', true, NOW(), NOW())
RETURNING id;

# Note the ID returned (e.g., 2)
# Use this ID in the next command

# Create admin profile (replace 2 with your user ID)
INSERT INTO user_profiles (user_id, full_name, phone, address, capital_used, is_complete, created_at, updated_at)
VALUES (2, 'Admin User', '+91 9999999999', '123 Admin Street', 100000, true, NOW(), NOW());

# Verify admin user
SELECT u.id, u.email, u.is_admin, up.full_name 
FROM users u 
LEFT JOIN user_profiles up ON u.id = up.user_id 
WHERE u.is_admin = true;

# Exit
\q
```

---

## Complete Testing Checklist

Use this checklist to verify everything works:

### Backend Tests

- [ ] Backend server starts without errors
- [ ] Health endpoint returns "healthy"
- [ ] Products API returns 4 products
- [ ] Monitoring health check passes
- [ ] Swagger documentation loads
- [ ] Logs are being created
- [ ] Database has 17 tables
- [ ] Database has seed data

### Frontend Tests

- [ ] Frontend server starts without errors
- [ ] Landing page loads correctly
- [ ] All sections visible (header, hero, products, offers, testimonials, footer)
- [ ] No console errors (F12 → Console)
- [ ] Images load properly
- [ ] Navigation links work
- [ ] Responsive design works (try resizing browser)

### Database Tests

- [ ] Can connect to database
- [ ] All 17 tables exist
- [ ] Products table has 4 rows
- [ ] Users table has at least 1 admin user
- [ ] Offers table has 3 rows
- [ ] Testimonials table has 3 rows

### System Tests

- [ ] Both servers running simultaneously
- [ ] Can access backend and frontend URLs
- [ ] No port conflicts
- [ ] Adequate disk space for logs
- [ ] PostgreSQL service running

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "npm: command not found"

**Problem:** Node.js/npm not installed or not in PATH

**Solution:**
```bash
# Check if Node.js is installed
where node
where npm

# If not found:
# 1. Download from https://nodejs.org/
# 2. Install LTS version
# 3. Restart terminal
# 4. Verify installation
node --version
npm --version
```

---

#### Issue 2: "PostgreSQL connection failed"

**Problem:** Database not running or wrong credentials

**Solution:**
```bash
# Check if PostgreSQL service is running
# Windows: Win+R → services.msc → Look for "postgresql" service

# Test connection
psql -U postgres

# If connection works, check .env file
# Verify DATABASE_URL has correct password

# Common mistakes:
# - Wrong password in .env
# - Database name typo (should be 'tradingpro')
# - PostgreSQL not running
```

---

#### Issue 3: "Port 3000 already in use"

**Problem:** Another application using port 3000

**Solution:**
```bash
# Find process using port 3000
# Windows:
netstat -ano | findstr :3000

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# Or use different port
# Edit .env:
PORT=3001

# Then restart server
```

---

#### Issue 4: "Port 8000 already in use"

**Problem:** Another application using port 8000

**Solution:**
```bash
# Use different port for frontend
# Windows:
python -m http.server 8080

# Update FRONTEND_URL in backend/.env:
FRONTEND_URL=http://localhost:8080
CORS_ORIGIN=http://localhost:8080

# Restart backend server
```

---

#### Issue 5: "Module not found"

**Problem:** Dependencies not installed

**Solution:**
```bash
# Delete and reinstall
cd backend
rm -rf node_modules package-lock.json
npm install

# If specific module missing:
npm install <module-name>
```

---

#### Issue 6: "Migration failed"

**Problem:** Database tables already exist or connection error

**Solution:**
```bash
# Drop and recreate database
psql -U postgres

DROP DATABASE tradingpro;
CREATE DATABASE tradingpro;
\q

# Run migrations again
npm run db:migrate
npm run db:migrate:email-queue
npm run db:migrate:monitoring
npm run db:seed
```

---

#### Issue 7: "Python not found"

**Problem:** Python not installed

**Solution:**
```bash
# Check Python
python --version

# If not installed:
# Download from https://www.python.org/

# Alternative: Use Node.js http-server
npm install -g http-server
cd public
http-server -p 8000
```

---

#### Issue 8: "Cannot connect to database"

**Problem:** Wrong connection string or PostgreSQL not running

**Solution:**
```bash
# Verify PostgreSQL is running
# Windows: Check Services
# Mac/Linux: 
sudo systemctl status postgresql

# Test connection manually
psql -U postgres -h localhost -p 5432 -d tradingpro

# If fails, check:
# 1. PostgreSQL service running
# 2. Firewall not blocking port 5432
# 3. pg_hba.conf allows local connections
```

---

#### Issue 9: "EADDRINUSE: address already in use"

**Problem:** Port already occupied

**Solution:**
```bash
# Check what's using the port
# Windows:
netstat -ano | findstr :<PORT>

# Mac/Linux:
lsof -i :<PORT>

# Kill the process or use different port
```

---

#### Issue 10: "Permission denied"

**Problem:** Insufficient permissions

**Solution:**
```bash
# Windows: Run PowerShell as Administrator
# Right-click PowerShell → "Run as Administrator"

# Mac/Linux: Use sudo
sudo npm install
```

---

## Advanced Configuration

### Setting Up Gmail for Email Notifications

1. **Enable 2-Factor Authentication**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Create App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Generate password
   - Copy the 16-character password

3. **Update .env**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=abcd efgh ijkl mnop  (app password)
   ```

4. **Test Email**
   ```bash
   # Restart backend server
   # Create test order with payment proof
   # Check email inbox for confirmation
   ```

---

### Setting Up Google OAuth

1. **Create Google Cloud Project**
   - Go to: https://console.cloud.google.com/
   - Create new project: "TradingPro Dev"

2. **Enable Google+ API**
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

3. **Create OAuth Credentials**
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "TradingPro Development"
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/v1/auth/google/callback`
   - Click "Create"

4. **Update .env**
   ```env
   GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
   ```

5. **Test OAuth**
   - Visit: http://localhost:8000/login.html
   - Click "Continue with Google"
   - Should redirect to Google login

---

## Next Steps

Once everything is running successfully:

### 1. Test User Journey

Follow complete user flow:
- Browse products
- Login with OAuth (if configured)
- Complete registration
- Add products to cart
- Proceed to checkout
- Upload payment proof
- Check email confirmation

### 2. Test Admin Features

Access admin panel:
- Navigate to: http://localhost:8000/admin/dashboard.html
- View pending orders
- Approve/reject orders
- Manage products
- View monitoring dashboard

### 3. Monitor System Health

Check monitoring dashboard:
- URL: http://localhost:8000/admin/monitoring.html
- View system metrics
- Check error logs
- Monitor performance
- Review failed logins
- Check email delivery

### 4. Prepare for Production

- [ ] Set up cloud file storage (S3/Azure/GCS)
- [ ] Configure production database
- [ ] Set up production OAuth credentials
- [ ] Configure email service for production
- [ ] Set up domain and SSL
- [ ] Configure backup strategy
- [ ] Set up monitoring alerts

---

## Quick Reference

### Common Commands

```bash
# Start backend
cd backend && npm run dev

# Start frontend
cd public && python -m http.server 8000

# Run migrations
npm run db:migrate
npm run db:migrate:email-queue
npm run db:migrate:monitoring

# Seed database
npm run db:seed

# Check database
psql -U postgres -d tradingpro

# View logs
type backend\logs\combined.log

# Kill process on port
taskkill /PID <PID> /F
```

### Important URLs

- **Frontend:** http://localhost:8000
- **Backend API:** http://localhost:3000/api/v1
- **Health Check:** http://localhost:3000/health
- **API Docs:** http://localhost:3000/api-docs
- **Admin Dashboard:** http://localhost:8000/admin/dashboard.html
- **Monitoring:** http://localhost:8000/admin/monitoring.html

### Database Quick Reference

```sql
-- Connect
psql -U postgres -d tradingpro

-- List tables
\dt

-- Check products
SELECT * FROM products;

-- Check users
SELECT * FROM users;

-- Check admin users
SELECT * FROM users WHERE is_admin = true;

-- Exit
\q
```

---

## Support and Resources

### Documentation Files

- `README.md` - Project overview
- `QUICK-START.md` - Quick start guide
- `TASKS-13-14-COMPLETION-REPORT.md` - Email & Product API
- `TASK-17-MONITORING-COMPLETION.md` - Monitoring system
- `PROJECT-STATUS-DEC-7-EVENING.md` - Project status

### Helpful Links

- **Node.js Download:** https://nodejs.org/
- **PostgreSQL Download:** https://www.postgresql.org/download/
- **Google Cloud Console:** https://console.cloud.google.com/
- **Gmail App Passwords:** https://myaccount.google.com/apppasswords

### Getting Help

If you encounter issues:

1. Check the Troubleshooting section above
2. Review the logs in `backend/logs/`
3. Check browser console for frontend errors (F12)
4. Verify all environment variables in `.env`
5. Ensure PostgreSQL service is running
6. Restart both servers

---

## Success Indicators

✅ **You're ready when:**

1. Both servers running without errors
2. Landing page loads correctly
3. API health check returns "healthy"
4. Database has 17 tables with data
5. Products API returns 4 products
6. No errors in browser console
7. Logs are being generated
8. Monitoring dashboard accessible

---

## Summary

**What You've Accomplished:**

✅ Installed and configured all dependencies
✅ Set up PostgreSQL database with 17 tables
✅ Loaded seed data (products, admin user, offers, testimonials)
✅ Started backend server (Node.js/Express)
✅ Started frontend server (static files)
✅ Verified all systems operational
✅ Ready for development and testing

**Current Status:**
- **Backend:** Running on http://localhost:3000
- **Frontend:** Running on http://localhost:8000
- **Database:** PostgreSQL with 17 tables
- **Environment:** Development/Local
- **Features:** 70% complete, 100% core features working

**You can now:**
- Develop new features
- Test existing functionality
- Access monitoring dashboard
- Prepare for production deployment

---

**Congratulations! Your development environment is ready! 🎉**

---

**Version:** 1.0  
**Last Updated:** December 7, 2025  
**Maintained By:** StockSage Development Team

