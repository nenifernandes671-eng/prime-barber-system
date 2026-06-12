create table if not exists public.membership_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.memberships(id) on delete cascade,
  membership_id uuid not null references public.membership_plans(id) on delete restrict,
  billing_mode text not null default 'manual'
    check (billing_mode in ('manual', 'automatic')),
  asaas_customer_id text,
  asaas_subscription_id text unique,
  value numeric(10, 2) not null check (value > 0),
  status text not null default 'pending'
    check (status in ('active', 'pending', 'overdue', 'cancelled')),
  paid_until date,
  next_due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.membership_subscriptions
  add column if not exists billing_mode text;

update public.membership_subscriptions
set billing_mode = case
  when asaas_subscription_id is not null then 'automatic'
  else 'manual'
end
where billing_mode is null;

alter table public.membership_subscriptions
  alter column billing_mode set default 'manual',
  alter column billing_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'membership_subscriptions_billing_mode_check'
      and conrelid = 'public.membership_subscriptions'::regclass
  ) then
    alter table public.membership_subscriptions
      add constraint membership_subscriptions_billing_mode_check
      check (billing_mode in ('manual', 'automatic'));
  end if;
end
$$;

create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid not null references public.membership_subscriptions(id) on delete cascade,
  asaas_payment_id text unique,
  amount numeric(10, 2) not null check (amount >= 0),
  status text not null,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Server-only credentials for future tenant-owned ASAAS accounts.
-- Do not expose this table through browser clients.
create table if not exists public.tenant_payment_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  asaas_enabled boolean not null default false,
  asaas_api_key text,
  asaas_environment text not null default 'production'
    check (asaas_environment in ('sandbox', 'production')),
  asaas_base_url text not null default 'https://api.asaas.com/v3',
  asaas_account_name text,
  asaas_account_email text,
  connection_status text not null default 'not_tested'
    check (connection_status in ('not_tested', 'active', 'error')),
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_payment_settings
  add column if not exists asaas_environment text not null default 'production',
  add column if not exists asaas_account_name text,
  add column if not exists asaas_account_email text,
  add column if not exists connection_status text not null default 'not_tested',
  add column if not exists last_tested_at timestamptz;

alter table public.tenant_payment_settings enable row level security;

create index if not exists membership_subscriptions_tenant_idx
  on public.membership_subscriptions (tenant_id);

create index if not exists membership_subscriptions_billing_mode_idx
  on public.membership_subscriptions (tenant_id, billing_mode);

create index if not exists membership_subscriptions_customer_idx
  on public.membership_subscriptions (customer_id);

create index if not exists membership_subscriptions_asaas_customer_idx
  on public.membership_subscriptions (asaas_customer_id);

create index if not exists membership_subscriptions_next_due_idx
  on public.membership_subscriptions (tenant_id, next_due_date);

create index if not exists membership_payments_subscription_idx
  on public.membership_payments (subscription_id);

create index if not exists membership_payments_tenant_idx
  on public.membership_payments (tenant_id);

create or replace function public.set_membership_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists membership_subscriptions_updated_at
  on public.membership_subscriptions;

create trigger membership_subscriptions_updated_at
before update on public.membership_subscriptions
for each row execute function public.set_membership_subscription_updated_at();

drop trigger if exists tenant_payment_settings_updated_at
  on public.tenant_payment_settings;

create trigger tenant_payment_settings_updated_at
before update on public.tenant_payment_settings
for each row execute function public.set_membership_subscription_updated_at();

notify pgrst, 'reload schema';
