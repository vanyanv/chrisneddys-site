import type { Metadata } from "next";
import "@/styles/catering-order.css";
import { pageMetadata } from "@/lib/seo";
import { FindForm } from "./FindForm";

export const metadata: Metadata = pageMetadata({
  title: "Find My Catering Orders",
  description: "Get an email with the links to every catering order placed with this email.",
  path: "/catering/find/",
});

/** O5: "Find my orders" — emails every order link for an address, never
 * revealing whether that address has any. */
export default function CateringFindPage() {
  return (
    <div className="cor-find">
      <FindForm />
    </div>
  );
}
