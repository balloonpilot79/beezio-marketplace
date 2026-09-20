import { getBuyerFacingProductPrice } from "./buyerPrice";
import { normalizeProductImages } from "./imageHelpers";

export interface HomeProduct {
  id: string;
  title: string;
  price: number;
  image: string | null;
  seller: string;
  category: string;
  available: boolean;
}

export function prepareHomeProducts(rows: any[]): HomeProduct[] {
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const status = String(row?.status || "").toLowerCase();
      if (
        !row?.id ||
        seen.has(String(row.id)) ||
        !row.title ||
        row.is_digital === true ||
        row.catalog_preview ||
        row.is_active === false ||
        ["draft", "archived", "store_only"].includes(status)
      )
        return false;
      const price = getBuyerFacingProductPrice(row);
      if (!(price > 0) || !Number.isFinite(price)) return false;
      seen.add(String(row.id));
      return true;
    })
    .map((row) => {
      const stock = row.stock_quantity ?? row.total_inventory;
      const knownStock =
        stock != null &&
        String(stock).trim() !== "" &&
        Number.isFinite(Number(stock));
      const backorder =
        String(row.dropship_provider || "")
          .toLowerCase()
          .includes("cj") ||
        String(row.lineage || "")
          .toUpperCase()
          .includes("CJ");
      const available =
        backorder ||
        row.track_inventory === false ||
        (knownStock
          ? Number(stock) > 0
          : !(row.track_inventory === true && row.in_stock === false));
      return {
        id: String(row.id),
        title: String(row.title),
        price: getBuyerFacingProductPrice(row),
        image:
          normalizeProductImages(
            Array.isArray(row.images)
              ? row.images.length
                ? row.images
                : row.primary_image_url || row.image_url
              : row.images || row.primary_image_url || row.image_url,
          )[0] || null,
        seller: String(row.profiles?.full_name || "Independent seller"),
        category: String(row.category_name || row.category || "Discover more"),
        available,
      };
    })
    .sort((a, b) => Number(b.available) - Number(a.available));
}
