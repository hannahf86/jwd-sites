// =============================================================================
// components/editor/RichTextEditor.tsx — paragraphs, bold, italic, lists, links
// =============================================================================
// Deliberately small. No headings, colours or fonts: the website's design
// decides how text looks, and a client choosing their own heading sizes is
// how a site slowly stops matching itself. Saves Tiptap JSON, which is the
// shape the database checks for (`{"type":"doc", ...}`).
"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from "lucide-react";
import { isSafeHref, type RichTextValue } from "@/lib/content";

export default function RichTextEditor({
  value,
  onChange,
  labelId,
}: {
  value: RichTextValue | null;
  onChange: (value: RichTextValue | null) => void;
  labelId: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState("");

  const editor = useEditor({
    // Server rendering would render once without the editor, then again
    // with it, and React would complain about the mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          // Same rule as the database: no javascript: links, even pasted.
          isAllowedUri: (url: string) => isSafeHref(url),
        },
      }),
    ],
    // Our type is looser than Tiptap's; the database has already checked the shape.
    content: (value as JSONContent | null) ?? "",
    editorProps: {
      attributes: { class: "rte-content", "aria-labelledby": labelId, "aria-multiline": "true", role: "textbox" },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? null : (editor.getJSON() as RichTextValue)),
  });

  // Toolbar buttons show which formatting is on where the cursor is.
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      bullets: editor?.isActive("bulletList") ?? false,
      numbers: editor?.isActive("orderedList") ?? false,
      link: editor?.isActive("link") ?? false,
    }),
  });

  if (!editor || !active) return <div className="rte rte-loading" aria-hidden />;

  function openLink() {
    setHref((editor!.getAttributes("link").href as string | undefined) ?? "");
    setLinkError("");
    setLinkOpen(true);
  }

  function applyLink(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault();
    const url = href.trim();
    if (!isSafeHref(url)) {
      setLinkError("Start with https://, or with / for a page on your own site.");
      return;
    }
    const chain = editor!.chain().focus();
    if (editor!.state.selection.empty && !editor!.isActive("link")) {
      // Nothing selected: insert the address itself as the link text.
      chain.insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
    } else {
      chain.extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  }

  const tool = (label: string, on: boolean, run: () => void, Icon: typeof Bold) => (
    <button
      type="button"
      className={`rte-tool${on ? " is-on" : ""}`}
      aria-label={label}
      aria-pressed={on}
      title={label}
      onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
      onClick={run}
    >
      <Icon size={15} aria-hidden />
    </button>
  );

  return (
    <div className="rte">
      {/* --- Toolbar --- */}
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        {tool("Bold", active.bold, () => editor.chain().focus().toggleBold().run(), Bold)}
        {tool("Italic", active.italic, () => editor.chain().focus().toggleItalic().run(), Italic)}
        {tool("Bulleted list", active.bullets, () => editor.chain().focus().toggleBulletList().run(), List)}
        {tool("Numbered list", active.numbers, () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
        {tool("Add a link", active.link, openLink, Link2)}
        {active.link && tool("Remove link", false, () => editor.chain().focus().extendMarkRange("link").unsetLink().run(), Unlink)}
      </div>

      {/* --- Link box (inline, not a browser prompt) --- */}
      {linkOpen && (
        <div className="rte-linkbar">
          <label className="sr-only" htmlFor={`${labelId}-href`}>Link address</label>
          <input
            id={`${labelId}-href`}
            className="field"
            autoFocus
            placeholder="https://… or /events"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink(e);
              if (e.key === "Escape") setLinkOpen(false);
            }}
          />
          <button type="button" className="btn-secondary" onClick={applyLink}>Add link</button>
          <button type="button" className="btn-ghost" onClick={() => setLinkOpen(false)}>Cancel</button>
          {linkError && <p className="field-problem" style={{ flexBasis: "100%" }}>{linkError}</p>}
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
