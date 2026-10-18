create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_users (
  id uuid primary key default gen_random_uuid(),
  code_hash char(64) not null unique,
  code_encrypted text,
  created_at timestamptz not null default now()
);

create table if not exists private.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references private.app_users(id) on delete cascade,
  token_hash char(64) not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists app_sessions_user_idx on private.app_sessions(user_id);
create index if not exists app_sessions_expiry_idx on private.app_sessions(expires_at);

create table if not exists private.app_favorites (
  user_id uuid not null references private.app_users(id) on delete cascade,
  item_key text not null check (length(item_key) between 1 and 2000),
  created_at timestamptz not null default now(),
  primary key (user_id,item_key)
);

create table if not exists private.auth_rate_limits (
  bucket text primary key,
  hits integer not null,
  resets_at timestamptz not null
);
create index if not exists auth_rate_limits_expiry_idx on private.auth_rate_limits(resets_at);
