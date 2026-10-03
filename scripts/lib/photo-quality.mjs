/**
 * Per-photo encoding for the menu photo pipeline: each cut is encoded at the
 * lowest quality that still looks like the lossless master at that size,
 * rather than one fixed quality for every photo.
 *
 * "Looks like" is measured with SSIM (structural similarity) on the luma
 * channel and on both chroma channels, computed here on raw pixels so the
 * pipeline needs nothing beyond `sharp`. A white-sweep shake and a busy
 * tray of loaded fries need very different qualities to reach the same score,
 * which is the point: the plain photos come out smaller and the busy ones
 * keep their detail.
 */
import sharp from "sharp";

/** RGB -> Y, Cb, Cr planes (BT.601, full range). */
function planes(rgb, n) {
  const y = new Float32Array(n);
  const cb = new Float32Array(n);
  const cr = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const r = rgb[p];
    const g = rgb[p + 1];
    const b = rgb[p + 2];
    y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    cb[i] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    cr[i] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  }
  return [y, cb, cr];
}

/** Mean SSIM over 8x8 windows on a 4px stride. */
function ssimPlane(a, b, w, h) {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let sum = 0;
  let count = 0;
  for (let y0 = 0; y0 + 8 <= h; y0 += 4) {
    for (let x0 = 0; x0 + 8 <= w; x0 += 4) {
      let ma = 0;
      let mb = 0;
      for (let y = y0; y < y0 + 8; y++) {
        for (let x = x0; x < x0 + 8; x++) {
          ma += a[y * w + x];
          mb += b[y * w + x];
        }
      }
      ma /= 64;
      mb /= 64;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let y = y0; y < y0 + 8; y++) {
        for (let x = x0; x < x0 + 8; x++) {
          const da = a[y * w + x] - ma;
          const db = b[y * w + x] - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      }
      va /= 63;
      vb /= 63;
      cov /= 63;
      sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return sum / count;
}

/** Luma and chroma SSIM of `encoded` against the `ref` raw RGB buffer. */
export async function similarity(ref, encoded, width, height) {
  const got = await sharp(encoded).removeAlpha().raw().toBuffer();
  const n = width * height;
  const [ya, cba, cra] = planes(ref, n);
  const [yb, cbb, crb] = planes(got, n);
  return {
    luma: ssimPlane(ya, yb, width, height),
    chroma: Math.min(ssimPlane(cba, cbb, width, height), ssimPlane(cra, crb, width, height)),
  };
}

// The search runs at a quicker effort; the file written is re-encoded at the
// full effort, which only ever comes out smaller at the same quality.
const ENCODERS = {
  avif: (img, quality, effort) => img.avif({ quality, effort, chromaSubsampling: "4:2:0" }),
  webp: (img, quality, effort) => img.webp({ quality, effort, smartSubsample: true }),
};
const EFFORT = { search: 3, final: 6 };
const RANGE = { avif: [30, 80], webp: [50, 95] };

/**
 * Encode `ref` (raw RGB, `width` x `height`) as `format` at the lowest quality
 * whose luma SSIM reaches `target.luma` and chroma SSIM `target.chroma`
 * (binary search, so about five encodes). Falls back to the top of the range
 * if nothing reaches the target.
 */
export async function encodeToTarget(ref, width, height, format, target) {
  const img = () => sharp(ref, { raw: { width, height, channels: 3 } });
  let [lo, hi] = RANGE[format];
  let best = null;
  while (lo <= hi) {
    const q = Math.floor((lo + hi) / 2);
    const buf = await ENCODERS[format](img(), q, EFFORT.search).toBuffer();
    const s = await similarity(ref, buf, width, height);
    if (s.luma >= target.luma && s.chroma >= target.chroma) {
      best = { quality: q, ...s };
      hi = q - 1;
    } else {
      lo = q + 1;
    }
  }
  const quality = best ? best.quality : RANGE[format][1];
  const buf = await ENCODERS[format](img(), quality, EFFORT.final).toBuffer();
  return { buf, quality, ...(await similarity(ref, buf, width, height)) };
}
