-- ============================================================
-- 0008 — INVITES: finding people by email, listing a site's editors
-- ============================================================
-- Two things the dashboard's invite screen needs that RLS alone can't give
-- it, because both read auth.users, which no API role can see.
--
-- 1. auth_user_id_for_email(): does this address already have an account?
--    One person can edit two sites, and auth users are unique by email, so
--    inviting an existing address must attach a membership rather than fail.
--    Server only — service_role, never a browser — because "is this email
--    registered" is exactly what a stranger shouldn't be able to ask.
--
-- 2. site_editors(): who can edit this site, by email, and have they ever
--    signed in. Staff only, checked inside the function.

create or replace function public.auth_user_id_for_email(addr text)
returns uuid language sql stable security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(addr) limit 1
$$;

revoke all on function public.auth_user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_for_email(text) to service_role;

create or replace function public.site_editors(p_site uuid)
returns table (user_id uuid, email text, added_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer
set search_path = public, auth
as $$
  select m.user_id, u.email::text, m.created_at, u.last_sign_in_at
  from public.site_members m
  join auth.users u on u.id = m.user_id
  where m.site_id = p_site
    and public.is_staff()
  order by m.created_at
$$;

revoke all on function public.site_editors(uuid) from public, anon;
grant execute on function public.site_editors(uuid) to authenticated;

select
  (select count(*) from pg_proc where proname = 'auth_user_id_for_email') as lookup_fn,
  (select count(*) from pg_proc where proname = 'site_editors')           as editors_fn;
