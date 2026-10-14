export type WholesaleTier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

export type ProductSellingMode = "PIECE" | "SET" | "BOTH";

export type WholesaleUnit = "PIECE" | "SET";

export type SetVariantType = "SIZE" | "COLOR" | "SIZE_COLOR" | "CUSTOM";

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

export type ProductVariantType = "SIZE" | "COLOR" | "SIZE_COLOR" | "CUSTOM";

/** An individual purchasable product variant. */
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
  /** Colour value when applicable. */
  color?: string;
  /** Custom variant value, e.g. "Pack A" or "Regular". */
  value?: string;
  /** Variant-specific selling price; product-level retailPrice remains the fallback. */
  price?: number;
  /** Variant-specific MRP. */
  mrp?: number;
  /** Variant-specific inventory. */
  stock: number;
  /** Variant images; product-level images can be used if empty. */
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

/** Variant configuration for a product. */
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

/** One row in a product size chart. */
export type ProductSizeChartRow = {
  size: string;
  /** Flexible measurements, e.g. "Chest: 38 in, Length: 28 in". */
  measurements: string;
};

/** Optional category-specific size chart; older products may omit it. */
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
  /** PIECE = individual pieces; SET = complete sets. */
  saleUnit: WholesaleUnit;
  /** false means a complete set is mandatory and cannot be broken. */
  setBreakAllowed: boolean;
  /** Number of pieces in one complete set. */
  setSize?: number;
  /** Buyer-facing name, e.g. "Size Set" or "6 Color Set". */
  setName?: string;
  /** Size / colour / size-colour composition of one complete set. */
  composition?: SetCompositionItem[];
  /** Minimum number of sets when saleUnit is SET. */
  moqSets?: number;
  /** Whether tier prices are per piece or per complete set. */
  priceUnit: WholesaleUnit;
  /** Quantity-based wholesale tiers; quantity units follow price/sale configuration. */
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

  /** Empty or system-defined for admin-created products until seller attribution is assigned. */
  sellerId: string;
  sellerName?: string;
  sellerVerified?: boolean;

  /** Product-level gallery; upload/edit flow should enforce its image limit. */
  images: string[];

  /** Maximum Retail Price. */
  mrp: number;
  /** Retail selling price per piece. */
  retailPrice: number;
  /** Legacy/base wholesale price, retained for backward compatibility. */
  wholesalePrice: number;
  /** Legacy wholesale MOQ, normally in pieces. */
  moq: number;
  /** Legacy wholesale tiers; new products may use wholesaleConfiguration.tiers. */
  wholesaleTiers: WholesaleTier[];

  /** PIECE = individual piece; SET = complete set; BOTH = retail and wholesale set options. */
  sellingMode?: ProductSellingMode;
  /** Optional to preserve compatibility with older Firestore products. */
  wholesaleConfiguration?: WholesaleConfiguration;
  /** Optional purchasable size/colour/custom variants. */
  variantConfiguration?: ProductVariantConfiguration;
  /** Optional category-specific size chart. */
  sizeChart?: ProductSizeChart;

  /** Total inventory; with variants, expected to represent aggregate variant stock. */
  stock: number;

  rating?: number;
  reviewsCount?: number;

  status: "active" | "draft" | "out_of_stock" | "blocked";
  featured?: boolean;
  bestSeller?: boolean;
  trending?: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
};
