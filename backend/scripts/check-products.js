const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/tradingpro.db');
const db = new Database(DB_PATH);

console.log('\n=== Checking Products ===\n');

const products = db.prepare('SELECT * FROM products').all();
console.log(`Total products: ${products.length}\n`);

products.forEach(product => {
    console.log(`Product: ${product.name}`);
    console.log(`  ID: ${product.id}`);
    console.log(`  Category: ${product.category || 'N/A'}`);
    console.log(`  Monthly Price: ${product.price_per_month || product.monthly_price || 'N/A'}`);
    console.log(`  Yearly Price: ${product.price_per_year || product.yearly_price || 'N/A'}`);
    console.log(`  Status: ${product.status || 'N/A'}`);
    console.log('');
});

db.close();

