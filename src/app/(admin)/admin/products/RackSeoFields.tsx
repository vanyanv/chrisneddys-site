"use client";

import type { AdminProduct } from "@/lib/catalogAdmin";
import type { UsePendingChanges } from "./usePendingChanges";

/** "Search engines" inside the Rack panel's "More details": slug, page
 * title, meta description, keywords and the share picture, plus the "Write
 * with AI" button. Its busy flag and remount nonce live in
 * `RackMoreDetails`, outside the accordion body that `resetToken` remounts,
 * so a Save or Discard mid-write doesn't reset them. */
export function RackSeoFields({
  product,
  pendingApi,
  seoBusy,
  seoNonce,
  onGenerate,
}: {
  product: AdminProduct;
  pendingApi: UsePendingChanges;
  seoBusy: boolean;
  seoNonce: number;
  onGenerate: () => Promise<void>;
}) {
  const slugValue = String(pendingApi.getValue(product.id, "slug") ?? product.slug);
  const metaValue = String(
    pendingApi.getValue(product.id, "metaDescription") ?? product.metaDescription,
  );
  const metaTitleValue = String(
    pendingApi.getValue(product.id, "metaTitle") ?? product.metaTitle ?? "",
  );
  const metaKeywordsValue = String(
    pendingApi.getValue(product.id, "metaKeywords") ?? product.metaKeywords ?? "",
  );
  const socialImageUrlValue = String(
    pendingApi.getValue(product.id, "socialImageUrl") ?? product.socialImageUrl ?? "",
  );
  const socialImageAltValue = String(
    pendingApi.getValue(product.id, "socialImageAlt") ?? product.socialImageAlt ?? "",
  );

  return (
    <details className="adm-accordion">
      <summary>
        Search engines
        <svg
          className="adm-accordion-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" />
        </svg>
      </summary>
      <div className="adm-accordion-body" key={`seo-${pendingApi.resetToken}-${seoNonce}`}>
        <div className="adm-field">
          <button
            type="button"
            className="adm-btn"
            disabled={seoBusy}
            onClick={() => void onGenerate()}
          >
            Write with AI
          </button>
          <p className="adm-help">
            Fills in the four fields below from this product&rsquo;s name, price and description.
            Safe to run again &mdash; it replaces whatever is here now.
          </p>
        </div>
        <div className="adm-field">
          <label htmlFor={`slug-${product.id}`} className="adm-label">
            Slug
          </label>
          <input
            id={`slug-${product.id}`}
            className="adm-input"
            defaultValue={slugValue}
            pattern="^[a-z0-9\-]+$"
            onBlur={(e) => {
              const raw = e.target.value.trim().toLowerCase();
              if (raw === product.slug) pendingApi.clearValue(product.id, "slug");
              else pendingApi.setValue(product.id, "slug", raw);
            }}
          />
          <p className="adm-help">Lowercase letters, numbers and hyphens only.</p>
          {pendingApi.getError(product.id, "slug") && (
            <p className="adm-error" role="alert">
              {pendingApi.getError(product.id, "slug")}
            </p>
          )}
        </div>
        <div className="adm-field">
          <label htmlFor={`meta-title-${product.id}`} className="adm-label">
            Page title
          </label>
          <input
            id={`meta-title-${product.id}`}
            className="adm-input"
            maxLength={60}
            defaultValue={metaTitleValue}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const original = product.metaTitle ?? "";
              if (raw === original) pendingApi.clearValue(product.id, "metaTitle");
              else pendingApi.setValue(product.id, "metaTitle", raw || null);
            }}
          />
          <p className="adm-help">
            {metaTitleValue.length}/60 &middot; Leave it empty and the name and price fill it in.
          </p>
          {pendingApi.getError(product.id, "metaTitle") && (
            <p className="adm-error" role="alert">
              {pendingApi.getError(product.id, "metaTitle")}
            </p>
          )}
        </div>
        <div className="adm-field">
          <label htmlFor={`meta-${product.id}`} className="adm-label">
            Meta description
          </label>
          <textarea
            id={`meta-${product.id}`}
            className="adm-textarea"
            rows={2}
            maxLength={155}
            defaultValue={metaValue}
            onBlur={(e) => {
              if (e.target.value === product.metaDescription)
                pendingApi.clearValue(product.id, "metaDescription");
              else pendingApi.setValue(product.id, "metaDescription", e.target.value);
            }}
          />
          <p className="adm-help">{metaValue.length}/155</p>
        </div>
        <div className="adm-field">
          <label htmlFor={`meta-keywords-${product.id}`} className="adm-label">
            Keywords
          </label>
          <input
            id={`meta-keywords-${product.id}`}
            className="adm-input"
            maxLength={160}
            defaultValue={metaKeywordsValue}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const original = product.metaKeywords ?? "";
              if (raw === original) pendingApi.clearValue(product.id, "metaKeywords");
              else pendingApi.setValue(product.id, "metaKeywords", raw || null);
            }}
          />
          <p className="adm-help">
            Comma-separated. Search engines don&rsquo;t rank on these, so a short honest list beats
            a long one. Leave it empty and it&rsquo;s worked out from the product.
          </p>
          {pendingApi.getError(product.id, "metaKeywords") && (
            <p className="adm-error" role="alert">
              {pendingApi.getError(product.id, "metaKeywords")}
            </p>
          )}
        </div>
        <div className="adm-field">
          <label htmlFor={`social-url-${product.id}`} className="adm-label">
            Share picture
          </label>
          <input
            id={`social-url-${product.id}`}
            className="adm-input"
            defaultValue={socialImageUrlValue}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const original = product.socialImageUrl ?? "";
              if (raw === original) pendingApi.clearValue(product.id, "socialImageUrl");
              else pendingApi.setValue(product.id, "socialImageUrl", raw || null);
            }}
          />
          <p className="adm-help">
            Leave this empty and the card is drawn from the product automatically. If you set it, it
            needs to start with &ldquo;/&rdquo; or be a full https:// address.
          </p>
          {pendingApi.getError(product.id, "socialImageUrl") && (
            <p className="adm-error" role="alert">
              {pendingApi.getError(product.id, "socialImageUrl")}
            </p>
          )}
        </div>
        <div className="adm-field">
          <label htmlFor={`social-alt-${product.id}`} className="adm-label">
            Share picture alt text
          </label>
          <textarea
            id={`social-alt-${product.id}`}
            className="adm-textarea"
            rows={2}
            maxLength={125}
            defaultValue={socialImageAltValue}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              const original = product.socialImageAlt ?? "";
              if (raw === original) pendingApi.clearValue(product.id, "socialImageAlt");
              else pendingApi.setValue(product.id, "socialImageAlt", raw || null);
            }}
          />
          <p className="adm-help">
            {socialImageAltValue.length}/125 &middot; Leave it empty and it&rsquo;s worked out from
            the product.
          </p>
          {pendingApi.getError(product.id, "socialImageAlt") && (
            <p className="adm-error" role="alert">
              {pendingApi.getError(product.id, "socialImageAlt")}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}
