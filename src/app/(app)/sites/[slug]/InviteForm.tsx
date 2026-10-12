// =============================================================================
// app/(app)/sites/[slug]/InviteForm.tsx — invite a client to edit this site
// =============================================================================
"use client";

import { useActionState } from "react";
import { inviteEditor, type FormState } from "../actions";

export default function InviteForm({ siteId }: { siteId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteEditor, { status: "idle" });

  return (
    <form action={action}>
      {state.status !== "idle" && (
        <div className={`message message-${state.status}`} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </div>
      )}

      <input type="hidden" name="site_id" value={siteId} />
      <label className="label" htmlFor="invite-email">Invite by email</label>
      {/* key: after a success the field starts empty again; after an
          error it keeps what was typed. */}
      <input
        key={state.status === "success" ? state.message : "typing"}
        id="invite-email"
        name="email"
        type="email"
        className="field"
        required
        defaultValue={state.status === "error" ? state.values?.email : ""}
        placeholder="client@example.com"
      />
      <button type="submit" className="btn-secondary" style={{ marginTop: 12 }} disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </button>
    </form>
  );
}
