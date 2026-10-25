import { qrDrawing } from "@/lib/closing/qr";

/** The sign that goes up in the back: red header, the QR, a line in each language.
 * The QR is drawn as an inline SVG path, so it prints crisp at any size. */
export function QrSign({ url, storeName }: { url: string; storeName: string }) {
  const { size, path } = qrDrawing(url);
  const quiet = 2;
  const box = size + quiet * 2;
  return (
    <div className="clo-qrsign">
      <div className="clo-qrsign-head">
        <b>Closing Check</b>
        <span>{storeName} · Staff only</span>
      </div>
      <div className="clo-qrsign-box">
        <svg
          viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
          role="img"
          aria-label={`QR code for the ${storeName} closing check`}
          shapeRendering="crispEdges"
        >
          <rect x={-quiet} y={-quiet} width={box} height={box} fill="#fff" />
          <path d={path} fill="#1a1612" />
        </svg>
      </div>
      <div className="clo-qrsign-foot">
        Scan with your phone camera at close.
        <br />
        <span lang="es">Escanea con la cámara al cerrar.</span>
      </div>
    </div>
  );
}
