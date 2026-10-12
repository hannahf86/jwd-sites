// =============================================================================
// app/(app)/sites/[slug]/pages/actions.ts — save drafts, publish a page
// =============================================================================
// Both run as the signed-in person through db(), so RLS decides which site
// they can touch and the guard trigger stops anyone but staff changing a
// field's settings. The checks here are for friendly messages, not safety.
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/viewer";
import { valueProblem, type ContentField, type FieldValue } from "@/lib/content";
import { pingSite } from "@/lib/revalidate";

export type Change = { key: string; value: FieldValue };

export type SaveResult =
  | { ok: true; message: string }
  | { ok: false; message: string; problems?: Record<string, string> };

/** Load the site and the definitions of the fields being changed. */
async function context(siteSlug: string, keys: string[]) {
  const supabase = await db();
  const { data: site } = await supabase
    .from("sites")
    .select("id, slug, revalidate_url")
    .eq("slug", siteSlug)
    .maybeSingle();
  if (!site) return null;

  const { data: fields } = await supabase
    .from("content_fields")
    .select("key, type, max_length, label, page")
    .eq("site_id", site.id)
    .in("key", keys);

  const byKey = new Map(
    ((fields ?? []) as Pick<ContentField, "key" | "type" | "max_length" | "label" | "page">[]).map((f) => [f.key, f]),
  );
  return { supabase, site, byKey };
}

// -----------------------------------------------------------------------------
// Save drafts
// -----------------------------------------------------------------------------
// Nothing goes live. Every change is checked first, and if any one is
// wrong, none are saved: a half-saved page is harder to reason about than
// an unsaved one.
export async function saveDrafts(siteSlug: string, changes: Change[]): Promise<SaveResult> {
  await requireViewer();
  if (changes.length === 0) return { ok: true, message: "Nothing to save." };

  const ctx = await context(siteSlug, changes.map((c) => c.key));
  if (!ctx) return { ok: false, message: "That website couldn't be found." };
  const { supabase, site, byKey } = ctx;

  const problems: Record<string, string> = {};
  for (const { key, value } of changes) {
    const field = byKey.get(key);
    if (!field) {
      problems[key] = "This field no longer exists. Reload the page.";
      continue;
    }
    const problem = valueProblem(field.type, value, field.max_length, site.id);
    if (problem) problems[key] = problem;
  }
  if (Object.keys(problems).length > 0) {
    return { ok: false, message: "Some changes need fixing before they can be saved.", problems };
  }

  for (const { key, value } of changes) {
    const { error } = await supabase
      .from("content_fields")
      .update({ draft_value: value })
      .eq("site_id", site.id)
      .eq("key", key);
    if (error) {
      return { ok: false, message: `“${byKey.get(key)?.label ?? key}” couldn't be saved: ${error.message}` };
    }
  }

  revalidatePath(`/sites/${site.slug}`, "layout");
  return {
    ok: true,
    message: `Saved ${changes.length} ${changes.length === 1 ? "change" : "changes"}. Not live yet — publish when you're ready.`,
  };
}

// -----------------------------------------------------------------------------
// Publish a page
// -----------------------------------------------------------------------------
// Copies saved drafts to live for the given fields, then pings the website
// so it refreshes. publish_content() runs as the caller, so another site's
// fields are untouched whatever keys are passed.
export async function publishFields(siteSlug: string, keys: string[]): Promise<SaveResult> {
  await requireViewer();

  const ctx = await context(siteSlug, keys);
  if (!ctx) return { ok: false, message: "That website couldn't be found." };
  const { supabase, site } = ctx;

  const { data: count, error } = await supabase.rpc("publish_content", { p_site: site.id, p_keys: keys });
  if (error) return { ok: false, message: `Publishing failed: ${error.message}` };

  const published = (count as number) ?? 0;
  if (published === 0) return { ok: true, message: "Everything on this page is already live." };

  const pinged = await pingSite(site, ["content"]);
  revalidatePath(`/sites/${site.slug}`, "layout");

  return {
    ok: true,
    message:
      `Published ${published} ${published === 1 ? "change" : "changes"}.` +
      (pinged ? " Your website has been updated." : " Your website will show them within a few minutes."),
  };
}
