begin;

alter table public.tenants
  add column if not exists landing_logo_url text,
  add column if not exists landing_about_title text,
  add column if not exists landing_about_text text,
  add column if not exists landing_about_image_url text,
  add column if not exists landing_testimonials jsonb not null default '[]'::jsonb,
  add column if not exists landing_differentials jsonb not null default '[]'::jsonb,
  add column if not exists landing_years_experience text,
  add column if not exists landing_appointments_count text,
  add column if not exists landing_clients_count text,
  add column if not exists landing_average_rating text;

comment on column public.tenants.landing_testimonials is
  'Depoimentos exibidos na pagina publica do tenant.';

comment on column public.tenants.landing_differentials is
  'Diferenciais exibidos na pagina publica do tenant.';

commit;
