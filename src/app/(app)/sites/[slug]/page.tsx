// =============================================================================
// app/(app)/sites/[slug]/page.tsx — one site's overview
// =============================================================================
// The tiles are the sections a client will edit. Each one is a placeholder
// until its editor is built, but the numbers on them are real.
// Someone else's site is a 404, never a 403 — RLS returns no row, so the
// page can't tell "doesn't exist" from "not yours", and neither can they.
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Image as ImageIcon, Inbox, LayoutList, Newspaper } from "lucide-react";
import { getSite, siteCounts, siteEditors } from "@/lib/sites";
import { requireViewer } from "@/lib/viewer";
import InviteForm from "./InviteForm";
import RemoveEditorButton from "./RemoveEditorButton";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const site = await getSite((await params).slug);
  return { title: site?.name ?? "Site" };
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function SitePage({ params }: Props) {
  const { slug } = await params;
  const viewer = await requireViewer();
  const site = await getSite(slug);
  if (!site) notFound();

  const [counts, editors] = await Promise.all([
    siteCounts(site.id),
    viewer.isStaff ? siteEditors(site.id) : Promise.resolve([]),
  ]);

  // `href` marks the ones that are built; the rest say "Coming soon".
  const modules: { name: string; icon: typeof FileText; stat: string; href?: string }[] = [
    {
      name: "Pages",
      icon: FileText,
      href: `/sites/${site.slug}/pages`,
      stat:
        counts.fields === 0
          ? "No editable text set up yet"
          : counts.unpublishedFields > 0
            ? `${plural(counts.unpublishedFields, "change")} not published`
            : counts.liveFields === 0
              ? "Ready to fill in"
              : "Everything is published",
    },
    { name: "Lists", icon: LayoutList, stat: "Testimonials, logos and more" },
    { name: "Events", icon: CalendarDays, stat: plural(counts.upcomingEvents, "upcoming event") },
    { name: "Blog", icon: Newspaper, stat: plural(counts.posts, "post") },
    { name: "Images", icon: ImageIcon, stat: "Your image library" },
    {
      name: "Messages",
      icon: Inbox,
      stat: counts.unreadSubmissions > 0 ? `${counts.unreadSubmissions} unread` : "No unread messages",
    },
  ];

  return (
    <>
      {/* --- Header --- */}
      <div className="page-head">
        <div>
          <div className="eyebrow">Website</div>
          <h1 className="page-title">{site.name}</h1>
          {site.domain && (
            <p className="page-sub">
              <a href={`https://${site.domain}`} target="_blank" rel="noreferrer">
                {site.domain}
              </a>
            </p>
          )}
        </div>
        {site.status !== "active" && <span className="badge badge-needs">Paused</span>}
      </div>

      <div className={viewer.isStaff ? "two-col" : undefined}>
        {/* --- What you can edit --- */}
        <section aria-labelledby="edit-heading">
          <h2 id="edit-heading" className="section-title">What you can edit</h2>
          <div className="module-grid">
            {modules.map(({ name, icon: Icon, stat, href }) => {
              const inner = (
                <>
                  <Icon size={18} aria-hidden style={{ color: "var(--accent-text)" }} />
                  <span className="module-name">{name}</span>
                  <span className="module-stat">{stat}</span>
                  {!href && (
                    <span className="badge badge-muted" style={{ alignSelf: "flex-start", marginTop: 6 }}>
                      Coming soon
                    </span>
                  )}
                </>
              );
              return href ? (
                <Link key={name} href={href} className="card module site-card">
                  {inner}
                </Link>
              ) : (
                <div key={name} className="card module is-soon">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        {/* --- Editors (staff only) --- */}
        {viewer.isStaff && (
          <section className="card" aria-labelledby="editors-heading">
            <h2 id="editors-heading" className="section-title">Who can edit</h2>

            {editors.length === 0 ? (
              <p className="empty" style={{ marginBottom: 18 }}>Nobody yet. Invite the client below.</p>
            ) : (
              <ul className="list" style={{ marginBottom: 18 }}>
                {editors.map((editor) => (
                  <li key={editor.user_id} className="list-row">
                    <div className="list-main">
                      <div className="list-title">{editor.email}</div>
                      <div className="list-meta">
                        {editor.last_sign_in_at
                          ? `Last signed in ${dateFormat.format(new Date(editor.last_sign_in_at))}`
                          : "Invited, hasn't signed in yet"}
                      </div>
                    </div>
                    <RemoveEditorButton siteId={site.id} slug={site.slug} userId={editor.user_id} email={editor.email} />
                  </li>
                ))}
              </ul>
            )}

            <InviteForm siteId={site.id} />
          </section>
        )}
      </div>
    </>
  );
}
