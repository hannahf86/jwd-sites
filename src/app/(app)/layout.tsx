// =============================================================================
// app/(app)/layout.tsx — the signed-in shell: sidebar + content
// =============================================================================
import Sidebar from "@/components/Sidebar";
import { listSites } from "@/lib/sites";
import { requireViewer } from "@/lib/viewer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const sites = await listSites();

  return (
    <div className="dashboard-shell">
      <Sidebar viewer={viewer} sites={sites} />
      <div className="dashboard-main">
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
