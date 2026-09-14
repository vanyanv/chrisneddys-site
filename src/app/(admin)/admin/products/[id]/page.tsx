import { notFound } from "next/navigation";
import { getProductForAdmin } from "@/lib/catalogAdmin";
import { ProductForm } from "./ProductForm";
import { PhotosCard } from "./PhotosCard";
import { InventoryCard } from "./InventoryCard";
import { StatusCard } from "./StatusCard";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function AdminProductEditorPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const product = await getProductForAdmin(id);
  if (!product) notFound();

  const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return (
    <div className="adm-editor-grid">
      <div className="adm-editor-left">
        <ProductForm product={product} />
      </div>
      <div className="adm-editor-right">
        <PhotosCard product={product} blobConfigured={blobConfigured} />
        <InventoryCard product={product} />
        <StatusCard product={product} />
      </div>
    </div>
  );
}
