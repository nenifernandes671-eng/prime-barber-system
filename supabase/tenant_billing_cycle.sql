alter table public.tenants
  add column if not exists billing_cycle text;

update public.tenants
set billing_cycle = 'monthly'
where billing_cycle is null;

alter table public.tenants
  drop constraint if exists tenants_billing_cycle_check;

alter table public.tenants
  add constraint tenants_billing_cycle_check
  check (billing_cycle in ('monthly', 'quarterly', 'yearly'));

comment on column public.tenants.billing_cycle is
  'Ciclo da assinatura SaaS: monthly, quarterly ou yearly. Registros antigos usam monthly.';
