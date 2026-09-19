import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Product } from "@/types/product";

const productsCollection = collection(db, "products");

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

    images: Array.isArray(data.images)
      ? data.images.map(String)
      : [],

    mrp: Number(data.mrp ?? 0),
    retailPrice: Number(data.retailPrice ?? 0),

    wholesalePrice: Number(data.wholesalePrice ?? 0),
    moq: Number(data.moq ?? 1),

    wholesaleTiers: Array.isArray(data.wholesaleTiers)
      ? data.wholesaleTiers.map((tier) => {
          const item = tier as Record<string, unknown>;

          return {
            minQuantity: Number(item.minQuantity ?? 1),
            maxQuantity:
              item.maxQuantity !== undefined
                ? Number(item.maxQuantity)
                : undefined,
            price: Number(item.price ?? 0),
          };
        })
      : [],

    stock: Number(data.stock ?? 0),

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
   GET ALL ACTIVE PRODUCTS
========================================= */

export async function getProducts(
  productLimit = 24
): Promise<Product[]> {
  const productsQuery = query(
    productsCollection,
    where("status", "==", "active"),
    orderBy("createdAt", "desc"),
    limit(productLimit)
  );

  const snapshot = await getDocs(productsQuery);

  return snapshot.docs.map((doc) =>
    mapProduct(doc.id, doc.data())
  );
}

/* =========================================
   GET FEATURED PRODUCTS
========================================= */

export async function getFeaturedProducts(
  productLimit = 8
): Promise<Product[]> {
  const productsQuery = query(
    productsCollection,
    where("status", "==", "active"),
    where("featured", "==", true),
    orderBy("createdAt", "desc"),
    limit(productLimit)
  );

  const snapshot = await getDocs(productsQuery);

  return snapshot.docs.map((doc) =>
    mapProduct(doc.id, doc.data())
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
    where("status", "==", "active"),
    where("bestSeller", "==", true),
    orderBy("createdAt", "desc"),
    limit(productLimit)
  );

  const snapshot = await getDocs(productsQuery);

  return snapshot.docs.map((doc) =>
    mapProduct(doc.id, doc.data())
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
    where("status", "==", "active"),
    where("trending", "==", true),
    orderBy("createdAt", "desc"),
    limit(productLimit)
  );

  const snapshot = await getDocs(productsQuery);

  return snapshot.docs.map((doc) =>
    mapProduct(doc.id, doc.data())
  );
}
