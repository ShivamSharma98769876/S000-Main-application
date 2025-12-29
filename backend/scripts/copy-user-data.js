const Database = require('better-sqlite3');
const path = require('path');

const SOURCE_DB = path.join(__dirname, '../../data/tradingpro.db');
const TARGET_DB = path.join(__dirname, '../data/tradingpro.db');

console.log('=== Copying User Data for User ID 2 ===\n');

const sourceDb = new Database(SOURCE_DB);
const targetDb = new Database(TARGET_DB);

targetDb.pragma('foreign_keys = ON');

try {
    // 1. Copy user if doesn't exist
    const targetUser = targetDb.prepare('SELECT * FROM users WHERE id = 2').get();
    if (!targetUser) {
        const sourceUser = sourceDb.prepare('SELECT * FROM users WHERE id = 2').get();
        if (sourceUser) {
            console.log('Copying user ID 2...');
            targetDb.prepare(`
                INSERT INTO users (id, provider_type, provider_user_id, email, is_admin, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sourceUser.id,
                sourceUser.provider_type,
                sourceUser.provider_user_id,
                sourceUser.email,
                sourceUser.is_admin || 0,
                sourceUser.is_active !== undefined ? sourceUser.is_active : 1,
                sourceUser.created_at,
                sourceUser.updated_at
            );
            console.log('✅ User copied');
        }
    } else {
        console.log('User ID 2 already exists in target DB');
    }
    
    // 2. Copy user profile
    const targetProfile = targetDb.prepare('SELECT * FROM user_profiles WHERE user_id = 2').get();
    if (!targetProfile) {
        const sourceProfile = sourceDb.prepare('SELECT * FROM user_profiles WHERE user_id = 2').get();
        if (sourceProfile) {
            console.log('Copying user profile...');
            targetDb.prepare(`
                INSERT INTO user_profiles (user_id, full_name, address, phone, capital_used, referral_code, zerodha_client_id, profile_completed, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sourceProfile.user_id,
                sourceProfile.full_name,
                sourceProfile.address,
                sourceProfile.phone,
                sourceProfile.capital_used,
                sourceProfile.referral_code,
                sourceProfile.zerodha_client_id,
                sourceProfile.profile_completed || 1,
                sourceProfile.created_at,
                sourceProfile.updated_at
            );
            console.log('✅ Profile copied');
        }
    } else {
        console.log('User profile already exists in target DB');
    }
    
    // 3. First, get all product IDs needed for user ID 2's subscriptions and orders
    const neededProductIds = new Set();
    const userSubscriptions = sourceDb.prepare('SELECT product_id FROM subscriptions WHERE user_id = 2').all();
    userSubscriptions.forEach(s => neededProductIds.add(s.product_id));
    
    const orderItems = sourceDb.prepare(`
        SELECT DISTINCT product_id FROM subscription_order_items 
        WHERE order_id IN (SELECT id FROM subscription_orders WHERE user_id = 2)
    `).all();
    orderItems.forEach(item => neededProductIds.add(item.product_id));
    
    console.log(`\nProducts needed: ${Array.from(neededProductIds).join(', ')}`);
    
    // Copy all needed products
    const productIdsArray = Array.from(neededProductIds);
    if (productIdsArray.length > 0) {
        const placeholders = productIdsArray.map(() => '?').join(',');
        const sourceProducts = sourceDb.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...productIdsArray);
        
        for (const product of sourceProducts) {
            const existing = targetDb.prepare('SELECT id FROM products WHERE id = ?').get(product.id);
            if (!existing) {
                console.log(`Copying product ${product.id}: ${product.name}`);
                targetDb.prepare(`
                    INSERT INTO products (id, name, description, category, price_per_month, price_per_year, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    product.id,
                    product.name,
                    product.description,
                    product.category,
                    product.price_per_month || product.monthly_price,
                    product.price_per_year || product.yearly_price,
                    product.status || 'ACTIVE',
                    product.created_at,
                    product.updated_at
                );
                console.log(`✅ Product ${product.id} copied`);
            }
        }
    }
    
    // 5. Copy orders for user ID 2
    const sourceOrders = sourceDb.prepare('SELECT * FROM subscription_orders WHERE user_id = 2').all();
    console.log(`\nFound ${sourceOrders.length} orders for user ID 2`);
    
    for (const order of sourceOrders) {
        const existingOrder = targetDb.prepare('SELECT id FROM subscription_orders WHERE id = ?').get(order.id);
        if (!existingOrder) {
            console.log(`Copying order ${order.id}...`);
            targetDb.prepare(`
                INSERT INTO subscription_orders (id, user_id, status, total_amount, payment_proof_url, payment_reference, payment_date, rejection_reason, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                order.id,
                order.user_id,
                order.status,
                order.total_amount,
                order.payment_proof_url,
                order.payment_reference,
                order.payment_date,
                order.rejection_reason,
                order.created_at,
                order.updated_at
            );
            
            // Copy order items
            const orderItems = sourceDb.prepare('SELECT * FROM subscription_order_items WHERE order_id = ?').all(order.id);
            for (const item of orderItems) {
                targetDb.prepare(`
                    INSERT INTO subscription_order_items (id, order_id, product_id, duration_type, duration_units, start_date, end_date, unit_price, subtotal, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    item.id,
                    item.order_id,
                    item.product_id,
                    item.duration_type,
                    item.duration_units,
                    item.start_date,
                    item.end_date,
                    item.unit_price || item.price,
                    item.subtotal,
                    item.created_at
                );
            }
            console.log(`✅ Order ${order.id} and ${orderItems.length} items copied`);
        }
    }
    
    // 6. Now copy subscriptions
    console.log('\n=== Copying Subscriptions ===');
    const subscriptions = sourceDb.prepare('SELECT * FROM subscriptions WHERE user_id = 2').all();
    console.log(`Found ${subscriptions.length} subscriptions\n`);
    
    for (const sub of subscriptions) {
        const existing = targetDb.prepare('SELECT id FROM subscriptions WHERE id = ?').get(sub.id);
        if (!existing) {
            console.log(`Copying subscription ${sub.id}...`);
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
            console.log(`✅ Subscription ${sub.id} copied`);
        } else {
            console.log(`Subscription ${sub.id} already exists`);
        }
    }
    
    // Verify
    const finalCount = targetDb.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = 2').get();
    console.log(`\n✅ Complete! Total subscriptions for user ID 2: ${finalCount.count}`);
    
} catch (error) {
    console.error('Error:', error);
} finally {
    sourceDb.close();
    targetDb.close();
}

