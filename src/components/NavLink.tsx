// =============================================================================
// components/NavLink.tsx — sidebar link that knows when it's the current page
// =============================================================================
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
