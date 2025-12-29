# Check Session in Database

## The Issue

Cookie is being set correctly, but browser is sending a DIFFERENT session cookie. This means:
- OAuth creates session: `ulXRb6aX_mXxilAxPouDwEw11yAIg5vF` ✅
- Cookie is set for that session ✅
- But browser sends: `GUxSEFTIvUa1QNjOgn6SZKfVINK0YABF` (different!) ❌

## Possible Causes

1. **Session not saved to database** - Cookie is set but session doesn't exist in DB
2. **Session expired/deleted** - Session was saved but then deleted
3. **Cookie not stored by browser** - Browser isn't storing the new cookie
4. **Browser creating new session** - Browser makes request before cookie is stored

## Check Database

Run this SQL query to check if the session exists:

```sql
SELECT sid, sess, expire 
FROM session 
WHERE sid = 'ulXRb6aX_mXxilAxPouDwEw11yAIg5vF';
```

**What to check:**
- Does the session exist? (Yes/No)
- Does `sess` contain `passport` data? (Check JSON)
- Is `expire` in the future? (Should be tomorrow)

## Also Check

After OAuth, before dashboard loads, check Application tab:
- Cookies → `http://127.0.0.1:3000` → `sessionId`
- What is the value? Does it match `ulXRb6aX_mXxilAxPouDwEw11yAIg5vF`?

If cookie value doesn't match, the browser isn't storing the new cookie.

