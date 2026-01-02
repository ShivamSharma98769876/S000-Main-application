/**
 * Generate RSA keys and output in format ready for Azure Portal
 * This script generates keys and displays them in a format that's easy to copy to Azure
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(60));
console.log('Generating RSA Keys for Azure');
console.log('='.repeat(60) + '\n');

// Generate 2048-bit RSA key pair using Node.js built-in crypto
console.log('Generating 2048-bit RSA key pair...');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Save to file system (for local backup)
const keysDir = path.join(__dirname, '../config/keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

console.log('✅ Keys generated and saved to:');
console.log(`   ${privateKeyPath}`);
console.log(`   ${publicKeyPath}\n`);

console.log('='.repeat(60));
console.log('STEP 1: Copy JWT_PRIVATE_KEY to Azure Portal');
console.log('='.repeat(60) + '\n');
console.log('Go to: Azure Portal → Your App Service → Configuration → Application settings');
console.log('Add new setting:');
console.log('  Name: JWT_PRIVATE_KEY');
console.log('  Value: (copy the entire block below)\n');
console.log('─'.repeat(60));
console.log(privateKey);
console.log('─'.repeat(60) + '\n');

console.log('='.repeat(60));
console.log('STEP 2: Copy JWT_PUBLIC_KEY to Azure Portal');
console.log('='.repeat(60) + '\n');
console.log('Add another setting:');
console.log('  Name: JWT_PUBLIC_KEY');
console.log('  Value: (copy the entire block below)\n');
console.log('─'.repeat(60));
console.log(publicKey);
console.log('─'.repeat(60) + '\n');

console.log('='.repeat(60));
console.log('STEP 3: Save and Restart');
console.log('='.repeat(60) + '\n');
console.log('1. Click "Save" at the top of Azure Portal');
console.log('2. Wait for the app to restart');
console.log('3. Check logs - you should see:');
console.log('   ✅ JWT Service initialized from environment variables');
console.log('   ✅ JWT private key validated as RSA key\n');

console.log('='.repeat(60));
console.log('Important Notes:');
console.log('='.repeat(60) + '\n');
console.log('⚠️  Copy the ENTIRE key including:');
console.log('   - -----BEGIN PRIVATE KEY-----');
console.log('   - All the base64 content');
console.log('   - -----END PRIVATE KEY-----');
console.log('\n⚠️  Do NOT add quotes or extra spaces');
console.log('⚠️  The key should be exactly as shown above\n');

console.log('✅ Keys are also saved locally for backup:');
console.log(`   ${privateKeyPath}`);
console.log(`   ${publicKeyPath}\n`);

