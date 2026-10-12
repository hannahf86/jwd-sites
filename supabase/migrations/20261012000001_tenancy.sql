-- ============================================================
-- 0001 — TENANCY: sites, staff and editors
-- ============================================================
-- One Supabase project serves every client website. Each website is a row
-- in `sites`, and every content row carries a `site_id`. Postgres decides
-- who sees what (RLS), so a dashboard route that forgets a filter cannot
-- leak another client's content — the rows are simply never returned.
-- Same approach as Ennyn.
--
-- Three kinds of people:
--   staff   Jorvik Web Dev. Every site, plus the setup only we should do:
--           creating sites, defining editable fields, inviting editors.
--   editor  A client. Edits the content of the sites they're a member of.
--   anon    A website visitor. Reads published content and nothing else.
--
-- Re-runnable: every statement is guarded, and the test suite applies the
-- whole folder twice to prove it.

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------

-- Staff are a list, not a role on a site, because staff aren't members of
-- sites — they're the people who create them. Rows are added in the SQL
-- editor (see README), never through the API.
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id             uuid primary key default gen_random_uuid(),
  -- Used in dashboard URLs: /sites/feel-good-menopause
  slug           text not null unique
                   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null,
  -- The live domain, e.g. feelgoodmenopause.co.uk. Informational.
  domain         text,
  -- Where the dashboard pings after a publish so the site refreshes its
  -- cache. The secret is NOT stored here: each site's secret is derived
  -- from one platform secret (HMAC of the site id) held in env vars.
  revalidate_url text check (revalidate_url ~ '^https://'),
  -- Event times are shown in this zone, named explicitly — Vercel runs in
  -- UTC and the browser doesn't, so an unnamed zone drifts an hour.
  timezone       text not null default 'Europe/London',
  status         text not null default 'active'
                   check (status in ('active', 'paused', 'archived')),
  created_at     timestamptz not null default now()
);

-- Clients who can edit a site. One person can edit more than one site.
create table if not exists public.site_members (
  site_id    uuid not null references public.sites (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Only one role today. The column exists so adding a second (say, a
  -- client admin who can invite colleagues) isn't a table rewrite.
  role       text not null default 'editor' check (role in ('editor')),
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

create index if not exists site_members_user_idx on public.site_members (user_id);

-- ------------------------------------------------------------
-- 2. Who is asking
-- ------------------------------------------------------------
-- security definer so a policy never reads its own table (that recursion
-- took Ennyn's sign-in down for an afternoon), and stable so Postgres
-- evaluates it once per statement rather than once per row.

create or replace function public.is_staff()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

-- Every site this person may edit: all of them for staff, their own for
-- editors. Policies say `site_id in (select public.auth_site_ids())`.
create or replace function public.auth_site_ids()
returns setof uuid language sql stable security definer
set search_path = public
as $$
  select id from public.sites where public.is_staff()
  union
  select site_id from public.site_members where user_id = auth.uid()
$$;

-- Shared by every table with updated_at / updated_by.
-- Authorship comes from the session, never the request.
create or replace function public.touch_updated()
returns trigger language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

-- Supabase grants execute on new functions to anon by default.
revoke all on function public.is_staff()      from public, anon;
revoke all on function public.auth_site_ids() from public, anon;
revoke all on function public.touch_updated() from public, anon;
grant execute on function public.is_staff()      to authenticated;
grant execute on function public.auth_site_ids() to authenticated;

-- ------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------
-- force, not just enable: without it the table owner skips its own
-- policies. (service_role still bypasses, as it should.)

alter table public.staff        enable row level security;
alter table public.staff        force  row level security;
alter table public.sites        enable row level security;
alter table public.sites        force  row level security;
alter table public.site_members enable row level security;
alter table public.site_members force  row level security;

-- --- staff: you can see whether you're staff, and that's all ---
drop policy if exists staff_read_self on public.staff;
create policy staff_read_self on public.staff for select to authenticated
  using (user_id = auth.uid());

-- --- sites: editors read theirs; only staff create or change them ---
drop policy if exists sites_read on public.sites;
create policy sites_read on public.sites for select to authenticated
  using (id in (select public.auth_site_ids()));

drop policy if exists sites_staff_write on public.sites;
create policy sites_staff_write on public.sites for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- --- members: you see your own memberships; staff see and manage all ---
drop policy if exists members_read on public.site_members;
create policy members_read on public.site_members for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists members_staff_write on public.site_members;
create policy members_staff_write on public.site_members for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ------------------------------------------------------------
-- 4. Grants
-- ------------------------------------------------------------
-- Supabase's defaults hand anon everything in public. Visitors have no
-- business with any of these three tables, so take it all back. Signed-in
-- users get the verbs; the policies above decide the rows.

revoke all on public.staff, public.sites, public.site_members from anon, authenticated;
grant select                         on public.staff        to authenticated;
grant select, insert, update, delete on public.sites        to authenticated;
grant select, insert, update, delete on public.site_members to authenticated;

select
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('staff', 'sites', 'site_members')) as tenancy_policies;
