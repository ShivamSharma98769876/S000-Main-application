const Database = require('better-sqlite3');
const path = require('path');

const SOURCE_DB = path.join(__dirname, '../../data/tradingpro.db');
const TARGET_DB = path.join(__dirname, '../data/tradingpro.db');

console.log('Source DB:', SOURCE_DB);
console.log('Target DB:', TARGET_DB);
console.log('\n=== Copying Subscriptions ===\n');

const sourceDb = new Database(SOURCE_DB);
const targetDb = new Database(TARGET_DB);

// Enable foreign keys
targetDb.pragma('foreign_keys = ON');

try {
    // Get subscriptions from source
    const subscriptions = sourceDb.prepare(`
        SELECT * FROM subscriptions WHERE user_id = 2
    `).all();
    
    console.log(`Found ${subscriptions.length} subscriptions for user ID 2\n`);
    
    // Check if products exist in target database
    for (const sub of subscriptions) {
        // Check if product exists
        const product = targetDb.prepare('SELECT id FROM products WHERE id = ?').get(sub.product_id);
        
        if (!product) {
            // Get product from source and insert into target
            const sourceProduct = sourceDb.prepare('SELECT * FROM products WHERE id = ?').get(sub.product_id);
            if (sourceProduct) {
                console.log(`Copying product ${sourceProduct.id}: ${sourceProduct.name}`);
                targetDb.prepare(`
                    INSERT INTO products (id, name, description, category, price_per_month, price_per_year, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    sourceProduct.id,
                    sourceProduct.name,
                    sourceProduct.description,
                    sourceProduct.category,
                    sourceProduct.price_per_month || sourceProduct.monthly_price,
                    sourceProduct.price_per_year || sourceProduct.yearly_price,
                    sourceProduct.status || 'ACTIVE',
                    sourceProduct.created_at,
                    sourceProduct.updated_at
                );
            }
        }
        
        // Check if subscription already exists
        const existing = targetDb.prepare('SELECT id FROM subscriptions WHERE id = ?').get(sub.id);
        
        if (!existing) {
            console.log(`Copying subscription ${sub.id} for product ${sub.product_id}`);
            targetDb.prepare(`
                INSERT INTO subscriptions (id, user_id, product_id, order_id, start_date, end_date, status, auto_renew, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sub.id,
                sub.user_id,
                sub.product_id,
                sub.order_id,
                sub.start_date,
                sub.end_date,
                sub.status,
                sub.auto_renew || 0,
                sub.created_at,
                sub.updated_at
            );
        } else {
            console.log(`Subscription ${sub.id} already exists, skipping`);
        }
    }
    
    // Verify
    const copied = targetDb.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = 2').get();
    console.log(`\n✅ Copied subscriptions. Total for user ID 2 in target DB: ${copied.count}`);
    
} catch (error) {
    console.error('Error copying subscriptions:', error);
} finally {
    sourceDb.close();
    targetDb.close();
}

