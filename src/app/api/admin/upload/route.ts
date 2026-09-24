/**
 * POST /api/admin/upload
 *
 * Owner-only. Accepts one product image as multipart form data, resizes it
 * with `sharp` into the three cuts the storefront expects (a 720px-wide WebP
 * at quality 82, a 400px-wide mid cut for the thumbnail strip, and a
 * 200px-wide thumb), uploads all three to Vercel Blob, and inserts (or
 * replaces) the corresponding `product_images` row.
 *
 * Requires `BLOB_READ_WRITE_TOKEN`. Never falls back to writing into
 * `public/` — an admin upload with no Blob store connected is a 400, not a
 * silent write to the deployed bundle.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { getOwnerSession } from "@/lib/auth";
import { addImage, getProductForAdmin, type ImageKind } from "@/lib/catalogAdmin";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FULL_WIDTH = 720;
const MID_WIDTH = 400;
const THUMB_WIDTH = 200;
const WEBP_QUALITY = 82;

function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return badRequest(
      "Photo uploads need the Vercel Blob store connected (BLOB_READ_WRITE_TOKEN).",
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const productId = String(formData.get("productId") ?? "");
  const kind = String(formData.get("kind") ?? "view") as ImageKind;
  const label = String(formData.get("label") ?? "VIEW").trim() || "VIEW";
  const requestedViewId = String(formData.get("viewId") ?? "").trim();

  if (!(file instanceof File)) return badRequest("No file uploaded.");
  if (!productId) return badRequest("Missing product id.");
  if (!["view", "certificate", "sticker"].includes(kind)) return badRequest("Bad image kind.");
  if ((kind === "certificate" || kind === "sticker") && !requestedViewId) {
    return badRequest("Certificate/sticker uploads need a viewId.");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return badRequest("Only JPEG, PNG or WebP images are accepted.");
  }
  if (file.size > MAX_BYTES) {
    return badRequest("Images must be 20 MB or smaller.");
  }

  const viewId = kind === "view" ? requestedViewId || crypto.randomUUID() : requestedViewId;
  // Empty until the owner writes one: the admin flags an image with no alt
  // text, and the shop falls back to the product's name (`shopperAlt`), so a
  // placeholder addressed to the owner never reaches a customer.
  const alt = "";

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const source = sharp(inputBuffer);
  const metadata = await source.metadata();

  const fullPipeline = sharp(inputBuffer).resize({ width: FULL_WIDTH, withoutEnlargement: true });
  const midPipeline = sharp(inputBuffer).resize({ width: MID_WIDTH, withoutEnlargement: true });
  const thumbPipeline = sharp(inputBuffer).resize({ width: THUMB_WIDTH, withoutEnlargement: true });

  const [fullResult, midResult, thumbResult] = await Promise.all([
    fullPipeline.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true }),
    midPipeline.webp({ quality: WEBP_QUALITY }).toBuffer(),
    thumbPipeline.webp({ quality: WEBP_QUALITY }).toBuffer(),
  ]);

  const basePath = `products/${productId}/${viewId}-${Date.now()}`;

  const [fullBlob, midBlob, thumbBlob] = await Promise.all([
    put(`${basePath}.webp`, fullResult.data, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
      token,
    }),
    put(`${basePath}-mid.webp`, midResult, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
      token,
    }),
    put(`${basePath}-thumb.webp`, thumbResult, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/webp",
      token,
    }),
  ]);

  const width = fullResult.info.width || metadata.width || FULL_WIDTH;
  const height = fullResult.info.height || metadata.height || FULL_WIDTH;

  const row = await addImage({
    productId,
    kind,
    viewId,
    label,
    alt,
    urlFull: fullBlob.url,
    urlMid: midBlob.url,
    urlThumb: thumbBlob.url,
    width,
    height,
  });

  const product = await getProductForAdmin(productId);
  if (product) {
    revalidateTag("catalogue");
    revalidatePath("/shop/");
    revalidatePath(`/shop/${product.slug}/`);
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    urlFull: fullBlob.url,
    urlMid: midBlob.url,
    urlThumb: thumbBlob.url,
    width,
    height,
  });
}
