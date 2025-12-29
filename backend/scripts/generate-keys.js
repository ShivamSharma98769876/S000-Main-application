const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate 2048-bit RSA key pair using Node.js built-in crypto
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

// Save to secure location
const keysDir = path.join(__dirname, '../config/keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey);
fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

console.log('✅ RSA key pair generated successfully!');
console.log('📁 Private key: backend/config/keys/private.pem');
console.log('📁 Public key: backend/config/keys/public.pem');
console.log('⚠️  Add private.pem to .gitignore!');

