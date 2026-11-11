import { describe, expect, it } from "vitest";
import { shoppingCategory } from "./shoppingCategory";

describe("shopping categories", () => {
  it.each([
    ["Born to Fly — Goose Pilot Mouse Pad", "Electronics", "Office & Desk Accessories"],
    ["Sunflower & Blue Wildflower — Botanical Cotton Canvas Tote", "Physical Products", "Bags & Accessories"],
    ["Barn Hair. Don’t Care. — Horse Ceramic Mug, 11oz", "Horse & Equestrian", "Home & Kitchen"],
    ["Dog Portrait T-Shirt", "Pet Supplies", "Clothing"],
    ["Garden Rose Necklace — LED Gift Box", "Electronics", "Jewelry"],
    ["USB keyboard", "Electronics", "Electronics"],
    ["Vintage saddle", "Horse & Equestrian", "Horse & Equestrian"],
    ["Unusual collectible", "Physical Products", "More Finds"],
  ])("groups %s by item type", (title, original, expected) => {
    expect(shoppingCategory(title, original)).toBe(expected);
  });
});
