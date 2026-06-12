begin;

alter table public.barbeiros
  add column if not exists compensation_type text default 'commission',
  add column if not exists commission_percentage numeric(5,2),
  add column if not exists fixed_salary_amount numeric(12,2) default 0,
  add column if not exists chair_rental_amount numeric(12,2) default 0;

alter table public.barbeiros
  drop constraint if exists barbeiros_compensation_type_check;

alter table public.barbeiros
  add constraint barbeiros_compensation_type_check
  check (
    compensation_type in (
      'commission',
      'fixed_salary',
      'salary_plus_commission',
      'chair_rental'
    )
  );

update public.barbeiros as canonical
set
  compensation_type = coalesce(canonical.compensation_type, 'commission'),
  commission_percentage = coalesce(
    canonical.commission_percentage,
    legacy.commission_percentage,
    0
  )
from public.barbers as legacy
where canonical.tenant_id = legacy.tenant_id
  and (
    (
      canonical.email is not null
      and legacy.email is not null
      and lower(canonical.email) = lower(legacy.email)
    )
    or lower(canonical.nome) = lower(legacy.name)
  );

update public.barbeiros
set
  compensation_type = coalesce(compensation_type, 'commission'),
  commission_percentage = coalesce(commission_percentage, 0),
  fixed_salary_amount = coalesce(fixed_salary_amount, 0),
  chair_rental_amount = coalesce(chair_rental_amount, 0);

create index if not exists barbeiros_tenant_compensation_idx
  on public.barbeiros (tenant_id, compensation_type);

comment on column public.barbeiros.compensation_type is
  'commission, fixed_salary, salary_plus_commission ou chair_rental';

commit;
