# Next Steps - Child App Integration

## ✅ Completed
- [x] RSA keys generated (`backend/config/keys/public.pem` and `private.pem`)
- [x] All code implemented
- [x] Routes configured
- [x] Security hardening applied

## 🔄 Immediate Next Steps

### Step 1: Run Database Migration
Create the audit table for tracking token usage:

```bash
cd backend
node scripts/create-app-access-audit.js
```

**Expected Output:**
```
✅ App Access Audit table created successfully
```

### Step 2: Set Environment Variables
Add these to your `backend/.env` file:

```env
# JWT Configuration
JWT_PRIVATE_KEY_PATH=./config/keys/private.pem
JWT_PUBLIC_KEY_PATH=./config/keys/public.pem
JWT_ISSUER=tradingpro-main-app
JWT_AUDIENCE=tradingpro-child-app
JWT_EXPIRY=10m

# Child App URLs
CHILD_APP_URL=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
CHILD_APP_ALLOWED_ORIGINS=https://a001-strangle-ckb5h2a9cqcaamhb.southindia-01.azurewebsites.net
```

### Step 3: Install Dependencies (if not done)
```bash
cd backend
npm install
```

This will install `node-rsa` and other dependencies.

### Step 4: Restart Server
Restart your backend server to load the new environment variables:

```bash
cd backend
npm run dev
# or
npm start
```

### Step 5: Test the Integration

#### Test 1: Generate Token (requires authentication)
```bash
# First, login to get a session cookie, then:
curl -X GET http://127.0.0.1:3000/api/v1/child-app/generate-token \
  -H "Cookie: sessionId=YOUR_SESSION_ID" \
  --cookie-jar cookies.txt
```

#### Test 2: Verify Token
```bash
# Use the token from Test 1
curl -X POST http://127.0.0.1:3000/api/v1/child-app/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_JWT_TOKEN_HERE"}'
```

#### Test 3: Test Dashboard Button
1. Open `http://127.0.0.1:8000/dashboard.html`
2. Login if needed
3. Click "Launch Advanced Tools" button on an active subscription
4. Should open child app in new window with token

### Step 6: Share with Child App Team

#### 6.1 Share Public Key
**Location:** `backend/config/keys/public.pem`

**Secure Transfer Methods:**
- ✅ Azure Key Vault (recommended)
- ✅ Encrypted email (PGP/GPG)
- ✅ Secure file sharing (OneDrive/SharePoint with encryption)
- ❌ DO NOT: Plain email, Slack, Teams, or commit to repo

#### 6.2 Share Reference Implementation
Provide the child app team with:
- `child-app-examples/` directory (entire folder)
- `docs/CHILD_APP_SSO_MIDDLEWARE.md`
- `docs/CHILD_APP_INTEGRATION_PLAN.md`

## 📋 Testing Checklist

After completing the steps above, verify:

- [ ] Migration ran successfully (check database for `app_access_audit` table)
- [ ] Environment variables set correctly
- [ ] Server starts without errors
- [ ] JWT service initializes (check logs)
- [ ] Token generation endpoint works
- [ ] Token verification endpoint works
- [ ] Dashboard launch button appears
- [ ] Rate limiting works (try 21 requests in 15 min)
- [ ] CORS allows child app origin
- [ ] Audit logs are being created

## 🚨 Troubleshooting

### Issue: "JWT keys not found"
**Solution:** Ensure keys are generated:
```bash
cd backend
node scripts/generate-keys.js
```

### Issue: "Table app_access_audit does not exist"
**Solution:** Run migration:
```bash
cd backend
node scripts/create-app-access-audit.js
```

### Issue: "Cannot find module 'node-rsa'"
**Solution:** Install dependencies:
```bash
cd backend
npm install
```

### Issue: CORS errors
**Solution:** Check `CHILD_APP_ALLOWED_ORIGINS` in `.env` matches child app URL

## 📞 Support

For issues, check:
- `docs/CHILD_APP_INTEGRATION_COMPLETION.md` - Full completion summary
- `docs/CHILD_APP_INTEGRATION_PLAN.md` - Original implementation plan
- `backend/tests/integration/child-app.test.js` - Test examples

---

**Status:** Ready for testing after completing Steps 1-4

