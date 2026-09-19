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

function mapCategory(
  id: string,
  data: Record<string, unknown>
): Category {
  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    description:
      data.description !== undefined
        ? String(data.description)
        : undefined,
    image:
      data.image !== undefined
        ? String(data.image)
        : undefined,
    icon:
      data.icon !== undefined
        ? String(data.icon)
        : undefined,
    parentId:
      data.parentId !== undefined
        ? data.parentId === null
          ? null
          : String(data.parentId)
        : null,
    productCount:
      data.productCount !== undefined
        ? Number(data.productCount)
        : 0,
    featured:
      data.featured !== undefined
        ? Boolean(data.featured)
        : false,
    trending:
      data.trending !== undefined
        ? Boolean(data.trending)
        : false,
    status:
      data.status === "inactive"
        ? "inactive"
        : "active",
    sortOrder:
      data.sortOrder !== undefined
        ? Number(data.sortOrder)
        : 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getCategories(): Promise<Category[]> {
  const categoryQuery = query(
    categoriesCollection,
    where("status", "==", "active")
  );

  const snapshot = await getDocs(categoryQuery);

  const categories = snapshot.docs.map((doc) =>
    mapCategory(doc.id, doc.data())
  );

  return categories.sort(
    (a, b) =>
      (a.sortOrder ?? 0) -
      (b.sortOrder ?? 0)
  );
}

export async function getCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const categories = await getCategories();

  return (
    categories.find(
      (category) => category.slug === slug
    ) ?? null
  );
}
