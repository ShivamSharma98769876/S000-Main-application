/**
 * Quick script to add DB_PASSWORD to .env file
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

async function addPassword() {
    const envPath = path.join(__dirname, '../.env');
    
    if (!fs.existsSync(envPath)) {
        console.log('❌ .env file not found at:', envPath);
        console.log('   Please create a .env file first.');
        rl.close();
        return;
    }
    
    // Read existing file
    let envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    // Check if DB_PASSWORD already exists
    let passwordLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('DB_PASSWORD=')) {
            passwordLineIndex = i;
            break;
        }
    }
    
    if (passwordLineIndex >= 0) {
        const currentLine = lines[passwordLineIndex];
        const currentValue = currentLine.split('=')[1]?.trim().replace(/^["']|["']$/g, '');
        
        if (currentValue && currentValue !== 'undefined') {
            console.log('✓ DB_PASSWORD already exists in .env file');
            console.log(`  Current value: ${currentValue ? '***' + currentValue.slice(-2) : '(empty)'}`);
            const update = await question('\nDo you want to update it? (y/n): ');
            if (update.toLowerCase() !== 'y') {
                console.log('No changes made.');
                rl.close();
                return;
            }
        }
    }
    
    // Ask for password
    console.log('\nEnter your PostgreSQL password:');
    console.log('(If your PostgreSQL has no password, just press Enter)');
    const password = await question('Password: ');
    
    // Prepare the line
    const passwordLine = `DB_PASSWORD=${password || ''}`;
    
    if (passwordLineIndex >= 0) {
        // Update existing line
        lines[passwordLineIndex] = passwordLine;
    } else {
        // Add new line
        // Try to add after other DB_ variables
        let insertIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('DB_')) {
                insertIndex = i + 1;
            }
        }
        
        if (insertIndex >= 0) {
            lines.splice(insertIndex, 0, passwordLine);
        } else {
            // Add at the end
            lines.push(passwordLine);
        }
    }
    
    // Write back to file
    fs.writeFileSync(envPath, lines.join('\n'));
    
    console.log('\n✅ DB_PASSWORD has been added/updated in .env file');
    console.log('   Please restart your server or run the migration again.\n');
    
    rl.close();
}

addPassword().catch((error) => {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
});

