-- ============================================================
-- 0002 — MEDIA: the image library and its storage bucket
-- ============================================================
-- Every uploaded file is a row here and an object in the `site-media`
-- bucket at `{site_id}/{file}`. The leading folder is the tenant: storage
-- policies match on it, the same way Ennyn's project files work.
--
-- The bucket is PUBLIC, unlike Ennyn's. These images go on public websites,
-- and Next's image optimiser needs a stable URL. Reads are open; writes are
-- scoped to the editor's own site folder.

-- ------------------------------------------------------------
-- 1. Media library
-- ------------------------------------------------------------

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites (id) on delete cascade,
  -- Object path inside the bucket. Must sit in this site's folder, so a
  -- row can't point at another client's file.
  path        text not null unique,
  alt         text not null default '',
  mime_type   text,
  width       integer check (width  > 0),
  height      integer check (height > 0),
  size_bytes  bigint  check (size_bytes >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null default auth.uid(),

  -- Target for composite foreign keys: a post's cover image must belong to
  -- the post's own site. A single-column key would let a row carry one
  -- site's id and another site's image.
  unique (id, site_id),
  constraint media_path_in_site check (split_part(path, '/', 1) = site_id::text)
);

create index if not exists media_site_idx on public.media (site_id, created_at desc);

drop trigger if exists media_touch on public.media;
create trigger media_touch before update on public.media
  for each row execute function public.touch_updated();

alter table public.media enable row level security;
alter table public.media force  row level security;

drop policy if exists media_edit on public.media;
create policy media_edit on public.media for all to authenticated
  using (site_id in (select public.auth_site_ids()))
  with check (site_id in (select public.auth_site_ids()));

-- Visitors need alt text and dimensions to render images. The files are
-- public anyway, so the metadata is too.
drop policy if exists media_public_read on public.media;
create policy media_public_read on public.media for select to anon
  using (true);

revoke all on public.media from anon, authenticated;
grant select                         on public.media to anon;
grant select, insert, update, delete on public.media to authenticated;

-- ------------------------------------------------------------
-- 2. Storage bucket
-- ------------------------------------------------------------
-- No SVG: an SVG can carry script, and it would be served from our
-- Supabase domain. PDFs are allowed for downloadable resources.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
        'application/pdf']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_media_read   on storage.objects;
drop policy if exists site_media_insert on storage.objects;
drop policy if exists site_media_update on storage.objects;
drop policy if exists site_media_delete on storage.objects;

-- Public URLs don't need a select policy. This one is for the dashboard's
-- own listing, and only covers your site's folder.
create policy site_media_read on storage.objects for select to authenticated
  using (
    bucket_id = 'site-media'
    and exists (select 1 from public.auth_site_ids() as t(site)
                where (storage.foldername(name))[1] = t.site::text)
  );

create policy site_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and exists (select 1 from public.auth_site_ids() as t(site)
                where (storage.foldername(name))[1] = t.site::text)
  );

create policy site_media_update on storage.objects for update to authenticated
  using (
    bucket_id = 'site-media'
    and exists (select 1 from public.auth_site_ids() as t(site)
                where (storage.foldername(name))[1] = t.site::text)
  )
  with check (
    bucket_id = 'site-media'
    and exists (select 1 from public.auth_site_ids() as t(site)
                where (storage.foldername(name))[1] = t.site::text)
  );

create policy site_media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-media'
    and exists (select 1 from public.auth_site_ids() as t(site)
                where (storage.foldername(name))[1] = t.site::text)
  );

select
  (select count(*) from storage.buckets where id = 'site-media' and public) as public_bucket,
  (select count(*) from pg_policies
    where schemaname = 'storage' and policyname like 'site_media_%')     as storage_policies;
