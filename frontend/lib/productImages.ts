/**
 * High-quality curated product image mapping for AutoCommerce catalog.
 */

const PRODUCT_IMAGES: Record<string, string> = {
  // Direct SKU matches
  "TSHIRT-WHT-001": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80",
  "JEANS-BLU-002": "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80",
  "AUDIO-HDPH-003": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
  "SHOES-RUN-004": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80",
  "HOODIE-ORG-005": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
};

const CATEGORY_FALLBACKS: Record<string, string> = {
  Apparel: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&auto=format&fit=crop&q=80",
  Footwear: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=80",
  Electronics: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80",
  Accessories: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80";

export function getProductImage(sku?: string, category?: string, title?: string, imageUrl?: string): string {
  if (imageUrl && imageUrl.trim().length > 0) {
    return imageUrl.trim();
  }

  if (sku && PRODUCT_IMAGES[sku]) {
    return PRODUCT_IMAGES[sku];
  }

  // Check title keywords
  const titleLower = (title || "").toLowerCase();
  if (titleLower.includes("t-shirt") || titleLower.includes("shirt")) {
    return PRODUCT_IMAGES["TSHIRT-WHT-001"];
  }
  if (titleLower.includes("jean") || titleLower.includes("denim")) {
    return PRODUCT_IMAGES["JEANS-BLU-002"];
  }
  if (titleLower.includes("headphone") || titleLower.includes("audio") || titleLower.includes("earphone")) {
    return PRODUCT_IMAGES["AUDIO-HDPH-003"];
  }
  if (titleLower.includes("shoe") || titleLower.includes("running") || titleLower.includes("sneaker")) {
    return PRODUCT_IMAGES["SHOES-RUN-004"];
  }
  if (titleLower.includes("hoodie") || titleLower.includes("sweatshirt")) {
    return PRODUCT_IMAGES["HOODIE-ORG-005"];
  }

  if (category && CATEGORY_FALLBACKS[category]) {
    return CATEGORY_FALLBACKS[category];
  }

  return DEFAULT_IMAGE;
}
