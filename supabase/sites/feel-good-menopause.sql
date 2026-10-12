-- ============================================================
-- SITE SETUP — Feel Good Menopause (feelgoodmenopause.co.uk)
-- ============================================================
-- What Kirsty can edit, page by page. Definitions only: labels, types,
-- help text and order. No wording — the current copy comes across when
-- the site itself is rebuilt, from the Webflow project.
--
-- Run in the SQL editor AFTER adding the site in the dashboard with the
-- short name `feel-good-menopause`. Re-runnable: running it again updates
-- labels, help and order, and never touches what Kirsty has written.
--
-- Keys are what the site's code asks for (`home.hero.title`), so renaming
-- a key here means changing the site too. Labels can change freely.
--
-- Not here, on purpose:
--   - The events (Walk & Talk, Menopause Café) — they're rows in `events`.
--   - Blog posts — rows in `posts`.
--   - Navigation and footer links — fixed in the site's code.
--   - Form field labels — fixed in code; only the messages are editable.

do $$
declare
  v_site uuid;
begin
  select id into v_site from public.sites where slug = 'feel-good-menopause';
  if v_site is null then
    raise exception 'Add the site in the dashboard first, with the short name feel-good-menopause';
  end if;

  -- ----------------------------------------------------------
  -- Page content fields
  -- ----------------------------------------------------------
  -- (key, page, section, label, type, max_length, help)
  -- Order on screen follows the order written here.

  insert into public.content_fields (site_id, key, page, section, label, type, max_length, help, sort_order)
  select v_site, f.key, f.page, f.section, f.label, f.type, f.max_length, f.help,
         (row_number() over ()) * 10  -- VALUES keeps the order written
  from (values
    -- === HOME ===============================================
    ('home.hero.title',          'Home', 'Top of the page', 'Big heading',              'text',      80,   'The large title at the very top, e.g. FEEL GOOD MENOPAUSE.'),
    ('home.hero.subtitle',       'Home', 'Top of the page', 'Subheading',               'text',      120,   'Under the title, e.g. Empower, Educate, Embrace.'),
    ('home.hero.strapline',      'Home', 'Top of the page', 'Small line under it',      'text',      160,   'A short line, e.g. Own your journey with a smile.'),
    ('home.hero.checklist',      'Home', 'Top of the page', 'Ticked list',              'long_text', 1000,  'One item per line. Each line gets a tick.'),
    ('home.hero.intro',          'Home', 'Top of the page', 'Introduction',             'rich_text', null, 'The paragraph introducing what you do.'),
    ('home.hero.slogan',         'Home', 'Top of the page', 'Slogan',                   'text',      160,  'The line above the buttons, e.g. Don''t be scared, be prepared!'),
    ('home.hero.primary_button', 'Home', 'Top of the page', 'Main button',              'link',      null, null),
    ('home.hero.second_button',  'Home', 'Top of the page', 'Second button',            'link',      null, null),
    ('home.hero.image',          'Home', 'Top of the page', 'Photo',                    'image',     null, 'A portrait photo works best.'),

    ('home.stats.eyebrow',       'Home', 'Statistics',      'Small heading',            'text',      80,   null),
    ('home.stats.title',         'Home', 'Statistics',      'Heading',                  'text',      120,   null),
    ('home.stats.image',         'Home', 'Statistics',      'Photo',                    'image',     null, null),

    ('home.wins.eyebrow',        'Home', 'Celebrate the wins', 'Small heading',         'text',      80,   null),
    ('home.wins.title',          'Home', 'Celebrate the wins', 'Heading',               'text',      120,   null),
    ('home.wins.intro',          'Home', 'Celebrate the wins', 'Introduction',          'rich_text', null, null),

    ('home.journey.title',       'Home', 'Caterpillar to butterfly', 'Heading',         'text',      160,   null),
    ('home.journey.body',        'Home', 'Caterpillar to butterfly', 'Text',            'rich_text', null, null),

    ('home.your_journey.title',  'Home', 'Your menopause, your journey', 'Heading',     'text',      120,   null),
    ('home.your_journey.body',   'Home', 'Your menopause, your journey', 'Text',        'rich_text', null, null),
    ('home.your_journey.button', 'Home', 'Your menopause, your journey', 'Button',      'link',      null, null),

    ('home.vision.eyebrow',      'Home', 'The Vision Method', 'Small heading',          'text',      80,   null),
    ('home.vision.title',        'Home', 'The Vision Method', 'Heading',                'text',      120,   null),
    ('home.vision.intro',        'Home', 'The Vision Method', 'Introduction',           'rich_text', null, null),

    ('home.reviews.title',       'Home', 'Worked with and for', 'Heading',              'text',      120,   null),

    ('home.testimonials.eyebrow','Home', 'Testimonials',    'Small heading',            'text',      80,   null),
    ('home.testimonials.title',  'Home', 'Testimonials',    'Heading',                  'text',      120,   null),

    ('home.contact.eyebrow',     'Home', 'Get in touch',    'Small heading',            'text',      80,   null),
    ('home.contact.title',       'Home', 'Get in touch',    'Heading',                  'text',      120,   null),
    ('home.contact.body',        'Home', 'Get in touch',    'Text',                     'long_text', 1000,  null),
    ('home.contact.button',      'Home', 'Get in touch',    'Button',                   'link',      null, null),

    ('home.seo.title',           'Home', 'Search engines',  'Page title in Google',     'text',      70,   'Shown as the blue link in search results. Aim for under 60 characters.'),
    ('home.seo.description',     'Home', 'Search engines',  'Description in Google',    'long_text', 200,  'The grey text under the link. Aim for under 160 characters.'),

    -- === ABOUT (Kirsty's Story) =============================
    ('about.hero.title',         'Kirsty''s Story', 'Top of the page', 'Heading',       'text',      80,   null),
    ('about.hero.subtitle',      'Kirsty''s Story', 'Top of the page', 'Subheading',    'text',      160,   null),
    ('about.hero.image',         'Kirsty''s Story', 'Top of the page', 'Banner photo',  'image',     null, 'A wide, landscape photo.'),

    ('about.story.title',        'Kirsty''s Story', 'My story',  'Heading',             'text',      120,   null),
    ('about.story.body',         'Kirsty''s Story', 'My story',  'Your story',          'rich_text', null, null),
    ('about.story.button',       'Kirsty''s Story', 'My story',  'Button',              'link',      null, null),

    ('about.cta.title',          'Kirsty''s Story', 'Book a consultation', 'Heading',   'text',      120,   null),
    ('about.cta.body',           'Kirsty''s Story', 'Book a consultation', 'Text',      'long_text', 1000,  null),
    ('about.cta.button',         'Kirsty''s Story', 'Book a consultation', 'Button',    'link',      null, null),
    ('about.cta.image',          'Kirsty''s Story', 'Book a consultation', 'Photo',     'image',     null, null),

    ('about.seo.title',          'Kirsty''s Story', 'Search engines', 'Page title in Google',  'text',      70,  'Aim for under 60 characters; Google cuts off longer titles.'),
    ('about.seo.description',    'Kirsty''s Story', 'Search engines', 'Description in Google', 'long_text', 200, 'Aim for under 160 characters; Google cuts off longer descriptions.'),

    -- === SERVICES (How we can help you) =====================
    ('services.intro.title',     'How we can help you', 'Introduction', 'Heading',      'text',      120,   null),
    ('services.intro.body',      'How we can help you', 'Introduction', 'Text',         'rich_text', null, null),

    ('services.workshops.title', 'How we can help you', 'Workshops', 'Heading',         'text',      120,   null),
    ('services.workshops.body',  'How we can help you', 'Workshops', 'Text',            'rich_text', null, null),
    ('services.workshops.image', 'How we can help you', 'Workshops', 'Photo',           'image',     null, null),
    ('services.workshops.button','How we can help you', 'Workshops', 'Button',          'link',      null, null),

    ('services.consulting.title',    'How we can help you', 'Consulting', 'Heading',    'text',      120,   null),
    ('services.consulting.intro',    'How we can help you', 'Consulting', 'Text',       'rich_text', null, null),
    ('services.consulting.checklist','How we can help you', 'Consulting', 'Ticked list','long_text', 1000,  'One item per line. Each line gets a tick.'),
    ('services.consulting.image',    'How we can help you', 'Consulting', 'Photo',      'image',     null, null),
    ('services.consulting.button',   'How we can help you', 'Consulting', 'Button',     'link',      null, null),

    ('services.coaching.title',      'How we can help you', 'Coaching & mentoring', 'Heading',     'text',      120,   null),
    ('services.coaching.body',       'How we can help you', 'Coaching & mentoring', 'Text',        'rich_text', null, null),
    ('services.coaching.checklist',  'How we can help you', 'Coaching & mentoring', 'Ticked list', 'long_text', 1000,  'One item per line. Each line gets a tick.'),
    ('services.coaching.image',      'How we can help you', 'Coaching & mentoring', 'Photo',       'image',     null, null),
    ('services.coaching.button',     'How we can help you', 'Coaching & mentoring', 'Button',      'link',      null, null),

    ('services.cafe.title',      'How we can help you', 'Menopause Café', 'Heading',    'text',      120,   null),
    ('services.cafe.body',       'How we can help you', 'Menopause Café', 'Text',       'rich_text', null, null),
    ('services.cafe.image',      'How we can help you', 'Menopause Café', 'Photo',      'image',     null, null),
    ('services.cafe.button',     'How we can help you', 'Menopause Café', 'Button',     'link',      null, null),

    ('services.walk.title',      'How we can help you', 'Walk & Talk', 'Heading',       'text',      120,   null),
    ('services.walk.body',       'How we can help you', 'Walk & Talk', 'Text',          'rich_text', null, null),
    ('services.walk.image',      'How we can help you', 'Walk & Talk', 'Photo',         'image',     null, null),
    ('services.walk.button',     'How we can help you', 'Walk & Talk', 'Button',        'link',      null, null),

    ('services.seo.title',       'How we can help you', 'Search engines', 'Page title in Google',  'text',      70,  'Aim for under 60 characters; Google cuts off longer titles.'),
    ('services.seo.description', 'How we can help you', 'Search engines', 'Description in Google', 'long_text', 200, 'Aim for under 160 characters; Google cuts off longer descriptions.'),

    -- === TIPS & RESOURCES ===================================
    ('tips.intro.eyebrow',       'Tips & Resources', 'Introduction', 'Small heading',   'text',      80,   null),
    ('tips.intro.title',         'Tips & Resources', 'Introduction', 'Heading',         'text',      120,   null),
    ('tips.intro.body',          'Tips & Resources', 'Introduction', 'Text',            'long_text', 1000,  'Shown above your latest blog posts.'),

    ('tips.faq.title',           'Tips & Resources', 'Questions',    'Heading',         'text',      120,   null),

    ('tips.help.intro',          'Tips & Resources', 'How we can help', 'Introduction', 'rich_text', null, null),
    ('tips.help.handbook',       'Tips & Resources', 'How we can help', 'Handbook download', 'link', null, 'Link to the Menopause Resources Handbook PDF.'),
    ('tips.help.outro',          'Tips & Resources', 'How we can help', 'Closing text', 'rich_text', null, null),

    ('tips.signup.title',        'Tips & Resources', 'Handbook sign-up', 'Heading',     'text',      120,   null),
    ('tips.signup.body',         'Tips & Resources', 'Handbook sign-up', 'Text',        'long_text', 1000,  null),
    ('tips.signup.small_print',  'Tips & Resources', 'Handbook sign-up', 'Small print', 'long_text', 1000,  'The newsletter consent line under the form.'),
    ('tips.signup.image',        'Tips & Resources', 'Handbook sign-up', 'Photo',       'image',     null, null),

    ('tips.seo.title',           'Tips & Resources', 'Search engines', 'Page title in Google',  'text',      70,  'Aim for under 60 characters; Google cuts off longer titles.'),
    ('tips.seo.description',     'Tips & Resources', 'Search engines', 'Description in Google', 'long_text', 200, 'Aim for under 160 characters; Google cuts off longer descriptions.'),

    -- === EVENTS =============================================
    ('events.intro.eyebrow',     'Events', 'Introduction', 'Small heading',             'text',      120,   null),
    ('events.intro.title',       'Events', 'Introduction', 'Heading',                   'text',      120,   null),
    ('events.intro.body',        'Events', 'Introduction', 'Text',                      'long_text', 1000,  null),

    ('events.calendar.title',    'Events', 'Calendar',     'Heading',                   'text',      120,   'Your events themselves are edited under Events.'),

    ('events.cta.title',         'Events', 'Ideas for events', 'Heading',               'text',      120,   null),
    ('events.cta.body',          'Events', 'Ideas for events', 'Text',                  'long_text', 1000,  null),
    ('events.cta.button',        'Events', 'Ideas for events', 'Button',                'link',      null, null),

    ('events.seo.title',         'Events', 'Search engines', 'Page title in Google',    'text',      70,  'Aim for under 60 characters; Google cuts off longer titles.'),
    ('events.seo.description',   'Events', 'Search engines', 'Description in Google',   'long_text', 200, 'Aim for under 160 characters; Google cuts off longer descriptions.'),

    -- === GET IN TOUCH (bookings) ============================
    ('contact.intro.eyebrow',    'Get in touch', 'Contact form', 'Small heading',       'text',      80,   null),
    ('contact.intro.title',      'Get in touch', 'Contact form', 'Heading',             'text',      120,   null),
    ('contact.intro.body',       'Get in touch', 'Contact form', 'Text',                'long_text', 1000,  null),
    ('contact.intro.image',      'Get in touch', 'Contact form', 'Illustration',        'image',     null, null),
    ('contact.form.success',     'Get in touch', 'Contact form', 'Message after sending', 'text',    200,  'What people see once their message has gone.'),

    ('contact.seo.title',        'Get in touch', 'Search engines', 'Page title in Google',  'text',      70,  'Aim for under 60 characters; Google cuts off longer titles.'),
    ('contact.seo.description',  'Get in touch', 'Search engines', 'Description in Google', 'long_text', 200, 'Aim for under 160 characters; Google cuts off longer descriptions.'),

    -- === EVERY PAGE (footer) ================================
    ('site.signup.title',        'Every page', 'Handbook sign-up (footer)', 'Heading',  'text',      120,   null),
    ('site.signup.body',         'Every page', 'Handbook sign-up (footer)', 'Text',     'long_text', 500,  null),
    ('site.signup.success',      'Every page', 'Handbook sign-up (footer)', 'Message after signing up', 'text', 200, null),

    ('site.contact_email',       'Every page', 'Contact details', 'Email address',      'text',      120,  null),
    ('site.social.facebook',     'Every page', 'Contact details', 'Facebook',           'link',      null, 'Leave empty to hide the icon.'),
    ('site.social.bluesky',      'Every page', 'Contact details', 'Bluesky',            'link',      null, 'Leave empty to hide the icon.'),
    ('site.social.linkedin',     'Every page', 'Contact details', 'LinkedIn',           'link',      null, 'Leave empty to hide the icon.'),
    ('site.social.instagram',    'Every page', 'Contact details', 'Instagram',          'link',      null, 'Leave empty to hide the icon.'),
    ('site.copyright',           'Every page', 'Contact details', 'Copyright line',     'text',      200,  null),

    -- === LEGAL PAGES ========================================
    ('legal.privacy.body',       'Legal pages', 'Privacy policy',       'Privacy policy',       'rich_text', null, null),
    ('legal.business.body',      'Legal pages', 'Business information', 'Business information', 'rich_text', null, null),
    ('legal.logo.body',          'Legal pages', 'Logo',                 'Logo page text',       'rich_text', null, null)
  ) as f(key, page, section, label, type, max_length, help)
  on conflict (site_id, key) do update
    set page       = excluded.page,
        section    = excluded.section,
        label      = excluded.label,
        type       = excluded.type,
        max_length = excluded.max_length,
        help       = excluded.help,
        sort_order = excluded.sort_order;

  -- ----------------------------------------------------------
  -- Lists: the repeating blocks
  -- ----------------------------------------------------------
  -- (key, page, section, label, help, item_schema)

  insert into public.lists (site_id, key, page, section, label, help, item_schema, sort_order)
  select v_site, l.key, l.page, l.section, l.label, l.help, l.item_schema::jsonb,
         (row_number() over ()) * 10
  from (values
    ('stats', 'Home', 'Statistics', 'Statistics',
      'The site shows four side by side.',
      '[{"key":"number","label":"Number","type":"text"},{"key":"label","label":"What it means","type":"text"}]'),

    ('wins', 'Home', 'Celebrate the wins', 'The wins',
      null,
      '[{"key":"title","label":"Win","type":"text"},{"key":"subtitle","label":"Line underneath","type":"text"}]'),

    ('vision_steps', 'Home', 'The Vision Method', 'Vision steps',
      'Six steps that spell VISION. The letter pictures stay in order, so keep six.',
      '[{"key":"title","label":"Step","type":"text"},{"key":"description","label":"Description","type":"text"}]'),

    ('review_images', 'Home', 'Worked with and for', 'Google reviews',
      'Screenshots of Google reviews, shown in the scrolling strip.',
      '[{"key":"image","label":"Review screenshot","type":"image"}]'),

    ('testimonials', 'Home', 'Testimonials', 'Testimonials',
      null,
      '[{"key":"title","label":"Headline","type":"text"},{"key":"quote","label":"What they said","type":"long_text"},{"key":"name","label":"Name","type":"text"},{"key":"organisation","label":"Organisation","type":"text"}]'),

    ('about_photos', 'Kirsty''s Story', 'My story', 'Photos',
      null,
      '[{"key":"image","label":"Photo","type":"image"}]'),

    ('workshop_types', 'How we can help you', 'Workshops', 'Workshops on offer',
      null,
      '[{"key":"title","label":"Workshop","type":"text"},{"key":"description","label":"Description","type":"long_text"}]'),

    ('faqs', 'Tips & Resources', 'Questions', 'Questions and answers',
      null,
      '[{"key":"question","label":"Question","type":"text"},{"key":"answer","label":"Answer","type":"rich_text"}]'),

    ('help_cards', 'Tips & Resources', 'How we can help', 'Ways we help',
      null,
      '[{"key":"title","label":"Title","type":"text"},{"key":"description","label":"Description","type":"long_text"}]')
  ) as l(key, page, section, label, help, item_schema)
  on conflict (site_id, key) do update
    set page        = excluded.page,
        section     = excluded.section,
        label       = excluded.label,
        help        = excluded.help,
        item_schema = excluded.item_schema,
        sort_order  = excluded.sort_order;
end $$;

select
  (select count(*) from public.content_fields cf join public.sites s on s.id = cf.site_id
    where s.slug = 'feel-good-menopause') as fields,
  (select count(*) from public.lists l join public.sites s on s.id = l.site_id
    where s.slug = 'feel-good-menopause') as lists;
