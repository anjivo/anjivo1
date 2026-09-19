import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Product } from "@/types/product";

const productsCollection = collection(db, "products");


/* =========================================
   MAP FIRESTORE PRODUCT
========================================= */

function mapProduct(
  id: string,
  data: Record<string, unknown>
): Product {
  return {
    id,

    name: String(data.name ?? ""),

    slug: String(data.slug ?? ""),

    description:
      data.description !== undefined
        ? String(data.description)
        : undefined,

    categoryId: String(data.categoryId ?? ""),

    categoryName:
      data.categoryName !== undefined
        ? String(data.categoryName)
        : undefined,

    subcategoryId:
      data.subcategoryId !== undefined
        ? String(data.subcategoryId)
        : undefined,

    sellerId: String(data.sellerId ?? ""),

    sellerName:
      data.sellerName !== undefined
        ? String(data.sellerName)
        : undefined,

    sellerVerified:
      data.sellerVerified !== undefined
        ? Boolean(data.sellerVerified)
        : undefined,

    images:
      Array.isArray(data.images)
        ? data.images.map(String)
        : [],

    mrp: Number(data.mrp ?? 0),

    retailPrice: Number(
      data.retailPrice ?? 0
    ),

    wholesalePrice: Number(
      data.wholesalePrice ?? 0
    ),

    moq: Number(
      data.moq ?? 1
    ),

    wholesaleTiers:
      Array.isArray(data.wholesaleTiers)
        ? data.wholesaleTiers.map((tier) => {
            const item =
              tier as Record<string, unknown>;

            return {
              minQuantity: Number(
                item.minQuantity ?? 1
              ),

              maxQuantity:
                item.maxQuantity !== undefined
                  ? Number(item.maxQuantity)
                  : undefined,

              price: Number(
                item.price ?? 0
              ),
            };
          })
        : [],

    stock: Number(
      data.stock ?? 0
    ),

    rating:
      data.rating !== undefined
        ? Number(data.rating)
        : undefined,

    reviewsCount:
      data.reviewsCount !== undefined
        ? Number(data.reviewsCount)
        : undefined,

    status:
      data.status === "draft" ||
      data.status === "out_of_stock" ||
      data.status === "blocked"
        ? data.status
        : "active",

    featured:
      data.featured !== undefined
        ? Boolean(data.featured)
        : false,

    bestSeller:
      data.bestSeller !== undefined
        ? Boolean(data.bestSeller)
        : false,

    trending:
      data.trending !== undefined
        ? Boolean(data.trending)
        : false,

    createdAt: data.createdAt,

    updatedAt: data.updatedAt,
  };
}


/* =========================================
   FIRESTORE DATE → NUMBER
========================================= */

function getTime(
  value: unknown
): number {
  if (!value) {
    return 0;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const time = new Date(value).getTime();

    return Number.isNaN(time)
      ? 0
      : time;
  }

  return 0;
}


/* =========================================
   SORT NEWEST FIRST
========================================= */

function sortByNewest(
  products: Product[]
): Product[] {
  return [...products].sort(
    (a, b) =>
      getTime(b.createdAt) -
      getTime(a.createdAt)
  );
}


/* =========================================
   GET ALL ACTIVE PRODUCTS
========================================= */

export async function getProducts(
  productLimit = 24
): Promise<Product[]> {

  const productsQuery = query(
    productsCollection,
    where("status", "==", "active")
  );

  const snapshot = await getDocs(
    productsQuery
  );

  const products = snapshot.docs.map(
    (document) =>
      mapProduct(
        document.id,
        document.data()
      )
  );

  return sortByNewest(products).slice(
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

  /*
   * Sirf slug se search kar rahe hain.
   * Status ko JavaScript me check karenge.
   *
   * Isse compound Firestore index ki
   * dependency nahi rahegi.
   */

  const productQuery = query(
    productsCollection,
    where("slug", "==", slug),
    limit(1)
  );

  const snapshot = await getDocs(
    productQuery
  );

  if (snapshot.empty) {
    return null;
  }

  const document =
    snapshot.docs[0];

  const product = mapProduct(
    document.id,
    document.data()
  );

  if (product.status !== "active") {
    return null;
  }

  return product;
}


/* =========================================
   GET FEATURED PRODUCTS
========================================= */

export async function getFeaturedProducts(
  productLimit = 8
): Promise<Product[]> {

  const productsQuery = query(
    productsCollection,
    where("status", "==", "active")
  );

  const snapshot = await getDocs(
    productsQuery
  );

  const products = snapshot.docs
    .map((document) =>
      mapProduct(
        document.id,
        document.data()
      )
    )
    .filter(
      (product) =>
        product.featured === true
    );

  return sortByNewest(products).slice(
    0,
    productLimit
  );
}


/* =========================================
   GET BEST SELLERS
========================================= */

export async function getBestSellerProducts(
  productLimit = 8
): Promise<Product[]> {

  const productsQuery = query(
    productsCollection,
    where("status", "==", "active")
  );

  const snapshot = await getDocs(
    productsQuery
  );

  const products = snapshot.docs
    .map((document) =>
      mapProduct(
        document.id,
        document.data()
      )
    )
    .filter(
      (product) =>
        product.bestSeller === true
    );

  return sortByNewest(products).slice(
    0,
    productLimit
  );
}


/* =========================================
   GET TRENDING PRODUCTS
========================================= */

export async function getTrendingProducts(
  productLimit = 8
): Promise<Product[]> {

  const productsQuery = query(
    productsCollection,
    where("status", "==", "active")
  );

  const snapshot = await getDocs(
    productsQuery
  );

  const products = snapshot.docs
    .map((document) =>
      mapProduct(
        document.id,
        document.data()
      )
    )
    .filter(
      (product) =>
        product.trending === true
    );

  return sortByNewest(products).slice(
    0,
    productLimit
  );
}
