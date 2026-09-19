import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Category } from "@/types/category";

const categoriesCollection =
  collection(db, "categories");

function mapCategory(
  id: string,
  data: Record<string, unknown>
): Category {
  return {
    id,

    name: String(
      data.name ?? ""
    ),

    slug: String(
      data.slug ?? ""
    ),

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

/* =========================================
   ALL ACTIVE CATEGORIES
========================================= */

export async function getCategories(): Promise<Category[]> {
  const categoriesQuery = query(
    categoriesCollection,
    where("status", "==", "active")
  );

  const snapshot =
    await getDocs(categoriesQuery);

  const categories =
    snapshot.docs.map((document) =>
      mapCategory(
        document.id,
        document.data()
      )
    );

  return categories.sort(
    (a, b) =>
      (a.sortOrder ?? 0) -
      (b.sortOrder ?? 0)
  );
}

/* =========================================
   ROOT CATEGORIES
========================================= */

export async function getRootCategories(): Promise<Category[]> {
  const categories =
    await getCategories();

  return categories
    .filter(
      (category) =>
        !category.parentId
    )
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) -
        (b.sortOrder ?? 0)
    );
}

/* =========================================
   SUBCATEGORIES
========================================= */

export async function getSubcategories(
  parentId: string
): Promise<Category[]> {
  const categories =
    await getCategories();

  return categories
    .filter(
      (category) =>
        category.parentId === parentId
    )
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) -
        (b.sortOrder ?? 0)
    );
}

/* =========================================
   CATEGORY BY SLUG
========================================= */

export async function getCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const categories =
    await getCategories();

  return (
    categories.find(
      (category) =>
        category.slug === slug
    ) ?? null
  );
}

/* =========================================
   FEATURED CATEGORIES
========================================= */

export async function getFeaturedCategories(
  categoryLimit = 12
): Promise<Category[]> {
  const categories =
    await getCategories();

  return categories
    .filter(
      (category) =>
        category.featured === true
    )
    .slice(0, categoryLimit);
}

/* =========================================
   TRENDING CATEGORIES
========================================= */

export async function getTrendingCategories(
  categoryLimit = 12
): Promise<Category[]> {
  const categories =
    await getCategories();

  return categories
    .filter(
      (category) =>
        category.trending === true
    )
    .slice(0, categoryLimit);
}
