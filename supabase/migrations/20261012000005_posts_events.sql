-- ============================================================
-- 0005 — POSTS AND EVENTS
-- ============================================================
-- Blog posts and events get real tables rather than lists: they have their
-- own pages (slugs), dates the site queries by, and SEO fields.
--
-- Both use the same publishing rule. A row is live when
--   status = 'published' and published_at <= now()
-- so setting published_at in the future schedules it, with no cron.
--
-- Bodies are Tiptap JSON. Whatever renders them on the public site must
-- drop unsafe link hrefs (javascript:) — the database checks the shape of
-- a document, not every mark inside it.

-- ------------------------------------------------------------
-- 1. Shared: stamp published_at when something goes live
-- ------------------------------------------------------------

create or replace function public.stamp_published()
returns trigger language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

revoke all on function public.stamp_published() from public, anon;

-- ------------------------------------------------------------
-- 2. Posts
-- ------------------------------------------------------------

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites (id) on delete cascade,
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null check (char_length(title) between 1 and 200),
  excerpt         text check (char_length(excerpt) <= 500),
  body            jsonb not null default '{"type":"doc","content":[]}'::jsonb
                    check (body ->> 'type' = 'doc'),
  cover_media_id  uuid,
  author_name     text,
  tags            text[] not null default '{}',
  seo_title       text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  status          text not null default 'draft'
                    check (status in ('draft', 'published')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null default auth.uid(),

  unique (site_id, slug),
  -- Cover must be from this site's library. Deleting the image clears the
  -- cover rather than the post (or the site_id with it).
  foreign key (cover_media_id, site_id)
    references public.media (id, site_id) on delete set null (cover_media_id)
);

create index if not exists posts_live_idx
  on public.posts (site_id, published_at desc) where status = 'published';

drop trigger if exists posts_stamp on public.posts;
create trigger posts_stamp before insert or update on public.posts
  for each row execute function public.stamp_published();

-- ------------------------------------------------------------
-- 3. Events
-- ------------------------------------------------------------
-- Times are timestamptz, displayed in sites.timezone. An all-day event is
-- stored at local midnight and the calendar ignores the time.
-- Not here yet: recurring events. Each date is its own row for now; a
-- "duplicate event" button in the dashboard covers the common case.

create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references public.sites (id) on delete cascade,
  slug             text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null check (char_length(title) between 1 and 200),
  summary          text check (char_length(summary) <= 500),
  body             jsonb not null default '{"type":"doc","content":[]}'::jsonb
                     check (body ->> 'type' = 'doc'),
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  all_day          boolean not null default false,
  location_name    text,
  location_address text,
  online_url       text check (online_url  ~ '^https?://'),
  booking_url      text check (booking_url ~ '^https?://'),
  price_text       text,                        -- "Free", "£15", "From £10"
  image_media_id   uuid,
  -- Cancelled events stay on the calendar, marked, so people who saw them
  -- aren't left wondering where they went.
  is_cancelled     boolean not null default false,
  status           text not null default 'draft'
                     check (status in ('draft', 'published')),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null default auth.uid(),

  unique (site_id, slug),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at),
  foreign key (image_media_id, site_id)
    references public.media (id, site_id) on delete set null (image_media_id)
);

-- The calendar asks "what's on between these two dates".
create index if not exists events_calendar_idx
  on public.events (site_id, starts_at);

drop trigger if exists events_stamp on public.events;
create trigger events_stamp before insert or update on public.events
  for each row execute function public.stamp_published();

-- ------------------------------------------------------------
-- 4. Row Level Security and grants
-- ------------------------------------------------------------

alter table public.posts  enable row level security;
alter table public.posts  force  row level security;
alter table public.events enable row level security;
alter table public.events force  row level security;

drop policy if exists posts_edit on public.posts;
create policy posts_edit on public.posts for all to authenticated
  using (site_id in (select public.auth_site_ids()))
  with check (site_id in (select public.auth_site_ids()));

drop policy if exists posts_public_read on public.posts;
create policy posts_public_read on public.posts for select to anon
  using (status = 'published' and published_at <= now());

drop policy if exists events_edit on public.events;
create policy events_edit on public.events for all to authenticated
  using (site_id in (select public.auth_site_ids()))
  with check (site_id in (select public.auth_site_ids()));

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select to anon
  using (status = 'published' and published_at <= now());

revoke all on public.posts, public.events from anon, authenticated;
grant select                         on public.posts, public.events to anon;
grant select, insert, update, delete on public.posts, public.events to authenticated;

select
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('posts', 'events')) as post_event_policies;
