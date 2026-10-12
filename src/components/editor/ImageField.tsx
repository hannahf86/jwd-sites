// =============================================================================
// components/editor/ImageField.tsx — choose, upload or remove an image
// =============================================================================
// Uploads go browser → Supabase Storage directly, as the signed-in person,
// into this site's folder. Storage policies refuse any other folder, and
// it skips Vercel's 4.5MB request limit, which a phone photo can exceed.
// A media row is written alongside so the image appears in the library.
"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { mediaUrl, type ImageValue } from "@/lib/content";
import type { MediaItem } from "@/lib/pages";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket's limit

/** Width and height, read in the browser before uploading. */
function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default function ImageField({
  siteId,
  value,
  onChange,
  media,
  onUploaded,
  labelId,
}: {
  siteId: string;
  value: ImageValue | null;
  onChange: (value: ImageValue | null) => void;
  media: MediaItem[];
  onUploaded: (item: MediaItem) => void;
  labelId: string;
}) {
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const images = media.filter((m) => m.mime_type?.startsWith("image/") ?? true);

  function choose(item: MediaItem) {
    onChange({ media_id: item.id, path: item.path, alt: value?.alt || item.alt || "" });
    setPicking(false);
  }

  async function upload(file: File) {
    setError("");
    if (!IMAGE_TYPES.includes(file.type)) return setError("That file type isn't supported. Use a JPG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return setError("That image is over 10MB. Try a smaller version.");

    setUploading(true);
    const supabase = browserDb();
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${siteId}/${crypto.randomUUID()}.${ext}`;
    const size = await readDimensions(file);

    const { error: uploadError } = await supabase.storage
      .from("site-media")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) {
      setUploading(false);
      return setError(`The upload didn't work: ${uploadError.message}`);
    }

    const { data, error: rowError } = await supabase
      .from("media")
      .insert({
        site_id: siteId,
        path,
        alt: "",
        mime_type: file.type,
        width: size?.width ?? null,
        height: size?.height ?? null,
        size_bytes: file.size,
      })
      .select("id, path, alt, width, height, mime_type")
      .single();

    if (rowError || !data) {
      // Don't leave a file nothing points to.
      await supabase.storage.from("site-media").remove([path]);
      setUploading(false);
      return setError(`The upload didn't work: ${rowError?.message ?? "unknown error"}`);
    }

    const item = data as MediaItem;
    onUploaded(item);
    choose(item);
    setUploading(false);
  }

  return (
    <div className="image-field">
      {/* --- The current image --- */}
      {value ? (
        <div className="image-current">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(value.path)} alt="" className="image-thumb" />
          <div className="image-current-side">
            <label className="label" htmlFor={`${labelId}-alt`}>Describe the image</label>
            <input
              id={`${labelId}-alt`}
              className="field"
              value={value.alt}
              placeholder="e.g. Kirsty smiling in the garden"
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
            />
            <p className="hint">Read aloud to people who can&apos;t see it, and used by Google.</p>
            <div className="image-actions">
              <button type="button" className="btn-ghost" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                <ImagePlus size={14} aria-hidden /> Change image
              </button>
              <button type="button" className="btn-ghost" onClick={() => onChange(null)}>
                <Trash2 size={14} aria-hidden /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="image-empty" onClick={() => setPicking((p) => !p)} aria-expanded={picking} aria-labelledby={labelId}>
          <ImagePlus size={18} aria-hidden /> Choose an image
        </button>
      )}

      {error && <p className="field-problem" role="alert">{error}</p>}

      {/* --- Picker: upload, or choose from the library --- */}
      {picking && (
        <div className="image-picker">
          <div className="image-picker-head">
            <button type="button" className="btn-secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
              <Upload size={14} aria-hidden /> {uploading ? "Uploading…" : "Upload a new image"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
            <button type="button" className="btn-ghost" onClick={() => setPicking(false)}>Close</button>
          </div>

          {images.length === 0 ? (
            <p className="empty">No images uploaded yet.</p>
          ) : (
            <ul className="image-grid" aria-label="Your images">
              {images.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`image-choice${value?.media_id === item.id ? " is-chosen" : ""}`}
                    onClick={() => choose(item)}
                    aria-label={item.alt ? `Use image: ${item.alt}` : "Use this image"}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(item.path)} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
