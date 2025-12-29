const { query } = require('../config/database');
const logger = require('../config/logger');

async function fixProductPrices() {
    try {
        logger.info('Checking and fixing product prices...');
        
        // Check if products have prices
        const products = await query('SELECT id, name, price_per_month, price_per_year FROM products');
        
        console.log('\nCurrent products:');
        products.rows.forEach(p => {
            console.log(`  ${p.id}. ${p.name} - Monthly: ₹${p.price_per_month}, Yearly: ₹${p.price_per_year}`);
        });
        
        // If prices are null, set default prices based on product names
        const updates = [
            { id: 1, name: 'Algo Trading Platform', monthly: 2999, yearly: 29990 },
            { id: 2, name: 'Premium Analytics Suite', monthly: 4999, yearly: 49990 },
            { id: 3, name: 'Smart Trading Bots', monthly: 3499, yearly: 34990 },
            { id: 4, name: 'Trading Academy', monthly: 1999, yearly: 19990 }
        ];
        
        for (const product of products.rows) {
            if (!product.price_per_month || !product.price_per_year) {
                // Find matching default price
                const defaultPrice = updates.find(u => u.name === product.name || u.id === product.id);
                
                if (defaultPrice) {
                    await query(
                        'UPDATE products SET price_per_month = $1, price_per_year = $2 WHERE id = $3',
                        [defaultPrice.monthly, defaultPrice.yearly, product.id]
                    );
                    console.log(`✓ Updated ${product.name}: ₹${defaultPrice.monthly}/month, ₹${defaultPrice.yearly}/year`);
                }
            }
        }
        
        console.log('\n✅ Product prices fixed!');
        logger.info('Product prices fixed successfully');
        
        process.exit(0);
    } catch (error) {
        logger.error('Failed to fix product prices', error);
        console.error('❌ Failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    fixProductPrices();
}

module.exports = { fixProductPrices };


