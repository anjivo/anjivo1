
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Category } from "@/types/category";

const categoriesCollection = collection(db, "categories");

/**
 * Professional ANJIVO category names.
 *
 * Existing slugs are preserved to reduce the risk of breaking
 * existing product references and category URLs.
 */
const DEFAULT_CATEGORIES = [
  {
    name: "Fashion & Apparel",
    slug: "fashion",
    icon: "shirt",
    sortOrder: 1,
  },
  {
    name: "Men's Fashion",
    slug: "mens-clothing",
    icon: "shirt",
    sortOrder: 2,
  },
  {
    name: "Women's Fashion",
    slug: "womens-clothing",
    icon: "shirt",
    sortOrder: 3,
  },
  {
    name: "Footwear",
    slug: "footwear",
    icon: "footprints",
    sortOrder: 4,
  },
  {
    name: "Beauty & Personal Care",
    slug: "beauty-personal-care",
    icon: "sparkles",
    sortOrder: 5,
  },
  {
    name: "Electronics & Gadgets",
    slug: "electronics",
    icon: "smartphone",
    sortOrder: 6,
  },
  {
    name: "Mobile Accessories",
    slug: "mobile-accessories",
    icon: "headphones",
    sortOrder: 7,
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    icon: "house",
    sortOrder: 8,
  },
  {
    name: "Grocery & Daily Essentials",
    slug: "grocery",
    icon: "shopping-basket",
    sortOrder: 9,
  },
  {
    name: "Toys, Kids & Baby",
    slug: "toys-games",
    icon: "puzzle",
    sortOrder: 10,
  },
  {
    name: "Bags & Luggage",
    slug: "bags-accessories",
    icon: "shopping-bag",
    sortOrder: 11,
  },
  {
    name: "Jewellery & Accessories",
    slug: "jewellery",
    icon: "gem",
    sortOrder: 12,
  },
  {
    name: "Sports & Fitness",
    slug: "sports-fitness",
    icon: "dumbbell",
    sortOrder: 13,
  },
  {
    name: "Books & Stationery",
    slug: "books-stationery",
    icon: "book",
    sortOrder: 14,
  },
  {
    name: "Automotive Accessories",
    slug: "automotive",
    icon: "car",
    sortOrder: 15,
  },
] as const;

/**
 * Automatically initialize missing categories and rename known defaults.
 *
 * - Existing category document IDs are preserved.
 * - Existing slugs are preserved.
 * - Only the display name is changed for existing default categories.
 * - Other existing fields, including status and productCount, are preserved.
 * - Missing defaults are created without overwriting unrelated documents.
 */
export async function initializeDefaultCategories(): Promise<void> {
  const snapshot = await getDocs(categoriesCollection);

  const existingBySlug = new Map<
    string,
    (typeof snapshot.docs)[number]
  >();

  for (const categoryDoc of snapshot.docs) {
    const data = categoryDoc.data();
    const slug =
      typeof data.slug === "string"
        ? data.slug.trim().toLowerCase()
        : "";

    if (slug && !existingBySlug.has(slug)) {
      existingBySlug.set(slug, categoryDoc);
    }
  }

  const operations = DEFAULT_CATEGORIES.map((category) => {
    const existingDoc = existingBySlug.get(category.slug);

    return {
      category,
      existingDoc,
      newRef: existingDoc
        ? null
        : doc(categoriesCollection),
    };
  });

  await runTransaction(db, async (transaction) => {
    // Complete all reads before performing any writes.
    const refsToRead = new Map<
      string,
      ReturnType<typeof doc>
    >();

    for (const operation of operations) {
      if (operation.existingDoc) {
        refsToRead.set(
          operation.existingDoc.id,
          doc(db, "categories", operation.existingDoc.id)
        );
      } else if (operation.newRef) {
        refsToRead.set(operation.newRef.id, operation.newRef);
      }
    }

    const refs = Array.from(refsToRead.values());
    const documents = await Promise.all(
      refs.map((ref) => transaction.get(ref))
    );

    const existsById = new Map(
      documents.map((documentSnapshot) => [
        documentSnapshot.id,
        documentSnapshot.exists(),
      ])
    );

    for (const operation of operations) {
      const { category, existingDoc, newRef } = operation;

      if (existingDoc) {
        const existingRef = doc(
          db,
          "categories",
          existingDoc.id
        );

        if (!existsById.get(existingDoc.id)) {
          continue;
        }

        const existingData = existingDoc.data();
        const updates: Record<string, unknown> = {};

        // Update only the display name and ordering.
        if (existingData.name !== category.name) {
          updates.name = category.name;
        }

        if (existingData.sortOrder !== category.sortOrder) {
          updates.sortOrder = category.sortOrder;
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = serverTimestamp();
          transaction.update(existingRef, updates);
        }

        continue;
      }

      if (!newRef || existsById.get(newRef.id)) {
        continue;
      }

      transaction.set(newRef, {
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
    }
  });
}

/**
 * Create a new category.
 */
export async function createCategory(
  data: Omit<Category, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const name = data.name.trim();
  const slug = data.slug.trim().toLowerCase();

  if (!name || !slug) {
    throw new Error("Category name and slug are required.");
  }

  const existingQuery = query(
    categoriesCollection,
    where("slug", "==", slug)
  );

  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) {
    throw new Error("A category with this slug already exists.");
  }

  const categoryRef = await addDoc(categoriesCollection, {
    ...data,
    name,
    slug,
    status: data.status ?? "active",
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
 * Initialize defaults and return active categories.
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
 * Get an active category by slug.
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
