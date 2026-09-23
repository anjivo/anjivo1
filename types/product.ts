export type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

export type ProductSellingMode =
  | "PIECE"
  | "SET"
  | "BOTH";

export type WholesaleUnit =
  | "PIECE"
  | "SET";

export type SetVariantType =
  | "SIZE"
  | "COLOR"
  | "SIZE_COLOR"
  | "CUSTOM";

export type SetCompositionItem = {
  variantType: SetVariantType;

  value: string;

  quantity: number;

  size?: string;

  color?: string;
};

/* =========================================================
   PRODUCT VARIANTS
   ========================================================= */

export type ProductVariantType =
  | "SIZE"
  | "COLOR"
  | "SIZE_COLOR"
  | "CUSTOM";

/**
 * Individual purchasable variant.
 *
 * Examples:
 *
 * Size:
 * S
 *
 * Color:
 * Black
 *
 * Size + Color:
 * M / Black
 *
 * Each variant can have its own:
 * - SKU
 * - stock
 * - price
 * - images
 */
export type ProductVariant = {
  /**
   * Unique variant ID inside the product.
   *
   * Example:
   * "var_s_black"
   */
  id: string;

  /**
   * Seller-defined SKU.
   */
  sku: string;

  /**
   * Variant type.
   */
  variantType: ProductVariantType;

  /**
   * Display value.
   *
   * Examples:
   * "S"
   * "Black"
   * "M / Black"
   */
  name: string;

  /**
   * Size value when applicable.
   */
  size?: string;

  /**
   * Color value when applicable.
   */
  color?: string;

  /**
   * Custom variant value.
   *
   * Example:
   * "Pack A"
   * "Regular"
   */
  value?: string;

  /**
   * Variant-specific selling price.
   *
   * Optional so products can continue using
   * product-level retailPrice.
   */
  price?: number;

  /**
   * Variant-specific MRP.
   */
  mrp?: number;

  /**
   * Variant-specific inventory.
   */
  stock: number;

  /**
   * Variant-specific images.
   *
   * If empty, product-level images can be used.
   */
  images?: string[];

  /**
   * Whether customers can purchase this variant.
   */
  status: "active" | "inactive" | "out_of_stock";

  /**
   * Optional barcode / EAN / UPC.
   */
  barcode?: string;

  /**
   * Optional seller-specific metadata.
   */
  metadata?: Record<string, string | number | boolean>;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/**
 * Variant configuration for a product.
 *
 * Example:
 *
 * variantType = SIZE_COLOR
 *
 * sizes = ["S", "M", "L"]
 *
 * colors = ["Black", "White"]
 */
export type ProductVariantConfiguration = {
  enabled: boolean;

  type: ProductVariantType;

  /**
   * Available size values.
   *
   * Example:
   * ["S", "M", "L", "XL"]
   */
  sizes?: string[];

  /**
   * Available color values.
   *
   * Example:
   * ["Black", "White", "Blue"]
   */
  colors?: string[];

  /**
   * Generated/custom variants.
   */
  variants: ProductVariant[];
};

/* =========================================================
   WHOLESALE CONFIGURATION
   ========================================================= */

export type WholesaleConfiguration = {
  enabled: boolean;

  /**
   * How wholesale quantity is sold.
   *
   * PIECE:
   * Customer buys individual pieces.
   *
   * SET:
   * Customer must buy complete sets.
   */
  saleUnit: WholesaleUnit;

  /**
   * Whether a wholesale set can be broken.
   *
   * false = complete set is mandatory.
   */
  setBreakAllowed: boolean;

  /**
   * Number of pieces in one complete set.
   *
   * Example:
   * 28, 30, 32, 34, 36
   * = 5 pieces per set.
   */
  setSize?: number;

  /**
   * Name displayed to buyers.
   *
   * Example:
   * "Size Set"
   * "6 Color Set"
   */
  setName?: string;

  /**
   * Size / colour / size-colour
   * composition of one complete set.
   */
  composition?: SetCompositionItem[];

  /**
   * Minimum number of wholesale
   * units/sets that must be purchased.
   *
   * If saleUnit = SET:
   * moqSets is used.
   *
   * If saleUnit = PIECE:
   * moq is used.
   */
  moqSets?: number;

  /**
   * Wholesale price basis.
   *
   * PIECE:
   * tier price is per piece.
   *
   * SET:
   * tier price is per complete set.
   */
  priceUnit: WholesaleUnit;

  /**
   * Existing quantity-based wholesale tiers.
   *
   * For PIECE:
   * minQuantity/maxQuantity = pieces.
   *
   * For SET:
   * minQuantity/maxQuantity = sets.
   */
  tiers: WholesaleTier[];
};

/* =========================================================
   PRODUCT
   ========================================================= */

export type Product = {
  id: string;

  name: string;
  slug: string;

  description?: string;

  categoryId: string;
  categoryName?: string;
  subcategoryId?: string;

  sellerId: string;
  sellerName?: string;
  sellerVerified?: boolean;

  /**
   * Product-level images.
   *
   * Maximum 10 images is enforced by
   * the product upload/edit flow.
   */
  images: string[];

  /**
   * Maximum Retail Price.
   */
  mrp: number;

  /**
   * Retail selling price.
   *
   * Retail remains piece-based.
   */
  retailPrice: number;

  /**
   * Existing base wholesale price.
   *
   * Kept for backward compatibility.
   *
   * Actual price can be calculated from
   * wholesaleConfiguration.tiers.
   */
  wholesalePrice: number;

  /**
   * Existing wholesale MOQ.
   *
   * For PIECE-based wholesale this remains
   * the minimum number of pieces.
   *
   * For SET-based wholesale, use
   * wholesaleConfiguration.moqSets.
   */
  moq: number;

  /**
   * Existing wholesale tiers.
   *
   * Kept for backward compatibility.
   *
   * New products should preferably use
   * wholesaleConfiguration.tiers.
   */
  wholesaleTiers: WholesaleTier[];

  /**
   * How the product can be sold.
   *
   * PIECE:
   * Individual piece.
   *
   * SET:
   * Complete set/pack.
   *
   * BOTH:
   * Retail/individual + wholesale set
   * can coexist.
   */
  sellingMode?: ProductSellingMode;

  /**
   * Wholesale configuration.
   *
   * Optional temporarily so existing
   * Firestore products do not break.
   */
  wholesaleConfiguration?: WholesaleConfiguration;

  /**
   * Product variant configuration.
   *
   * Optional temporarily so existing
   * Firestore products do not break.
   */
  variantConfiguration?: ProductVariantConfiguration;

  /**
   * Total inventory.
   *
   * For normal piece products:
   * number of pieces.
   *
   * For products with variants:
   * this can represent the aggregate
   * inventory across variants.
   *
   * For set products:
   * should be interpreted together with
   * set configuration.
   */
  stock: number;

  rating?: number;
  reviewsCount?: number;

  status:
    | "active"
    | "draft"
    | "out_of_stock"
    | "blocked";

  featured?: boolean;
  bestSeller?: boolean;
  trending?: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
};
