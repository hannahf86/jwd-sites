-- ============================================================
-- 0009 — LIST PLACEMENT: which page and section a list sits on
-- ============================================================
-- A client editing the Home page expects to find the testimonials there,
-- not in a separate "Lists" area. Lists now carry the same page/section
-- grouping as content_fields, so the Pages editor can show each list in
-- the section it belongs to. Null page means "not on a particular page".
--
-- Definition columns, so staff only: the lists_staff_write policy from
-- 0004 already limits every write on this table to staff.

alter table public.lists add column if not exists page    text;
alter table public.lists add column if not exists section text;

create index if not exists lists_page_idx on public.lists (site_id, page, sort_order);

select count(*) as lists_with_page_column
from information_schema.columns
where table_schema = 'public' and table_name = 'lists' and column_name in ('page', 'section');
