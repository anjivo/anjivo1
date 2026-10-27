import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type {
  Product,
  WholesaleConfiguration,
  WholesaleTier,
  SetCompositionItem,
  SetVariantType,
  ProductSellingMode,
  ProductSizeChart,
  ProductSizeChartRow,
  ProductVariant,
  ProductVariantConfiguration,
} from "@/types/product";

const productsCollection = collection(
  db,
  "products"
);

/* =========================================
   BASIC HELPERS
========================================= */

function numberValue(
  value: unknown,
  fallback = 0
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : fallback;
  }

  return fallback;
}

function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

function booleanValue(
  value: unknown,
  fallback = false
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

/* =========================================
   SIZE CHART MAPPER
========================================= */

function mapSizeChart(
  value: unknown
): ProductSizeChart | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const rawRows = Array.isArray(source.rows) ? source.rows : [];

  const rows: ProductSizeChartRow[] = rawRows
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return null;
      }

      const item = row as Record<string, unknown>;
      const size = stringValue(item.size).trim();
      const measurements = stringValue(item.measurements).trim();

      if (!size || !measurements) {
        return null;
      }

      return { size, measurements };
    })
    .filter((row): row is ProductSizeChartRow => row !== null);

  return {
    enabled: booleanValue(source.enabled, false),
    ...(stringValue(source.title).trim()
      ? { title: stringValue(source.title).trim() }
      : {}),
    ...(stringValue(source.unit).trim()
      ? { unit: stringValue(source.unit).trim() }
      : {}),
    rows,
  };
}

/* =========================================
   WHOLESALE TIER MAPPER
========================================= */

function mapWholesaleTiers(
  value: unknown
): WholesaleTier[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((tier) => {
      if (
        !tier ||
        typeof tier !== "object"
      ) {
        return null;
      }

      const item =
        tier as Record<
          string,
          unknown
        >;

      const minQuantity =
        numberValue(
          item.minQuantity,
          1
        );

      const maxQuantity =
        item.maxQuantity !==
          undefined &&
        item.maxQuantity !== null &&
        item.maxQuantity !== ""
          ? numberValue(
              item.maxQuantity
            )
          : undefined;

      const price =
        numberValue(
          item.price,
          0
        );

      if (
        minQuantity <= 0 ||
        price < 0
      ) {
        return null;
      }

      return {
        minQuantity,
        ...(maxQuantity !==
        undefined
          ? {
              maxQuantity,
            }
          : {}),
        price,
      };
    })
    .filter(
      (
        tier
      ): tier is WholesaleTier =>
        tier !== null
    )
    .sort(
      (a, b) =>
        a.minQuantity -
        b.minQuantity
    );
}

/* =========================================
   SET VARIANT TYPE
========================================= */

function normalizeSetVariantType(
  value: unknown
): SetVariantType {
  switch (value) {
    case "SIZE":
      return "SIZE";

    case "COLOR":
      return "COLOR";

    case "SIZE_COLOR":
      return "SIZE_COLOR";

    case "CUSTOM":
      return "CUSTOM";

    default:
      return "CUSTOM";
  }
}

/* =========================================
   SET COMPOSITION MAPPER
========================================= */

function mapSetComposition(
  value: unknown
): SetCompositionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const source =
        item as Record<
          string,
          unknown
        >;

      const variantType =
        normalizeSetVariantType(
          source.variantType
        );

      const valueText =
        stringValue(
          source.value
        ).trim();

      const quantity =
        Math.max(
          1,
          Math.floor(
            numberValue(
              source.quantity,
              1
            )
          )
        );

      if (!valueText) {
        return null;
      }

      const size =
        stringValue(
          source.size
        ).trim();

      const color =
        stringValue(
          source.color
        ).trim();

      return {
        variantType,
        value: valueText,
        quantity,

        ...(size
          ? { size }
          : {}),

        ...(color
          ? { color }
          : {}),
      };
    })
    .filter(
      (
        item
      ): item is SetCompositionItem =>
        item !== null
    );
}

/* =========================================
   WHOLESALE CONFIGURATION MAPPER
========================================= */

function mapWholesaleConfiguration(
  value: unknown
): WholesaleConfiguration | undefined {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return undefined;
  }

  const source =
    value as Record<
      string,
      unknown
    >;

  const saleUnit =
    source.saleUnit === "SET"
      ? "SET"
      : "PIECE";

  const priceUnit =
    source.priceUnit === "SET"
      ? "SET"
      : "PIECE";

  const setBreakAllowed =
    booleanValue(
      source.setBreakAllowed,
      saleUnit !== "SET"
    );

  const setSizeRaw =
    source.setSize;

  const setSize =
    setSizeRaw !== undefined &&
    setSizeRaw !== null
      ? Math.max(
          1,
          Math.floor(
            numberValue(
              setSizeRaw,
              1
            )
          )
        )
      : undefined;

  const moqSetsRaw =
    source.moqSets;

  const moqSets =
    moqSetsRaw !== undefined &&
    moqSetsRaw !== null
      ? Math.max(
          1,
          Math.floor(
            numberValue(
              moqSetsRaw,
              1
            )
          )
        )
      : undefined;

  const setName =
    stringValue(
      source.setName
    ).trim();

  const composition =
    mapSetComposition(
      source.composition
    );

  const tiers =
    mapWholesaleTiers(
      source.tiers
    );

  return {
    enabled:
      booleanValue(
        source.enabled,
        false
      ),

    saleUnit,

    setBreakAllowed,

    ...(setSize !==
    undefined
      ? {
          setSize,
        }
      : {}),

    ...(setName
      ? {
          setName,
        }
      : {}),

    ...(composition.length >
    0
      ? {
          composition,
        }
      : {}),

    ...(moqSets !==
    undefined
      ? {
          moqSets,
        }
      : {}),

    priceUnit,

    tiers,
  };
}

/* =========================================
   SELLING MODE
========================================= */

function normalizeSellingMode(
  value: unknown,
  wholesaleConfiguration?: WholesaleConfiguration
): ProductSellingMode {
  if (
    value === "PIECE" ||
    value === "SET" ||
    value === "BOTH"
  ) {
    return value;
  }

  /*
   * Backward compatibility:
   *
   * Existing products don't have
   * sellingMode.
   *
   * If wholesale configuration says
   * SET, treat it as BOTH when retail
   * pricing also exists.
   */

  if (
    wholesaleConfiguration?.saleUnit ===
    "SET"
  ) {
    return "BOTH";
  }

  if (
    wholesaleConfiguration?.enabled
  ) {
    return "BOTH";
  }

  return "PIECE";
}


/* =========================================
   PRODUCT VARIANT CONFIGURATION MAPPER
========================================= */

function mapProductVariantConfiguration(
  value: unknown
): ProductVariantConfiguration | undefined {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const validTypes = ["SIZE", "COLOR", "SIZE_COLOR", "CUSTOM"] as const;

  const type = validTypes.includes(
    source.type as (typeof validTypes)[number]
  )
    ? (source.type as ProductVariantConfiguration["type"])
    : "SIZE_COLOR";

  const variants: ProductVariant[] = (
    Array.isArray(source.variants) ? source.variants : []
  )
    .map((raw): ProductVariant | null => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
      }

      const item = raw as Record<string, unknown>;

      // Keep the stored ID unchanged: cart and checkout use it to locate
      // the exact Firestore variant. A variant without an ID is not safe to buy.
      const id = stringValue(item.id).trim();
      if (!id) {
        return null;
      }

      const sku = stringValue(item.sku).trim();
      const name = stringValue(item.name).trim();

      // Normalize known variant types; older imports may use lowercase or omit it.
      const rawVariantType = stringValue(item.variantType).trim().toUpperCase();
      const variantType = validTypes.includes(
        rawVariantType as (typeof validTypes)[number]
      )
        ? (rawVariantType as ProductVariant["variantType"])
        : type;

      // Older/imported catalog records may store inventory under a legacy field.
      // Normalize those fields into the canonical `stock` property used by the
      // product page, cart, and checkout. Prefer explicit `stock` when present.
      const rawStock =
        item.stock ??
        item.quantity ??
        item.availableStock ??
        item.inventory ??
        item.stockQuantity ??
        item.inventoryQuantity;
      const stock = Math.max(0, Math.floor(numberValue(rawStock, 0)));
      const rawStatus = stringValue(item.status).trim().toLowerCase();
      // Do not override explicit inactive/out_of_stock status merely because stock > 0;
      // checkout validates the raw Firestore record too.
      const status =
        rawStatus === "inactive"
          ? "inactive"
          : stock <= 0 || rawStatus === "out_of_stock"
            ? "out_of_stock"
            : "active";

      const images = Array.isArray(item.images)
        ? item.images.filter(
            (image): image is string =>
              typeof image === "string" && image.trim() !== ""
          ).map((image) => image.trim())
        : [];

      const metadata =
        item.metadata &&
        typeof item.metadata === "object" &&
        !Array.isArray(item.metadata)
          ? (item.metadata as ProductVariant["metadata"])
          : undefined;

      return {
        id,
        sku: sku || id,
        name: name || stringValue(item.size).trim() || stringValue(item.color).trim() || stringValue(item.value).trim() || sku || id,
        variantType,
        stock,
        status,
        ...(typeof item.size === "string" ? { size: item.size.trim() } : {}),
        ...(typeof item.color === "string" ? { color: item.color.trim() } : {}),
        ...(typeof item.value === "string" ? { value: item.value.trim() } : {}),
        ...(item.price !== undefined
          ? { price: Math.max(0, numberValue(item.price, 0)) }
          : {}),
        ...(item.mrp !== undefined
          ? { mrp: Math.max(0, numberValue(item.mrp, 0)) }
          : {}),
        ...(images.length > 0 ? { images } : {}),
        ...(typeof item.barcode === "string" ? { barcode: item.barcode } : {}),
        ...(metadata ? { metadata } : {}),
        ...(item.createdAt !== undefined ? { createdAt: item.createdAt } : {}),
        ...(item.updatedAt !== undefined ? { updatedAt: item.updatedAt } : {}),
      };
    })
    .filter((variant): variant is ProductVariant => variant !== null);

  const sizes = Array.isArray(source.sizes)
    ? source.sizes.filter((size): size is string => typeof size === "string")
    : [];
  const colors = Array.isArray(source.colors)
    ? source.colors.filter((color): color is string => typeof color === "string")
    : [];

  return {
    enabled: booleanValue(source.enabled, false),
    type,
    sizes,
    colors,
    variants,
  };
}

/* =========================================
   PRODUCT MAPPER
========================================= */

function mapProduct(
  id: string,
  data: Record<string, unknown>
): Product {
  const wholesaleConfiguration =
    mapWholesaleConfiguration(
      data.wholesaleConfiguration
    );

  const wholesaleTiers =
    mapWholesaleTiers(
      data.wholesaleTiers
    );

  const sellingMode =
    normalizeSellingMode(
      data.sellingMode,
      wholesaleConfiguration
    );

  const sizeChart = mapSizeChart(data.sizeChart);
  const variantConfiguration =
    mapProductVariantConfiguration(data.variantConfiguration);

  return {
    id,

    name:
      stringValue(
        data.name
      ),

    slug:
      stringValue(
        data.slug
      ),

    description:
      data.description !==
      undefined
        ? String(
            data.description
          )
        : undefined,

    categoryId:
      stringValue(
        data.categoryId
      ),

    categoryName:
      data.categoryName !==
      undefined
        ? String(
            data.categoryName
          )
        : undefined,

    subcategoryId:
      data.subcategoryId !==
      undefined
        ? String(
            data.subcategoryId
          )
        : undefined,

    sellerId:
      stringValue(
        data.sellerId
      ),

    sellerName:
      data.sellerName !==
      undefined
        ? String(
            data.sellerName
          )
        : undefined,

    sellerVerified:
      data.sellerVerified !==
      undefined
        ? booleanValue(
            data.sellerVerified
          )
        : undefined,

    images:
      Array.isArray(
        data.images
      )
        ? data.images
            .filter(
              (
                image
              ): image is string =>
                typeof image ===
                "string"
            )
            .map(
              (image) =>
                image.trim()
            )
            .filter(Boolean)
        : [],

    ...(sizeChart ? { sizeChart } : {}),

    mrp:
      numberValue(
        data.mrp,
        0
      ),

    retailPrice:
      numberValue(
        data.retailPrice,
        0
      ),

    wholesalePrice:
      numberValue(
        data.wholesalePrice,
        0
      ),

    moq: Math.max(
      1,
      Math.floor(
        numberValue(
          data.moq,
          1
        )
      )
    ),

    wholesaleTiers,

    sellingMode,

    wholesaleConfiguration,

    ...(variantConfiguration ? { variantConfiguration } : {}),

    stock: Math.max(
      0,
      Math.floor(
        numberValue(
          data.stock,
          0
        )
      )
    ),

    rating:
      data.rating !==
      undefined
        ? numberValue(
            data.rating
          )
        : undefined,

    reviewsCount:
      data.reviewsCount !==
      undefined
        ? Math.max(
            0,
            Math.floor(
              numberValue(
                data.reviewsCount
              )
            )
          )
        : undefined,

    status:
      data.status === "draft" ||
      data.status === "out_of_stock" ||
      data.status === "blocked"
        ? data.status
        : typeof data.status === "string" &&
            data.status.trim() !== "" &&
            data.status.trim().toLowerCase() !== "active"
          ? "blocked"
          : "active",

    featured:
      data.featured !==
      undefined
        ? booleanValue(
            data.featured
          )
        : false,

    bestSeller:
      data.bestSeller !==
      undefined
        ? booleanValue(
            data.bestSeller
          )
        : false,

    trending:
      data.trending !==
      undefined
        ? booleanValue(
            data.trending
          )
        : false,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================
   TIME HELPER
========================================= */

function getTime(
  value: unknown
): number {
  if (!value) {
    return 0;
  }

  if (
    typeof value ===
      "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis ===
      "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (
    value instanceof Date
  ) {
    return value.getTime();
  }

  if (
    typeof value ===
    "string"
  ) {
    const time =
      new Date(
        value
      ).getTime();

    return Number.isNaN(
      time
    )
      ? 0
      : time;
  }

  return 0;
}

/* =========================================
   NEWEST SORT
========================================= */

function sortByNewest(
  products: Product[]
): Product[] {
  return [...products].sort(
    (a, b) =>
      getTime(
        b.createdAt
      ) -
      getTime(
        a.createdAt
      )
  );
}

/* =========================================
   GET ALL ACTIVE PRODUCTS
========================================= */

export async function getProducts(
  productLimit = 24
): Promise<Product[]> {
  const productsQuery =
    query(
      productsCollection,
      where("status", "in", ["active", "ACTIVE"])
    );

  const snapshot =
    await getDocs(
      productsQuery
    );

  const products =
    snapshot.docs.map(
      (document) =>
        mapProduct(
          document.id,
          document.data()
        )
    );

  return sortByNewest(
    products
  ).slice(
    0,
    productLimit
  );
}

/* =========================================
   GET PRODUCT BY SLUG
========================================= */

export async function getProductBySlug(
  slug: string
): Promise<Product | null> {
  const productQuery =
    query(
      productsCollection,
      where(
        "slug",
        "==",
        slug.trim()
      ),
      where("status", "in", ["active", "ACTIVE"]),
      limit(1)
    );

  const snapshot =
    await getDocs(
      productQuery
    );

  if (
    snapshot.empty
  ) {
    return null;
  }

  const document =
    snapshot.docs[0];

  const product =
    mapProduct(
      document.id,
      document.data()
    );

  if (
    product.status !==
    "active"
  ) {
    return null;
  }

  return product;
}

/* =========================================
   FEATURED PRODUCTS
========================================= */

export async function getFeaturedProducts(
  productLimit = 8
): Promise<Product[]> {
  const productsQuery =
    query(
      productsCollection,
      where("status", "in", ["active", "ACTIVE"])
    );

  const snapshot =
    await getDocs(
      productsQuery
    );

  const products =
    snapshot.docs
      .map(
        (document) =>
          mapProduct(
            document.id,
            document.data()
          )
      )
      .filter(
        (product) =>
          product.featured ===
          true
      );

  return sortByNewest(
    products
  ).slice(
    0,
    productLimit
  );
}

/* =========================================
   BEST SELLERS
========================================= */

export async function getBestSellerProducts(
  productLimit = 8
): Promise<Product[]> {
  const productsQuery =
    query(
      productsCollection,
      where("status", "in", ["active", "ACTIVE"])
    );

  const snapshot =
    await getDocs(
      productsQuery
    );

  const products =
    snapshot.docs
      .map(
        (document) =>
          mapProduct(
            document.id,
            document.data()
          )
      )
      .filter(
        (product) =>
          product.bestSeller ===
          true
      );

  return sortByNewest(
    products
  ).slice(
    0,
    productLimit
  );
}

/* =========================================
   TRENDING PRODUCTS
========================================= */

export async function getTrendingProducts(
  productLimit = 8
): Promise<Product[]> {
  const productsQuery =
    query(
      productsCollection,
      where("status", "in", ["active", "ACTIVE"])
    );

  const snapshot =
    await getDocs(
      productsQuery
    );

  const products =
    snapshot.docs
      .map(
        (document) =>
          mapProduct(
            document.id,
            document.data()
          )
      )
      .filter(
        (product) =>
          product.trending ===
          true
      );

  return sortByNewest(
    products
  ).slice(
    0,
    productLimit
  );
}

/* =========================================
   SEARCH + FILTER
========================================= */

export type ProductFilters = {
  search?: string;

  categoryId?: string;

  sellerId?: string;

  minPrice?: number;

  maxPrice?: number;

  minRating?: number;

  pricingType?:
    | "retail"
    | "wholesale"
    | "all";

  sellingMode?:
    | "PIECE"
    | "SET"
    | "BOTH"
    | "all";

  wholesaleUnit?:
    | "PIECE"
    | "SET"
    | "all";

  sort?:
    | "newest"
    | "price_low"
    | "price_high"
    | "rating_high"
    | "name_az";
};

/* =========================================
   SEARCH PRODUCTS
========================================= */

export async function searchProducts(
  filters: ProductFilters = {},
  productLimit = 48
): Promise<Product[]> {
  const productsQuery =
    query(
      productsCollection,
      where("status", "in", ["active", "ACTIVE"])
    );

  const snapshot =
    await getDocs(
      productsQuery
    );

  let products =
    snapshot.docs.map(
      (document) =>
        mapProduct(
          document.id,
          document.data()
        )
    );

  /* =======================================
     SEARCH
  ======================================= */

  const search =
    filters.search
      ?.trim()
      .toLowerCase();

  if (search) {
    products =
      products.filter(
        (product) => {
          const searchableText = [
            product.name,

            product.description,

            product.categoryName,

            product.sellerName,

            product.slug,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            search
          );
        }
      );
  }

  /* =======================================
     CATEGORY
  ======================================= */

  if (
    filters.categoryId
  ) {
    products =
      products.filter(
        (product) =>
          product.categoryId ===
          filters.categoryId
      );
  }

  /* =======================================
     SELLER
  ======================================= */

  if (
    filters.sellerId
  ) {
    products =
      products.filter(
        (product) =>
          product.sellerId ===
          filters.sellerId
      );
  }

  /* =======================================
     SELLING MODE
  ======================================= */

  if (
    filters.sellingMode &&
    filters.sellingMode !==
      "all"
  ) {
    products =
      products.filter(
        (product) =>
          product.sellingMode ===
          filters.sellingMode
      );
  }

  /* =======================================
     WHOLESALE UNIT
  ======================================= */

  if (
    filters.wholesaleUnit &&
    filters.wholesaleUnit !==
      "all"
  ) {
    products =
      products.filter(
        (product) =>
          product.wholesaleConfiguration
            ?.saleUnit ===
          filters.wholesaleUnit
      );
  }

  /* =======================================
     PRICE
  ======================================= */

  const minPrice =
    filters.minPrice ??
    0;

  const maxPrice =
    filters.maxPrice ??
    Infinity;

  products =
    products.filter(
      (product) => {
        let price =
          product.retailPrice;

        if (
          filters.pricingType ===
          "wholesale"
        ) {
          /*
           * For SET products the base
           * wholesale price may represent
           * the complete set price.
           *
           * For PIECE products it represents
           * the piece price.
           */
          price =
            product.wholesalePrice;
        }

        return (
          price >=
            minPrice &&
          price <=
            maxPrice
        );
      }
    );

  /* =======================================
     RATING
  ======================================= */

  if (
    filters.minRating !==
    undefined
  ) {
    products =
      products.filter(
        (product) =>
          (product.rating ??
            0) >=
          filters.minRating!
      );
  }

  /* =======================================
     SORT
  ======================================= */

  switch (
    filters.sort
  ) {
    case "price_low":
      products.sort(
        (a, b) =>
          a.retailPrice -
          b.retailPrice
      );
      break;

    case "price_high":
      products.sort(
        (a, b) =>
          b.retailPrice -
          a.retailPrice
      );
      break;

    case "rating_high":
      products.sort(
        (a, b) =>
          (b.rating ??
            0) -
          (a.rating ??
            0)
      );
      break;

    case "name_az":
      products.sort(
        (a, b) =>
          a.name.localeCompare(
            b.name
          )
      );
      break;

    case "newest":

    default:
      products =
        sortByNewest(
          products
        );
      break;
  }

  return products.slice(
    0,
    productLimit
  );
}
