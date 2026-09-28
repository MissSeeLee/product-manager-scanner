BEGIN;

CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  username_normalized VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'VIEWER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_users_username_not_blank CHECK (BTRIM(username) <> ''),
  CONSTRAINT app_users_username_normalized_not_blank CHECK (BTRIM(username_normalized) <> ''),
  CONSTRAINT app_users_display_name_not_blank CHECK (BTRIM(display_name) <> ''),
  CONSTRAINT app_users_role_valid CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
  CONSTRAINT app_users_failed_login_nonnegative CHECK (failed_login_count >= 0)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent VARCHAR(500),
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
  ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
  ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  username_attempted VARCHAR(80),
  action VARCHAR(50) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_audit_log_created_at_idx
  ON auth_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_log_user_id_idx
  ON auth_audit_log (user_id, created_at DESC);

COMMIT;
