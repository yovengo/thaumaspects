create table if not exists private.app_unavailable_items (
  user_id uuid not null references private.app_users(id) on delete cascade,
  item_key text not null check (length(item_key) between 1 and 2000),
  created_at timestamptz not null default now(),
  primary key (user_id,item_key)
);

alter table private.app_unavailable_items enable row level security;
revoke all on private.app_unavailable_items from public, anon, authenticated;
