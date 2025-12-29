-- Users table (mirrored from parent app)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    parent_user_id INTEGER NOT NULL UNIQUE, -- References main app user.id
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    profile_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_parent_id ON users(parent_user_id);
CREATE INDEX idx_users_email ON users(email);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_session_id VARCHAR(255), -- References main app session
    email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_parent ON sessions(parent_session_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- SSO audit log
CREATE TABLE IF NOT EXISTS sso_audit (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    parent_user_id INTEGER,
    action VARCHAR(50), -- 'login', 'token_refresh', 'logout'
    token_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sso_audit_user ON sso_audit(user_id);
CREATE INDEX idx_sso_audit_created ON sso_audit(created_at);

