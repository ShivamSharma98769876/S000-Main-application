/**
 * Debug environment variable loading
 */

const path = require('path');
const fs = require('fs');

console.log('\n=== Environment Variable Loading Debug ===\n');

// Method 1: Load from .env
const envPath = path.join(__dirname, '../.env');
console.log('1. Loading from .env file:');
console.log(`   Path: ${envPath}`);
console.log(`   Exists: ${fs.existsSync(envPath)}`);

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbPasswordLine = envContent.split('\n').find(line => line.trim().startsWith('DB_PASSWORD='));
    
    if (dbPasswordLine) {
        console.log(`   Found DB_PASSWORD line: ${dbPasswordLine.trim()}`);
        const rawValue = dbPasswordLine.split('=')[1]?.trim();
        console.log(`   Raw value: "${rawValue}"`);
        console.log(`   Value type: ${typeof rawValue}`);
        console.log(`   Value length: ${rawValue ? rawValue.length : 0}`);
        
        // Check for quotes
        if (rawValue && (rawValue.startsWith('"') || rawValue.startsWith("'"))) {
            console.log('   ⚠️  Value has quotes - dotenv should handle this automatically');
        }
    } else {
        console.log('   ✗ DB_PASSWORD line not found');
    }
}

// Method 2: Load with dotenv
console.log('\n2. Loading with dotenv:');
require('dotenv').config({ path: envPath });

console.log(`   DB_PASSWORD type: ${typeof process.env.DB_PASSWORD}`);
console.log(`   DB_PASSWORD value: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-2) : 'NOT SET'}`);
console.log(`   DB_PASSWORD length: ${process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0}`);

if (process.env.DB_PASSWORD === undefined) {
    console.log('   ⚠️  DB_PASSWORD is undefined');
} else if (process.env.DB_PASSWORD === null) {
    console.log('   ⚠️  DB_PASSWORD is null');
} else if (process.env.DB_PASSWORD === '') {
    console.log('   ⚠️  DB_PASSWORD is empty string');
} else if (typeof process.env.DB_PASSWORD !== 'string') {
    console.log(`   ⚠️  DB_PASSWORD is not a string (type: ${typeof process.env.DB_PASSWORD})`);
} else {
    console.log('   ✓ DB_PASSWORD is a valid string');
}

// Check other DB variables
console.log('\n3. Other database variables:');
console.log(`   DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`   DB_PORT: ${process.env.DB_PORT || 'NOT SET'}`);
console.log(`   DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);
console.log(`   DB_USER: ${process.env.DB_USER || 'NOT SET'}`);

console.log('\n');

