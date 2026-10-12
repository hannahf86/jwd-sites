-- ============================================================
-- 0003 — PAGE CONTENT: editable text and images, draft → publish
-- ============================================================
-- This is how a client edits "the text and images" without a page builder.
--
-- Each site's code decides which bits of a page are editable and gives each
-- one a key — `home.hero.title`, `about.story.image`. Staff create a row per
-- key here (the definition: label, type, help text), and the dashboard
-- builds its edit forms from those rows. Clients only ever change values.
--
-- Every field has two values:
--   draft_value      what the client is working on — never shown publicly
--   published_value  what the live site renders
-- Publishing copies draft to published, and each publish is kept in
-- content_revisions so "I broke the homepage" has an undo.

-- ------------------------------------------------------------
-- 1. What a valid value looks like, per field type
-- ------------------------------------------------------------
-- The form is never the boundary: the database refuses a value of the
-- wrong shape whatever sent it.
--
--   text, long_text  a JSON string, within max_length if set
--   rich_text        a Tiptap document: {"type":"doc", ...}
--   image            {"media_id", "path", "alt"} — path inside this site
--   link             {"label", "href"} — http(s), relative, mailto or tel.
--                    Not javascript:, which is what this check is for.

create or replace function public.content_value_ok(
  p_type text, p_value jsonb, p_max integer, p_site uuid
)
returns boolean language sql immutable
as $$
  select p_value is null or case p_type
    when 'text' then
      jsonb_typeof(p_value) = 'string'
      and (p_max is null or char_length(p_value #>> '{}') <= p_max)
    when 'long_text' then
      jsonb_typeof(p_value) = 'string'
      and (p_max is null or char_length(p_value #>> '{}') <= p_max)
    when 'rich_text' then
      jsonb_typeof(p_value) = 'object' and p_value ->> 'type' = 'doc'
    when 'image' then
      jsonb_typeof(p_value) = 'object'
      and split_part(p_value ->> 'path', '/', 1) = p_site::text
      and jsonb_typeof(coalesce(p_value -> 'alt', '""'::jsonb)) = 'string'
    when 'link' then
      jsonb_typeof(p_value) = 'object'
      and (p_value ->> 'href') ~ '^(https?://|/|#|mailto:|tel:)'
    else false
  end
$$;

-- ------------------------------------------------------------
-- 2. Fields
-- ------------------------------------------------------------

create table if not exists public.content_fields (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites (id) on delete cascade,

  -- Definition: staff only (enforced by the guard trigger below).
  key             text not null check (key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  page            text not null,               -- dashboard grouping: "Home"
  section         text,                        -- "Hero"
  label           text not null,               -- "Headline"
  help            text,                        -- shown under the input
  type            text not null
                    check (type in ('text', 'long_text', 'rich_text', 'image', 'link')),
  max_length      integer check (max_length > 0),
  sort_order      integer not null default 0,

  -- Values: what clients edit.
  draft_value     jsonb,
  published_value jsonb,
  published_at    timestamptz,

  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null default auth.uid(),

  unique (site_id, key),
  unique (id, site_id),
  constraint content_draft_shape
    check (public.content_value_ok(type, draft_value, max_length, site_id)),
  constraint content_published_shape
    check (public.content_value_ok(type, published_value, max_length, site_id))
);

create index if not exists content_fields_page_idx
  on public.content_fields (site_id, page, sort_order);

-- ------------------------------------------------------------
-- 3. The guard: what an editor may change
-- ------------------------------------------------------------
-- Editors and staff are both `authenticated`, so column grants can't tell
-- them apart. This trigger can.
--
-- An editor may change draft_value, and may change published_value only to
-- what the draft says — that is, publish. They can't rename a field, change
-- its type, or write a live value that skipped the draft.

create or replace function public.content_fields_guard()
returns trigger language plpgsql
as $$
begin
  if not public.is_staff() then
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

drop trigger if exists content_fields_guard on public.content_fields;
create trigger content_fields_guard before update on public.content_fields
  for each row execute function public.content_fields_guard();

-- ------------------------------------------------------------
-- 4. Revisions: every published value, kept
-- ------------------------------------------------------------
-- Written by trigger only. Restoring one means copying it back into the
-- draft and publishing again, so a restore is itself a revision.

create table if not exists public.content_revisions (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null,
  field_id     uuid not null,
  value        jsonb,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,

  foreign key (field_id, site_id)
    references public.content_fields (id, site_id) on delete cascade
);

create index if not exists content_revisions_field_idx
  on public.content_revisions (field_id, published_at desc);

-- security definer: editors can't insert into this table themselves, but
-- publishing must still leave a record.
create or replace function public.content_fields_record_revision()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.content_revisions (site_id, field_id, value, published_by)
  values (new.site_id, new.id, new.published_value, auth.uid());
  return null;
end $$;

drop trigger if exists content_fields_revision on public.content_fields;
create trigger content_fields_revision
  after update of published_value on public.content_fields
  for each row
  when (new.published_value is distinct from old.published_value)
  execute function public.content_fields_record_revision();

-- ------------------------------------------------------------
-- 5. Publish
-- ------------------------------------------------------------
-- Security invoker: runs as the caller, so RLS decides which rows it can
-- touch. Another site's id updates nothing. An empty draft is skipped
-- rather than published, so a half-finished edit can't blank the live page.
-- Pass keys to publish some fields; leave it null to publish the site.

create or replace function public.publish_content(p_site uuid, p_keys text[] default null)
returns integer language plpgsql security invoker
set search_path = public
as $$
declare n integer;
begin
  update public.content_fields
     set published_value = draft_value
   where site_id = p_site
     and draft_value is not null
     and draft_value is distinct from published_value
     and (p_keys is null or key = any (p_keys));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.content_value_ok(text, jsonb, integer, uuid) from public, anon;
revoke all on function public.content_fields_guard()                        from public, anon;
revoke all on function public.content_fields_record_revision()              from public, anon, authenticated;
revoke all on function public.publish_content(uuid, text[])                 from public, anon;
grant execute on function public.content_value_ok(text, jsonb, integer, uuid) to authenticated;
grant execute on function public.publish_content(uuid, text[])                 to authenticated;

-- ------------------------------------------------------------
-- 6. Row Level Security and grants
-- ------------------------------------------------------------

alter table public.content_fields    enable row level security;
alter table public.content_fields    force  row level security;
alter table public.content_revisions enable row level security;
alter table public.content_revisions force  row level security;

-- Editors read and update their sites' fields. Creating and deleting fields
-- is setup work, so staff only.
drop policy if exists content_read on public.content_fields;
create policy content_read on public.content_fields for select to authenticated
  using (site_id in (select public.auth_site_ids()));

drop policy if exists content_update on public.content_fields;
create policy content_update on public.content_fields for update to authenticated
  using (site_id in (select public.auth_site_ids()))
  with check (site_id in (select public.auth_site_ids()));

drop policy if exists content_staff_insert on public.content_fields;
create policy content_staff_insert on public.content_fields for insert to authenticated
  with check (public.is_staff());

drop policy if exists content_staff_delete on public.content_fields;
create policy content_staff_delete on public.content_fields for delete to authenticated
  using (public.is_staff());

-- Visitors: published fields only, and only the published columns. The
-- column grant is what keeps drafts private — RLS filters rows, not
-- columns. A public site must name its columns; `select=*` is refused.
drop policy if exists content_public_read on public.content_fields;
create policy content_public_read on public.content_fields for select to anon
  using (published_value is not null);

drop policy if exists revisions_read on public.content_revisions;
create policy revisions_read on public.content_revisions for select to authenticated
  using (site_id in (select public.auth_site_ids()));

revoke all on public.content_fields, public.content_revisions from anon, authenticated;
grant select (site_id, key, type, published_value, published_at)
  on public.content_fields to anon;
grant select, insert, update, delete on public.content_fields    to authenticated;
grant select                         on public.content_revisions to authenticated;

select
  (select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in ('content_fields', 'content_revisions')) as content_policies;
