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
import type { Product } from "@/types/product";

function mapProduct(
  id: string,
  data: Record<string, unknown>
): Product {
  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    description: String(data.description ?? ""),

    categoryId: String(data.categoryId ?? ""),
    categoryName: String(data.categoryName ?? ""),

    subcategoryId: data.subcategoryId
      ? String(data.subcategoryId)
      : undefined,

    sellerId: String(data.sellerId ?? ""),

    sellerName: data.sellerName
      ? String(data.sellerName)
      : undefined,

    sellerVerified: Boolean(data.sellerVerified),

    images: Array.isArray(data.images)
      ? data.images.map(String)
      : [],

    mrp: Number(data.mrp ?? 0),
    retailPrice: Number(data.retailPrice ?? 0),
    wholesalePrice: Number(data.wholesalePrice ?? 0),
    moq: Number(data.moq ?? 1),

    wholesaleTiers: Array.isArray(data.wholesaleTiers)
      ? data.wholesaleTiers.map((tier) => {
          const value = tier as Record<string, unknown>;

          return {
            minQuantity: Number(
              value.minQuantity ?? 1
            ),

            maxQuantity:
              value.maxQuantity !== undefined
                ? Number(value.maxQuantity)
                : undefined,

            price: Number(value.price ?? 0),
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
      data.status === "active" ||
      data.status === "out_of_stock" ||
      data.status === "blocked"
        ? data.status
        : "draft",

    featured: Boolean(data.featured),
    bestSeller: Boolean(data.bestSeller),
    trending: Boolean(data.trending),

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/* =========================================================
   CREATE SELLER PRODUCT
========================================================= */

export async function createSellerProduct(
  sellerId: string,
  data: Omit<
    Product,
    "id" | "createdAt" | "updatedAt"
  >
): Promise<string> {
  const productsRef = collection(
    db,
    "products"
  );

  // Generate a new Firestore document reference
  const productRef = doc(productsRef);

  await setDoc(productRef, {
    ...data,

    sellerId,

    // New seller products always start as draft
    status: "draft",

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return productRef.id;
}

/* =========================================================
   GET ALL PRODUCTS OF SELLER
========================================================= */

export async function getSellerProducts(
  sellerId: string
): Promise<Product[]> {
  const productsRef = collection(
    db,
    "products"
  );

  const q = query(
    productsRef,
    where(
      "sellerId",
      "==",
      sellerId
    )
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((item) =>
      mapProduct(
        item.id,
        item.data() as Record<string, unknown>
      )
    )
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );
}

/* =========================================================
   GET SINGLE SELLER PRODUCT
========================================================= */

export async function getSellerProduct(
  sellerId: string,
  productId: string
): Promise<Product | null> {
  const productRef = doc(
    db,
    "products",
    productId
  );

  const snapshot = await getDoc(
    productRef
  );

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  if (data.sellerId !== sellerId) {
    return null;
  }

  return mapProduct(
    snapshot.id,
    data as Record<string, unknown>
  );
}

/* =========================================================
   UPDATE SELLER PRODUCT
========================================================= */

export async function updateSellerProduct(
  sellerId: string,
  productId: string,
  data: Partial<Product>
): Promise<void> {
  const productRef = doc(
    db,
    "products",
    productId
  );

  const snapshot = await getDoc(
    productRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Product not found."
    );
  }

  if (
    snapshot.data().sellerId !==
    sellerId
  ) {
    throw new Error(
      "You are not allowed to edit this product."
    );
  }

  const {
    id,
    sellerId: ignoredSellerId,
    createdAt,
    updatedAt,
    ...safeData
  } = data;

  // Keep sellerId and timestamps protected.
  // Also don't allow seller to change status here.
  delete (safeData as Partial<Product>).status;

  await updateDoc(productRef, {
    ...safeData,
    updatedAt: serverTimestamp(),
  });
}

/* =========================================================
   QUICK STOCK UPDATE
========================================================= */

export async function updateSellerStock(
  sellerId: string,
  productId: string,
  stock: number
): Promise<void> {
  if (
    !Number.isFinite(stock) ||
    stock < 0
  ) {
    throw new Error(
      "Invalid stock quantity."
    );
  }

  const productRef = doc(
    db,
    "products",
    productId
  );

  const snapshot = await getDoc(
    productRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Product not found."
    );
  }

  if (
    snapshot.data().sellerId !==
    sellerId
  ) {
    throw new Error(
      "You are not allowed to update this product."
    );
  }

  /*
   * Seller Firestore rules currently require
   * product status to remain unchanged.
   *
   * Therefore stock update changes ONLY stock.
   */

  await updateDoc(productRef, {
    stock: Math.floor(stock),
    updatedAt: serverTimestamp(),
  });
}

/* =========================================================
   DELETE SELLER PRODUCT
========================================================= */

export async function deleteSellerProduct(
  sellerId: string,
  productId: string
): Promise<void> {
  const productRef = doc(
    db,
    "products",
    productId
  );

  const snapshot = await getDoc(
    productRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Product not found."
    );
  }

  if (
    snapshot.data().sellerId !==
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
