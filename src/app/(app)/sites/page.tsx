// =============================================================================
// app/(app)/sites/page.tsx — all sites (staff) / straight to yours (client)
// =============================================================================
import Link from "next/link";
import { redirect } from "next/navigation";
import { listSites } from "@/lib/sites";
import { requireViewer } from "@/lib/viewer";
import NewSiteForm from "./NewSiteForm";

export const metadata = { title: "Sites" };

export default async function SitesPage() {
  const viewer = await requireViewer();
  const sites = await listSites();

  // A client with one website shouldn't have to pick it from a list of one.
  if (!viewer.isStaff && sites.length === 1) redirect(`/sites/${sites[0].slug}`);

  return (
    <>
      {/* --- Header --- */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{viewer.isStaff ? "All sites" : "Your websites"}</h1>
          <p className="page-sub">
            {viewer.isStaff
              ? `${sites.length} ${sites.length === 1 ? "site" : "sites"} on the platform.`
              : "Choose a website to edit."}
          </p>
        </div>
      </div>

      <div className={viewer.isStaff ? "two-col" : undefined}>
        {/* --- Site cards --- */}
        <section aria-label="Sites">
          {sites.length === 0 ? (
            <div className="card empty">
              {viewer.isStaff
                ? "No sites yet. Add the first one with the form."
                : "You haven't been given access to a website yet. Get in touch with Jorvik Web Dev and we'll sort it."}
            </div>
          ) : (
            <div className="site-grid">
              {sites.map((site) => (
                <Link key={site.id} href={`/sites/${site.slug}`} className="card site-card">
                  <div className="site-card-name">{site.name}</div>
                  <div className="site-card-domain">{site.domain ?? "No domain set"}</div>
                  {site.status !== "active" && (
                    <span className="badge badge-needs" style={{ marginTop: 10 }}>
                      Paused
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* --- Add a site (staff) --- */}
        {viewer.isStaff && (
          <section className="card" aria-labelledby="new-site">
            <h2 id="new-site" className="section-title">Add a site</h2>
            <NewSiteForm />
          </section>
        )}
      </div>
    </>
  );
}
