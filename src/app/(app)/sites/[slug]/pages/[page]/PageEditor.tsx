// =============================================================================
// app/(app)/sites/[slug]/pages/[page]/PageEditor.tsx — edit one page
// =============================================================================
// Three versions of every field are in play, and the editor keeps them apart:
//   live    what the website shows now (published_value)
//   saved   the saved draft (draft_value, or live if there's no draft)
//   value   what's in the box right now
// A field is "unsaved" when value ≠ saved, and "not live yet" when saved ≠
// live. Save draft writes value → saved. Publish writes saved → live (and
// saves first if anything is unsaved).
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutList } from "lucide-react";
import FieldInput from "@/components/editor/FieldInput";
import { sameValue, valueProblem, type ContentField, type FieldValue } from "@/lib/content";
import type { MediaItem, PageSection, PageSummary } from "@/lib/pages";
import { publishFields, saveDrafts, type SaveResult } from "../actions";

type Props = {
  site: { id: string; slug: string };
  page: { name: string; slug: string; sections: PageSection[] };
  pages: PageSummary[];
  media: MediaItem[];
};

type Status = "unsaved" | "draft" | "live" | "empty";

const STATUS_LABEL: Record<Status, string> = {
  unsaved: "Unsaved",
  draft: "Saved, not live yet",
  live: "Live",
  empty: "Empty",
};
const STATUS_CLASS: Record<Status, string> = {
  unsaved: "badge-needs",
  draft: "badge-progress",
  live: "badge-live",
  empty: "badge-muted",
};

export default function PageEditor({ site, page, pages, media: initialMedia }: Props) {
  const router = useRouter();
  const fields = useMemo(() => page.sections.flatMap((s) => s.fields), [page.sections]);

  const initial = (pick: (f: ContentField) => FieldValue) =>
    Object.fromEntries(fields.map((f) => [f.key, pick(f)])) as Record<string, FieldValue>;

  const [live, setLive] = useState(() => initial((f) => f.published_value));
  const [saved, setSaved] = useState(() => initial((f) => f.draft_value ?? f.published_value));
  const [values, setValues] = useState(() => initial((f) => f.draft_value ?? f.published_value));
  const [media, setMedia] = useState(initialMedia);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();

  const statusOf = (key: string): Status => {
    if (!sameValue(values[key], saved[key])) return "unsaved";
    if (saved[key] !== null && !sameValue(saved[key], live[key])) return "draft";
    return live[key] === null ? "empty" : "live";
  };

  const unsavedKeys = fields.filter((f) => statusOf(f.key) === "unsaved").map((f) => f.key);
  const draftKeys = fields.filter((f) => statusOf(f.key) === "draft").map((f) => f.key);
  const dirty = unsavedKeys.length > 0;

  // Closing the tab or reloading with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Bumped when a value is replaced from outside the input (undo, go back
  // to live). It's part of the input's key, so the input remounts showing
  // the replaced value — a rich text editor only reads its value on mount.
  const [resets, setResets] = useState<Record<string, number>>({});

  function setValue(key: string, value: FieldValue) {
    setValues((v) => ({ ...v, [key]: value }));
    setProblems(({ [key]: _gone, ...rest }) => rest);
    setResult(null);
  }

  function replaceValue(key: string, value: FieldValue) {
    setValue(key, value);
    setResets((r) => ({ ...r, [key]: (r[key] ?? 0) + 1 }));
  }

  async function save(): Promise<boolean> {
    const changes = unsavedKeys.map((key) => ({ key, value: values[key] }));

    // Same checks the server makes, run here first so a typo is pointed
    // out instantly. The server and the database still check regardless.
    const found: Record<string, string> = {};
    for (const { key, value } of changes) {
      const field = fields.find((f) => f.key === key)!;
      const problem = valueProblem(field.type, value, field.max_length, site.id);
      if (problem) found[key] = problem;
    }
    if (Object.keys(found).length > 0) {
      setProblems(found);
      setResult({ ok: false, message: "Some changes need fixing before they can be saved." });
      return false;
    }

    const res = await saveDrafts(site.slug, changes);
    setResult(res);
    if (!res.ok) {
      setProblems(res.problems ?? {});
      return false;
    }
    setSaved((s) => ({ ...s, ...Object.fromEntries(changes.map((c) => [c.key, c.value])) }));
    setProblems({});
    return true;
  }

  function onSave() {
    startTransition(async () => {
      if (await save()) router.refresh();
    });
  }

  function onPublish() {
    startTransition(async () => {
      if (dirty && !(await save())) return;
      // Everything about to go live is whatever's now saved.
      const toPublish = fields.map((f) => f.key);
      const res = await publishFields(site.slug, toPublish);
      setResult(res);
      if (res.ok) {
        // Mirrors publish_content(): every non-empty saved value goes live.
        // After the save above, saved and values are the same thing.
        const nextLive = { ...live };
        for (const f of fields) if (values[f.key] !== null) nextLive[f.key] = values[f.key];
        setLive(nextLive);
        router.refresh();
      }
    });
  }

  // Moving to another page with unsaved changes asks first. Links inside
  // the app don't fire beforeunload, so the tabs check for themselves.
  const confirmLeave = (e: React.MouseEvent) => {
    if (dirty && !window.confirm("You have unsaved changes on this page. Leave without saving?")) e.preventDefault();
  };

  return (
    <>
      {/* --- Page tabs --- */}
      <nav className="page-tabs" aria-label="Pages">
        {pages.map((p) => (
          <Link
            key={p.slug}
            href={`/sites/${site.slug}/pages/${p.slug}`}
            className={`page-tab${p.slug === page.slug ? " active" : ""}`}
            aria-current={p.slug === page.slug ? "page" : undefined}
            onClick={p.slug === page.slug ? undefined : confirmLeave}
          >
            {p.name}
            {p.unpublished > 0 && (
              <span className="page-tab-count" aria-label={`${p.unpublished} changes not live yet`}>
                {p.unpublished}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* --- Sections --- */}
      {page.sections.map((section) => (
        <section key={section.name} className="card editor-section" aria-labelledby={`sec-${section.name}`}>
          {section.name && (
            <h2 id={`sec-${section.name}`} className="section-title">
              {section.name}
            </h2>
          )}

          {section.fields.map((field) => {
            const status = statusOf(field.key);
            const labelId = `label-${field.key}`;
            const inputId = `input-${field.key}`;
            const plainInput = field.type === "text" || field.type === "long_text";
            const canUndo = status === "unsaved";
            const canUseLive = status === "draft" && live[field.key] !== null;

            return (
              <div key={field.key} className="editor-field">
                <div className="editor-field-head">
                  {plainInput ? (
                    <label id={labelId} htmlFor={inputId} className="label">{field.label}</label>
                  ) : (
                    <span id={labelId} className="label">{field.label}</span>
                  )}
                  <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                </div>
                {field.help && <p className="hint editor-help">{field.help}</p>}

                <FieldInput
                  key={resets[field.key] ?? 0}
                  field={field}
                  value={values[field.key]}
                  onChange={(v) => setValue(field.key, v)}
                  siteId={site.id}
                  media={media}
                  onUploaded={(item) => setMedia((m) => [item, ...m])}
                  labelId={labelId}
                  inputId={inputId}
                />

                {problems[field.key] && (
                  <p className="field-problem" role="alert">{problems[field.key]}</p>
                )}

                {(canUndo || canUseLive) && (
                  <div className="editor-field-actions">
                    {canUndo && (
                      <button type="button" className="text-button" onClick={() => replaceValue(field.key, saved[field.key])}>
                        Undo changes
                      </button>
                    )}
                    {canUseLive && (
                      <button type="button" className="text-button" onClick={() => replaceValue(field.key, live[field.key])}>
                        Go back to the live version
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Lists that live in this section, edited on their own screen. */}
          {section.lists.map((list) => (
            <div key={list.key} className="editor-list">
              <LayoutList size={16} aria-hidden style={{ color: "var(--accent-text)" }} />
              <div className="list-main">
                <div className="list-title">{list.label}</div>
                <div className="list-meta">
                  {list.item_count} {list.item_count === 1 ? "item" : "items"}
                  {list.help ? ` · ${list.help}` : ""}
                </div>
              </div>
              <span className="badge badge-muted">Editing coming soon</span>
            </div>
          ))}
        </section>
      ))}

      {/* --- Save / publish bar --- */}
      <div className="action-bar" role="region" aria-label="Save and publish">
        <div className="action-bar-status" aria-live="polite">
          {result ? (
            <span className={result.ok ? "ok" : "bad"}>{result.message}</span>
          ) : dirty ? (
            `${unsavedKeys.length} unsaved ${unsavedKeys.length === 1 ? "change" : "changes"}`
          ) : draftKeys.length > 0 ? (
            `${draftKeys.length} saved ${draftKeys.length === 1 ? "change isn't" : "changes aren't"} live yet`
          ) : (
            "Everything on this page is live"
          )}
        </div>
        <button type="button" className="btn-ghost" onClick={onSave} disabled={pending || !dirty}>
          {pending ? "Working…" : "Save draft"}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onPublish}
          disabled={pending || (!dirty && draftKeys.length === 0)}
        >
          Publish page
        </button>
      </div>
    </>
  );
}
