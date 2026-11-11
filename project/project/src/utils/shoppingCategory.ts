/** Buyer-facing categories shared by the homepage and marketplace. */
export function shoppingCategory(title: string, explicitCategory = ""): string {
  const explicit = explicitCategory.trim();
  // Classify the item itself, rather than the animal or hobby printed on it.
  if (/\bmouse\s*pad\b/i.test(title)) return "Office & Desk Accessories";
  if (/\b(tote|canvas bag)\b/i.test(title)) return "Bags & Accessories";
  if (/\b(t-?shirt|tee|hoodie|sweatshirt)\b/i.test(title)) return "Clothing";
  if (/\b(mug|tumbler|drinkware)\b/i.test(title)) return "Home & Kitchen";
  if (/\b(rug|blanket|throw pillow)\b/i.test(title)) return "Home & Kitchen";
  if (/\b(necklace|pendant|bracelet|earrings?|cuban link chain)\b/i.test(title)) return "Jewelry";
  if (/^(clothing|apparel|fashion|clothing & fashion)$/i.test(explicit)) return "Clothing";
  if (/^(physical products?|general|uncategorized|other)$/i.test(explicit)) return "More Finds";
  return explicit;
}
