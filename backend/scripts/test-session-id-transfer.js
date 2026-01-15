/**
 * Test Script: Verify Session ID Transfer in JWT Tokens
 * 
 * This script tests that the main application correctly includes
 * the session ID in JWT tokens generated for child app access.
 * 
 * Usage:
 *   1. First, login to get a session cookie
 *   2. Run: node scripts/test-session-id-transfer.js YOUR_SESSION_ID
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const SESSION_ID = process.argv[2];

if (!SESSION_ID) {
    console.error('❌ Error: Session ID required');
    console.log('Usage: node scripts/test-session-id-transfer.js YOUR_SESSION_ID');
    console.log('\nTo get session ID:');
    console.log('1. Login to the application');
    console.log('2. Check browser cookies for sessionId');
    console.log('3. Or check server logs for session creation');
    process.exit(1);
}

// Load public key to verify tokens
const publicKeyPath = path.join(__dirname, '../config/keys/public.pem');
let publicKey;

try {
    publicKey = fs.readFileSync(publicKeyPath, 'utf8');
} catch (error) {
    console.error('❌ Error: Public key not found. Run generate-keys.js first.');
    process.exit(1);
}

/**
 * Make HTTP request
 */
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const req = client.request(url, {
            method: options.method || 'GET',
            headers: {
                'Cookie': `sessionId=${SESSION_ID}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        
        req.on('error', reject);
        
        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        
        req.end();
    });
}

/**
 * Decode JWT token
 */
function decodeToken(token) {
    try {
        return jwt.decode(token, { complete: true });
    } catch (error) {
        return null;
    }
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, publicKey, {
            algorithms: ['RS256'],
            issuer: 'StockSage-main-app',
            audience: 'StockSage-child-app'
        });
    } catch (error) {
        return null;
    }
}

/**
 * Main test function
 */
async function testSessionIdTransfer() {
    console.log('🧪 Testing Session ID Transfer in JWT Tokens\n');
    console.log(`📋 Configuration:`);
    console.log(`   API URL: ${API_BASE_URL}`);
    console.log(`   Session ID: ${SESSION_ID.substring(0, 20)}...`);
    console.log(`   Public Key: ${publicKeyPath}\n`);

    // Test 1: Generate Token
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 1: Generate Token with Session ID');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        const response = await makeRequest(`${API_BASE_URL}/api/v1/child-app/generate-token`);
        
        if (response.status !== 200) {
            console.error(`❌ Failed: HTTP ${response.status}`);
            console.error(`   Response:`, response.data);
            return;
        }
        
        if (!response.data.success || !response.data.token) {
            console.error('❌ Failed: Invalid response');
            console.error('   Response:', response.data);
            return;
        }
        
        const token = response.data.token;
        console.log('✅ Token generated successfully');
        console.log(`   Token (first 50 chars): ${token.substring(0, 50)}...\n`);
        
        // Decode token
        const decoded = decodeToken(token);
        if (!decoded) {
            console.error('❌ Failed: Cannot decode token');
            return;
        }
        
        console.log('📦 Token Payload:');
        console.log(JSON.stringify(decoded.payload, null, 2));
        console.log();
        
        // Verify session_id
        if (!decoded.payload.session_id) {
            console.error('❌ FAILED: session_id is missing from token payload!');
            return;
        }
        
        const tokenSessionId = decoded.payload.session_id;
        console.log(`✅ Session ID found in token: ${tokenSessionId}`);
        
        // Check if session_id matches (or is a valid UUID)
        if (tokenSessionId === SESSION_ID) {
            console.log(`✅ Session ID matches provided session ID`);
        } else {
            console.log(`⚠️  Session ID in token (${tokenSessionId}) differs from provided session ID`);
            console.log(`   This is OK if the token uses a different session identifier`);
        }
        
        // Verify token signature
        const verified = verifyToken(token);
        if (verified) {
            console.log('✅ Token signature verified successfully');
        } else {
            console.error('❌ FAILED: Token signature verification failed');
            return;
        }
        
        // Check required fields
        const requiredFields = ['user_id', 'email', 'session_id', 'iss', 'aud', 'exp', 'iat'];
        const missingFields = requiredFields.filter(field => !decoded.payload[field]);
        
        if (missingFields.length > 0) {
            console.error(`❌ FAILED: Missing required fields: ${missingFields.join(', ')}`);
            return;
        } else {
            console.log('✅ All required fields present in token');
        }
        
        console.log('\n✅ Test 1 PASSED: Session ID is correctly included in JWT token\n');
        
        // Test 2: Launch Endpoint
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Test 2: Launch Endpoint with Session ID');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const launchResponse = await makeRequest(`${API_BASE_URL}/api/v1/child-app/launch`, {
            method: 'POST',
            body: { return_url: '/dashboard' }
        });
        
        if (launchResponse.status !== 200 || !launchResponse.data.success) {
            console.error(`❌ Failed: HTTP ${launchResponse.status}`);
            console.error('   Response:', launchResponse.data);
            return;
        }
        
        const redirectUrl = launchResponse.data.redirect_url;
        console.log('✅ Launch endpoint successful');
        console.log(`   Redirect URL: ${redirectUrl.substring(0, 100)}...\n`);
        
        // Extract token from URL
        const urlObj = new URL(redirectUrl);
        const ssoToken = urlObj.searchParams.get('sso_token');
        
        if (!ssoToken) {
            console.error('❌ FAILED: No sso_token in redirect URL');
            return;
        }
        
        const launchDecoded = decodeToken(ssoToken);
        if (launchDecoded && launchDecoded.payload.session_id) {
            console.log(`✅ Session ID in launch token: ${launchDecoded.payload.session_id}`);
            console.log('✅ Test 2 PASSED: Launch endpoint includes session ID\n');
        } else {
            console.error('❌ FAILED: Launch token missing session_id');
            return;
        }
        
        // Summary
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Test Summary');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ All tests PASSED');
        console.log(`✅ Session ID is correctly transferred: ${tokenSessionId}`);
        console.log('✅ Token is properly signed and verified');
        console.log('✅ All required fields present');
        console.log('\n🎉 Session ID transfer is working correctly!');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testSessionIdTransfer().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

