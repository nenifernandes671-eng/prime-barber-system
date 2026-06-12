alter table public.tenants
  add column if not exists trial_start timestamptz,
  add column if not exists trial_end timestamptz,
  add column if not exists subscription_status text;

comment on column public.tenants.trial_start is
  'Inicio do teste gratuito. Preenchido apenas para novos tenants.';

comment on column public.tenants.trial_end is
  'Fim do teste gratuito. Preenchido apenas para novos tenants.';

comment on column public.tenants.subscription_status is
  'Estado da assinatura: trialing, active, trial_expired, blocked ou cancelled.';

create index if not exists tenants_subscription_status_idx
  on public.tenants (subscription_status);

create index if not exists tenants_trial_end_idx
  on public.tenants (trial_end);
