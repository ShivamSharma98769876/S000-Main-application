const Database = require('better-sqlite3');
const path = require('path');

// Check the database in the root data folder
const DB_PATH = path.join(__dirname, '../../data/tradingpro.db');
console.log('Checking database at:', DB_PATH);

const db = new Database(DB_PATH);

console.log('\n=== Checking Root Data Folder Database ===\n');

// Get all subscriptions
const subscriptions = db.prepare(`
    SELECT 
        s.id,
        s.user_id,
        s.product_id,
        s.start_date,
        s.end_date,
        s.status,
        s.order_id,
        s.created_at,
        u.email as user_email,
        up.full_name as user_name,
        p.name as product_name
    FROM subscriptions s
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN user_profiles up ON up.user_id = s.user_id
    LEFT JOIN products p ON p.id = s.product_id
    ORDER BY s.user_id, s.id
`).all();

console.log(`Total subscriptions: ${subscriptions.length}\n`);

if (subscriptions.length > 0) {
    subscriptions.forEach((sub, index) => {
        console.log(`Subscription ${index + 1}:`);
        console.log(`  Subscription ID: ${sub.id}`);
        console.log(`  User ID: ${sub.user_id}`);
        console.log(`  User Email: ${sub.user_email || 'N/A'}`);
        console.log(`  User Name: ${sub.user_name || 'N/A'}`);
        console.log(`  Product ID: ${sub.product_id}`);
        console.log(`  Product Name: ${sub.product_name || 'N/A'}`);
        console.log(`  Status: ${sub.status}`);
        console.log(`  Start Date: ${sub.start_date}`);
        console.log(`  End Date: ${sub.end_date}`);
        console.log(`  Order ID: ${sub.order_id || 'N/A'}`);
        console.log('');
    });
    
    // Check specifically for user_id = 2
    const user2Subs = subscriptions.filter(s => s.user_id === 2);
    console.log(`\n=== Subscriptions for User ID 2: ${user2Subs.length} ===`);
    if (user2Subs.length > 0) {
        user2Subs.forEach(sub => {
            console.log(`  - ${sub.product_name} (Status: ${sub.status}, ID: ${sub.id})`);
        });
    }
}

// Check users
const users = db.prepare('SELECT id, email FROM users WHERE id = 2').get();
if (users) {
    console.log(`\nUser ID 2: ${users.email}`);
} else {
    console.log('\nUser ID 2 not found in this database');
}

db.close();

