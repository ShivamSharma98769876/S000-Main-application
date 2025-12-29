const path = require('path');
const fs = require('fs');

// Simulate __dirname as it would be in database.js (backend/config/)
const configDir = path.join(__dirname, '../config');
const dbPath = path.resolve(configDir, '../../data/tradingpro.db');

console.log('Config directory (simulated):', configDir);
console.log('Resolved DB Path:', dbPath);
console.log('');

// Test with actual file
if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log('✅ Database file exists!');
    console.log('   Path:', dbPath);
    console.log('   Size:', (stats.size / 1024).toFixed(2), 'KB');
    console.log('   Modified:', stats.mtime);
} else {
    console.log('❌ Database file NOT found at:', dbPath);
    console.log('   Checking alternative paths...');
    
    // Check backend/data
    const altPath1 = path.resolve(configDir, '../data/tradingpro.db');
    if (fs.existsSync(altPath1)) {
        console.log('   Found at:', altPath1);
    }
}

