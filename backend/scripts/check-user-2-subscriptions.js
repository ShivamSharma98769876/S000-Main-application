const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/tradingpro.db');
const db = new Database(DB_PATH);

console.log('\n=== Checking User ID 2 Subscriptions ===\n');

// Get user info
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(2);
if (!user) {
    console.log('User ID 2 not found!');
    db.close();
    process.exit(1);
}

console.log('User Info:');
console.log(`  ID: ${user.id}`);
console.log(`  Email: ${user.email}`);
console.log(`  Provider: ${user.provider_type}`);
console.log(`  Is Admin: ${user.is_admin}`);
console.log('');

// Get user profile
const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(2);
if (profile) {
    console.log('Profile Info:');
    console.log(`  Full Name: ${profile.full_name || 'N/A'}`);
    console.log(`  Profile Completed: ${profile.profile_completed}`);
    console.log('');
} else {
    console.log('No profile found for user ID 2\n');
}

// Get subscriptions
const subscriptions = db.prepare(`
    SELECT s.*, p.name as product_name, p.category, p.description
    FROM subscriptions s
    JOIN products p ON p.id = s.product_id
    WHERE s.user_id = ?
`).all(2);

console.log(`Subscriptions found: ${subscriptions.length}\n`);

if (subscriptions.length > 0) {
    subscriptions.forEach((sub, index) => {
        console.log(`Subscription ${index + 1}:`);
        console.log(`  ID: ${sub.id}`);
        console.log(`  Product: ${sub.product_name}`);
        console.log(`  Category: ${sub.category}`);
        console.log(`  Status: ${sub.status}`);
        console.log(`  Start Date: ${sub.start_date}`);
        console.log(`  End Date: ${sub.end_date}`);
        console.log(`  Order ID: ${sub.order_id || sub.source_order_id || 'N/A'}`);
        console.log(`  Created At: ${sub.created_at}`);
        console.log('');
    });
} else {
    console.log('No subscriptions found in database for user ID 2');
}

// Check orders
const orders = db.prepare(`
    SELECT o.*, COUNT(oi.id) as item_count
    FROM subscription_orders o
    LEFT JOIN subscription_order_items oi ON oi.order_id = o.id
    WHERE o.user_id = ?
    GROUP BY o.id
`).all(2);

console.log(`Orders found: ${orders.length}\n`);
orders.forEach(order => {
    console.log(`Order #${order.id}:`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Total: ${order.total_amount}`);
    console.log(`  Items: ${order.item_count}`);
    console.log(`  Created: ${order.created_at}`);
    console.log('');
});

db.close();

