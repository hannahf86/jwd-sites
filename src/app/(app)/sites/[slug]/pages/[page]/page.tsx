// =============================================================================
// app/(app)/sites/[slug]/pages/[page]/page.tsx — the Pages editor, one page
// =============================================================================
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getSite } from "@/lib/sites";
import { listMedia, listPages, loadPage } from "@/lib/pages";
import PageEditor from "./PageEditor";

type Props = { params: Promise<{ slug: string; page: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, page } = await params;
  const site = await getSite(slug);
  const loaded = site ? await loadPage(site.id, page) : null;
  return { title: loaded ? `${loaded.name} · ${site!.name}` : "Pages" };
}

export default async function EditPage({ params }: Props) {
  const { slug, page: pageSlug } = await params;
  const site = await getSite(slug);
  if (!site) notFound();

  const [page, pages, media] = await Promise.all([
    loadPage(site.id, pageSlug),
    listPages(site.id),
    listMedia(site.id),
  ]);
  if (!page) notFound();

  return (
    <div className="editor-page">
      {/* --- Header --- */}
      <div className="page-head">
        <div>
          <Link href={`/sites/${site.slug}`} className="back-link">
            <ArrowLeft size={14} aria-hidden /> {site.name}
          </Link>
          <h1 className="page-title">Pages</h1>
          <p className="page-sub">Change the words and pictures on your website. Nothing goes live until you publish.</p>
        </div>
        {site.domain && (
          <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="btn-ghost">
            View your website <ExternalLink size={14} aria-hidden />
          </a>
        )}
      </div>

      {/* key: a different page is a fresh editor, not this one's state */}
      <PageEditor
        key={pageSlug}
        site={{ id: site.id, slug: site.slug }}
        page={{ name: page.name, slug: pageSlug, sections: page.sections }}
        pages={pages}
        media={media}
      />
    </div>
  );
}
