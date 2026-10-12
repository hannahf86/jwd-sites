// =============================================================================
// components/editor/FieldInput.tsx — the right input for each field type
// =============================================================================
"use client";

import RichTextEditor from "./RichTextEditor";
import ImageField from "./ImageField";
import type { ContentField, FieldValue, ImageValue, LinkValue, RichTextValue } from "@/lib/content";
import type { MediaItem } from "@/lib/pages";

type Props = {
  field: ContentField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  siteId: string;
  media: MediaItem[];
  onUploaded: (item: MediaItem) => void;
  labelId: string;
  inputId: string;
};

/** "12 / 60", turning amber near the limit and red over it. */
function Counter({ text, max }: { text: string; max: number }) {
  const n = [...text].length;
  const tone = n > max ? "over" : n > max * 0.9 ? "near" : "";
  return (
    <span className={`counter ${tone}`} aria-live="polite">
      {n} / {max}
    </span>
  );
}

export default function FieldInput({ field, value, onChange, siteId, media, onUploaded, labelId, inputId }: Props) {
  // Empty text is saved as "nothing", not as an empty string, so the
  // website can tell "left blank" from "never filled in" the same way.
  const setText = (text: string) => onChange(text === "" ? null : text);

  switch (field.type) {
    case "text": {
      const text = (value as string | null) ?? "";
      return (
        <>
          <input id={inputId} className="field" value={text} onChange={(e) => setText(e.target.value)} />
          {field.max_length && <Counter text={text} max={field.max_length} />}
        </>
      );
    }

    case "long_text": {
      const text = (value as string | null) ?? "";
      return (
        <>
          <textarea
            id={inputId}
            className="field"
            rows={Math.min(10, Math.max(3, text.split("\n").length + 1))}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {field.max_length && <Counter text={text} max={field.max_length} />}
        </>
      );
    }

    case "rich_text":
      return (
        <RichTextEditor
          value={value as RichTextValue | null}
          onChange={(v) => onChange(v)}
          labelId={labelId}
        />
      );

    case "image":
      return (
        <ImageField
          siteId={siteId}
          value={value as ImageValue | null}
          onChange={(v) => onChange(v)}
          media={media}
          onUploaded={onUploaded}
          labelId={labelId}
        />
      );

    case "link": {
      const link = (value as LinkValue | null) ?? { label: "", href: "" };
      // Both empty means no button at all.
      const set = (next: LinkValue) => onChange(next.label === "" && next.href === "" ? null : next);
      return (
        <div className="link-field">
          <div>
            <label className="label" htmlFor={`${inputId}-label`}>Button text</label>
            <input
              id={`${inputId}-label`}
              className="field"
              value={link.label}
              onChange={(e) => set({ ...link, label: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor={`${inputId}-href`}>Goes to</label>
            <input
              id={`${inputId}-href`}
              className="field"
              value={link.href}
              placeholder="https://… or /events"
              onChange={(e) => set({ ...link, href: e.target.value })}
            />
          </div>
        </div>
      );
    }
  }
}
