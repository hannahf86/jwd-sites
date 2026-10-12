// =============================================================================
// app/(app)/sites/[slug]/RemoveEditorButton.tsx — take away someone's access
// =============================================================================
"use client";

import { removeEditor } from "../actions";

export default function RemoveEditorButton({
  siteId,
  slug,
  userId,
  email,
}: {
  siteId: string;
  slug: string;
  userId: string;
  email: string;
}) {
  return (
    <form
      action={removeEditor}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${email}? They won't be able to edit this site any more.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="user_id" value={userId} />
      <button type="submit" className="btn-ghost" aria-label={`Remove ${email}`}>
        Remove
      </button>
    </form>
  );
}
