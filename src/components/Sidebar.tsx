// =============================================================================
// components/Sidebar.tsx — the left-hand navigation
// =============================================================================
// Lists the sites this person can edit, straight from RLS: staff see every
// site, a client sees theirs (usually one). Becomes a top bar on phones.
import { Globe, LayoutGrid, LogOut } from "lucide-react";
import Wordmark from "@/components/Wordmark";
import NavLink from "@/components/NavLink";
import type { Site } from "@/lib/sites";
import type { Viewer } from "@/lib/viewer";

export default function Sidebar({ viewer, sites }: { viewer: Viewer; sites: Site[] }) {
  return (
    <aside className="dashboard-sidebar">
      {/* --- Brand --- */}
      <div className="sidebar-head">
        <Wordmark href="/sites" />
      </div>

      {/* --- Navigation --- */}
      <nav className="sidebar-nav" aria-label="Main">
        {viewer.isStaff && (
          <NavLink href="/sites" exact>
            <LayoutGrid size={16} aria-hidden /> All sites
          </NavLink>
        )}

        {sites.length > 0 && <div className="sidebar-section">{sites.length === 1 ? "Your website" : "Websites"}</div>}
        {sites.map((site) => (
          <NavLink key={site.id} href={`/sites/${site.slug}`}>
            <Globe size={16} aria-hidden /> {site.name}
          </NavLink>
        ))}
      </nav>

      {/* --- Who's signed in, and the way out --- */}
      <div className="sidebar-foot">
        <div className="sidebar-user" title={viewer.email}>
          {viewer.email}
          {viewer.isStaff && " · Staff"}
        </div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="nav-item">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
