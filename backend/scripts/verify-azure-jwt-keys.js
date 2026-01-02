/**
 * Verify JWT keys from Azure environment variables
 * This script checks what Azure is actually providing
 */

console.log('\n' + '='.repeat(60));
console.log('Azure JWT Keys Verification');
console.log('='.repeat(60) + '\n');

// Check environment variables directly
console.log('📋 Environment Variables Check:\n');

const hasPrivateKey = !!process.env.JWT_PRIVATE_KEY;
const hasPublicKey = !!process.env.JWT_PUBLIC_KEY;

console.log(`JWT_PRIVATE_KEY: ${hasPrivateKey ? 'SET' : 'NOT SET'}`);
console.log(`JWT_PUBLIC_KEY: ${hasPublicKey ? 'SET' : 'NOT SET'}\n`);

if (!hasPrivateKey || !hasPublicKey) {
    console.log('❌ Keys are NOT set in environment variables!\n');
    console.log('📝 Solution:');
    console.log('   1. Go to Azure Portal → Your App Service → Configuration');
    console.log('   2. Check Application settings');
    console.log('   3. Verify JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are listed');
    console.log('   4. If missing, add them');
    console.log('   5. Save and restart\n');
    process.exit(1);
}

// Analyze the keys
const privateKey = process.env.JWT_PRIVATE_KEY;
const publicKey = process.env.JWT_PUBLIC_KEY;

console.log('🔑 Analyzing JWT_PRIVATE_KEY:\n');
console.log(`   Length: ${privateKey.length} characters`);
console.log(`   Has BEGIN: ${privateKey.includes('BEGIN')}`);
console.log(`   Has PRIVATE KEY: ${privateKey.includes('PRIVATE KEY')}`);
console.log(`   Has RSA: ${privateKey.includes('RSA')}`);
console.log(`   Has END: ${privateKey.includes('END')}`);
console.log(`   Line count: ${privateKey.split('\n').length}`);
console.log(`   First 80 chars: ${privateKey.substring(0, 80)}`);
console.log(`   Last 80 chars: ${privateKey.substring(privateKey.length - 80)}\n`);

console.log('🔑 Analyzing JWT_PUBLIC_KEY:\n');
console.log(`   Length: ${publicKey.length} characters`);
console.log(`   Has BEGIN: ${publicKey.includes('BEGIN')}`);
console.log(`   Has PUBLIC KEY: ${publicKey.includes('PUBLIC KEY')}`);
console.log(`   Has END: ${publicKey.includes('END')}`);
console.log(`   Line count: ${publicKey.split('\n').length}`);
console.log(`   First 80 chars: ${publicKey.substring(0, 80)}\n`);

// Try to parse as RSA keys
const crypto = require('crypto');

console.log('🧪 Testing RSA Key Parsing:\n');

try {
    const privateKeyObj = crypto.createPrivateKey(privateKey);
    console.log(`✅ JWT_PRIVATE_KEY is a valid RSA key!`);
    console.log(`   Type: ${privateKeyObj.asymmetricKeyType}`);
    console.log(`   Size: ${privateKeyObj.asymmetricKeyDetails?.modulusLength || 'unknown'} bits\n`);
} catch (error) {
    console.log(`❌ JWT_PRIVATE_KEY is NOT a valid RSA key!`);
    console.log(`   Error: ${error.message}`);
    console.log(`   Code: ${error.code || 'N/A'}\n`);
    
    if (error.message.includes('error:0909006C')) {
        console.log('💡 This error usually means:');
        console.log('   - Key is corrupted');
        console.log('   - Key is incomplete (missing lines)');
        console.log('   - Key is in wrong format\n');
    }
    
    if (privateKey.length < 1000) {
        console.log('⚠️  Key is too short!');
        console.log('   RSA keys are typically 1600+ characters');
        console.log('   You may have set a symmetric secret instead\n');
    }
}

try {
    const publicKeyObj = crypto.createPublicKey(publicKey);
    console.log(`✅ JWT_PUBLIC_KEY is a valid RSA key!`);
    console.log(`   Type: ${publicKeyObj.asymmetricKeyType}\n`);
} catch (error) {
    console.log(`❌ JWT_PUBLIC_KEY is NOT a valid RSA key!`);
    console.log(`   Error: ${error.message}\n`);
}

console.log('='.repeat(60));
console.log('Summary:');
console.log('='.repeat(60) + '\n');

if (hasPrivateKey && hasPublicKey) {
    try {
        crypto.createPrivateKey(privateKey);
        crypto.createPublicKey(publicKey);
        console.log('✅ Both keys are valid RSA keys!');
        console.log('   Your JWT configuration should work.\n');
    } catch (error) {
        console.log('❌ Keys are set but INVALID!');
        console.log(`   Error: ${error.message}\n`);
        console.log('📝 Next Steps:');
        console.log('   1. Go to Azure Portal → Configuration → Application settings');
        console.log('   2. Delete JWT_PRIVATE_KEY and JWT_PUBLIC_KEY');
        console.log('   3. Generate new keys: node scripts/generate-keys.js');
        console.log('   4. Copy ENTIRE keys (all lines) to Azure Portal');
        console.log('   5. Save and restart\n');
    }
}

process.exit(0);

