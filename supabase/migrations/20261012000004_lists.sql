-- ============================================================
-- 0004 — LISTS: repeatable blocks (testimonials, logos, stats)
-- ============================================================
-- Things a page has several of, where the client adds, removes and
-- reorders: testimonials, "worked with" logos, the four statistics, FAQs.
--
-- Staff define a list and the shape of one item (`item_schema`, the same
-- field types as page content); clients manage the items. One generic table
-- rather than a table per kind, so a new site needing "team members" is a
-- row, not a migration.
--
-- item_schema example:
--   [{"key":"quote","label":"Quote","type":"long_text"},
--    {"key":"name","label":"Name","type":"text"},
--    {"key":"photo","label":"Photo","type":"image"}]

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------

create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]+$'),   -- "testimonials"
  label       text not null,                               -- "Testimonials"
  help        text,
  item_schema jsonb not null default '[]'::jsonb
                check (jsonb_typeof(item_schema) = 'array'),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),

  unique (site_id, key),
  unique (id, site_id)
);

create table if not exists public.list_items (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null,
  list_id      uuid not null,
  data         jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(data) = 'object'),
  sort_order   integer not null default 0,
  -- Hidden items stay in the dashboard but leave the live site, so a
  -- seasonal testimonial can come back without being retyped.
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null default auth.uid(),

  -- The item's site must be its list's site.
  foreign key (list_id, site_id)
    references public.lists (id, site_id) on delete cascade
);

create index if not exists list_items_list_idx
  on public.list_items (list_id, sort_order);

drop trigger if exists list_items_touch on public.list_items;
create trigger list_items_touch before update on public.list_items
  for each row execute function public.touch_updated();

-- ------------------------------------------------------------
-- 2. Row Level Security and grants
-- ------------------------------------------------------------

alter table public.lists      enable row level security;
alter table public.lists      force  row level security;
alter table public.list_items enable row level security;
alter table public.list_items force  row level security;

-- Lists: editors read; staff define.
drop policy if exists lists_read on public.lists;
create policy lists_read on public.lists for select to authenticated
  using (site_id in (select public.auth_site_ids()));

drop policy if exists lists_staff_write on public.lists;
create policy lists_staff_write on public.lists for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Visitors look a list up by key to fetch its items.
drop policy if exists lists_public_read on public.lists;
create policy lists_public_read on public.lists for select to anon
  using (true);

-- Items: editors do everything on their own sites.
drop policy if exists list_items_edit on public.list_items;
create policy list_items_edit on public.list_items for all to authenticated
  using (site_id in (select public.auth_site_ids()))
  with check (site_id in (select public.auth_site_ids()));

drop policy if exists list_items_public_read on public.list_items;
create policy list_items_public_read on public.list_items for select to anon
  using (is_published);

revoke all on public.lists, public.list_items from anon, authenticated;
grant select (id, site_id, key)                on public.lists      to anon;
grant select                                   on public.list_items to anon;
grant select, insert, update, delete           on public.lists      to authenticated;
grant select, insert, update, delete           on public.list_items to authenticated;

select
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('lists', 'list_items')) as list_policies;
