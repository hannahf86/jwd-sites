// =============================================================================
// app/(app)/sites/actions.ts — server actions: create site, invite, remove
// =============================================================================
// requireStaff() here gives a friendly answer to a non-staff caller; it is
// not the boundary. Every write goes through db(), as the signed-in person,
// so RLS refuses it whatever this file does. The one exception is creating
// an auth account on invite, which needs the secret key — see below.
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireStaff, siteUrl } from "@/lib/viewer";

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  // Echoed back so a form keeps what was typed when there's an error.
  // React 19 resets uncontrolled forms after an action runs.
  values?: Record<string, string>;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** "Feel Good Menopause!" → "feel-good-menopause" */
function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "https://www.Example.co.uk/" → "www.example.co.uk" */
function cleanDomain(input: string) {
  return input.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

// -----------------------------------------------------------------------------
// Create a site (staff)
// -----------------------------------------------------------------------------
export async function createSite(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();

  const name = text(form, "name");
  const slug = slugify(text(form, "slug") || name);
  const domain = cleanDomain(text(form, "domain"));
  const values = { name, slug: text(form, "slug"), domain: text(form, "domain") };

  if (!name) return { status: "error", message: "Give the site a name.", values };
  if (!slug) return { status: "error", message: "The name needs at least one letter or number.", values };
  if (domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    return { status: "error", message: "That domain doesn't look right. Try something like example.co.uk.", values };
  }

  const supabase = await db();
  const { error } = await supabase.from("sites").insert({ name, slug, domain: domain || null });

  if (error) {
    const taken = /duplicate|unique/i.test(error.message);
    return {
      status: "error",
      message: taken ? `There's already a site at /${slug}. Choose a different short name.` : error.message,
      values,
    };
  }

  revalidatePath("/sites", "layout");
  redirect(`/sites/${slug}`);
}

// -----------------------------------------------------------------------------
// Invite an editor (staff)
// -----------------------------------------------------------------------------
// One person can edit more than one site, and auth accounts are unique by
// email. So: if the address already has an account, attach a membership;
// only create (and email) an account when there isn't one.
export async function inviteEditor(_prev: FormState, form: FormData): Promise<FormState> {
  await requireStaff();

  const siteId = text(form, "site_id");
  const email = text(form, "email").toLowerCase();
  const values = { email };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "That email address doesn't look right.", values };
  }

  const supabase = await db();

  // Checked as the viewer, so a made-up site id finds nothing.
  const { data: site } = await supabase.from("sites").select("id, name, slug").eq("id", siteId).maybeSingle();
  if (!site) return { status: "error", message: "That site couldn't be found.", values };

  // The secret key, for the one thing RLS can't do: look in auth.users.
  const admin = adminDb();
  const { data: existingId, error: lookupError } = await admin.rpc("auth_user_id_for_email", { addr: email });
  if (lookupError) return { status: "error", message: `Couldn't check that address: ${lookupError.message}`, values };

  let userId = existingId as string | null;
  let createdUser = false;

  if (userId) {
    const { data: already } = await supabase
      .from("site_members")
      .select("user_id")
      .eq("site_id", site.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (already) return { status: "error", message: `${email} can already edit ${site.name}.`, values };
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl()}/reset-password`,
      data: { invited_to_site: site.id },
    });
    if (inviteError || !invited?.user) {
      return { status: "error", message: inviteError?.message ?? "The invite couldn't be sent.", values };
    }
    userId = invited.user.id;
    createdUser = true;
  }

  // The membership goes in as the viewer, not with the secret key, so RLS
  // checks that a staff member is the one granting access.
  const { error: memberError } = await supabase.from("site_members").insert({ site_id: site.id, user_id: userId });

  if (memberError) {
    // Only clean up an account made a moment ago. Deleting one that already
    // existed would lock that person out of their other sites.
    if (createdUser && userId) await admin.auth.admin.deleteUser(userId);
    return { status: "error", message: `Couldn't add them: ${memberError.message}`, values };
  }

  revalidatePath(`/sites/${site.slug}`);
  return {
    status: "success",
    message: createdUser
      ? `Invite sent to ${email}. The link in it lets them choose a password.`
      : `${email} already has an account, so no email was sent. They'll see ${site.name} next time they sign in.`,
  };
}

// -----------------------------------------------------------------------------
// Remove an editor (staff)
// -----------------------------------------------------------------------------
// Removes access to this site only. The account stays: they may edit other
// sites, and if not, an account with no sites can see nothing anyway.
export async function removeEditor(form: FormData): Promise<void> {
  await requireStaff();

  const siteId = text(form, "site_id");
  const userId = text(form, "user_id");
  const slug = text(form, "slug");

  const supabase = await db();
  const { error } = await supabase.from("site_members").delete().eq("site_id", siteId).eq("user_id", userId);
  if (error) throw new Error(`Couldn't remove that editor: ${error.message}`);

  revalidatePath(`/sites/${slug}`);
}
