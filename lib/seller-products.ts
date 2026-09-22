import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import type {
  Product,
  WholesaleTier,
  WholesaleConfiguration,
  ProductSellingMode,
} from "@/types/product";

/* =========================================================
   SELLER PRODUCT INPUT
========================================================= */

export type SellerProductInput = {
  name: string;
  slug: string;
  description?: string;

  categoryId: string;
  categoryName?: string;
  subcategoryId?: string;

  images: string[];

  mrp: number;
  retailPrice: number;

  /*
   * Backward-compatible base wholesale price.
   *
   * For PIECE:
   * price per piece.
   *
   * For SET:
   * price per set.
   *
   * For BOTH:
   * depends on wholesaleConfiguration.priceUnit.
   */
  wholesalePrice: number;

  moq: number;

  wholesaleTiers: WholesaleTier[];

  /*
   * New wholesale architecture.
   */
  sellingMode?: ProductSellingMode;

  wholesaleConfiguration?: WholesaleConfiguration;

  stock: number;

  featured?: boolean;
  bestSeller?: boolean;
  trending?: boolean;
};

/* =========================================================
   PRODUCT MAPPER
========================================================= */

function mapProduct(
  id: string,
  data: Record<string, unknown>
): Product {
  return {
    id,

    name:
      typeof data.name === "string"
        ? data.name
        : "",

    slug:
      typeof data.slug === "string"
        ? data.slug
        : "",

    description:
      typeof data.description === "string"
        ? data.description
        : "",

    categoryId:
      typeof data.categoryId === "string"
        ? data.categoryId
        : "",

    categoryName:
      typeof data.categoryName === "string"
        ? data.categoryName
        : "",

    subcategoryId:
      typeof data.subcategoryId === "string"
        ? data.subcategoryId
        : undefined,

    sellerId:
      typeof data.sellerId === "string"
        ? data.sellerId
        : "",

    sellerName:
      typeof data.sellerName === "string"
        ? data.sellerName
        : "",

    sellerVerified:
      data.sellerVerified === true,

    images:
      Array.isArray(data.images)
        ? data.images.filter(
            (
              image
            ): image is string =>
              typeof image ===
              "string"
          )
        : [],

    mrp: Number(
      data.mrp ?? 0
    ),

    retailPrice: Number(
      data.retailPrice ?? 0
    ),

    wholesalePrice: Number(
      data.wholesalePrice ?? 0
    ),

    moq: Math.max(
      1,
      Math.floor(
        Number(
          data.moq ?? 1
        )
      )
    ),

    wholesaleTiers:
      Array.isArray(
        data.wholesaleTiers
      )
        ? data.wholesaleTiers.map(
            (tier) => {
              const item =
                tier as Record<
                  string,
                  unknown
                >;

              return {
                minQuantity:
                  Number(
                    item.minQuantity ??
                      0
                  ),

                maxQuantity:
                  item.maxQuantity !==
                    undefined &&
                  item.maxQuantity !==
                    null
                    ? Number(
                        item.maxQuantity
                      )
                    : undefined,

                price: Number(
                  item.price ?? 0
                ),
              };
            }
          )
        : [],

    /* =====================================================
       NEW SET / PACK FIELDS
    ===================================================== */

    sellingMode:
      data.sellingMode ===
        "PIECE" ||
      data.sellingMode ===
        "SET" ||
      data.sellingMode ===
        "BOTH"
        ? data.sellingMode
        : undefined,

    wholesaleConfiguration:
      data.wholesaleConfiguration &&
      typeof data.wholesaleConfiguration ===
        "object"
        ? (data.wholesaleConfiguration as WholesaleConfiguration)
        : undefined,

    stock: Math.max(
      0,
      Math.floor(
        Number(
          data.stock ?? 0
        )
      )
    ),

    rating:
      typeof data.rating ===
      "number"
        ? data.rating
        : undefined,

    reviewsCount:
      typeof data.reviewsCount ===
      "number"
        ? data.reviewsCount
        : undefined,

    status:
      data.status ===
        "active" ||
      data.status ===
        "out_of_stock" ||
      data.status ===
        "blocked"
        ? data.status
        : "draft",

    featured:
      data.featured === true,

    bestSeller:
      data.bestSeller === true,

    trending:
      data.trending === true,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   CREATE PRODUCT
========================================================= */

export async function createSellerProduct(
  sellerId: string,
  data: SellerProductInput
): Promise<string> {
  if (!sellerId) {
    throw new Error(
      "Seller ID is required."
    );
  }

  if (!data.name.trim()) {
    throw new Error(
      "Product name is required."
    );
  }

  if (!data.categoryId) {
    throw new Error(
      "Category is required."
    );
  }

  if (data.retailPrice <= 0) {
    throw new Error(
      "Retail price must be greater than zero."
    );
  }

  if (data.wholesalePrice <= 0) {
    throw new Error(
      "Wholesale price must be greater than zero."
    );
  }

  if (data.stock < 0) {
    throw new Error(
      "Stock cannot be negative."
    );
  }

  if (data.moq < 1) {
    throw new Error(
      "MOQ must be at least 1."
    );
  }

  /* =======================================================
     SELLING MODE
  ======================================================= */

  const sellingMode =
    data.sellingMode ??
    "BOTH";

  /* =======================================================
     WHOLESALE CONFIGURATION
  ======================================================= */

  const wholesaleConfiguration =
    data.wholesaleConfiguration
      ? {
          ...data.wholesaleConfiguration,

          enabled:
            data.wholesaleConfiguration
              .enabled !== false,

          saleUnit:
            data.wholesaleConfiguration
              .saleUnit ===
            "SET"
              ? "SET"
              : "PIECE",

          priceUnit:
            data.wholesaleConfiguration
              .priceUnit ===
            "SET"
              ? "SET"
              : "PIECE",

          setBreakAllowed:
            data.wholesaleConfiguration
              .setBreakAllowed !==
            false,

          tiers:
            Array.isArray(
              data.wholesaleConfiguration
                .tiers
            )
              ? data.wholesaleConfiguration
                  .tiers
              : [],
        }
      : undefined;

  /* =======================================================
     BASIC SET VALIDATION
  ======================================================= */

  if (
    sellingMode === "SET" ||
    wholesaleConfiguration?.saleUnit ===
      "SET"
  ) {
    if (
      !wholesaleConfiguration
    ) {
      throw new Error(
        "Wholesale configuration is required for set products."
      );
    }

    const setSize =
      wholesaleConfiguration.setSize;

    if (
      !setSize ||
      !Number.isInteger(
        setSize
      ) ||
      setSize < 1
    ) {
      throw new Error(
        "A valid set size is required."
      );
    }

    if (
      !Array.isArray(
        wholesaleConfiguration.composition
      ) ||
      wholesaleConfiguration
        .composition.length ===
        0
    ) {
      throw new Error(
        "Set composition is required."
      );
    }

    const compositionTotal =
      wholesaleConfiguration.composition.reduce(
        (
          total,
          item
        ) =>
          total +
          Math.max(
            1,
            Math.floor(
              Number(
                item.quantity
              )
            )
          ),
        0
      );

    if (
      compositionTotal !==
      setSize
    ) {
      throw new Error(
        "Set composition quantity must match set size."
      );
    }

    if (
      wholesaleConfiguration
        .moqSets !==
        undefined
    ) {
      if (
        !Number.isInteger(
          wholesaleConfiguration
            .moqSets
        ) ||
        wholesaleConfiguration
          .moqSets < 1
      ) {
        throw new Error(
          "MOQ sets must be a valid whole number."
        );
      }
    }
  }

  /* =======================================================
     CREATE FIRESTORE DOCUMENT
  ======================================================= */

  const productRef =
    doc(
      collection(
        db,
        "products"
      )
    );

  const productData: Record<
    string,
    unknown
  > = {
    name:
      data.name.trim(),

    slug:
      data.slug.trim(),

    description:
      data.description?.trim() ??
      "",

    categoryId:
      data.categoryId,

    categoryName:
      data.categoryName ??
      "",

    ...(data.subcategoryId
      ? {
          subcategoryId:
            data.subcategoryId,
        }
      : {}),

    images:
      Array.isArray(
        data.images
      )
        ? data.images
        : [],

    mrp:
      data.mrp,

    retailPrice:
      data.retailPrice,

    wholesalePrice:
      data.wholesalePrice,

    moq:
      data.moq,

    wholesaleTiers:
      data.wholesaleTiers,

    /* =====================================================
       NEW WHOLESALE ARCHITECTURE
    ===================================================== */

    sellingMode,

    ...(wholesaleConfiguration
      ? {
          wholesaleConfiguration,
        }
      : {}),

    stock:
      Math.floor(
        data.stock
      ),

    /* =====================================================
       SELLER OWNERSHIP
    ===================================================== */

    sellerId,

    /* =====================================================
       PLATFORM CONTROLLED FIELDS
    ===================================================== */

    status:
      "draft",

    sellerVerified:
      false,

    featured:
      false,

    bestSeller:
      false,

    trending:
      false,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await setDoc(
    productRef,
    productData
  );

  return productRef.id;
}

/* =========================================================
   GET SELLER PRODUCTS
========================================================= */

export async function getSellerProducts(
  sellerId: string
): Promise<Product[]> {
  if (!sellerId) {
    return [];
  }

  const productsQuery =
    query(
      collection(
        db,
        "products"
      ),
      where(
        "sellerId",
        "==",
        sellerId
      )
    );

  const snapshot =
    await getDocs(
      productsQuery
    );

  const products =
    snapshot.docs.map(
      (productDoc) =>
        mapProduct(
          productDoc.id,
          productDoc.data() as Record<
            string,
            unknown
          >
        )
    );

  products.sort(
    (a, b) => {
      const aTime =
        a.createdAt &&
        typeof (
          a.createdAt as {
            seconds?: number;
          }
        ).seconds ===
          "number"
          ? (
              a.createdAt as {
                seconds: number;
              }
            ).seconds
          : 0;

      const bTime =
        b.createdAt &&
        typeof (
          b.createdAt as {
            seconds?: number;
          }
        ).seconds ===
          "number"
          ? (
              b.createdAt as {
                seconds: number;
              }
            ).seconds
          : 0;

      return (
        bTime -
        aTime
      );
    }
  );

  return products;
}

/* =========================================================
   GET SINGLE SELLER PRODUCT
========================================================= */

export async function getSellerProduct(
  sellerId: string,
  productId: string
): Promise<Product | null> {
  const productRef =
    doc(
      db,
      "products",
      productId
    );

  const snapshot =
    await getDoc(
      productRef
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  const data =
    snapshot.data();

  if (
    data.sellerId !==
    sellerId
  ) {
    throw new Error(
      "You are not allowed to access this product."
    );
  }

  return mapProduct(
    snapshot.id,
    data as Record<
      string,
      unknown
    >
  );
}

/* =========================================================
   UPDATE SELLER PRODUCT
========================================================= */

export async function updateSellerProduct(
  sellerId: string,
  productId: string,
  data: Partial<SellerProductInput>
): Promise<void> {
  const productRef =
    doc(
      db,
      "products",
      productId
    );

  const snapshot =
    await getDoc(
      productRef
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "Product not found."
    );
  }

  const currentData =
    snapshot.data();

  if (
    currentData.sellerId !==
    sellerId
  ) {
    throw new Error(
      "You are not allowed to update this product."
    );
  }

  const safeData: Record<
    string,
    unknown
  > = {
    ...data,
  };

  /*
   * Never allow seller to change
   * ownership.
   */
  delete safeData.sellerId;

  /*
   * Never allow seller to change
   * approval/status.
   */
  delete safeData.status;

  /*
   * Never allow seller to change
   * verification.
   */
  delete safeData.sellerVerified;

  /*
   * Never allow seller to modify
   * platform badges.
   */
  delete safeData.featured;
  delete safeData.bestSeller;
  delete safeData.trending;

  /*
   * Never allow seller to modify
   * creation timestamp.
   */
  delete safeData.createdAt;

  await updateDoc(
    productRef,
    {
      ...safeData,
      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   UPDATE STOCK
========================================================= */

export async function updateSellerStock(
  sellerId: string,
  productId: string,
  stock: number
): Promise<void> {
  if (
    !Number.isFinite(stock)
  ) {
    throw new Error(
      "Invalid stock value."
    );
  }

  if (stock < 0) {
    throw new Error(
      "Stock cannot be negative."
    );
  }

  const productRef =
    doc(
      db,
      "products",
      productId
    );

  const snapshot =
    await getDoc(
      productRef
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "Product not found."
    );
  }

  const data =
    snapshot.data();

  if (
    data.sellerId !==
    sellerId
  ) {
    throw new Error(
      "You are not allowed to update this product."
    );
  }

  await updateDoc(
    productRef,
    {
      stock:
        Math.floor(
          stock
        ),

      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   DELETE SELLER PRODUCT
========================================================= */

export async function deleteSellerProduct(
  sellerId: string,
  productId: string
): Promise<void> {
  const productRef =
    doc(
      db,
      "products",
      productId
    );

  const snapshot =
    await getDoc(
      productRef
    );

  if (
    !snapshot.exists()
  ) {
    throw new Error(
      "Product not found."
    );
  }

  const data =
    snapshot.data();

  if (
    data.sellerId !==
    sellerId
  ) {
    throw new Error(
      "You are not allowed to delete this product."
    );
  }

  await deleteDoc(
    productRef
  );
}
