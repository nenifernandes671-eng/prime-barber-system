create table if not exists public.tenant_gallery_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  image_url text not null,
  storage_path text,
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tenant_gallery_images_tenant_position_idx
  on public.tenant_gallery_images (tenant_id, position, created_at);

alter table public.tenant_gallery_images enable row level security;

drop policy if exists "tenant_gallery_images_select_public" on public.tenant_gallery_images;
drop policy if exists "tenant_gallery_images_manage_admin" on public.tenant_gallery_images;

create policy "tenant_gallery_images_select_public"
  on public.tenant_gallery_images
  for select
  using (true);

create policy "tenant_gallery_images_manage_admin"
  on public.tenant_gallery_images
  for all
  using (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = tenant_gallery_images.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.tenant_users tu
      where tu.tenant_id = tenant_gallery_images.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('admin', 'owner')
    )
  );
