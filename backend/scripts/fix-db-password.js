/**
 * Fix database password configuration
 * This script helps set up the database password correctly
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function fixDatabasePassword() {
    console.log('\n=== Database Password Configuration Fix ===\n');
    
    const envPath = path.join(__dirname, '../.env');
    const envFileAlt = path.join(__dirname, '../env');
    
    let envFilePath = envPath;
    if (!fs.existsSync(envPath) && fs.existsSync(envFileAlt)) {
        envFilePath = envFileAlt;
    }
    
    if (!fs.existsSync(envFilePath)) {
        console.log('❌ No .env or env file found!');
        console.log(`   Expected location: ${envPath}`);
        console.log('\nCreating a new .env file...\n');
        
        // Ask for database configuration
        const dbHost = await question('Database host (default: 127.0.0.1): ') || '127.0.0.1';
        const dbPort = await question('Database port (default: 5432): ') || '5432';
        const dbName = await question('Database name (default: tradingpro): ') || 'tradingpro';
        const dbUser = await question('Database user (default: postgres): ') || 'postgres';
        const dbPassword = await question('Database password (required): ');
        
        if (!dbPassword) {
            console.log('\n⚠️  WARNING: No password provided. If your PostgreSQL requires a password, this will fail.');
            const confirm = await question('Continue anyway? (y/n): ');
            if (confirm.toLowerCase() !== 'y') {
                console.log('Aborted.');
                process.exit(1);
            }
        }
        
        // Create .env file content
        const envContent = `# Database Configuration
DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_NAME=${dbName}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword || ''}

# Or use DATABASE_URL format (alternative)
# DATABASE_URL=postgresql://${dbUser}:${dbPassword || ''}@${dbHost}:${dbPort}/${dbName}

# Server Configuration
NODE_ENV=development
PORT=3000
`;
        
        fs.writeFileSync(envPath, envContent);
        console.log(`\n✅ Created .env file at: ${envPath}`);
        console.log('   Please restart your server for changes to take effect.\n');
        
    } else {
        console.log(`✓ Found environment file: ${envFilePath}\n`);
        
        // Read existing file
        const envContent = fs.readFileSync(envFilePath, 'utf8');
        const lines = envContent.split('\n');
        
        // Check if DB_PASSWORD exists
        let hasPassword = false;
        let hasDatabaseUrl = false;
        
        for (const line of lines) {
            if (line.trim().startsWith('DB_PASSWORD=')) {
                hasPassword = true;
                const currentValue = line.split('=')[1]?.trim();
                if (!currentValue || currentValue === '""' || currentValue === "''") {
                    console.log('⚠️  DB_PASSWORD is set but empty\n');
                    const newPassword = await question('Enter your PostgreSQL password: ');
                    if (newPassword) {
                        // Replace the line
                        const newLines = lines.map(l => 
                            l.trim().startsWith('DB_PASSWORD=') 
                                ? `DB_PASSWORD=${newPassword}`
                                : l
                        );
                        fs.writeFileSync(envFilePath, newLines.join('\n'));
                        console.log('\n✅ Updated DB_PASSWORD in .env file');
                        console.log('   Please restart your server for changes to take effect.\n');
                    }
                } else {
                    console.log('✓ DB_PASSWORD is already set');
                }
                break;
            }
            if (line.trim().startsWith('DATABASE_URL=')) {
                hasDatabaseUrl = true;
            }
        }
        
        if (!hasPassword && !hasDatabaseUrl) {
            console.log('⚠️  DB_PASSWORD is not set in .env file\n');
            const dbPassword = await question('Enter your PostgreSQL password (or press Enter for no password): ');
            
            // Append to file
            const newLine = `DB_PASSWORD=${dbPassword || ''}\n`;
            fs.appendFileSync(envFilePath, newLine);
            console.log('\n✅ Added DB_PASSWORD to .env file');
            console.log('   Please restart your server for changes to take effect.\n');
        }
    }
    
    rl.close();
}

fixDatabasePassword().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});

