import Link from "next/link";
import { getDb } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { CLOSING_STORE } from "@/lib/closing/ownerText";
import { getOrCreateStore } from "@/lib/closing/store";
import { locations } from "@/data/locations";
import { absoluteUrl } from "@/lib/siteOrigin";
import { PrintButton } from "@/app/(admin)/admin/orders/[id]/packing-slip/PrintButton";
import { QrSign } from "../crew/QrSign";
import "@/styles/admin-rack.css";
import "@/styles/admin-closing.css";

export const dynamic = "force-dynamic";

/** The sign alone, sized for a US Letter sheet. Like the packing slip it draws
 * no admin chrome; `@media print` hides the Print / Back buttons. */
export default async function ClosingSignPage() {
  await requireOwner();
  const store = await getOrCreateStore(await getDb(), CLOSING_STORE);
  const storeName = locations.find((l) => l.id === CLOSING_STORE)?.name ?? CLOSING_STORE;
  return (
    <div className="rack-root clo-printpage">
      <div className="clo-noprint">
        <PrintButton />
        <Link href="/admin/closing/crew/" className="clo-btn">
          Back
        </Link>
      </div>
      <div className="clo-printsheet">
        <QrSign url={absoluteUrl(`/close/${store.linkToken}/`)} storeName={storeName} />
      </div>
    </div>
  );
}
