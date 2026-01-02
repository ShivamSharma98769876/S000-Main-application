#!/usr/bin/env node
/**
 * Download database from Azure App Service via Kudu API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Parse publish profile to get credentials
function parsePublishProfile(profilePath) {
    const content = fs.readFileSync(profilePath, 'utf8');
    
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

// Download file via Kudu API
function downloadFile(remotePath, localPath, credentials, callback) {
    const url = new URL(`https://${credentials.publishUrl}/api/vfs/${remotePath}`);
    const auth = Buffer.from(`${credentials.userName}:${credentials.userPwd}`).toString('base64');
    
    const options = {
        hostname: credentials.publishUrl,
        port: 443,
        path: `/api/vfs/${remotePath}`,
        method: 'GET',
        headers: {
            'Authorization': `Basic ${auth}`
        }
    };
    
    console.log(`Downloading from ${remotePath}...`);
    
    const file = fs.createWriteStream(localPath);
    
    const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                const stats = fs.statSync(localPath);
                console.log(`✓ Download successful! (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                callback(null);
            });
        } else {
            file.close();
            fs.unlinkSync(localPath);
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.error(`❌ Download failed: ${res.statusCode}`);
                console.error('Response:', data);
                callback(new Error(`Download failed: ${res.statusCode}`));
            });
        }
    });
    
    req.on('error', (error) => {
        file.close();
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
        }
        console.error('❌ Download error:', error.message);
        callback(error);
    });
    
    req.end();
}

// Main execution
const publishProfilePath = process.argv[2] || process.env.AZURE_PUBLISH_PROFILE_PATH;
const localPath = process.argv[3] || path.resolve(__dirname, '../../data/tradingpro.db.downloaded');

if (!publishProfilePath) {
    console.error('❌ Publish profile path required!');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/download-db-from-azure.js [publish-profile-path] [local-save-path]');
    console.log('');
    console.log('Or set environment variable:');
    console.log('  AZURE_PUBLISH_PROFILE_PATH=path/to/publishprofile.xml');
    process.exit(1);
}

if (!fs.existsSync(publishProfilePath)) {
    console.error(`❌ Publish profile not found: ${publishProfilePath}`);
    process.exit(1);
}

console.log('='.repeat(60));
console.log('Download Database from Azure');
console.log('='.repeat(60));
console.log(`Publish Profile: ${publishProfilePath}`);
console.log(`Local Save Path: ${localPath}`);
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

// Ensure directory exists
const localDir = path.dirname(localPath);
if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
}

// Download from Azure
const remotePath = 'site/wwwroot/data/tradingpro.db';

downloadFile(remotePath, localPath, credentials, (error) => {
    if (error) {
        console.error('');
        console.error('Download failed. Try manual download via Kudu Console instead.');
        process.exit(1);
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Download Complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Database saved to: ${localPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify the downloaded database:');
    console.log(`   node scripts/check-db-integrity.js "${localPath}"`);
    console.log('');
    console.log('2. Replace your corrupted local database:');
    console.log(`   copy "${localPath}" "C:\\Users\\SharmaS8\\Downloads\\tradingpro.db"`);
    console.log('');
});

