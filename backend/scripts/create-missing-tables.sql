-- Create missing tables for Azure deployment
-- Run this via sqlite3 CLI or through a Node.js script after npm install

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    stack TEXT,
    error_name TEXT,
    error_code TEXT,
    context TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    data TEXT NOT NULL,
    priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME NOT NULL,
    sent_at DATETIME,
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Verify tables
-- Run: .tables
-- Should show: error_logs email_queue

