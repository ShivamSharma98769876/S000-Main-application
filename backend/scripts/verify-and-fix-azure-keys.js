require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔍 Verifying JWT Keys on Azure...\n');

const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME);
console.log(`Environment: ${isAzure ? 'Azure' : 'Local'}\n`);

// Check file system keys
const azureKeysPath = '/home/site/wwwroot/config/keys';
const azurePrivateKey = path.join(azureKeysPath, 'private.pem');
const azurePublicKey = path.join(azureKeysPath, 'public.pem');

console.log('📁 Checking file system keys:');
console.log(`   Private: ${azurePrivateKey}`);
console.log(`   Public: ${azurePublicKey}\n`);

if (!fs.existsSync(azurePrivateKey)) {
    console.error(`❌ Private key not found at: ${azurePrivateKey}`);
    process.exit(1);
}

if (!fs.existsSync(azurePublicKey)) {
    console.error(`❌ Public key not found at: ${azurePublicKey}`);
    process.exit(1);
}

console.log('✅ Both key files exist\n');

// Read keys
let privateKey, publicKey;
try {
    privateKey = fs.readFileSync(azurePrivateKey, 'utf8');
    publicKey = fs.readFileSync(azurePublicKey, 'utf8');
    console.log('✅ Keys read successfully');
    console.log(`   Private key length: ${privateKey.length} chars`);
    console.log(`   Public key length: ${publicKey.length} chars\n`);
} catch (error) {
    console.error(`❌ Failed to read keys: ${error.message}`);
    process.exit(1);
}

// Trim whitespace
privateKey = privateKey.trim();
publicKey = publicKey.trim();

// Check format
console.log('🔍 Validating key format...\n');

// Check private key
const hasBeginPrivate = privateKey.includes('BEGIN') && privateKey.includes('PRIVATE KEY');
const hasEndPrivate = privateKey.includes('END PRIVATE KEY') || privateKey.includes('END RSA PRIVATE KEY');

console.log('Private Key:');
console.log(`   Has BEGIN marker: ${privateKey.includes('BEGIN')}`);
console.log(`   Has PRIVATE KEY: ${privateKey.includes('PRIVATE KEY')}`);
console.log(`   Has END marker: ${privateKey.includes('END')}`);
console.log(`   First line: ${privateKey.split('\n')[0]}`);
console.log(`   Last line: ${privateKey.split('\n').slice(-1)[0]}`);
console.log(`   Line count: ${privateKey.split('\n').length}\n`);

if (!hasBeginPrivate || !hasEndPrivate) {
    console.error('❌ Private key is not in valid PEM format');
    console.error(`   Expected: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----`);
    console.error(`   First 100 chars: ${privateKey.substring(0, 100)}`);
    console.error(`   Last 100 chars: ${privateKey.substring(privateKey.length - 100)}\n`);
    process.exit(1);
}

// Check public key
const hasBeginPublic = publicKey.includes('BEGIN') && publicKey.includes('PUBLIC KEY');
const hasEndPublic = publicKey.includes('END PUBLIC KEY');

console.log('Public Key:');
console.log(`   Has BEGIN marker: ${publicKey.includes('BEGIN')}`);
console.log(`   Has PUBLIC KEY: ${publicKey.includes('PUBLIC KEY')}`);
console.log(`   Has END marker: ${publicKey.includes('END')}`);
console.log(`   First line: ${publicKey.split('\n')[0]}`);
console.log(`   Last line: ${publicKey.split('\n').slice(-1)[0]}`);
console.log(`   Line count: ${publicKey.split('\n').length}\n`);

if (!hasBeginPublic || !hasEndPublic) {
    console.error('❌ Public key is not in valid PEM format');
    process.exit(1);
}

// Try to parse as RSA keys
console.log('🔐 Attempting to parse as RSA keys...\n');

try {
    const privateKeyObject = crypto.createPrivateKey(privateKey);
    console.log('✅ Private key parsed successfully');
    console.log(`   Key type: ${privateKeyObject.asymmetricKeyType}`);
    console.log(`   Key size: ${privateKeyObject.asymmetricKeyDetails?.modulusLength} bits\n`);
    
    if (privateKeyObject.asymmetricKeyType !== 'rsa') {
        console.error(`❌ Key is not RSA. Found: ${privateKeyObject.asymmetricKeyType}`);
        process.exit(1);
    }
} catch (parseError) {
    console.error('❌ Failed to parse private key as RSA key');
    console.error(`   Error: ${parseError.message}`);
    console.error(`   Code: ${parseError.code}\n`);
    
    // Show key details for debugging
    console.log('Key details:');
    console.log(`   Length: ${privateKey.length}`);
    console.log(`   First 200 chars: ${privateKey.substring(0, 200)}`);
    console.log(`   Last 200 chars: ${privateKey.substring(Math.max(0, privateKey.length - 200))}`);
    console.log(`   Has \\r (Windows line endings): ${privateKey.includes('\r')}`);
    console.log(`   Has \\n (Unix line endings): ${privateKey.includes('\n')}`);
    console.log(`   Line count: ${privateKey.split(/\r?\n/).length}\n`);
    
    // Try to fix common issues
    console.log('🔧 Attempting to fix common issues...\n');
    
    // Remove Windows line endings
    let fixedKey = privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Ensure proper line endings
    if (!fixedKey.endsWith('\n')) {
        fixedKey += '\n';
    }
    
    // Try parsing again
    try {
        const fixedKeyObject = crypto.createPrivateKey(fixedKey);
        console.log('✅ Fixed key parsed successfully!');
        console.log(`   Key type: ${fixedKeyObject.asymmetricKeyType}\n`);
        
        // Write fixed key back
        console.log('💾 Writing fixed key back to file...');
        fs.writeFileSync(azurePrivateKey, fixedKey, 'utf8');
        console.log('✅ Fixed private key written\n');
        
        privateKey = fixedKey;
    } catch (fixError) {
        console.error('❌ Fixed key still failed to parse');
        console.error(`   Error: ${fixError.message}\n`);
        process.exit(1);
    }
}

try {
    const publicKeyObject = crypto.createPublicKey(publicKey);
    console.log('✅ Public key parsed successfully');
    console.log(`   Key type: ${publicKeyObject.asymmetricKeyType}\n`);
} catch (parseError) {
    console.error('❌ Failed to parse public key');
    console.error(`   Error: ${parseError.message}\n`);
    process.exit(1);
}

console.log('✅ All checks passed! Keys are valid RSA keys.\n');
console.log('📋 Summary:');
console.log(`   Private key: ${azurePrivateKey} (${privateKey.length} chars)`);
console.log(`   Public key: ${azurePublicKey} (${publicKey.length} chars)`);
console.log(`   Status: ✅ Valid RSA keys\n`);

