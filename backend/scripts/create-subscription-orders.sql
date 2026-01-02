-- Create subscription_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) NOT NULL,
    payment_proof_url TEXT,
    payment_reference VARCHAR(100),
    payment_date TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create subscription_order_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscription_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES subscription_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    duration_unit VARCHAR(10) NOT NULL CHECK (duration_unit IN ('MONTH', 'YEAR')),
    duration_value INTEGER NOT NULL CHECK (duration_value BETWEEN 1 AND 12),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_orders_user ON subscription_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON subscription_orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_order_items_order ON subscription_order_items(order_id);

