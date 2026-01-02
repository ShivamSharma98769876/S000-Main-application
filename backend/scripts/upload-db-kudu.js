#!/usr/bin/env node
/**
 * Upload database file to Azure App Service via Kudu API
 * 
 * Usage:
 *   node scripts/upload-db-kudu.js [local-db-path] [publish-profile-path]
 * 
 * Or set environment variables:
 *   AZURE_PUBLISH_PROFILE_PATH=path/to/publishprofile.xml
 *   LOCAL_DB_PATH=path/to/tradingpro.db
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse publish profile to get credentials
function parsePublishProfile(profilePath) {
    const content = fs.readFileSync(profilePath, 'utf8');
    
    // Extract publishUrl, userName, userPWD
    const publishUrlMatch = content.match(/publishUrl="([^"]+)"/);
    const userNameMatch = content.match(/userName="([^"]+)"/);
    const userPwdMatch = content.match(/userPWD="([^"]+)"/);
    
    if (!publishUrlMatch || !userNameMatch || !userPwdMatch) {
        throw new Error('Invalid publish profile format');
    }
    
    return {
        publishUrl: publishUrlMatch[1],
        userName: userNameMatch[1],
        userPwd: userPwdMatch[1]
    };
}

// Upload file via Kudu API
function uploadFile(filePath, targetPath, credentials, callback) {
    const fileContent = fs.readFileSync(filePath);
    const fileSize = fileContent.length;
    
    const url = new URL(`https://${credentials.publishUrl}/api/vfs/${targetPath}`);
    const auth = Buffer.from(`${credentials.userName}:${credentials.userPwd}`).toString('base64');
    
    const options = {
        hostname: credentials.publishUrl,
        port: 443,
        path: `/api/vfs/${targetPath}`,
        method: 'PUT',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': fileSize,
            'If-Match': '*'
        }
    };
    
    console.log(`Uploading ${(fileSize / 1024 / 1024).toFixed(2)} MB to ${targetPath}...`);
    
    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
                console.log('✓ Upload successful!');
                callback(null);
            } else {
                console.error(`❌ Upload failed: ${res.statusCode}`);
                console.error('Response:', data);
                callback(new Error(`Upload failed: ${res.statusCode}`));
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Upload error:', error.message);
        callback(error);
    });
    
    req.write(fileContent);
    req.end();
}

// Main execution
const localDbPath = process.argv[2] || process.env.LOCAL_DB_PATH || path.resolve(__dirname, '../../data/tradingpro.db');
const publishProfilePath = process.argv[3] || process.env.AZURE_PUBLISH_PROFILE_PATH;

if (!publishProfilePath) {
    console.error('❌ Publish profile path required!');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/upload-db-kudu.js [local-db-path] [publish-profile-path]');
    console.log('');
    console.log('Or set environment variables:');
    console.log('  AZURE_PUBLISH_PROFILE_PATH=path/to/publishprofile.xml');
    console.log('  LOCAL_DB_PATH=path/to/tradingpro.db');
    console.log('');
    console.log('To get publish profile:');
    console.log('  Azure Portal → App Service → Get publish profile');
    process.exit(1);
}

if (!fs.existsSync(localDbPath)) {
    console.error(`❌ Local database not found: ${localDbPath}`);
    process.exit(1);
}

if (!fs.existsSync(publishProfilePath)) {
    console.error(`❌ Publish profile not found: ${publishProfilePath}`);
    process.exit(1);
}

console.log('='.repeat(60));
console.log('Upload Database to Azure via Kudu API');
console.log('='.repeat(60));
console.log(`Local DB: ${localDbPath}`);
console.log(`Publish Profile: ${publishProfilePath}`);
console.log('');

// Parse publish profile
let credentials;
try {
    credentials = parsePublishProfile(publishProfilePath);
    console.log(`✓ Publish profile parsed`);
    console.log(`  Server: ${credentials.publishUrl}`);
} catch (error) {
    console.error('❌ Failed to parse publish profile:', error.message);
    process.exit(1);
}

// Check local database
const stats = fs.statSync(localDbPath);
console.log(`✓ Local database found (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
console.log('');

// Upload to data/tradingpro.db
const targetPath = 'site/wwwroot/data/tradingpro.db';

console.log('⚠️  IMPORTANT: Stop the App Service before uploading!');
console.log('   Azure Portal → App Service → Stop');
console.log('');

// Proceed with upload
uploadFile(localDbPath, targetPath, credentials, (error) => {
    if (error) {
        console.error('');
        console.error('Upload failed. Try manual upload via Kudu Console instead.');
        process.exit(1);
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Upload Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify file on Azure:');
    console.log('   SSH/Kudu → ls -la /home/site/wwwroot/data/tradingpro.db');
    console.log('');
    console.log('2. Set permissions (if needed):');
    console.log('   chmod 644 /home/site/wwwroot/data/tradingpro.db');
    console.log('');
    console.log('3. Restart App Service');
    console.log('   Azure Portal → App Service → Restart');
    console.log('');
    console.log('4. Verify database:');
    console.log('   node scripts/check-db-integrity.js');
});

