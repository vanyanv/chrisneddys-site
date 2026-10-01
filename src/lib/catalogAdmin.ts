/**
 * The admin write layer — every `/admin/products` server action funnels its
 * database work through here. Unlike `src/lib/catalog.ts` (the storefront's
 * read layer, cached with `unstable_cache`) every read in this module is
 * uncached: an owner editing a product has to see what is actually in the
 * database, not a stale minute-old snapshot.
 *
 * Callers (server actions in `src/app/admin/products/actions.ts`) are
 * responsible for `requireOwner()` and for `revalidateTag("catalogue")` /
 * `revalidatePath` after a write that the storefront could see — nothing
 * here touches the cache.
 *
 * The code lives in `src/lib/catalogAdmin/`: `products` (create, update,
 * reorder, duplicate, publish), `fields` (autosave and the Save bar's
 * batch), `inventory` (the run), `images`, `lists` (the admin's reads), and
 * `shared`. This file is the one import path for all of it.
 */
export {
  type CreateDraftResult,
  type DuplicateProductResult,
  type ProductPatch,
  type ReorderProductsResult,
  type SetStatusResult,
  type UpdateProductResult,
  backfillDraftSeo,
  createDraft,
  duplicateProduct,
  reorderProducts,
  setStatus,
  updateProduct,
} from "./catalogAdmin/products";
export {
  type ApplyProductChangesResult,
  type ProductChange,
  type ProductField,
  type ProductFieldValues,
  type UpdateProductFieldResult,
  applyProductChanges,
  updateProductField,
} from "./catalogAdmin/fields";
export {
  EditionSizeLockedError,
  type InventoryMode,
  type SetInventoryResult,
  setEditionAside,
  setInventory,
  setOnlineCount,
} from "./catalogAdmin/inventory";
export {
  type AddImageInput,
  type ImageKind,
  type ReorderImagesResult,
  type UpdateImageResult,
  addImage,
  removeImage,
  reorderImages,
  updateImage,
} from "./catalogAdmin/images";
export {
  type AdminEdition,
  type AdminInventorySummary,
  type AdminProduct,
  type AdminProductImage,
  type AdminProductListRow,
  getProductForAdmin,
  listArchivedProductsForAdmin,
  listProductsForAdmin,
} from "./catalogAdmin/lists";
