/**
 * Check current database server configuration
 */

const path = require('path');
const fs = require('fs');

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
console.log('PostgreSQL Database Server Information');
console.log('='.repeat(60) + '\n');

// Check if DATABASE_URL is set
if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        console.log('✅ DATABASE_URL is configured');
        console.log(`   Server Name: ${url.hostname}`);
        console.log(`   Port: ${url.port || 5432}`);
        console.log(`   Database: ${url.pathname.replace('/', '')}`);
        console.log(`   Username: ${url.username}`);
        console.log(`   Password: ${url.password ? '***' : 'NOT SET'}`);
        console.log(`   Full URL: ${url.protocol}//${url.username}:***@${url.hostname}:${url.port || 5432}${url.pathname}`);
    } catch (e) {
        console.log('⚠️  DATABASE_URL is set but invalid:', e.message);
    }
} else {
    console.log('❌ DATABASE_URL is NOT set');
}

console.log('\n' + '-'.repeat(60) + '\n');

// Check individual parameters
if (process.env.DB_HOST) {
    console.log('✅ DB_HOST is configured');
    console.log(`   Server Name: ${process.env.DB_HOST}`);
} else {
    console.log('❌ DB_HOST is NOT set');
}

if (process.env.DB_PORT) {
    console.log(`   Port: ${process.env.DB_PORT}`);
} else {
    console.log(`   Port: 5432 (default)`);
}

if (process.env.DB_NAME) {
    console.log(`   Database: ${process.env.DB_NAME}`);
} else {
    console.log(`   Database: tradingpro (default)`);
}

if (process.env.DB_USER) {
    console.log(`   Username: ${process.env.DB_USER}`);
} else {
    console.log(`   Username: postgres (default)`);
}

if (process.env.DB_PASSWORD) {
    console.log(`   Password: *** (set)`);
} else {
    console.log(`   Password: NOT SET`);
}

console.log('\n' + '='.repeat(60));
console.log('Where to Find Your PostgreSQL Server Name in Azure:');
console.log('='.repeat(60) + '\n');

console.log('1. Go to Azure Portal: https://portal.azure.com');
console.log('2. Navigate to: All resources → Your PostgreSQL Server');
console.log('3. Look at the "Overview" page:');
console.log('   - Server name is shown at the top');
console.log('   - Format: your-server-name.postgres.database.azure.com');
console.log('\n4. Or go to "Connection strings" in the left menu:');
console.log('   - Copy the PostgreSQL connection string');
console.log('   - The server name is in the format:');
console.log('     postgresql://user:password@SERVER-NAME:5432/database');
console.log('\n5. Or check "Properties":');
console.log('   - "Fully qualified domain name" shows the server name');

console.log('\n' + '='.repeat(60));
console.log('Current Environment:');
console.log('='.repeat(60) + '\n');

const isAzure = !!(process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME);
console.log(`Running on: ${isAzure ? 'Azure' : 'Local'}`);
if (isAzure) {
    console.log(`Website: ${process.env.WEBSITE_SITE_NAME || process.env.WEBSITE_HOSTNAME || 'Unknown'}`);
}

console.log('\n');

