/**
 * Check JWT keys configuration on Azure
 * Run this in Azure Kudu Console to diagnose key issues
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load environment variables
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

console.log('\n' + '='.repeat(60));
console.log('JWT Keys Diagnostic Tool');
console.log('='.repeat(60) + '\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`   JWT_PRIVATE_KEY: ${process.env.JWT_PRIVATE_KEY ? 'SET' : 'NOT SET'}`);
console.log(`   JWT_PUBLIC_KEY: ${process.env.JWT_PUBLIC_KEY ? 'SET' : 'NOT SET'}`);
console.log(`   JWT_PRIVATE_KEY_PATH: ${process.env.JWT_PRIVATE_KEY_PATH || 'NOT SET'}`);
console.log(`   JWT_PUBLIC_KEY_PATH: ${process.env.JWT_PUBLIC_KEY_PATH || 'NOT SET'}\n`);

if (!process.env.JWT_PRIVATE_KEY && !process.env.JWT_PUBLIC_KEY) {
    console.log('❌ JWT keys are NOT set in environment variables!\n');
    console.log('📝 Solution:');
    console.log('   1. Go to Azure Portal → Configuration → Application settings');
    console.log('   2. Add JWT_PRIVATE_KEY and JWT_PUBLIC_KEY');
    console.log('   3. Generate keys using: node scripts/generate-keys.js');
    process.exit(1);
}

// Check private key
if (process.env.JWT_PRIVATE_KEY) {
    const privateKey = process.env.JWT_PRIVATE_KEY.trim();
    console.log('🔑 Checking JWT_PRIVATE_KEY:\n');
    console.log(`   Length: ${privateKey.length} characters`);
    console.log(`   Has BEGIN: ${privateKey.includes('BEGIN')}`);
    console.log(`   Has PRIVATE KEY: ${privateKey.includes('PRIVATE KEY')}`);
    console.log(`   Has END: ${privateKey.includes('END')}`);
    console.log(`   First 50 chars: ${privateKey.substring(0, 50)}`);
    console.log(`   Last 50 chars: ${privateKey.substring(privateKey.length - 50)}\n`);
    
    // Try to parse as RSA key
    try {
        const keyObject = crypto.createPrivateKey(privateKey);
        console.log(`   ✅ Key Type: ${keyObject.asymmetricKeyType}`);
        console.log(`   ✅ Key Size: ${keyObject.asymmetricKeyDetails?.modulusLength || 'unknown'} bits\n`);
        console.log('✅ JWT_PRIVATE_KEY is VALID!\n');
    } catch (parseError) {
        console.log(`   ❌ Key Parse Error: ${parseError.message}\n`);
        console.log('❌ JWT_PRIVATE_KEY is INVALID!\n');
        console.log('📝 Solution:');
        console.log('   1. Generate new keys: node scripts/generate-keys.js');
        console.log('   2. Copy ENTIRE private key to Azure Portal');
        console.log('   3. Make sure to include -----BEGIN and -----END lines');
        console.log(`\n   Error: ${parseError.message}\n`);
        process.exit(1);
    }
}

// Check public key
if (process.env.JWT_PUBLIC_KEY) {
    const publicKey = process.env.JWT_PUBLIC_KEY.trim();
    console.log('🔑 Checking JWT_PUBLIC_KEY:\n');
    console.log(`   Length: ${publicKey.length} characters`);
    console.log(`   Has BEGIN: ${publicKey.includes('BEGIN')}`);
    console.log(`   Has PUBLIC KEY: ${publicKey.includes('PUBLIC KEY')}`);
    console.log(`   Has END: ${publicKey.includes('END')}\n`);
    
    try {
        const keyObject = crypto.createPublicKey(publicKey);
        console.log(`   ✅ Key Type: ${keyObject.asymmetricKeyType}\n`);
        console.log('✅ JWT_PUBLIC_KEY is VALID!\n');
    } catch (parseError) {
        console.log(`   ❌ Key Parse Error: ${parseError.message}\n`);
        console.log('❌ JWT_PUBLIC_KEY is INVALID!\n');
    }
}

// Check file system keys (fallback)
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH 
    ? path.resolve(process.env.JWT_PRIVATE_KEY_PATH)
    : path.join(__dirname, '../config/keys/private.pem');
const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH 
    ? path.resolve(process.env.JWT_PUBLIC_KEY_PATH)
    : path.join(__dirname, '../config/keys/public.pem');

console.log('📁 Checking file system keys (fallback):');
console.log(`   Private key file: ${privateKeyPath}`);
console.log(`   Exists: ${fs.existsSync(privateKeyPath)}`);
console.log(`   Public key file: ${publicKeyPath}`);
console.log(`   Exists: ${fs.existsSync(publicKeyPath)}\n`);

console.log('='.repeat(60));
console.log('Summary:');
console.log('='.repeat(60) + '\n');

if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    try {
        crypto.createPrivateKey(process.env.JWT_PRIVATE_KEY);
        crypto.createPublicKey(process.env.JWT_PUBLIC_KEY);
        console.log('✅ JWT keys are properly configured!');
        console.log('   Your keys should work correctly.\n');
    } catch (error) {
        console.log('❌ JWT keys are NOT properly configured!');
        console.log(`   Error: ${error.message}\n`);
        console.log('📝 Next Steps:');
        console.log('   1. Generate new keys: node scripts/generate-keys.js');
        console.log('   2. Copy keys to Azure Portal → Configuration → Application settings');
        console.log('   3. Restart the app service\n');
    }
} else {
    console.log('❌ JWT keys are NOT set!');
    console.log('   Set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY in Azure Portal\n');
}

process.exit(0);

