-- ============================================================
-- 0006 — FORMS: contact and sign-up submissions
-- ============================================================
-- A submission is a row before it is an email (Ennyn's support rule): the
-- site's API route calls submit_form() first and only then sends the
-- Resend notification, so a failed send never loses an enquiry. The client
-- sees every submission in the dashboard either way.
--
-- Visitors can't insert into the table. They can only call submit_form(),
-- which checks the site is live and caps the rate. Honeypot and timing
-- checks belong in the site's route, before this is called.

create table if not exists public.form_submissions (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references public.sites (id) on delete cascade,
  form_key   text not null check (form_key ~ '^[a-z0-9_]+$'),   -- "contact", "handbook_signup"
  data       jsonb not null
               check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 10000),
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists form_submissions_site_idx
  on public.form_submissions (site_id, created_at desc);

-- ------------------------------------------------------------
-- 1. The only way in
-- ------------------------------------------------------------
-- The cap is per site: 30 in ten minutes is far above what a small
-- business's site receives, and low enough that a bot can't fill the table.
-- The trade-off: a flood blocks real submissions for those ten minutes.
-- Raise it per site if one ever needs more.

create or replace function public.submit_form(p_site uuid, p_form text, p_data jsonb)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.sites where id = p_site and status = 'active') then
    raise exception 'Unknown site' using errcode = '22023';
  end if;

  if (select count(*) from public.form_submissions
       where site_id = p_site and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many submissions, please try again shortly' using errcode = '54000';
  end if;

  insert into public.form_submissions (site_id, form_key, data)
  values (p_site, p_form, p_data)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.submit_form(uuid, text, jsonb) from public;
grant execute on function public.submit_form(uuid, text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. Row Level Security and grants
-- ------------------------------------------------------------
-- Editors read, mark as read, and delete (GDPR requests). They can't
-- insert or alter what someone submitted — the column grant allows
-- updating is_read and nothing else.

alter table public.form_submissions enable row level security;
alter table public.form_submissions force  row level security;

drop policy if exists submissions_read on public.form_submissions;
create policy submissions_read on public.form_submissions for select to authenticated
  using (site_id in (select public.auth_site_ids()));

drop policy if exists submissions_mark_read on public.form_submissions;
create policy submissions_mark_read on public.form_submissions for update to authenticated
  using (site_id in (select public.auth_site_ids()))
  with check (site_id in (select public.auth_site_ids()));

drop policy if exists submissions_delete on public.form_submissions;
create policy submissions_delete on public.form_submissions for delete to authenticated
  using (site_id in (select public.auth_site_ids()));

revoke all on public.form_submissions from anon, authenticated;
grant select, delete      on public.form_submissions to authenticated;
grant update (is_read)    on public.form_submissions to authenticated;

select
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'form_submissions') as form_policies;
