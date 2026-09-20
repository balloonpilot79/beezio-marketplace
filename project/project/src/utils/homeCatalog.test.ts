import { describe, expect, it } from "vitest";
import { prepareHomeProducts } from "./homeCatalog";

const product = {
  id: "live",
  title: "Body Butter",
  is_active: true,
  status: "active",
  price: 30,
  calculated_customer_price: 51.67,
  stock_quantity: 4,
  category: "Body care",
  profiles: { full_name: "MareBelle" },
};

describe("homepage live catalog", () => {
  it("uses the published customer price and seller identity", () => {
    expect(prepareHomeProducts([product])[0]).toMatchObject({
      id: "live",
      title: "Body Butter",
      price: 51.67,
      seller: "MareBelle",
      category: "Body care",
      available: true,
    });
  });
  it.each([
    { is_digital: true },
    { status: "draft" },
    { status: "archived" },
    { status: "store_only" },
    { catalog_preview: true },
    { is_active: false },
    { id: "" },
    { title: "" },
    { price: 0, calculated_customer_price: 0 },
  ])(
    "does not promote unavailable or invalid catalog records: %j",
    (override) => {
      expect(prepareHomeProducts([{ ...product, ...override }])).toEqual([]);
    },
  );
  it("deduplicates products and places purchasable products before sold-out products", () => {
    const out = { ...product, id: "sold-out", stock_quantity: 0 };
    expect(
      prepareHomeProducts([out, product, product]).map((row) => [
        row.id,
        row.available,
      ]),
    ).toEqual([
      ["live", true],
      ["sold-out", false],
    ]);
  });
  it("respects untracked inventory and existing supplier backorder behavior", () => {
    expect(
      prepareHomeProducts([
        { ...product, stock_quantity: 0, track_inventory: false },
      ])[0].available,
    ).toBe(true);
    expect(
      prepareHomeProducts([
        { ...product, stock_quantity: 0, dropship_provider: "cj" },
      ])[0].available,
    ).toBe(true);
  });
  it("uses a neutral placeholder when there is no actual product image", () => {
    expect(prepareHomeProducts([product])[0].image).toBeNull();
  });
  it("falls back to the primary image when images is empty", () => {
    expect(
      prepareHomeProducts([
        {
          ...product,
          images: [],
          primary_image_url: "https://cdn.example.com/primary.jpg",
        },
      ])[0].image,
    ).toBe("https://cdn.example.com/primary.jpg");
  });
});
