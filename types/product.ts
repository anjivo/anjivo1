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
   * Total inventory.
   *
   * For normal piece products:
   * number of pieces.
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
