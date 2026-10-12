// =============================================================================
// app/(app)/sites/[slug]/pages/page.tsx — Pages: go to the first page
// =============================================================================
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSite } from "@/lib/sites";
import { listPages } from "@/lib/pages";
import { requireViewer } from "@/lib/viewer";

type Props = { params: Promise<{ slug: string }> };

export default async function PagesIndex({ params }: Props) {
  const { slug } = await params;
  const viewer = await requireViewer();
  const site = await getSite(slug);
  if (!site) notFound();

  const pages = await listPages(site.id);
  if (pages.length > 0) redirect(`/sites/${site.slug}/pages/${pages[0].slug}`);

  return (
    <>
      <div className="page-head">
        <div>
          <Link href={`/sites/${site.slug}`} className="back-link">
            <ArrowLeft size={14} aria-hidden /> {site.name}
          </Link>
          <h1 className="page-title">Pages</h1>
        </div>
      </div>
      <div className="card empty">
        {viewer.isStaff
          ? "No editable content is set up for this site yet. Run its setup file from supabase/sites in the SQL editor."
          : "Nothing is set up for editing yet. Jorvik Web Dev will let you know when it's ready."}
      </div>
    </>
  );
}
