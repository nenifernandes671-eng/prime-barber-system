create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  is_active boolean not null default true,
  unique (tenant_id, user_id, token)
);

create index if not exists device_tokens_tenant_user_active_idx
  on public.device_tokens (tenant_id, user_id, is_active);

create table if not exists public.push_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_ids uuid[] not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  type text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_attempt_at timestamptz not null default now(),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists push_queue_worker_idx
  on public.push_queue (status, next_attempt_at, created_at);

create index if not exists push_queue_tenant_idx
  on public.push_queue (tenant_id, created_at desc);

create table if not exists public.push_logs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid references public.push_queue(id) on delete set null,
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_token_id uuid references public.device_tokens(id) on delete set null,
  title text not null,
  status text not null check (status in ('sent', 'failed')),
  error_message text,
  type text,
  created_at timestamptz not null default now()
);

create index if not exists push_logs_tenant_created_idx
  on public.push_logs (tenant_id, created_at desc);

create index if not exists push_logs_user_created_idx
  on public.push_logs (user_id, created_at desc);

alter table public.device_tokens enable row level security;
alter table public.push_queue enable row level security;
alter table public.push_logs enable row level security;

drop policy if exists device_tokens_own_tenant_select on public.device_tokens;
create policy device_tokens_own_tenant_select on public.device_tokens
  for select using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = device_tokens.tenant_id
        and tu.user_id = auth.uid()
    )
  );

drop policy if exists push_logs_own_tenant_select on public.push_logs;
create policy push_logs_own_tenant_select on public.push_logs
  for select using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = push_logs.tenant_id
        and tu.user_id = auth.uid()
    )
  );
