/**
 * Check QR code configuration and file
 */

const path = require('path');
const fs = require('fs');

const envPaths = [
    path.join(__dirname, '../env'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    require('dotenv').config();
}

const { query } = require('../config/database');

async function checkQRCode() {
    try {
        // Get QR code URL from config
        const result = await query(`
            SELECT config_key, config_value 
            FROM system_config 
            WHERE config_key = 'qr_code_url'
        `);
        
        console.log('\n=== QR Code Configuration ===\n');
        
        if (result.rows.length === 0) {
            console.log('❌ QR code URL not configured in system_config');
            console.log('   Please upload a QR code through the admin panel.');
        } else {
            const qrUrl = result.rows[0].config_value;
            console.log(`✓ QR code URL: ${qrUrl}`);
            
            // Check if file exists
            // Use same path logic as server.js and routes
            const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
            const fileName = qrUrl.replace('/uploads/', '').replace(/^\/+/, ''); // Remove leading slashes
            const filePath = path.join(uploadDir, fileName);
            
            console.log(`\n=== File Check ===\n`);
            console.log(`Upload directory: ${uploadDir}`);
            console.log(`File name: ${fileName}`);
            console.log(`Full path: ${filePath}`);
            console.log(`File exists: ${fs.existsSync(filePath)}`);
            
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
                console.log(`File modified: ${stats.mtime}`);
                console.log('\n✅ QR code file exists and is accessible');
            } else {
                console.log('\n⚠️  QR code file not found!');
                console.log('   The URL is configured but the file is missing.');
                console.log('   Please re-upload the QR code.');
            }
        }
        
        // List all files in uploads directory
        // Use same path logic as server.js
        const uploadDir = process.env.UPLOAD_DIR 
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.join(__dirname, '../uploads');
        if (fs.existsSync(uploadDir)) {
            const files = fs.readdirSync(uploadDir);
            console.log(`\n=== Files in uploads directory (${uploadDir}) ===\n`);
            if (files.length === 0) {
                console.log('  (empty)');
            } else {
                files.forEach(file => {
                    const filePath = path.join(uploadDir, file);
                    const stats = fs.statSync(filePath);
                    console.log(`  ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
                });
            }
        } else {
            console.log(`\n⚠️  Upload directory does not exist: ${uploadDir}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkQRCode();

