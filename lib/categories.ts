
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Category } from "@/types/category";

const categoriesCollection = collection(db, "categories");

/**
 * Create a new category.
 */
export async function createCategory(
  data: Omit<Category, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const categoryRef = await addDoc(categoriesCollection, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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

    featured:
      data.featured === true,

    trending:
      data.trending === true,

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
 * Get all active categories.
 *
 * Categories with missing status are treated as active.
 * Results are sorted by sortOrder in ascending order.
 */
export async function getCategories(): Promise<Category[]> {
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
 * Get a category by its slug.
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
