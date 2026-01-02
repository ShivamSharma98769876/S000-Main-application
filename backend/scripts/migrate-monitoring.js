const path = require('path');
const fs = require('fs');

// Load environment variables BEFORE requiring database config
const envPath = path.join(__dirname, '../env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const { query } = require('../config/database');

async function migrateMonitoring() {
    try {
        console.log('Creating monitoring tables...');
        
        // Error logs table
        console.log('Creating error_logs table...');
        await query(`
            CREATE TABLE IF NOT EXISTS error_logs (
                id SERIAL PRIMARY KEY,
                message TEXT NOT NULL,
                stack TEXT,
                error_name VARCHAR(255),
                error_code VARCHAR(50),
                context JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        // Performance metrics table
        console.log('Creating performance_metrics table...');
        await query(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                operation VARCHAR(255) NOT NULL,
                duration INTEGER NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        // Failed login attempts table
        console.log('Creating failed_login_attempts table...');
        await query(`
            CREATE TABLE IF NOT EXISTS failed_login_attempts (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255),
                provider VARCHAR(50),
                ip_address VARCHAR(45),
                user_agent TEXT,
                reason TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        // System alerts table
        console.log('Creating system_alerts table...');
        await query(`
            CREATE TABLE IF NOT EXISTS system_alerts (
                id SERIAL PRIMARY KEY,
                alert_type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
                message TEXT NOT NULL,
                metadata JSONB,
                resolved BOOLEAN DEFAULT FALSE,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        console.log('Creating indexes...');
        
        // Error logs indexes
        await query(`
            CREATE INDEX IF NOT EXISTS idx_error_logs_created_at 
            ON error_logs(created_at DESC);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_error_logs_error_name 
            ON error_logs(error_name);
        `);
        
        // Performance metrics indexes
        await query(`
            CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at 
            ON performance_metrics(created_at DESC);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation 
            ON performance_metrics(operation);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_performance_metrics_duration 
            ON performance_metrics(duration);
        `);
        
        // Failed login attempts indexes
        await query(`
            CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_created_at 
            ON failed_login_attempts(created_at DESC);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip 
            ON failed_login_attempts(ip_address);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email 
            ON failed_login_attempts(email);
        `);
        
        // System alerts indexes
        await query(`
            CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at 
            ON system_alerts(created_at DESC);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_system_alerts_severity 
            ON system_alerts(severity);
        `);
        
        await query(`
            CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved 
            ON system_alerts(resolved);
        `);
        
        console.log('✅ Monitoring tables created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating monitoring tables:', error);
        process.exit(1);
    }
}

migrateMonitoring();


