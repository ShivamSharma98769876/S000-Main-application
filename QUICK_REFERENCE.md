# 🚀 Quick Reference Card - Trading Pro Platform

## One-Page Quick Start

---

## ⚡ Quick Setup (First Time)

```bash
# 1. Create Database
psql -U postgres
CREATE DATABASE tradingpro;
\q

# 2. Install Dependencies
cd backend
npm install

# 3. Create .env file (copy from deployment_Dev.md)
# Update: DATABASE_URL and SESSION_SECRET

# 4. Run Migrations
npm run db:migrate
npm run db:migrate:email-queue
npm run db:migrate:monitoring
npm run db:seed

# 5. Start Servers (2 terminals)
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd public && python -m http.server 8000
```

---

## 🌐 Important URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:8000 | Landing page, user interface |
| **Backend** | http://localhost:3000 | API server |
| **Health Check** | http://localhost:3000/health | Server status |
| **API Docs** | http://localhost:3000/api-docs | Swagger documentation |
| **Products API** | http://localhost:3000/api/v1/products | Products endpoint |
| **Admin Dashboard** | http://localhost:8000/admin/dashboard.html | Admin panel |
| **Monitoring** | http://localhost:8000/admin/monitoring.html | System monitoring |

---

## 🔧 Daily Usage

### Start Development

```bash
# Terminal 1 - Backend
cd D:\Automation\FIn-Independence\backend
npm run dev

# Terminal 2 - Frontend
cd D:\Automation\FIn-Independence\public
python -m http.server 8000
```

### Stop Development

```bash
# Press Ctrl+C in both terminals
```

---

## 🗄️ Database Quick Commands

```bash
# Connect to database
psql -U postgres -d tradingpro

# List tables
\dt

# Check products
SELECT id, name, monthly_price FROM products;

# Check users
SELECT id, email, is_admin FROM users;

# Count records
SELECT 
  (SELECT COUNT(*) FROM products) as products,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM orders) as orders;

# Exit
\q
```

---

## 📊 NPM Scripts Reference

```bash
# Development
npm run dev              # Start with auto-reload
npm start                # Start production mode

# Database
npm run db:migrate              # Create core tables
npm run db:migrate:email-queue  # Create email queue table
npm run db:migrate:monitoring   # Create monitoring tables
npm run db:seed                 # Load sample data

# Testing
npm test                 # Run all tests
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests
npm run test:coverage    # Coverage report
```

---

## 🔍 Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Port 3000 in use | `taskkill /PID <PID> /F` or change PORT in .env |
| Port 8000 in use | `python -m http.server 8080` |
| Database connection failed | Check PostgreSQL service is running |
| Module not found | `cd backend && npm install` |
| Can't connect to DB | Verify DATABASE_URL password in .env |
| Migration failed | Drop database and recreate, then re-run migrations |

---

## 📝 Environment Variables (.env)

### Must Configure

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tradingpro
SESSION_SECRET=your-random-32-character-secret-key
```

### Optional (for testing login/email)

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

---

## ✅ Health Check Checklist

- [ ] Backend responds at http://localhost:3000/health
- [ ] Frontend loads at http://localhost:8000
- [ ] Products API returns data
- [ ] Database has 17 tables
- [ ] No errors in terminal
- [ ] No errors in browser console (F12)

---

## 📁 Project Structure

```
FIn-Independence/
├── backend/
│   ├── config/         # Configuration files
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── scripts/        # Database migrations
│   ├── logs/          # Application logs
│   ├── uploads/       # Uploaded files
│   ├── server.js      # Main server file
│   ├── package.json   # Dependencies
│   └── .env          # Environment variables
├── public/
│   ├── admin/        # Admin interface
│   ├── css/          # Stylesheets
│   ├── js/           # JavaScript
│   ├── index.html    # Landing page
│   └── *.html        # Other pages
└── deployment_Dev.md # This guide
```

---

## 🎯 Testing Endpoints

### Using curl

```bash
# Health check
curl http://localhost:3000/health

# Get products
curl http://localhost:3000/api/v1/products

# Monitoring health
curl http://localhost:3000/api/v1/monitoring/health
```

### Using Browser

1. Open http://localhost:3000/health (should see JSON)
2. Open http://localhost:8000 (should see landing page)
3. Open http://localhost:3000/api-docs (should see Swagger UI)

---

## 🔐 Create Admin User

```sql
-- Connect to database
psql -U postgres -d tradingpro

-- Create admin user
INSERT INTO users (provider_type, provider_user_id, email, is_admin, created_at, updated_at)
VALUES ('google', 'admin-dev-001', 'admin@test.com', true, NOW(), NOW())
RETURNING id;

-- Create profile (use ID from above)
INSERT INTO user_profiles (user_id, full_name, phone, address, capital_used, is_complete, created_at, updated_at)
VALUES (1, 'Admin User', '+91 9999999999', '123 Test St', 100000, true, NOW(), NOW());
```

---

## 📊 Monitoring Dashboard Tabs

1. **Errors** - Recent application errors
2. **Performance** - Response times and slow operations
3. **Failed Logins** - Security monitoring
4. **Email** - Email delivery statistics
5. **Alerts** - System alerts and warnings

---

## 🚨 Emergency Commands

### Reset Everything

```bash
# Stop servers (Ctrl+C)

# Drop database
psql -U postgres
DROP DATABASE tradingpro;
CREATE DATABASE tradingpro;
\q

# Reinstall
cd backend
rm -rf node_modules
npm install

# Remigrate
npm run db:migrate
npm run db:migrate:email-queue
npm run db:migrate:monitoring
npm run db:seed

# Restart servers
npm run dev
```

### View Recent Logs

```bash
# Windows
type backend\logs\combined.log
type backend\logs\error.log

# Mac/Linux
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

---

## 📞 Common Issues & Solutions

### Issue: "Module not found"
```bash
cd backend
npm install
```

### Issue: "ECONNREFUSED database"
```bash
# Check PostgreSQL is running
# Windows: services.msc → postgresql
# Verify .env DATABASE_URL password
```

### Issue: "Port already in use"
```bash
# Find process
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

---

## 💡 Pro Tips

1. **Always run 2 terminals** (backend + frontend)
2. **Check logs frequently** (`backend/logs/combined.log`)
3. **Use browser DevTools** (F12) to debug frontend
4. **Keep .env secure** (never commit to Git)
5. **Backup database before major changes**
6. **Monitor dashboard** for system health

---

## 📚 Key Documentation Files

- `deployment_Dev.md` - Complete setup guide (this file)
- `README.md` - Project overview
- `TASK-17-MONITORING-COMPLETION.md` - Monitoring system
- `PROJECT-STATUS-DEC-7-EVENING.md` - Current status
- `QUICK-START.md` - Quick start guide

---

## 🎯 Next Steps After Setup

1. ✅ Verify all systems working
2. ✅ Test user registration flow
3. ✅ Test product browsing
4. ✅ Test cart functionality
5. ✅ Test admin features
6. ✅ Monitor system health
7. 🚀 Deploy to production

---

## 📊 Project Status

- **Core Features:** 100% ✅
- **Overall Completion:** 70% ✅
- **Tables:** 17
- **API Endpoints:** 50+
- **Tests:** Framework ready
- **Monitoring:** Fully operational

---

**Keep this page bookmarked for quick reference!** 📌

---

Last Updated: December 7, 2025

