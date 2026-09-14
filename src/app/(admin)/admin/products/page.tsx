import { requireOwner } from "@/lib/auth";
import { listArchivedProductsForAdmin, listProductsForAdmin } from "@/lib/catalogAdmin";
import { ProductSheet } from "./ProductSheet";
import "@/styles/admin-sheet.css";

export const dynamic = "force-dynamic";

/** The Sheet — `/admin/products` is the admin home. Everything interactive
 * (header count/search/filter, the row grid, the expanded editor, the Save
 * bar) lives in `ProductSheet` (client) so it can update optimistically
 * without a full page reload; this server component only loads the data an
 * owner is allowed to see. */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  await requireOwner();
  const { open } = await searchParams;

  const [allRows, archived] = await Promise.all([
    listProductsForAdmin(),
    listArchivedProductsForAdmin(),
  ]);
  // `listProductsForAdmin` returns every status, archived included (see
  // ACTIONS.md) — archived products only belong in the "Archived (n)"
  // disclosure below, never in the main sheet grid.
  const rows = allRows.filter((row) => row.status !== "archived");

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return (
    <ProductSheet
      rows={rows}
      archived={archived}
      blobConfigured={blobConfigured}
      openId={open ?? null}
    />
  );
}
