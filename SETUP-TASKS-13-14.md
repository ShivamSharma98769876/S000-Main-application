# Setup Guide - Tasks 13.7 & 14.6

Quick guide to set up the newly completed Email Queue System and Product API endpoints.

---

## Prerequisites

- ✅ Node.js and npm installed
- ✅ PostgreSQL database running
- ✅ Backend `.env` file configured
- ✅ Previous migrations already run

---

## Step 1: Email Queue Database Migration

Run the email queue migration to create the `email_queue` table:

```bash
cd backend
npm run db:migrate:email-queue
```

**Expected Output:**
```
Creating email_queue table...
Creating indexes for email_queue...
✅ Email queue table created successfully!
```

**Manual Alternative (if needed):**
```bash
cd backend
node scripts/migrate-email-queue.js
```

---

## Step 2: Verify Migration

Check that the email_queue table was created:

```sql
-- Connect to your PostgreSQL database
psql -U your_username -d tradingpro

-- Check table exists
\dt email_queue

-- Check table structure
\d email_queue

-- Should show:
-- - id (SERIAL PRIMARY KEY)
-- - type (VARCHAR)
-- - recipient (VARCHAR)
-- - data (JSONB)
-- - priority (VARCHAR)
-- - status (VARCHAR)
-- - retry_count (INTEGER)
-- - error_message (TEXT)
-- - created_at (TIMESTAMP)
-- - sent_at (TIMESTAMP)
-- - updated_at (TIMESTAMP)
```

---

## Step 3: Restart Backend Server

Restart the server to load the new email queue service:

```bash
cd backend

# If using npm run dev (nodemon will auto-restart)
npm run dev

# If using npm start
npm start
```

**Look for this in the logs:**
```
Email queue processing started
Server running on port 3000
```

---

## Step 4: Test Email Queue

### Test 1: Create an Order with Payment Proof

1. Go to http://localhost:8000
2. Login with OAuth
3. Add a product to cart
4. Go to checkout
5. Upload payment proof

**Expected:**
- Order created
- 2 emails added to queue (user + admin)
- Check database: `SELECT * FROM email_queue;`

### Test 2: Check Queue Statistics

```bash
# Using curl or Postman (must be authenticated as admin)
GET http://localhost:3000/api/v1/admin/email-queue/stats

# Response:
{
  "stats": {
    "pending": 2,
    "sent": 0,
    "failed": 0,
    "total": 2
  }
}
```

### Test 3: Watch Queue Processing

Wait 30 seconds (or restart server to trigger immediately), then check:

```sql
SELECT id, type, recipient, status, retry_count, sent_at 
FROM email_queue 
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected:**
- Status should change from `PENDING` to `SENT`
- `sent_at` timestamp should be filled

---

## Step 5: Test Product API Endpoints

### Test 1: List All Products (Admin)

```bash
GET http://localhost:3000/api/v1/admin/products
# Must be authenticated as admin

# Response:
{
  "products": [
    {
      "id": 1,
      "name": "Trading Signals",
      "description": "...",
      "category": "Signals",
      "monthly_price": "1999.00",
      "yearly_price": "19990.00",
      "status": "ACTIVE",
      ...
    }
  ]
}
```

### Test 2: Create a Product

```bash
POST http://localhost:3000/api/v1/admin/products
Content-Type: application/json

{
  "name": "Test Product",
  "description": "Test Description",
  "category": "Test",
  "monthly_price": 1000,
  "yearly_price": 10000,
  "status": "ACTIVE"
}

# Response: 201 Created
{
  "message": "Product created successfully",
  "product": { ... }
}
```

### Test 3: Update a Product

```bash
PUT http://localhost:3000/api/v1/admin/products/1
Content-Type: application/json

{
  "name": "Updated Product Name",
  "description": "Updated Description",
  "category": "Signals",
  "monthly_price": 2499,
  "yearly_price": 24990,
  "status": "ACTIVE"
}
```

### Test 4: Delete a Product

```bash
DELETE http://localhost:3000/api/v1/admin/products/1

# Response: 200 OK (if no active subscriptions)
# Response: 409 Conflict (if has active subscriptions)
```

---

## Step 6: Test Admin Frontend

1. Go to http://localhost:8000/admin/products.html
2. Login as admin
3. Click "Add Product" button
4. Fill out the form
5. Click "Save Product"
6. Verify product appears in list
7. Click "Edit" button
8. Modify product
9. Click "Delete" button (on a product without subscriptions)

---

## Environment Variables

Make sure these are set in `backend/.env`:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=TradingPro <noreply@tradingpro.com>
ADMIN_EMAIL=admin@tradingpro.com

# Other required vars
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/tradingpro
SESSION_SECRET=your-secret-key
```

---

## Troubleshooting

### Issue: Email queue table not found

**Solution:**
```bash
cd backend
npm run db:migrate:email-queue
```

### Issue: Emails stuck in PENDING

**Possible causes:**
1. Email service not configured (check .env)
2. Email credentials incorrect
3. Server not running background processor

**Check:**
```sql
SELECT * FROM email_queue WHERE status = 'PENDING';
```

**Manual retry:**
```bash
POST http://localhost:3000/api/v1/admin/email-queue/retry-failed
```

### Issue: Product API returns 403 Forbidden

**Cause:** Not authenticated as admin

**Solution:**
1. Login as admin user
2. Check `users` table: `UPDATE users SET is_admin = true WHERE id = 1;`

### Issue: Product deletion fails with 409 Conflict

**Cause:** Product has active subscriptions

**Solution:** Deactivate instead of delete:
```bash
PATCH http://localhost:3000/api/v1/admin/products/1/status
{ "status": "INACTIVE" }
```

---

## Monitoring

### Check Email Queue Status

```sql
-- Queue statistics
SELECT status, COUNT(*) as count 
FROM email_queue 
GROUP BY status;

-- Recent emails
SELECT id, type, recipient, status, retry_count, created_at, sent_at
FROM email_queue
ORDER BY created_at DESC
LIMIT 20;

-- Failed emails
SELECT id, type, recipient, error_message, retry_count
FROM email_queue
WHERE status = 'FAILED';
```

### Admin Endpoints

```bash
# Get queue statistics
GET /api/v1/admin/email-queue/stats

# Retry failed emails
POST /api/v1/admin/email-queue/retry-failed

# Cleanup old sent emails (older than 30 days)
POST /api/v1/admin/email-queue/cleanup
```

---

## API Documentation

Full API documentation available at:
- **Swagger UI:** http://localhost:3000/api-docs
- **JSON Spec:** http://localhost:3000/api-docs.json

---

## Testing Checklist

### Email Queue
- [ ] Migration runs successfully
- [ ] Table created with correct schema
- [ ] Server starts without errors
- [ ] Emails added to queue on order creation
- [ ] Queue processes emails (status changes to SENT)
- [ ] Failed emails retry automatically
- [ ] Admin stats endpoint works
- [ ] Manual retry works

### Product API
- [ ] List products endpoint works
- [ ] Create product works
- [ ] Update product works
- [ ] Toggle product status works
- [ ] Delete product works (without subscriptions)
- [ ] Delete blocked (with subscriptions)
- [ ] Frontend form connects to API
- [ ] Frontend displays products correctly
- [ ] Admin authentication enforced

---

## Next Steps

Once everything is working:

1. ✅ Test email delivery with real email credentials
2. ✅ Create some test products via admin panel
3. ✅ Test full order flow with email notifications
4. ✅ Monitor email queue for any issues
5. ✅ Consider implementing Task 12 (File Storage)

---

## Support

If you encounter any issues:

1. Check server logs for errors
2. Check database logs
3. Verify environment variables
4. Check email credentials
5. Ensure admin user exists and has `is_admin = true`

---

**Setup Complete! 🎉**

You now have:
- ✅ Reliable email queue with retry logic
- ✅ Complete product management API
- ✅ Admin interfaces for both features
- ✅ Background email processing
- ✅ Queue monitoring and management

Enjoy your fully functional Trading Subscription Platform!

