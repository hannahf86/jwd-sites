// =============================================================================
// lib/revalidate.ts — tell a client's website that content changed
// =============================================================================
// After a publish, the dashboard POSTs to the site's revalidate_url so it
// refreshes its cached pages straight away instead of waiting.
//
// The contract a client site implements (route handler at revalidate_url):
//   - method POST, JSON body { "tags": ["content"] }
//   - header x-revalidate-secret: HMAC-SHA256(REVALIDATE_SECRET, site id), hex
//   - on a match, revalidateTag() each tag; otherwise 401
//
// Each site holds only its own derived secret, never REVALIDATE_SECRET, so a
// leaked site secret can't be used against any other site.
//
// Best effort by design: if the ping fails, the site still picks up the
// change when its cache next expires. A publish never fails because of it.
import "server-only";
import { createHmac } from "node:crypto";

export function siteRevalidateSecret(siteId: string) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(siteId).digest("hex");
}

export async function pingSite(site: { id: string; revalidate_url: string | null }, tags: string[]) {
  const secret = siteRevalidateSecret(site.id);
  if (!site.revalidate_url || !secret) return false;

  try {
    const res = await fetch(site.revalidate_url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
