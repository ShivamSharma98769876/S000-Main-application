# Test Cookie Script - Copy This

## Step 1: Copy This Entire Script

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie', {credentials: 'include'}).then(function(res) {return res.json();}).then(function(data) {console.log('Cookies received:', data.cookiesReceived);console.log('Session ID:', data.sessionID);});
```

## Step 2: Or Use This Simpler Version

Open browser console and type this line by line:

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie', {credentials: 'include'})
.then(res => res.json())
.then(data => {
  console.log('Cookies:', data.cookiesReceived);
  console.log('Session ID:', data.sessionID);
});
```

## Step 3: Or Use This (Most Compatible)

```javascript
fetch('http://127.0.0.1:3000/api/v1/auth/test-cookie', {credentials: 'include'})
.then(function(res) {
  return res.json();
})
.then(function(data) {
  console.log('Cookies received:', data.cookiesReceived);
  console.log('Session ID:', data.sessionID);
});
```

## What to Look For

After running, check the console output:
- **Cookies received:** Should show `sessionId=...` or "No cookies"
- **Session ID:** Should show a session ID

## Report Back

Just tell me what `Cookies received:` shows!

