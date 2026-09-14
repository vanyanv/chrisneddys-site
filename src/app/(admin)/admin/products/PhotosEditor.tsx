"use client";

import { useRef, useState } from "react";
import type { AdminProduct, AdminProductImage } from "@/lib/catalogAdmin";
import { imageThumbSrc } from "@/lib/productImage";
import { reorderImagesAction, removeImageAction, updateImageAction } from "./actions";
import { usePointerListReorder } from "./usePointerListReorder";

type SingleKind = "certificate" | "sticker";

/** One view photo: thumb, drag handle, label/alt (autosave on blur — these
 * two fields are NOT part of the sheet's batched Save, they commit
 * immediately like the Live pill and drag reorder), Remove. */
function ViewRow({
  productId,
  photoDir,
  image,
  isCover,
  dragHandleRef,
  dragHandleProps,
  isDragging,
  onRemoved,
  onFieldSaved,
}: {
  productId: string;
  photoDir: string | null;
  image: AdminProductImage;
  isCover: boolean;
  dragHandleRef: (el: HTMLButtonElement | null) => void;
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  };
  isDragging: boolean;
  onRemoved: (imageId: string) => void;
  onFieldSaved: (imageId: string, patch: Partial<AdminProductImage>) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const thumb = imageThumbSrc(photoDir, image);

  async function saveField(field: "label" | "alt", value: string) {
    if (value === image[field]) return;
    const fd = new FormData();
    fd.append("imageId", image.id);
    fd.append("productId", productId);
    fd.append("label", field === "label" ? value : image.label);
    fd.append("alt", field === "alt" ? value : image.alt);
    const result = await updateImageAction(undefined, fd);
    if (!result.ok) setError(result.error ?? "Couldn't save.");
    else {
      setError(null);
      onFieldSaved(image.id, { [field]: value } as Partial<AdminProductImage>);
    }
  }

  async function remove() {
    setRemoving(true);
    const fd = new FormData();
    fd.append("imageId", image.id);
    fd.append("productId", productId);
    await removeImageAction(fd);
    onRemoved(image.id);
  }

  return (
    <div className={`adm-photo-row${isDragging ? " is-dragging" : ""}`}>
      <button
        type="button"
        className="adm-drag-handle"
        aria-label={`Reorder ${image.label || "photo"}`}
        ref={dragHandleRef}
        {...dragHandleProps}
      >
        ⣿
      </button>
      {thumb ? (
        <img className="adm-photo-thumb" src={thumb} alt="" width={72} height={72} />
      ) : (
        <span className="adm-photo-thumb adm-thumb-empty" aria-hidden="true" />
      )}
      <div className="adm-photo-fields">
        {isCover && <span className="adm-label">Cover</span>}
        <label htmlFor={`label-${image.id}`} className="adm-sr-only">
          Label
        </label>
        <input
          id={`label-${image.id}`}
          className="adm-input"
          defaultValue={image.label}
          onBlur={(e) => saveField("label", e.target.value)}
        />
        <label htmlFor={`alt-${image.id}`} className="adm-sr-only">
          Alt text
        </label>
        <textarea
          id={`alt-${image.id}`}
          className="adm-textarea"
          rows={2}
          defaultValue={image.alt}
          onBlur={(e) => saveField("alt", e.target.value)}
        />
        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="adm-photo-actions">
        <button
          type="button"
          className="adm-btn adm-btn-danger"
          disabled={removing}
          onClick={remove}
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </div>
    </div>
  );
}

function SingleSlot({
  productId,
  photoDir,
  kind,
  image,
  blobConfigured,
  onChanged,
}: {
  productId: string;
  photoDir: string | null;
  kind: SingleKind;
  image: AdminProductImage | null;
  blobConfigured: boolean;
  onChanged: (kind: SingleKind, image: AdminProductImage | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thumb = image ? imageThumbSrc(photoDir, image) : null;

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("productId", productId);
      fd.append("kind", kind);
      fd.append("viewId", kind);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        id?: string;
        urlFull?: string;
        urlThumb?: string;
      };
      if (!res.ok || !json.ok || !json.id) throw new Error(json.error ?? "Upload failed.");
      onChanged(kind, {
        id: json.id,
        viewId: kind,
        label: kind.toUpperCase(),
        alt: `${kind} photo`,
        src: "",
        urlFull: json.urlFull ?? null,
        urlThumb: json.urlThumb ?? null,
        position: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!image) return;
    const fd = new FormData();
    fd.append("imageId", image.id);
    fd.append("productId", productId);
    await removeImageAction(fd);
    onChanged(kind, null);
  }

  return (
    <div className="adm-photo-row">
      {thumb ? (
        <img className="adm-photo-thumb" src={thumb} alt="" width={72} height={72} />
      ) : (
        <span className="adm-photo-thumb adm-thumb-empty" aria-hidden="true" />
      )}
      <div className="adm-photo-fields">
        <span className="adm-label">{kind}</span>
        <label htmlFor={`upload-${kind}`} className="adm-sr-only">
          Upload {kind}
        </label>
        <input
          id={`upload-${kind}`}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!blobConfigured || uploading}
          onChange={(e) => upload(e.target.files)}
        />
        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {image && (
        <div className="adm-photo-actions">
          <button type="button" className="adm-btn adm-btn-danger" onClick={remove}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export function PhotosEditor({
  product,
  blobConfigured,
  onProductPatch,
}: {
  product: AdminProduct;
  blobConfigured: boolean;
  onProductPatch: (patch: Partial<AdminProduct>) => void;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const views = [...product.views].sort((a, b) => a.position - b.position);
  const viewIds = views.map((v) => v.id);

  const reorder = usePointerListReorder(viewIds, (orderedIds) => {
    void reorderImagesAction(product.id, orderedIds).then(() => {
      const byId = new Map(views.map((v) => [v.id, v]));
      onProductPatch({
        views: orderedIds
          .map((id, i) => {
            const v = byId.get(id);
            return v ? { ...v, position: i } : null;
          })
          .filter((v): v is AdminProductImage => v !== null),
      });
    });
  });

  const orderedViews = reorder.order
    .map((id) => views.find((v) => v.id === id))
    .filter((v): v is AdminProductImage => v !== undefined);

  function removeView(imageId: string) {
    onProductPatch({ views: product.views.filter((v) => v.id !== imageId) });
  }

  function patchView(imageId: string, patch: Partial<AdminProductImage>) {
    onProductPatch({
      views: product.views.map((v) => (v.id === imageId ? { ...v, ...patch } : v)),
    });
  }

  async function addView(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("productId", product.id);
        fd.append("kind", "view");
        fd.append("viewId", `view-${product.views.length + 1}`);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          id?: string;
          urlFull?: string;
          urlThumb?: string;
        };
        if (!res.ok || !json.ok || !json.id) throw new Error(json.error ?? "Upload failed.");
        onProductPatch({
          views: [
            ...product.views,
            {
              id: json.id,
              viewId: `view-${product.views.length + 1}`,
              label: "VIEW",
              alt: "Product photo — edit this alt text",
              src: "",
              urlFull: json.urlFull ?? null,
              urlThumb: json.urlThumb ?? null,
              position: product.views.length,
            },
          ],
        });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (addInputRef.current) addInputRef.current.value = "";
    }
  }

  return (
    <section>
      <h4 className="adm-group-label">Photos</h4>
      <div className="adm-photo-grid">
        {orderedViews.map((image, i) => (
          <ViewRow
            key={image.id}
            productId={product.id}
            photoDir={product.photoDir}
            image={image}
            isCover={i === 0}
            isDragging={reorder.draggingId === image.id}
            dragHandleRef={reorder.registerRef(image.id)}
            dragHandleProps={{
              onPointerDown: reorder.onPointerDownHandle(image.id),
              onPointerMove: reorder.onPointerMoveHandle,
              onPointerUp: reorder.onPointerUpHandle,
            }}
            onRemoved={removeView}
            onFieldSaved={patchView}
          />
        ))}
        {orderedViews.length === 0 && <p className="adm-empty">No photos uploaded yet.</p>}
      </div>
      <div className="adm-field">
        <label htmlFor={`add-view-${product.id}`} className="adm-label">
          Add view photos
        </label>
        <input
          id={`add-view-${product.id}`}
          ref={addInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={!blobConfigured || uploading}
          onChange={(e) => addView(e.target.files)}
        />
      </div>
      {uploadError && (
        <p className="adm-error" role="alert">
          {uploadError}
        </p>
      )}

      <h4 className="adm-group-label">Certificate &amp; sticker</h4>
      <div className="adm-photo-grid">
        <SingleSlot
          productId={product.id}
          photoDir={product.photoDir}
          kind="certificate"
          image={product.certificate}
          blobConfigured={blobConfigured}
          onChanged={(_, image) => onProductPatch({ certificate: image })}
        />
        <SingleSlot
          productId={product.id}
          photoDir={product.photoDir}
          kind="sticker"
          image={product.sticker}
          blobConfigured={blobConfigured}
          onChanged={(_, image) => onProductPatch({ sticker: image })}
        />
      </div>
      {!blobConfigured && (
        <p className="adm-help">
          Photo uploads need the Vercel Blob store connected (BLOB_READ_WRITE_TOKEN).
        </p>
      )}
    </section>
  );
}
