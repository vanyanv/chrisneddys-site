import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductForAdmin } from "@/lib/catalogAdmin";
import { StandaloneEditor } from "./StandaloneEditor";

export const dynamic = "force-dynamic";

type Params = { id: string };

/** The Sheet's "Open full editor" target — the same three-group
 * `ProductEditor` the sheet's expanded row uses, full width, with its own
 * Save bar. */
export default async function AdminProductEditorPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const product = await getProductForAdmin(id);
  if (!product) notFound();

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return (
    <>
      <Link href="/admin/products" className="adm-row-link">
        &larr; All products
      </Link>
      <h1 className="adm-h1">{product.name}</h1>
      <StandaloneEditor product={product} blobConfigured={blobConfigured} />
    </>
  );
}
