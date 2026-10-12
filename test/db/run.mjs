// ============================================================
// DATABASE TESTS — tenant isolation and publishing rules
// ============================================================
// Builds the schema from scratch in PGlite (real Postgres, in-process, no
// Docker), applies every file in supabase/migrations twice to prove they're
// re-runnable, seeds two client sites, then checks that nobody can reach
// what isn't theirs.
//
//   npm run test:db
//
// Exits non-zero on any failure, so it can gate a merge. Run it before
// changing any policy, grant, or site_id column.

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

// --- people and sites -------------------------------------------------------
const STAFF   = '00000000-0000-0000-0000-00000000000a'; // Jorvik Web Dev
const KIRSTY  = '00000000-0000-0000-0000-00000000000b'; // edits site 1
const OTHER   = '00000000-0000-0000-0000-00000000000c'; // edits site 2
const NOBODY  = '00000000-0000-0000-0000-00000000000d'; // signed in, no sites
const SITE1   = '11111111-1111-1111-1111-111111111111';
const SITE2   = '22222222-2222-2222-2222-222222222222';
const MEDIA1  = '11111111-0000-0000-0000-0000000000a1';
const MEDIA2  = '22222222-0000-0000-0000-0000000000a2';

const db = await PGlite.create();
let passed = 0;
const failures = [];

// --- helpers ----------------------------------------------------------------

// Run a query as someone. Each call is its own transaction; a thrown error
// rolls it back, so a refused write can't leak into the next test.
async function as(who, sql, params = []) {
  return db.transaction(async (tx) => {
    if (who === 'anon') {
      await tx.exec('set local role anon');
    } else {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [who]);
      await tx.exec('set local role authenticated');
    }
    return (await tx.query(sql, params)).rows;
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}

function equal(actual, expected, what = 'value') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

async function refused(promise, pattern) {
  try {
    await promise;
  } catch (err) {
    if (pattern && !pattern.test(err.message)) {
      throw new Error(`refused, but for the wrong reason: ${err.message}`);
    }
    return;
  }
  throw new Error('expected this to be refused, but it succeeded');
}

const count = async (who, sql, params) => Number((await as(who, sql, params))[0].n);

// --- build ------------------------------------------------------------------

console.log('\nBuilding schema');
await db.exec(readFileSync(join(ROOT, 'test', 'db', 'shim.sql'), 'utf8'));

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
for (const pass of [1, 2]) {
  for (const f of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
    } catch (err) {
      console.error(`\nMigration failed on pass ${pass}: ${f}\n${err.message}`);
      process.exit(1);
    }
  }
  console.log(`  pass ${pass}: ${files.length} migrations applied cleanly`);
}

// --- seed (as the database owner, like the SQL editor) ----------------------

await db.exec(`
  insert into auth.users (id, email) values
    ('${STAFF}',  'staff@example.test'),
    ('${KIRSTY}', 'kirsty@example.test'),
    ('${OTHER}',  'other@example.test'),
    ('${NOBODY}', 'nobody@example.test');
  insert into public.staff (user_id) values ('${STAFF}');
  insert into public.sites (id, slug, name) values
    ('${SITE1}', 'feel-good-menopause', 'Feel Good Menopause'),
    ('${SITE2}', 'another-client',      'Another Client');
  insert into public.site_members (site_id, user_id) values
    ('${SITE1}', '${KIRSTY}'),
    ('${SITE2}', '${OTHER}');
  insert into public.media (id, site_id, path, alt) values
    ('${MEDIA1}', '${SITE1}', '${SITE1}/hero.jpg', 'Kirsty smiling'),
    ('${MEDIA2}', '${SITE2}', '${SITE2}/logo.png', 'Logo');
  insert into public.content_fields (site_id, key, page, label, type, max_length, draft_value, published_value) values
    ('${SITE1}', 'home.hero.title', 'Home', 'Headline', 'text', 60,
       '"Empower, Educate, Embrace"', '"Empower, Educate, Embrace"'),
    ('${SITE1}', 'home.hero.image', 'Home', 'Hero image', 'image', null, null, null),
    ('${SITE1}', 'home.cta',        'Home', 'Button',     'link', null, null, null),
    ('${SITE2}', 'home.hero.title', 'Home', 'Headline',   'text', null, '"Secret draft"', '"Live"');
  insert into public.lists (id, site_id, key, label) values
    ('11111111-0000-0000-0000-0000000000b1', '${SITE1}', 'testimonials', 'Testimonials');
  insert into public.list_items (site_id, list_id, data, is_published) values
    ('${SITE1}', '11111111-0000-0000-0000-0000000000b1', '{"name":"Helen"}', true),
    ('${SITE1}', '11111111-0000-0000-0000-0000000000b1', '{"name":"Hidden"}', false);
  insert into public.posts (site_id, slug, title, status, published_at) values
    ('${SITE1}', 'live-post',      'Live',      'published', now() - interval '1 day'),
    ('${SITE1}', 'scheduled-post', 'Scheduled', 'published', now() + interval '7 days'),
    ('${SITE1}', 'draft-post',     'Draft',     'draft',     null),
    ('${SITE2}', 'their-post',     'Theirs',    'published', now() - interval '1 day');
  insert into public.events (site_id, slug, title, starts_at, status) values
    ('${SITE1}', 'menopause-cafe', 'Menopause Café', now() + interval '3 days', 'published'),
    ('${SITE1}', 'draft-event',    'Draft event',    now() + interval '9 days', 'draft');
`);

// --- tests ------------------------------------------------------------------

console.log('\nTenancy');

await test('an editor sees only their own site', async () => {
  equal(await as(KIRSTY, 'select slug from sites order by slug'), [{ slug: 'feel-good-menopause' }]);
});

await test('staff see every site', async () => {
  equal(await count(STAFF, 'select count(*) n from sites'), 2);
});

await test('a signed-in user with no membership sees nothing', async () => {
  equal(await count(NOBODY, 'select count(*) n from sites'), 0);
  equal(await count(NOBODY, 'select count(*) n from content_fields'), 0);
  equal(await count(NOBODY, 'select count(*) n from posts'), 0);
});

await test('an editor cannot add themselves to another site', async () => {
  await refused(as(KIRSTY, `insert into site_members (site_id, user_id) values ($1, $2)`, [SITE2, KIRSTY]),
    /row-level security/);
});

await test('an editor cannot rename their site', async () => {
  equal(await as(KIRSTY, `update sites set name = 'Mine now' where id = $1 returning id`, [SITE1]), []);
});

await test('an editor cannot make themselves staff', async () => {
  await refused(as(KIRSTY, `insert into staff (user_id) values ($1)`, [KIRSTY]), /permission denied/);
});

console.log('\nPage content');

await test("an editor cannot read another site's fields", async () => {
  equal(await count(KIRSTY, `select count(*) n from content_fields where site_id = $1`, [SITE2]), 0);
});

await test('an editor can change a draft', async () => {
  const rows = await as(KIRSTY,
    `update content_fields set draft_value = '"Feel good again"'
      where site_id = $1 and key = 'home.hero.title' returning key`, [SITE1]);
  equal(rows.length, 1, 'rows updated');
});

await test("an editor cannot change a field's label or type", async () => {
  await refused(as(KIRSTY,
    `update content_fields set label = 'Renamed' where site_id = $1 and key = 'home.hero.title'`, [SITE1]),
    /only be changed by Jorvik/);
});

await test('an editor cannot publish a value that skipped the draft', async () => {
  await refused(as(KIRSTY,
    `update content_fields set published_value = '"Sneaky"' where site_id = $1 and key = 'home.hero.title'`, [SITE1]),
    /copies the draft/);
});

await test('a value of the wrong shape is refused', async () => {
  await refused(as(KIRSTY,
    `update content_fields set draft_value = '{"not":"a string"}' where site_id = $1 and key = 'home.hero.title'`, [SITE1]),
    /content_draft_shape/);
});

await test('text longer than max_length is refused', async () => {
  await refused(as(KIRSTY,
    `update content_fields set draft_value = to_jsonb(repeat('x', 61)) where site_id = $1 and key = 'home.hero.title'`, [SITE1]),
    /content_draft_shape/);
});

await test('a javascript: link is refused', async () => {
  await refused(as(KIRSTY,
    `update content_fields set draft_value = '{"label":"Hi","href":"javascript:alert(1)"}'
      where site_id = $1 and key = 'home.cta'`, [SITE1]),
    /content_draft_shape/);
});

await test("an image from another site's folder is refused", async () => {
  await refused(as(KIRSTY,
    `update content_fields set draft_value = jsonb_build_object('media_id', $2::text, 'path', $3::text, 'alt', 'x')
      where site_id = $1 and key = 'home.hero.image'`, [SITE1, MEDIA2, `${SITE2}/logo.png`]),
    /content_draft_shape/);
});

await test('publishing copies drafts live and records a revision', async () => {
  const [{ n }] = await as(KIRSTY, `select publish_content($1) as n`, [SITE1]);
  equal(n, 1, 'fields published');
  const [field] = await as('anon',
    `select published_value from content_fields where site_id = $1 and key = 'home.hero.title'`, [SITE1]);
  equal(field.published_value, 'Feel good again');
  equal(await count(KIRSTY, `select count(*) n from content_revisions where site_id = $1`, [SITE1]), 1);
});

await test("publishing another site's id changes nothing", async () => {
  const [{ n }] = await as(KIRSTY, `select publish_content($1) as n`, [SITE2]);
  equal(n, 0, 'fields published');
});

await test('an editor cannot write revisions directly', async () => {
  await refused(as(KIRSTY,
    `insert into content_revisions (site_id, field_id, value)
      select site_id, id, '"forged"' from content_fields where site_id = $1 limit 1`, [SITE1]),
    /permission denied/);
});

await test('an editor cannot create or delete fields', async () => {
  await refused(as(KIRSTY,
    `insert into content_fields (site_id, key, page, label, type) values ($1, 'new.field', 'Home', 'New', 'text')`, [SITE1]),
    /row-level security/);
  equal(await as(KIRSTY, `delete from content_fields where site_id = $1 returning id`, [SITE1]), []);
});

await test('staff can create fields', async () => {
  const rows = await as(STAFF,
    `insert into content_fields (site_id, key, page, label, type) values ($1, 'about.intro', 'About', 'Intro', 'long_text') returning id`, [SITE1]);
  equal(rows.length, 1);
});

console.log('\nVisitors');

await test('visitors cannot read draft values', async () => {
  await refused(as('anon', `select draft_value from content_fields`), /permission denied/);
});

await test('visitors see published fields only', async () => {
  // home.hero.image and home.cta have never been published.
  equal(await count('anon', `select count(site_id) n from content_fields where site_id = $1`, [SITE1]), 1);
});

await test('visitors see live posts, not drafts or scheduled ones', async () => {
  equal(await as('anon', `select slug from posts where site_id = $1 order by slug`, [SITE1]),
    [{ slug: 'live-post' }]);
});

await test('visitors see published events only', async () => {
  equal(await as('anon', `select slug from events where site_id = $1`, [SITE1]),
    [{ slug: 'menopause-cafe' }]);
});

await test('visitors see published list items only', async () => {
  equal(await as('anon', `select data->>'name' as name from list_items`), [{ name: 'Helen' }]);
});

await test('visitors cannot write anything', async () => {
  await refused(as('anon', `insert into posts (site_id, slug, title) values ($1, 'x', 'x')`, [SITE1]), /permission denied/);
  await refused(as('anon', `update media set alt = 'x'`), /permission denied/);
  await refused(as('anon', `delete from list_items`), /permission denied/);
});

await test('visitors cannot call staff helpers', async () => {
  await refused(as('anon', `select public.auth_site_ids()`), /permission denied/);
});

console.log('\nPosts, events and media');

await test("a post cannot use another site's image as its cover", async () => {
  await refused(as(KIRSTY,
    `insert into posts (site_id, slug, title, cover_media_id) values ($1, 'stolen', 'x', $2)`, [SITE1, MEDIA2]),
    /foreign key/);
});

await test('a post can use its own site\'s image', async () => {
  const rows = await as(KIRSTY,
    `insert into posts (site_id, slug, title, cover_media_id) values ($1, 'with-cover', 'x', $2) returning id`, [SITE1, MEDIA1]);
  equal(rows.length, 1);
});

await test('deleting an image clears the cover, not the post', async () => {
  await as(KIRSTY, `delete from media where id = $1`, [MEDIA1]);
  const [post] = await as(KIRSTY, `select site_id, cover_media_id from posts where slug = 'with-cover'`);
  equal(post, { site_id: SITE1, cover_media_id: null });
});

await test('publishing a post stamps published_at', async () => {
  const [post] = await as(KIRSTY,
    `insert into posts (site_id, slug, title, status) values ($1, 'now-live', 'x', 'published')
      returning published_at is not null as stamped, updated_by`, [SITE1]);
  equal(post, { stamped: true, updated_by: KIRSTY });
});

await test('an editor cannot create a post on another site', async () => {
  await refused(as(KIRSTY, `insert into posts (site_id, slug, title) values ($1, 'x', 'x')`, [SITE2]),
    /row-level security/);
});

await test('an event cannot end before it starts', async () => {
  await refused(as(KIRSTY,
    `insert into events (site_id, slug, title, starts_at, ends_at) values ($1, 'x', 'x', now(), now() - interval '1 hour')`, [SITE1]),
    /events_end_after_start/);
});

await test("a media row cannot point into another site's folder", async () => {
  await refused(as(KIRSTY,
    `insert into media (site_id, path) values ($1, $2)`, [SITE1, `${SITE2}/sneaky.jpg`]),
    /media_path_in_site/);
});

console.log('\nStorage');

await test('an editor can upload to their own site folder', async () => {
  const rows = await as(KIRSTY,
    `insert into storage.objects (bucket_id, name) values ('site-media', $1) returning id`, [`${SITE1}/new.jpg`]);
  equal(rows.length, 1);
});

await test("an editor cannot upload to another site's folder", async () => {
  await refused(as(KIRSTY,
    `insert into storage.objects (bucket_id, name) values ('site-media', $1)`, [`${SITE2}/new.jpg`]),
    /row-level security/);
});

await test("an editor cannot list another site's files", async () => {
  await db.exec(`insert into storage.objects (bucket_id, name) values ('site-media', '${SITE2}/theirs.jpg')`);
  equal(await count(KIRSTY, `select count(*) n from storage.objects where name like $1`, [`${SITE2}/%`]), 0);
});

console.log('\nForms');

await test('visitors cannot insert submissions directly', async () => {
  await refused(as('anon',
    `insert into form_submissions (site_id, form_key, data) values ($1, 'contact', '{}')`, [SITE1]),
    /permission denied/);
});

await test('visitors can submit through submit_form', async () => {
  const [row] = await as('anon',
    `select submit_form($1, 'handbook_signup', '{"name":"Jo","email":"jo@example.test"}') as id`, [SITE1]);
  if (!row.id) throw new Error('no id returned');
});

await test('a submission to an unknown site is refused', async () => {
  await refused(as('anon',
    `select submit_form('99999999-9999-9999-9999-999999999999', 'contact', '{}')`), /Unknown site/);
});

await test('editors see their own submissions only', async () => {
  equal(await count(KIRSTY, `select count(*) n from form_submissions`), 1);
  equal(await count(OTHER,  `select count(*) n from form_submissions`), 0);
});

await test('an editor can mark a submission read but not edit it', async () => {
  const rows = await as(KIRSTY, `update form_submissions set is_read = true returning id`);
  equal(rows.length, 1);
  await refused(as(KIRSTY, `update form_submissions set data = '{}'`), /permission denied/);
});

await test('submissions are rate limited per site', async () => {
  for (let i = 0; i < 29; i++) {
    await as('anon', `select submit_form($1, 'contact', '{}')`, [SITE1]);
  }
  await refused(as('anon', `select submit_form($1, 'contact', '{}')`, [SITE1]), /Too many/);
  // Another site is unaffected.
  await as('anon', `select submit_form($1, 'contact', '{}')`, [SITE2]);
});

console.log('\nInvites');

await test('staff can list a site\'s editors with their emails', async () => {
  equal(await as(STAFF, `select email from site_editors($1)`, [SITE1]), [{ email: 'kirsty@example.test' }]);
});

await test('an editor gets no editor list, even for their own site', async () => {
  equal(await as(KIRSTY, `select email from site_editors($1)`, [SITE1]), []);
});

await test('only the server can look up an account by email', async () => {
  await refused(as(STAFF, `select auth_user_id_for_email('kirsty@example.test')`), /permission denied/);
  await refused(as('anon', `select auth_user_id_for_email('kirsty@example.test')`), /permission denied/);
});

console.log('\nHealth');

await test('platform_health reads ok on every row', async () => {
  const rows = (await db.query('select * from public.platform_health')).rows;
  const bad = rows.filter((r) => r.result !== 'ok');
  if (bad.length) throw new Error(bad.map((r) => `${r.check}: ${r.result}`).join('; '));
});

console.log('\nSite setup files');

// Each file in supabase/sites defines one client's editable fields. The
// test database's first site has the feel-good-menopause slug, so its file
// applies to that; any other file just needs to apply without error once a
// site with its slug exists.
const SITE_FILES = join(ROOT, 'supabase', 'sites');
for (const f of readdirSync(SITE_FILES).filter((f) => f.endsWith('.sql')).sort()) {
  await test(`${f} applies twice and keeps what the client wrote`, async () => {
    const before = await db.query(
      `select key, draft_value, published_value from content_fields where site_id = $1 order by key`, [SITE1]);
    const sql = readFileSync(join(SITE_FILES, f), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    for (const row of before.rows) {
      const [after] = (await db.query(
        `select draft_value, published_value from content_fields where site_id = $1 and key = $2`, [SITE1, row.key])).rows;
      equal(after, { draft_value: row.draft_value, published_value: row.published_value }, row.key);
    }
  });
}

await test('the Feel Good Menopause setup puts every list on a page', async () => {
  equal(await count(STAFF, `select count(*) n from lists where site_id = $1 and page is null`, [SITE1]), 0);
});

// --- result -----------------------------------------------------------------

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
