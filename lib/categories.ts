
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Category } from "@/types/category";

const categoriesCollection = collection(db, "categories");

/**
 * Default categories for the ANJIVO marketplace.
 * Categories are initialized only when missing.
 */
const DEFAULT_CATEGORIES = [
  { name: "Fashion", slug: "fashion", icon: "shirt", sortOrder: 1 },
  { name: "Men's Clothing", slug: "mens-clothing", icon: "shirt", sortOrder: 2 },
  { name: "Women's Clothing", slug: "womens-clothing", icon: "shirt", sortOrder: 3 },
  { name: "Footwear", slug: "footwear", icon: "footprints", sortOrder: 4 },
  { name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "sparkles", sortOrder: 5 },
  { name: "Electronics", slug: "electronics", icon: "smartphone", sortOrder: 6 },
  { name: "Mobile Accessories", slug: "mobile-accessories", icon: "headphones", sortOrder: 7 },
  { name: "Home & Kitchen", slug: "home-kitchen", icon: "house", sortOrder: 8 },
  { name: "Grocery", slug: "grocery", icon: "shopping-basket", sortOrder: 9 },
  { name: "Toys & Games", slug: "toys-games", icon: "puzzle", sortOrder: 10 },
  { name: "Bags & Accessories", slug: "bags-accessories", icon: "shopping-bag", sortOrder: 11 },
  { name: "Jewellery", slug: "jewellery", icon: "gem", sortOrder: 12 },
  { name: "Sports & Fitness", slug: "sports-fitness", icon: "dumbbell", sortOrder: 13 },
  { name: "Books & Stationery", slug: "books-stationery", icon: "book", sortOrder: 14 },
  { name: "Automotive", slug: "automotive", icon: "car", sortOrder: 15 },
] as const;

/**
 * Initialize default categories.
 *
 * Existing categories are preserved. Each default category uses
 * a predictable document ID, making repeated initialization idempotent.
 */
export async function initializeDefaultCategories(): Promise<void> {
  const snapshot = await getDocs(categoriesCollection);

  const existingSlugs = new Set(
    snapshot.docs
      .map((categoryDoc) => {
        const data = categoryDoc.data();
        return typeof data.slug === "string"
          ? data.slug.trim().toLowerCase()
          : "";
      })
      .filter(Boolean)
  );

  const missingCategories = DEFAULT_CATEGORIES.filter(
    (category) => !existingSlugs.has(category.slug)
  );

  if (missingCategories.length === 0) {
    return;
  }

  await runTransaction(db, async (transaction) => {
    const refs = missingCategories.map((category) =>
      doc(db, "categories", category.slug)
    );

    const documents = await Promise.all(
      refs.map((categoryRef) => transaction.get(categoryRef))
    );

    documents.forEach((categoryDoc, index) => {
      if (categoryDoc.exists()) {
        return;
      }

      const category = missingCategories[index];

      transaction.set(refs[index], {
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: `${category.name} products on ANJIVO`,
        image: "",
        parentId: null,
        productCount: 0,
        featured: false,
        trending: false,
        status: "active",
        sortOrder: category.sortOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  });
}

/**
 * Create a new category.
 */
export async function createCategory(
  data: Omit<Category, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const slug = data.slug.trim().toLowerCase();

  if (!data.name.trim() || !slug) {
    throw new Error("Category name and slug are required.");
  }

  const categoryRef = doc(db, "categories", slug);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(categoryRef);

    if (existing.exists()) {
      throw new Error("A category with this slug already exists.");
    }

    transaction.set(categoryRef, {
      ...data,
      name: data.name.trim(),
      slug,
      status: data.status ?? "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return categoryRef.id;
}

/**
 * Convert a Firestore document into a Category object.
 */
function mapCategory(
  id: string,
  data: Record<string, unknown>
): Category {
  const status =
    typeof data.status === "string"
      ? data.status.toLowerCase()
      : "active";

  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),

    description:
      data.description != null
        ? String(data.description)
        : undefined,

    image:
      data.image != null
        ? String(data.image)
        : undefined,

    icon:
      data.icon != null
        ? String(data.icon)
        : undefined,

    parentId:
      data.parentId === null || data.parentId === undefined
        ? null
        : String(data.parentId),

    productCount:
      data.productCount !== undefined
        ? Number(data.productCount) || 0
        : 0,

    featured: data.featured === true,
    trending: data.trending === true,

    status: status === "inactive" ? "inactive" : "active",

    sortOrder:
      data.sortOrder !== undefined
        ? Number(data.sortOrder) || 0
        : 0,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Initialize default categories, then return active categories.
 */
export async function getCategories(): Promise<Category[]> {
  await initializeDefaultCategories();

  const snapshot = await getDocs(categoriesCollection);

  const categories = snapshot.docs
    .map((categoryDoc) =>
      mapCategory(
        categoryDoc.id,
        categoryDoc.data() as Record<string, unknown>
      )
    )
    .filter((category) => category.status === "active");

  return categories.sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
}

/**
 * Get a category by slug.
 */
export async function getCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  const categories = await getCategories();

  return (
    categories.find(
      (category) =>
        category.slug.trim().toLowerCase() === normalizedSlug
    ) ?? null
  );
}
