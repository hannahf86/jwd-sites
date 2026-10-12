-- ============================================================
-- 0010 — FIELD GUARD: trust the SQL editor
-- ============================================================
-- The guard from 0003 asked one question — "is this staff?" — and answered
-- it with is_staff(), which looks up auth.uid(). In the SQL editor there is
-- no signed-in user, so auth.uid() is null and the answer was no: re-running
-- a site setup file to rename a label failed with "Field settings can only
-- be changed by Jorvik Web Dev". Caught by the test that runs every file in
-- supabase/sites twice.
--
-- The guard exists to stop dashboard users. Those always arrive through the
-- API as the `authenticated` role (or `anon`). Anyone connected as another
-- role — postgres in the SQL editor, service_role on the server — already
-- holds the keys to the whole database, so the guard now only applies to
-- the two API roles. current_user is the caller's role because the trigger
-- function is not security definer.

create or replace function public.content_fields_guard()
returns trigger language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_staff() then
    if (new.site_id, new.key, new.page, new.section, new.label, new.help,
        new.type, new.max_length, new.sort_order)
       is distinct from
       (old.site_id, old.key, old.page, old.section, old.label, old.help,
        old.type, old.max_length, old.sort_order)
    then
      raise exception 'Field settings can only be changed by Jorvik Web Dev'
        using errcode = '42501';
    end if;

    if new.published_value is distinct from old.published_value
       and new.published_value is distinct from new.draft_value
    then
      raise exception 'Publishing copies the draft; it cannot set a different value'
        using errcode = '42501';
    end if;
  end if;

  if new.published_value is distinct from old.published_value then
    new.published_at := now();
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

revoke all on function public.content_fields_guard() from public, anon;

select 'content_fields_guard updated' as result;
