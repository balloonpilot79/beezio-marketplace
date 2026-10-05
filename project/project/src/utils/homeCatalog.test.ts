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
  it.each([
    [{ affiliate_payout_amount: 7 }, 7],
    [{ commission_type: "flat_rate", flat_commission_amount: 5 }, 5],
    [{ affiliate_commission_type: "flat", affiliate_commission_value: 6 }, 6],
    [{ seller_ask: 20, commission_rate: 25 }, 5],
    [{ affiliate_payout_amount: 7, affiliate_enabled: false }, 0],
    [{}, 0],
  ])("preserves the configured affiliate earnings: %j", (fields, amount) => {
    expect(prepareHomeProducts([{ ...product, ...fields }])[0].affiliateAmount).toBe(amount);
  });
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
    { id: "721f1a14-645b-4aee-97b2-ec9ae780eeca" },
    { title: "" },
    { price: 0, calculated_customer_price: 0 },
  ])(
    "does not promote unavailable or invalid catalog records: %j",
    (override) => {
      expect(prepareHomeProducts([{ ...product, ...override }])).toEqual([]);
    },
  );
  it("deduplicates products and hides sold-out products", () => {
    const out = { ...product, id: "sold-out", stock_quantity: 0 };
    expect(
      prepareHomeProducts([out, product, product]).map((row) => [
        row.id,
        row.available,
      ]),
    ).toEqual([
      ["live", true],
    ]);
  });
  it("respects untracked inventory but hides tracked supplier stock at zero", () => {
    expect(
      prepareHomeProducts([
        { ...product, stock_quantity: 0, track_inventory: false },
      ])[0].available,
    ).toBe(true);
    expect(
      prepareHomeProducts([
        { ...product, stock_quantity: 0, dropship_provider: "cj" },
      ]),
    ).toEqual([]);
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
