/** QR code as an SVG path, drawn on the server so no script is needed. */
import QRCode from "qrcode";

export type QrDrawing = { size: number; path: string };

/** `size` is the grid width in modules; `path` fills every dark module (1 unit each). */
export function qrDrawing(text: string): QrDrawing {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = modules.size;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, path };
}
