# JWD Sites

The shared backend (and soon the dashboard) for Jorvik Web Dev's hosted
client websites. One Supabase project serves every client site; each site
is a row in `sites`, and Postgres row-level security keeps every client's
content to themselves.

## How the pieces fit

| Who | How they connect | What they can do |
|---|---|---|
| **Staff** (JWD) | Dashboard, signed in | Everything on every site: create sites, define editable fields and lists, invite editors |
| **Editor** (a client) | Dashboard, signed in | Edit content, posts, events, media and lists on their own sites; read their form submissions |
| **Visitor** | Public site, anon key | Read published content; submit forms through `submit_form()` |

Each client site is its own Next.js repo with its own design. It knows its
`SITE_ID` from an env var and reads published content with the public anon
key. It never holds the service-role key: a compromised client site must not
be able to reach any other client.

## The schema

| Migration | What it adds |
|---|---|
| `0001_tenancy` | `sites`, `staff`, `site_members`, and the `is_staff()` / `auth_site_ids()` helpers every policy uses |
| `0002_media` | `media` library and the public `site-media` bucket (`{site_id}/{file}`) |
| `0003_page_content` | `content_fields` (editable text/images with draft and published values), `content_revisions`, `publish_content()` |
| `0004_lists` | `lists` and `list_items`: testimonials, logos, stats, FAQs |
| `0005_posts_events` | `posts` and `events`, with scheduling via `published_at` |
| `0006_forms` | `form_submissions` and `submit_form()` |
| `0007_health` | `platform_health`, which checks the boundary is still standing |

Rules worth knowing before writing code against it:

- **Public sites must name their columns on `content_fields`.** Visitors are
  granted the published columns only, which is what keeps drafts private.
  `select=*` as anon is refused.
- **Content values are JSON with a shape per type**, checked by the
  database: text is a JSON string, rich text is a Tiptap doc, an image is
  `{media_id, path, alt}`, a link is `{label, href}`.
- **Editors change values; staff change definitions.** A trigger refuses an
  editor renaming a field or changing its type.
- **Something is live when `status = 'published' and published_at <= now()`.**
  A future `published_at` schedules it.
- **Render Tiptap bodies through a sanitiser** that drops `javascript:`
  hrefs. The database checks the document's shape, not every link in it.
- **Anything pointing at a site-owned row uses a composite foreign key**,
  `(x_id, site_id)`, so a row can never belong to two sites.

## Setting up Supabase

1. Create the organisation and a project. **Region: London (eu-west-2).**
   Upgrade the org to Pro before real clients go on it. Free projects
   pause after a week without activity.
2. **Authentication → Sign In / Providers:** turn **off** "Allow new users
   to sign up". Editors are invited, never self-registered.
3. **Authentication → SMTP:** set up custom SMTP through Resend, so
   invite and reset emails come from a JWD address.
4. **SQL editor:** run each file in `supabase/migrations` in filename
   order. Each one ends with a `select` that shows it worked. (Or link the
   project and run `supabase db push` with the Supabase CLI.)
5. Sign in to the project once (or invite yourself under Authentication →
   Users), then make yourself staff:

   ```sql
   insert into public.staff (user_id)
   select id from auth.users where email = 'hannah@jorvikweb.dev';
   ```

6. Check the boundary. Every row should read `ok`:

   ```sql
   select * from public.platform_health;
   ```

## Tests

```bash
npm install
npm run test:db
```

This builds the whole schema in PGlite (real Postgres, in-process, no
Docker), applies every migration **twice** to prove they're re-runnable,
and runs 43 isolation and publishing checks. Run it before changing any
policy, grant or `site_id` column, and add a test for any new table.

New migrations go in `supabase/migrations` with the next timestamp. Each one
explains *why* in its header, guards every statement so it can run twice,
and ends with a `select` that proves it worked.
