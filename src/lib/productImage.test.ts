import { describe, expect, it } from "vitest";
import {
  LEGACY_PLACEHOLDER_ALT,
  imageFullSrc,
  imageThumbSrc,
  needsAltText,
  shopperAlt,
  thumbStripSrcSet,
} from "./productImage";

const seeded = { src: "front", urlFull: null, urlThumb: null };
const uploaded = {
  src: "",
  urlFull: "https://x.public.blob.vercel-storage.com/a.webp",
  urlThumb: "https://x.public.blob.vercel-storage.com/a-thumb.webp",
};

describe("imageThumbSrc", () => {
  it("builds the repo path for a seeded image, which is what the admin was missing", () => {
    expect(imageThumbSrc("/shop/foam-trucker-blue", seeded)).toBe(
      "/shop/foam-trucker-blue/front-thumb.webp",
    );
  });

  it("prefers the uploaded blob thumb over anything derived", () => {
    expect(imageThumbSrc("/shop/foam-trucker-blue", uploaded)).toBe(uploaded.urlThumb);
  });

  it("falls back to the full blob url when only that was stored", () => {
    expect(imageThumbSrc(null, { src: "", urlFull: uploaded.urlFull, urlThumb: null })).toBe(
      uploaded.urlFull,
    );
  });

  it("returns null when there is no photoDir to build a path from", () => {
    expect(imageThumbSrc(null, seeded)).toBeNull();
  });

  it("returns null when the row names no image at all", () => {
    expect(
      imageThumbSrc("/shop/foam-trucker-blue", { src: "", urlFull: null, urlThumb: null }),
    ).toBeNull();
  });
});

describe("imageFullSrc", () => {
  it("builds the 720px cut for a seeded image", () => {
    expect(imageFullSrc("/shop/foam-trucker-blue", seeded)).toBe(
      "/shop/foam-trucker-blue/front.webp",
    );
  });

  it("prefers the uploaded blob url", () => {
    expect(imageFullSrc("/shop/foam-trucker-blue", uploaded)).toBe(uploaded.urlFull);
  });
});

describe("shopperAlt", () => {
  it("never hands a shopper the old upload placeholder", () => {
    expect(shopperAlt(LEGACY_PLACEHOLDER_ALT, "Foam Trucker")).toBe("Foam Trucker");
    expect(shopperAlt("", "Foam Trucker")).toBe("Foam Trucker");
    expect(needsAltText(LEGACY_PLACEHOLDER_ALT)).toBe(true);
  });

  it("keeps the owner's own alt text", () => {
    expect(shopperAlt("Front of the blue hat", "Foam Trucker")).toBe("Front of the blue hat");
    expect(needsAltText("Front of the blue hat")).toBe(false);
  });
});

describe("thumbStripSrcSet", () => {
  const base = "/shop/foam-trucker-blue/front";
  const thumbSrc = `${base}-thumb.webp`;
  const fullSrc = `${base}.webp`;

  it("offers the repo photography's own -mid.webp cut in the strip", () => {
    expect(thumbStripSrcSet({ thumb: true, base, thumbSrc, fullSrc })).toBe(
      `${thumbSrc} 200w, ${base}-mid.webp 400w, ${fullSrc} 720w`,
    );
  });

  it("offers an upload's stored midUrl in the strip when one was saved", () => {
    const url = "https://x.public.blob.vercel-storage.com/a.webp";
    const uploadedThumbSrc = "https://x.public.blob.vercel-storage.com/a-thumb.webp";
    const midUrl = "https://x.public.blob.vercel-storage.com/a-mid.webp";
    expect(
      thumbStripSrcSet({
        thumb: true,
        base,
        thumbSrc: uploadedThumbSrc,
        fullSrc: url,
        url,
        thumbUrl: uploadedThumbSrc,
        midUrl,
      }),
    ).toBe(`${uploadedThumbSrc} 200w, ${midUrl} 400w, ${url} 720w`);
  });

  it("falls back to the plain 200w/720w pair for an upload with no midUrl (no backfill)", () => {
    const url = "https://x.public.blob.vercel-storage.com/a.webp";
    const uploadedThumbSrc = "https://x.public.blob.vercel-storage.com/a-thumb.webp";
    expect(
      thumbStripSrcSet({
        thumb: true,
        base,
        thumbSrc: uploadedThumbSrc,
        fullSrc: url,
        url,
        thumbUrl: uploadedThumbSrc,
      }),
    ).toBe(`${uploadedThumbSrc} 200w, ${url} 720w`);
  });

  it("uses the plain pair outside the thumbnail strip regardless of what's available", () => {
    expect(thumbStripSrcSet({ thumb: false, base, thumbSrc, fullSrc })).toBe(
      `${thumbSrc} 200w, ${fullSrc} 720w`,
    );
  });
});
