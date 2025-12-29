const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/tradingpro.db');
const db = new Database(DB_PATH);

console.log('\n=== Checking User Subscriptions ===\n');

// Find user by name
const users = db.prepare(`
    SELECT u.id, u.email, up.full_name 
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE up.full_name LIKE '%shivam%' OR up.full_name LIKE '%Shivam%'
`).all();

console.log('Users found:', users.length);
users.forEach(user => {
    console.log(`  - ID: ${user.id}, Email: ${user.email}, Name: ${user.full_name}`);
    
    // Check subscriptions for this user
    const subscriptions = db.prepare(`
        SELECT s.*, p.name as product_name, p.category
        FROM subscriptions s
        JOIN products p ON p.id = s.product_id
        WHERE s.user_id = ?
    `).all(user.id);
    
    console.log(`  Subscriptions: ${subscriptions.length}`);
    if (subscriptions.length > 0) {
        subscriptions.forEach(sub => {
            console.log(`    - ${sub.product_name} (Status: ${sub.status}, Start: ${sub.start_date}, End: ${sub.end_date})`);
        });
    } else {
        // Check if there are any orders that should create subscriptions
        const orders = db.prepare(`
            SELECT o.*, oi.product_id, p.name as product_name
            FROM subscription_orders o
            JOIN subscription_order_items oi ON oi.order_id = o.id
            JOIN products p ON p.id = oi.product_id
            WHERE o.user_id = ?
        `).all(user.id);
        
        console.log(`  Orders: ${orders.length}`);
        orders.forEach(order => {
            console.log(`    - Order #${order.id}: ${order.product_name} (Status: ${order.status})`);
        });
    }
    console.log('');
});

// Check all subscriptions
const allSubscriptions = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get();
console.log(`Total subscriptions in database: ${allSubscriptions.count}`);

// Check all users
const allUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
console.log(`Total users in database: ${allUsers.count}`);

db.close();

