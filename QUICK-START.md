# TradingPro - Quick Start Guide

Get up and running with the Trading Subscription Platform in 5 minutes!

## ⚡ Prerequisites

- Node.js 18+ installed
- PostgreSQL 13+ installed and running
- Git (optional)

## 🚀 Setup Steps

### Step 1: Database Setup (2 minutes)

```bash
# Create database
createdb tradingpro

# Navigate to backend
cd backend

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

✅ **Result**: Database created with 4 sample products and admin user

### Step 2: Configure Environment (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env  # or use your favorite editor
```

**Minimum required configuration:**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tradingpro
DB_USER=postgres
DB_PASSWORD=your_password

# Session
SESSION_SECRET=change-this-to-a-random-string

# OAuth (for testing, use dummy values)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Step 3: Start Backend (30 seconds)

```bash
# From backend directory
npm run dev
```

✅ **Result**: Server running at http://localhost:3000

### Step 4: Start Frontend (30 seconds)

Open a new terminal:

```bash
# From project root
cd public

# Start static server (choose one):
python -m http.server 8000
# OR
npx http-server -p 8000
# OR
php -S localhost:8000
```

✅ **Result**: Frontend running at http://localhost:8000

### Step 5: Test the Application (1 minute)

1. **Open browser**: http://localhost:8000
2. **View landing page**: Should see TradingPro homepage
3. **Test API**: http://localhost:3000/health
4. **Check products**: http://localhost:3000/api/v1/products (requires auth)

## 🎯 What You Can Do Now

### Without OAuth Setup
- ✅ View landing page
- ✅ Browse public pages
- ✅ See API health check
- ❌ Cannot login (requires OAuth)

### With OAuth Setup
- ✅ Login with Google/Apple
- ✅ Complete registration
- ✅ Browse products
- ✅ Add to cart
- ✅ Create orders
- ✅ Upload payment proof
- ✅ Admin approval (if admin user)

## 🔑 OAuth Setup (Optional - 10 minutes)

### Google OAuth

1. **Go to**: [Google Cloud Console](https://console.cloud.google.com/)
2. **Create project**: "TradingPro"
3. **Enable API**: Google+ API
4. **Create credentials**: OAuth 2.0 Client ID
5. **Configure**:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/v1/auth/oauth/google/callback`
6. **Copy**: Client ID and Client Secret to `.env`

### Apple OAuth

1. **Go to**: [Apple Developer](https://developer.apple.com/)
2. **Create identifier**: Sign in with Apple
3. **Configure**:
   - Return URLs: `http://localhost:3000/api/v1/auth/oauth/apple/callback`
4. **Download**: Private key (.p8 file)
5. **Copy**: Team ID, Key ID, Client ID to `.env`
6. **Place**: Private key in `backend/config/`

## 📊 Sample Data

After seeding, you'll have:

### Products (4)
1. Algo Trading Platform - ₹2,999/month
2. Premium Analytics Suite - ₹4,999/month
3. Smart Trading Bots - ₹3,499/month
4. Trading Academy - ₹1,999/month

### Admin User
- Email: From `ADMIN_EMAIL` in `.env`
- Access: Admin panel features

## 🧪 Testing Without OAuth

You can test the API directly using curl:

```bash
# Health check
curl http://localhost:3000/health

# Get products (will fail without auth)
curl http://localhost:3000/api/v1/products

# Create session manually in database for testing
# Then use session cookie in requests
```

## 🐛 Common Issues

### Issue: "Database connection failed"
**Solution**: 
```bash
# Check PostgreSQL is running
pg_isready

# Check credentials in .env
psql -h localhost -U postgres -d tradingpro
```

### Issue: "Port 3000 already in use"
**Solution**:
```bash
# Kill process
lsof -ti:3000 | xargs kill -9

# Or change port in .env
PORT=3001
```

### Issue: "OAuth redirect mismatch"
**Solution**: Ensure redirect URLs in OAuth app match exactly:
- Google: `http://localhost:3000/api/v1/auth/oauth/google/callback`
- Apple: `http://localhost:3000/api/v1/auth/oauth/apple/callback`

### Issue: "Session not persisting"
**Solution**: Check session table exists:
```bash
psql -d tradingpro -c "SELECT * FROM session LIMIT 1;"
```

## 📝 Next Steps

1. **Configure OAuth** - Enable login functionality
2. **Customize branding** - Update logo, colors, content
3. **Add products** - Use admin API to add your products
4. **Configure email** - Set up SMTP for notifications
5. **Deploy** - Move to production environment

## 📚 Learn More

- **Full Documentation**: See `README.md`
- **Backend API**: See `backend/README.md`
- **Frontend**: See `public/README.md`
- **Task Summaries**: See `TASK-*-SUMMARY.md` files

## 🆘 Need Help?

- **Check logs**: `backend/logs/combined.log`
- **Database issues**: Run `npm run db:migrate` again
- **API errors**: Check `backend/logs/error.log`
- **Frontend issues**: Check browser console

## ✅ Verification Checklist

- [ ] Database created and migrated
- [ ] Backend server running (port 3000)
- [ ] Frontend server running (port 8000)
- [ ] Landing page loads
- [ ] API health check works
- [ ] OAuth configured (optional)
- [ ] Can login and register (if OAuth setup)
- [ ] Products display correctly

## 🎉 Success!

You now have a fully functional trading subscription platform running locally!

**What's working:**
- ✅ Landing page with all sections
- ✅ OAuth authentication system
- ✅ User registration and profiles
- ✅ Product catalog
- ✅ Shopping cart
- ✅ Order management
- ✅ Admin approval workflow

**Next: Configure OAuth to enable full functionality!**

---

**Time to setup**: ~5 minutes  
**Difficulty**: Easy  
**Support**: support@tradingpro.com

