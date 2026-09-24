"use client";

import { useRef, useState } from "react";
import type { AdminProduct, AdminProductImage } from "@/lib/catalogAdmin";
import { imageThumbSrc, needsAltText } from "@/lib/productImage";
import { reorderImagesAction, removeImageAction, updateImageAction } from "./actions";
import { usePointerListReorder } from "./usePointerListReorder";

type SingleKind = "certificate" | "sticker";

/** How long a first click on a remove control stays "armed" before it
 * reverts to a plain remove button — the confirm-on-second-click pattern
 * used instead of a dialog or a big red button. */
const REMOVE_CONFIRM_MS = 3000;

/** One cell in the compact 3-up photo grid: the thumb is a button that
 * selects it (showing its label/alt editor below the grid), the drag handle
 * and remove &times; only appear on hover/focus, and the first cell also
 * carries the COVER badge. */
function PhotoCell({
  image,
  photoDir,
  isCover,
  isSelected,
  onSelect,
  dragHandleRef,
  dragHandleProps,
  isDragging,
  confirmingRemove,
  onRemoveClick,
}: {
  image: AdminProductImage;
  photoDir: string | null;
  isCover: boolean;
  isSelected: boolean;
  onSelect: () => void;
  dragHandleRef: (el: HTMLButtonElement | null) => void;
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
  };
  isDragging: boolean;
  confirmingRemove: boolean;
  onRemoveClick: () => void;
}) {
  const thumb = imageThumbSrc(photoDir, image);
  const name = image.label || "photo";
  return (
    <div
      className={`adm-photo-cell${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <button
        type="button"
        className="adm-photo-select"
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <span className="adm-sr-only">{`Select ${name}`}</span>
        {thumb ? (
          <img className="adm-photo-thumb" src={thumb} alt="" />
        ) : (
          <span className="adm-photo-thumb adm-thumb-empty" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="adm-photo-drag"
        aria-label={`Reorder ${name}`}
        ref={dragHandleRef}
        {...dragHandleProps}
      >
        ⣿
      </button>
      {isCover && <span className="adm-photo-cover-badge">Cover</span>}
      <button
        type="button"
        className={`adm-photo-remove${confirmingRemove ? " is-confirm" : ""}`}
        aria-label={confirmingRemove ? `Confirm remove ${name}` : `Remove ${name}`}
        onClick={onRemoveClick}
      >
        &times;
      </button>
    </div>
  );
}

/** Certificate/sticker slot: same visual language as a grid cell (square,
 * select-to-replace, small &times; to remove) but standalone — labelled
 * above with its kind. */
function MiniSlot({
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
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumb = image ? imageThumbSrc(photoDir, image) : null;
  const inputId = `upload-${kind}-${productId}`;

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
        urlMid?: string;
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
        urlMid: json.urlMid ?? null,
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

  function handleRemoveClick() {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirming) {
      setConfirming(false);
      void remove();
      return;
    }
    setConfirming(true);
    confirmTimer.current = setTimeout(() => setConfirming(false), REMOVE_CONFIRM_MS);
  }

  return (
    <div className="adm-photo-mini-slot">
      <span className="adm-label">{kind}</span>
      <div
        className={`adm-photo-cell${image ? "" : " adm-photo-cell-empty"}${!blobConfigured && !image ? " is-disabled" : ""}`}
      >
        <label className="adm-photo-select" htmlFor={inputId}>
          <span className="adm-sr-only">{image ? `Replace ${kind}` : `Upload ${kind}`}</span>
          {thumb ? (
            <img className="adm-photo-thumb" src={thumb} alt="" />
          ) : (
            <span className="adm-photo-add-tile" aria-hidden="true">
              +
            </span>
          )}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="adm-sr-only"
          disabled={!blobConfigured || uploading}
          onChange={(e) => upload(e.target.files)}
        />
        {image && (
          <button
            type="button"
            className={`adm-photo-remove${confirming ? " is-confirm" : ""}`}
            aria-label={confirming ? `Confirm remove ${kind}` : `Remove ${kind}`}
            onClick={handleRemoveClick}
          >
            &times;
          </button>
        )}
      </div>
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const selectedImage = selectedId ? (orderedViews.find((v) => v.id === selectedId) ?? null) : null;

  function patchView(imageId: string, patch: Partial<AdminProductImage>) {
    onProductPatch({
      views: product.views.map((v) => (v.id === imageId ? { ...v, ...patch } : v)),
    });
  }

  async function saveField(imageId: string, field: "label" | "alt", value: string) {
    const image = product.views.find((v) => v.id === imageId);
    if (!image || value === image[field]) return;
    const fd = new FormData();
    fd.append("imageId", imageId);
    fd.append("productId", product.id);
    fd.append("label", field === "label" ? value : image.label);
    fd.append("alt", field === "alt" ? value : image.alt);
    const result = await updateImageAction(undefined, fd);
    if (!result.ok) setFieldError(result.error ?? "Couldn't save.");
    else {
      setFieldError(null);
      patchView(imageId, { [field]: value } as Partial<AdminProductImage>);
    }
  }

  function handleRemoveClick(imageId: string) {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirmRemoveId === imageId) {
      setConfirmRemoveId(null);
      void removeView(imageId);
      return;
    }
    setConfirmRemoveId(imageId);
    confirmTimer.current = setTimeout(() => setConfirmRemoveId(null), REMOVE_CONFIRM_MS);
  }

  async function removeView(imageId: string) {
    const fd = new FormData();
    fd.append("imageId", imageId);
    fd.append("productId", product.id);
    await removeImageAction(fd);
    if (selectedId === imageId) setSelectedId(null);
    onProductPatch({ views: product.views.filter((v) => v.id !== imageId) });
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
          urlMid?: string;
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
              alt: "",
              src: "",
              urlFull: json.urlFull ?? null,
              urlMid: json.urlMid ?? null,
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

  const addInputId = `add-view-${product.id}`;

  return (
    <section>
      <h4 className="adm-group-label">Photos</h4>
      <div className="adm-photo-grid">
        {orderedViews.map((image, i) => (
          <PhotoCell
            key={image.id}
            image={image}
            photoDir={product.photoDir}
            isCover={i === 0}
            isSelected={selectedId === image.id}
            onSelect={() => setSelectedId((prev) => (prev === image.id ? null : image.id))}
            isDragging={reorder.draggingId === image.id}
            dragHandleRef={reorder.registerRef(image.id)}
            dragHandleProps={{
              onPointerDown: reorder.onPointerDownHandle(image.id),
              onPointerMove: reorder.onPointerMoveHandle,
              onPointerUp: reorder.onPointerUpHandle,
            }}
            confirmingRemove={confirmRemoveId === image.id}
            onRemoveClick={() => handleRemoveClick(image.id)}
          />
        ))}
        <div
          className={`adm-photo-cell adm-photo-cell-empty${!blobConfigured ? " is-disabled" : ""}`}
        >
          <label className="adm-photo-select" htmlFor={addInputId}>
            <span className="adm-sr-only">Add view photos</span>
            <span className="adm-photo-add-tile" aria-hidden="true">
              + Add
            </span>
          </label>
        </div>
      </div>
      <label htmlFor={addInputId} className="adm-sr-only">
        Add view photos
      </label>
      <input
        id={addInputId}
        ref={addInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="adm-sr-only"
        disabled={!blobConfigured || uploading}
        onChange={(e) => addView(e.target.files)}
      />
      {orderedViews.length === 0 && <p className="adm-empty">No photos uploaded yet.</p>}
      {uploadError && (
        <p className="adm-error" role="alert">
          {uploadError}
        </p>
      )}

      {selectedImage && (
        <div className="adm-photo-detail" key={selectedImage.id}>
          <div className="adm-field">
            <label htmlFor={`label-${selectedImage.id}`} className="adm-label">
              Label
            </label>
            <input
              id={`label-${selectedImage.id}`}
              className="adm-input"
              defaultValue={selectedImage.label}
              onBlur={(e) => saveField(selectedImage.id, "label", e.target.value)}
            />
          </div>
          <div className="adm-field">
            <label htmlFor={`alt-${selectedImage.id}`} className="adm-label">
              Alt text
            </label>
            <textarea
              id={`alt-${selectedImage.id}`}
              className="adm-textarea"
              rows={2}
              defaultValue={needsAltText(selectedImage.alt) ? "" : selectedImage.alt}
              placeholder="Describe the photo for someone who can't see it"
              onBlur={(e) => {
                // Leaving an empty box untouched is not an edit; saving it
                // would only trip the 8-character minimum.
                if (e.target.value === "" && needsAltText(selectedImage.alt)) return;
                saveField(selectedImage.id, "alt", e.target.value);
              }}
            />
            {needsAltText(selectedImage.alt) && (
              <p className="adm-help adm-help-warn">
                No alt text yet. The shop reads out the product name for this photo until you add
                one.
              </p>
            )}
          </div>
          {fieldError && (
            <p className="adm-error" role="alert">
              {fieldError}
            </p>
          )}
        </div>
      )}

      <h4 className="adm-group-label">Certificate &amp; sticker</h4>
      <div className="adm-photo-mini-grid">
        <MiniSlot
          productId={product.id}
          photoDir={product.photoDir}
          kind="certificate"
          image={product.certificate}
          blobConfigured={blobConfigured}
          onChanged={(_, image) => onProductPatch({ certificate: image })}
        />
        <MiniSlot
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
