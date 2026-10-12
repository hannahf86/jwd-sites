// =============================================================================
// app/page.tsx — "/" has nothing of its own; the site list is home
// =============================================================================
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/sites");
}
