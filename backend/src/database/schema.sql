CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT, -- hashed with bcrypt, NULL for OAuth users
    name TEXT NOT NULL,
    auth_method TEXT NOT NULL CHECK (auth_method IN ('oauth', 'password')),
    oauth_provider TEXT, -- 'google', NULL for password auth
    primary_email_account_id TEXT, -- FK set later
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,

    CONSTRAINT valid_oauth_user CHECK (
        (auth_method = 'oauth' AND oauth_provider IS NOT NULL AND password IS NULL) OR
        (auth_method = 'password' AND password IS NOT NULL)
    )
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_method ON users(auth_method);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);


CREATE TABLE IF NOT EXISTS email_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    auth_type TEXT NOT NULL CHECK (auth_type IN ('imap', 'oauth')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- IMAP Configuration (JSON for flexibility)
    imap_config JSONB, -- { host, port, secure, password (encrypted) }

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'disconnected')),

    CONSTRAINT valid_imap_account CHECK (
        (auth_type = 'imap' AND imap_config IS NOT NULL) OR
        (auth_type = 'oauth' AND imap_config IS NULL)
    ),
    CONSTRAINT unique_user_email UNIQUE(user_id, email)
);

-- Indexes for email_accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email);
CREATE INDEX IF NOT EXISTS idx_email_accounts_is_active ON email_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_email_accounts_auth_type ON email_accounts(auth_type);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL, -- Encrypted
    refresh_token TEXT, -- Encrypted
    token_expiry TIMESTAMPTZ,
    scope TEXT[], -- Array of scopes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used TIMESTAMPTZ,

    CONSTRAINT unique_account_oauth UNIQUE(account_id)
);

-- Indexes for oauth_tokens
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_account_id ON oauth_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_email ON oauth_tokens(email);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expiry ON oauth_tokens(token_expiry);


CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    folder TEXT NOT NULL,
    uid TEXT NOT NULL, -- IMAP UID

    -- Email metadata
    subject TEXT NOT NULL,
    from_name TEXT NOT NULL,
    from_address TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,

    -- Email content
    body TEXT, -- Plain text body
    text_body TEXT, -- Plain text version
    html_body TEXT, -- HTML version

    -- Email flags
    flags TEXT[], -- Array of IMAP flags

    -- Categorization
    category TEXT, -- AI-assigned category

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_account_uid UNIQUE(account_id, uid)
);

-- Indexes for emails
CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_from_address ON emails(from_address);
CREATE INDEX IF NOT EXISTS idx_emails_account_folder ON emails(account_id, folder);
CREATE INDEX IF NOT EXISTS idx_emails_uncategorized ON emails(account_id) WHERE category IS NULL;

CREATE TABLE IF NOT EXISTS email_recipients (
    id SERIAL PRIMARY KEY,
    email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('to', 'cc', 'bcc')),
    name TEXT,
    address TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for email_recipients
CREATE INDEX IF NOT EXISTS idx_email_recipients_email_id ON email_recipients(email_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_address ON email_recipients(address);
CREATE INDEX IF NOT EXISTS idx_email_recipients_type ON email_recipients(recipient_type);


-- FOREIGN KEY: users.primary_email_account_id
-- Add FK after email_accounts table exists
ALTER TABLE users
ADD CONSTRAINT fk_users_primary_account
FOREIGN KEY (primary_email_account_id)
REFERENCES email_accounts(id)
ON DELETE SET NULL;

-- TRIGGERS: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- View: User with account summary
CREATE OR REPLACE VIEW user_accounts_summary AS
SELECT
    u.id AS user_id,
    u.email AS user_email,
    u.name,
    COUNT(ea.id) AS total_accounts,
    COUNT(ea.id) FILTER (WHERE ea.is_active = true) AS active_accounts,
    COUNT(e.id) AS total_emails
FROM users u
LEFT JOIN email_accounts ea ON ea.user_id = u.id
LEFT JOIN emails e ON e.account_id = ea.id
GROUP BY u.id, u.email, u.name;

-- View: Email statistics by account
CREATE OR REPLACE VIEW email_stats_by_account AS
SELECT
    ea.id AS account_id,
    ea.email AS account_email,
    ea.user_id,
    COUNT(e.id) AS total_emails,
    COUNT(e.id) FILTER (WHERE e.category IS NULL) AS uncategorized,
    COUNT(e.id) FILTER (WHERE e.category = 'primary') AS primary_emails,
    COUNT(e.id) FILTER (WHERE e.category = 'social') AS social_emails,
    COUNT(e.id) FILTER (WHERE e.category = 'promotions') AS promotions_emails,
    MAX(e.date) AS latest_email_date
FROM email_accounts ea
LEFT JOIN emails e ON e.account_id = ea.id
GROUP BY ea.id, ea.email, ea.user_id;

-- COMMENTS (Documentation)

COMMENT ON TABLE users IS 'User accounts with authentication';
COMMENT ON TABLE email_accounts IS 'Connected email accounts (IMAP/OAuth)';
COMMENT ON TABLE oauth_tokens IS 'OAuth tokens (encrypted) for Gmail/OAuth accounts';
COMMENT ON TABLE emails IS 'Email metadata and content';
COMMENT ON TABLE email_recipients IS 'Email recipients (to, cc, bcc)';

COMMENT ON COLUMN users.password IS 'bcrypt hashed password (NULL for OAuth users)';
COMMENT ON COLUMN oauth_tokens.access_token IS 'AES-256 encrypted access token';
COMMENT ON COLUMN oauth_tokens.refresh_token IS 'AES-256 encrypted refresh token';
COMMENT ON COLUMN emails.uid IS 'IMAP UID (unique per account/folder)';
COMMENT ON COLUMN emails.category IS 'AI-assigned category (primary, social, promotions, etc.)';
