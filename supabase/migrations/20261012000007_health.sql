-- ============================================================
-- 0007 — HEALTH CHECK
-- ============================================================
-- One query that says whether the boundary is still standing:
--
--   select * from public.platform_health;
--
-- Every row should read `ok`. Run it after any migration. It checks the
-- mistakes that are easy to make and silent when made: a new table without
-- RLS, RLS enabled but not forced, or Supabase's default grants quietly
-- giving visitors write access.

create or replace view public.platform_health as
with tables as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
)
select 'rls enabled on every table' as check,
       coalesce('FAIL: ' || string_agg(relname, ', ') filter (where not relrowsecurity), 'ok') as result
from tables
union all
select 'rls forced on every table',
       coalesce('FAIL: ' || string_agg(relname, ', ') filter (where not relforcerowsecurity), 'ok')
from tables
union all
select 'visitors cannot write any table',
       coalesce('FAIL: ' || string_agg(relname, ', ') filter (
         where has_table_privilege('anon', oid, 'INSERT')
            or has_table_privilege('anon', oid, 'UPDATE')
            or has_table_privilege('anon', oid, 'DELETE')
            or has_table_privilege('anon', oid, 'TRUNCATE')), 'ok')
from tables
union all
select 'visitors cannot read drafts',
       case when has_column_privilege('anon', 'public.content_fields', 'draft_value', 'SELECT')
            then 'FAIL: anon can select content_fields.draft_value' else 'ok' end
union all
select 'media bucket is public, and has no SVG',
       case when exists (select 1 from storage.buckets
                         where id = 'site-media' and public
                           and not ('image/svg+xml' = any (allowed_mime_types)))
            then 'ok' else 'FAIL: check the site-media bucket' end;

revoke all on public.platform_health from public, anon, authenticated;

select * from public.platform_health;
