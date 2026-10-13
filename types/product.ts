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
 * - Size: S
 * - Color: Black
 * - Size + Color: M / Black
 *
 * Each variant can have its own SKU, stock, price and images.
 */
export type ProductVariant = {
  /** Unique variant ID inside the product. */
  id: string;

  /** Seller-defined SKU. */
  sku: string;

  /** Variant type. */
  variantType: ProductVariantType;

  /** Display value, e.g. "S", "Black", or "M / Black". */
  name: string;

  /** Size value when applicable. */
  size?: string;

  /** Color value when applicable. */
  color?: string;

  /** Custom variant value, e.g. "Pack A" or "Regular". */
  value?: string;

  /**
   * Variant-specific selling price.
   * Optional so products can continue using product-level retailPrice.
   */
  price?: number;

  /** Variant-specific MRP. */
  mrp?: number;

  /** Variant-specific inventory. */
  stock: number;

  /** Variant-specific images; product-level images can be used if empty. */
  images?: string[];

  /** Whether customers can purchase this variant. */
  status: "active" | "inactive" | "out_of_stock";

  /** Optional barcode / EAN / UPC. */
  barcode?: string;

  /** Optional seller-specific metadata. */
  metadata?: Record<string, string | number | boolean>;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/**
 * Variant configuration for a product.
 *
 * Example:
 * type = "SIZE_COLOR"
 * sizes = ["S", "M", "L"]
 * colors = ["Black", "White"]
 */
export type ProductVariantConfiguration = {
  enabled: boolean;
  type: ProductVariantType;
  sizes?: string[];
  colors?: string[];
  variants: ProductVariant[];
};

/* =========================================================
   SIZE CHART
   ========================================================= */

/**
 * One row in a product size chart.
 *
 * `measurements` is kept as a string so the current admin form
 * and product details page can use values such as:
 * "Chest: 38 in, Length: 28 in"
 *
 * This also supports categories with different measurement fields
 * without forcing every category into the same fixed columns.
 */
export type ProductSizeChartRow = {
  size: string;
  measurements: string;
};

/**
 * Category-specific size chart configuration.
 *
 * Examples:
 * - Clothing: S, M, L, XL with chest/waist/length measurements
 * - Jeans: 28, 30, 32, 34 with waist/hip/length measurements
 * - Footwear: 6, 7, 8, 9 with foot-length measurements
 *
 * `enabled` is optional for backward compatibility with older
 * Firestore documents that may not contain a sizeChart field.
 */
export type ProductSizeChart = {
  enabled?: boolean;
  title?: string;
  unit?: string;
  rows?: ProductSizeChartRow[];
};

/* =========================================================
   WHOLESALE CONFIGURATION
   ========================================================= */

export type WholesaleConfiguration = {
  enabled: boolean;

  /**
   * How wholesale quantity is sold.
   *
   * PIECE: Customer buys individual pieces.
   * SET: Customer must buy complete sets.
   */
  saleUnit: WholesaleUnit;

  /** false = a complete set is mandatory and cannot be broken. */
  setBreakAllowed: boolean;

  /** Number of pieces in one complete set. */
  setSize?: number;

  /** Name displayed to buyers, e.g. "Size Set" or "6 Color Set". */
  setName?: string;

  /** Size / colour / size-colour composition of one complete set. */
  composition?: SetCompositionItem[];

  /**
   * Minimum number of wholesale units/sets that must be purchased.
   * For saleUnit = SET, use moqSets.
   * For saleUnit = PIECE, use moq.
   */
  moqSets?: number;

  /**
   * Wholesale price basis.
   * PIECE: tier price is per piece.
   * SET: tier price is per complete set.
   */
  priceUnit: WholesaleUnit;

  /**
   * Existing quantity-based wholesale tiers.
   * For PIECE, quantities are pieces; for SET, quantities are sets.
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
   * Maximum 10 images is enforced by the product upload/edit flow.
   */
  images: string[];

  /** Maximum Retail Price. */
  mrp: number;

  /** Retail selling price. Retail remains piece-based. */
  retailPrice: number;

  /**
   * Existing base wholesale price, kept for backward compatibility.
   * Actual price can be calculated from wholesaleConfiguration.tiers.
   */
  wholesalePrice: number;

  /**
   * Existing wholesale MOQ.
   * For PIECE-based wholesale this is the minimum number of pieces.
   * For SET-based wholesale, use wholesaleConfiguration.moqSets.
   */
  moq: number;

  /**
   * Existing wholesale tiers, kept for backward compatibility.
   * New products should preferably use wholesaleConfiguration.tiers.
   */
  wholesaleTiers: WholesaleTier[];

  /**
   * How the product can be sold.
   * PIECE: individual piece.
   * SET: complete set/pack.
   * BOTH: retail/individual + wholesale set can coexist.
   */
  sellingMode?: ProductSellingMode;

  /**
   * Wholesale configuration.
   * Optional temporarily so existing Firestore products do not break.
   */
  wholesaleConfiguration?: WholesaleConfiguration;

  /**
   * Product variant configuration.
   * Optional temporarily so existing Firestore products do not break.
   */
  variantConfiguration?: ProductVariantConfiguration;

  /**
   * Category-specific size chart.
   *
   * Optional so existing Firestore products and older code remain
   * compatible. The product details page should display it only when
   * enabled is true and at least one valid row exists.
   */
  sizeChart?: ProductSizeChart;

  /**
   * Total inventory.
   * For normal piece products: number of pieces.
   * For products with variants: aggregate inventory across variants.
   * For set products: interpret together with set configuration.
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
