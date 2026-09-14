"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProduct, AdminProductImage } from "@/lib/catalogAdmin";
import {
  moveImageAction,
  removeImageAction,
  updateImageAction,
  type ImageActionState,
} from "../actions";

const imageStateInitial: ImageActionState = {};

function ImageRow({
  productId,
  image,
  canMoveUp,
  canMoveDown,
}: {
  productId: string;
  image: AdminProductImage;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateImageAction, imageStateInitial);

  return (
    <div className="adm-photo-row">
      {image.urlThumb || image.urlFull ? (
        <img
          className="adm-photo-thumb"
          src={image.urlThumb ?? image.urlFull ?? ""}
          alt=""
          width={72}
          height={72}
        />
      ) : (
        <span className="adm-photo-thumb adm-thumb-empty" aria-hidden="true" />
      )}

      <form action={formAction} className="adm-photo-fields">
        <input type="hidden" name="imageId" value={image.id} />
        <input type="hidden" name="productId" value={productId} />
        <label htmlFor={`label-${image.id}`} className="adm-label">
          Label
        </label>
        <input
          id={`label-${image.id}`}
          name="label"
          type="text"
          className="adm-input"
          defaultValue={image.label}
        />
        <label htmlFor={`alt-${image.id}`} className="adm-label">
          Alt text
        </label>
        <textarea
          id={`alt-${image.id}`}
          name="alt"
          className="adm-textarea"
          rows={2}
          minLength={8}
          required
          defaultValue={image.alt}
        />
        <button type="submit" className="adm-btn" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.error && (
          <p className="adm-error" role="alert">
            {state.error}
          </p>
        )}
      </form>

      <div className="adm-photo-actions">
        {(canMoveUp || canMoveDown) && (
          <>
            <form action={moveImageAction}>
              <input type="hidden" name="imageId" value={image.id} />
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="direction" value="up" />
              <button type="submit" className="adm-btn" disabled={!canMoveUp} aria-label="Move up">
                &uarr;
              </button>
            </form>
            <form action={moveImageAction}>
              <input type="hidden" name="imageId" value={image.id} />
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="direction" value="down" />
              <button
                type="submit"
                className="adm-btn"
                disabled={!canMoveDown}
                aria-label="Move down"
              >
                &darr;
              </button>
            </form>
          </>
        )}
        <form action={removeImageAction}>
          <input type="hidden" name="imageId" value={image.id} />
          <input type="hidden" name="productId" value={productId} />
          <button type="submit" className="adm-btn adm-btn-danger">
            Remove
          </button>
        </form>
      </div>
    </div>
  );
}

export function PhotosCard({
  product,
  blobConfigured,
}: {
  product: AdminProduct;
  blobConfigured: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const viewInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null, kind: "view" | "certificate" | "sticker") {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("productId", product.id);
        fd.append("kind", kind);
        if (kind !== "view") fd.append("viewId", kind);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Upload failed.");
      }
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (viewInputRef.current) viewInputRef.current.value = "";
      if (certInputRef.current) certInputRef.current.value = "";
      if (stickerInputRef.current) stickerInputRef.current.value = "";
    }
  }

  const views = [...product.views].sort((a, b) => a.position - b.position);

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Photos</h2>

      <div className="adm-photo-grid">
        {views.map((image, i) => (
          <ImageRow
            key={image.id}
            productId={product.id}
            image={image}
            canMoveUp={i > 0}
            canMoveDown={i < views.length - 1}
          />
        ))}
        {views.length === 0 && <p className="adm-empty">No photos uploaded yet.</p>}
      </div>

      <div className="adm-field">
        <label htmlFor="upload-view" className="adm-label">
          Upload view photos
        </label>
        <input
          id="upload-view"
          ref={viewInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={!blobConfigured || uploading}
          onChange={(e) => upload(e.target.files, "view")}
        />
      </div>

      <h2 className="adm-h2">Certificate &amp; sticker</h2>
      <div className="adm-photo-grid">
        {product.certificate && (
          <ImageRow
            productId={product.id}
            image={product.certificate}
            canMoveUp={false}
            canMoveDown={false}
          />
        )}
        {product.sticker && (
          <ImageRow
            productId={product.id}
            image={product.sticker}
            canMoveUp={false}
            canMoveDown={false}
          />
        )}
      </div>

      <div className="adm-grid-2">
        <div className="adm-field">
          <label htmlFor="upload-cert" className="adm-label">
            Upload certificate
          </label>
          <input
            id="upload-cert"
            ref={certInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!blobConfigured || uploading}
            onChange={(e) => upload(e.target.files, "certificate")}
          />
        </div>
        <div className="adm-field">
          <label htmlFor="upload-sticker" className="adm-label">
            Upload sticker
          </label>
          <input
            id="upload-sticker"
            ref={stickerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!blobConfigured || uploading}
            onChange={(e) => upload(e.target.files, "sticker")}
          />
        </div>
      </div>

      {!blobConfigured && (
        <p className="adm-help">
          Photo uploads need the Vercel Blob store connected (BLOB_READ_WRITE_TOKEN).
        </p>
      )}
      {uploadError && (
        <p className="adm-error" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
