// =============================================================================
// app/(app)/sites/NewSiteForm.tsx — staff form to add a client site
// =============================================================================
"use client";

import { useActionState } from "react";
import { createSite, type FormState } from "./actions";

export default function NewSiteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSite, { status: "idle" });
  const v = state.values ?? {};

  return (
    <form action={action}>
      {state.status === "error" && (
        <div className="message message-error" role="alert">
          {state.message}
        </div>
      )}

      <div className="form-row">
        <label className="label" htmlFor="site-name">Business name</label>
        <input id="site-name" name="name" className="field" required defaultValue={v.name} placeholder="Feel Good Menopause" />
      </div>

      <div className="form-row">
        <label className="label" htmlFor="site-slug">Short name (optional)</label>
        <input id="site-slug" name="slug" className="field" defaultValue={v.slug} placeholder="feel-good-menopause" />
        <p className="hint">Used in dashboard links. Made from the business name if left blank.</p>
      </div>

      <div className="form-row">
        <label className="label" htmlFor="site-domain">Domain (optional)</label>
        <input id="site-domain" name="domain" className="field" defaultValue={v.domain} placeholder="feelgoodmenopause.co.uk" />
      </div>

      <button type="submit" className="btn-primary" style={{ marginTop: 18 }} disabled={pending}>
        {pending ? "Adding…" : "Add site"}
      </button>
    </form>
  );
}
