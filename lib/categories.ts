
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Category } from "@/types/category";

const categoriesCollection = collection(db, "categories");

const DEFAULT_CATEGORIES = [
  { name: "Fashion & Apparel", slug: "fashion", icon: "shirt", sortOrder: 1 },
  { name: "Men's Fashion", slug: "mens-clothing", icon: "shirt", sortOrder: 2 },
  { name: "Women's Fashion", slug: "womens-clothing", icon: "shirt", sortOrder: 3 },
  { name: "Footwear", slug: "footwear", icon: "footprints", sortOrder: 4 },
  { name: "Beauty & Personal Care", slug: "beauty-personal-care", icon: "sparkles", sortOrder: 5 },
  { name: "Electronics & Gadgets", slug: "electronics", icon: "smartphone", sortOrder: 6 },
  { name: "Mobile Accessories", slug: "mobile-accessories", icon: "headphones", sortOrder: 7 },
  { name: "Home & Kitchen", slug: "home-kitchen", icon: "house", sortOrder: 8 },
  { name: "Grocery & Daily Essentials", slug: "grocery", icon: "shopping-basket", sortOrder: 9 },
  { name: "Toys, Kids & Baby", slug: "toys-games", icon: "puzzle", sortOrder: 10 },
  { name: "Bags & Luggage", slug: "bags-accessories", icon: "shopping-bag", sortOrder: 11 },
  { name: "Jewellery & Accessories", slug: "jewellery", icon: "gem", sortOrder: 12 },
  { name: "Sports & Fitness", slug: "sports-fitness", icon: "dumbbell", sortOrder: 13 },
  { name: "Books & Stationery", slug: "books-stationery", icon: "book", sortOrder: 14 },
  { name: "Automotive Accessories", slug: "automotive", icon: "car", sortOrder: 15 },
] as const;

type DefaultSubcategory = {
  id: string;
  name: string;
  slug: string;
  parentSlug: string;
  sortOrder: number;
  icon: string;
};

const DEFAULT_SUBCATEGORIES: DefaultSubcategory[] = [
  // Fashion & Apparel
  { id: "sub-fashion-t-shirts", name: "T-Shirts", slug: "t-shirts", parentSlug: "fashion", sortOrder: 1, icon: "shirt" },
  { id: "sub-fashion-shirts", name: "Shirts", slug: "shirts", parentSlug: "fashion", sortOrder: 2, icon: "shirt" },
  { id: "sub-fashion-jeans", name: "Jeans", slug: "jeans", parentSlug: "fashion", sortOrder: 3, icon: "shirt" },
  { id: "sub-fashion-trousers", name: "Trousers", slug: "trousers", parentSlug: "fashion", sortOrder: 4, icon: "shirt" },
  { id: "sub-fashion-kids", name: "Kids' Clothing", slug: "kids-clothing", parentSlug: "fashion", sortOrder: 5, icon: "shirt" },

  // Men's Fashion
  { id: "sub-men-casual-shirts", name: "Casual Shirts", slug: "casual-shirts", parentSlug: "mens-clothing", sortOrder: 1, icon: "shirt" },
  { id: "sub-men-formal-shirts", name: "Formal Shirts", slug: "formal-shirts", parentSlug: "mens-clothing", sortOrder: 2, icon: "shirt" },
  { id: "sub-men-t-shirts", name: "Men's T-Shirts", slug: "mens-t-shirts", parentSlug: "mens-clothing", sortOrder: 3, icon: "shirt" },
  { id: "sub-men-jeans", name: "Men's Jeans", slug: "mens-jeans", parentSlug: "mens-clothing", sortOrder: 4, icon: "shirt" },
  { id: "sub-men-trousers", name: "Men's Trousers", slug: "mens-trousers", parentSlug: "mens-clothing", sortOrder: 5, icon: "shirt" },
  { id: "sub-men-ethnic", name: "Men's Ethnic Wear", slug: "mens-ethnic-wear", parentSlug: "mens-clothing", sortOrder: 6, icon: "shirt" },
  { id: "sub-men-innerwear", name: "Men's Innerwear", slug: "mens-innerwear", parentSlug: "mens-clothing", sortOrder: 7, icon: "shirt" },

  // Women's Fashion
  { id: "sub-women-kurtis", name: "Kurtis", slug: "kurtis", parentSlug: "womens-clothing", sortOrder: 1, icon: "shirt" },
  { id: "sub-women-sarees", name: "Sarees", slug: "sarees", parentSlug: "womens-clothing", sortOrder: 2, icon: "shirt" },
  { id: "sub-women-dresses", name: "Dresses", slug: "dresses", parentSlug: "womens-clothing", sortOrder: 3, icon: "shirt" },
  { id: "sub-women-tops", name: "Women's Tops", slug: "womens-tops", parentSlug: "womens-clothing", sortOrder: 4, icon: "shirt" },
  { id: "sub-women-jeans", name: "Women's Jeans", slug: "womens-jeans", parentSlug: "womens-clothing", sortOrder: 5, icon: "shirt" },
  { id: "sub-women-leggings", name: "Leggings", slug: "leggings", parentSlug: "womens-clothing", sortOrder: 6, icon: "shirt" },
  { id: "sub-women-innerwear", name: "Women's Innerwear", slug: "womens-innerwear", parentSlug: "womens-clothing", sortOrder: 7, icon: "shirt" },
];

export async function initializeDefaultCategories(): Promise<void> {
  const snapshot = await getDocs(categoriesCollection);

  const existingBySlug = new Map<string, (typeof snapshot.docs)[number]>();

  for (const categoryDoc of snapshot.docs) {
    const slug = categoryDoc.data().slug;
    if (typeof slug === "string" && slug.trim()) {
      const normalized = slug.trim().toLowerCase();
      if (!existingBySlug.has(normalized)) {
        existingBySlug.set(normalized, categoryDoc);
      }
    }
  }

  const operations = DEFAULT_CATEGORIES.map((category) => {
    const existingDoc = existingBySlug.get(category.slug);
    return {
      category,
      existingDoc,
      newRef: existingDoc ? null : doc(categoriesCollection),
    };
  });

  await runTransaction(db, async (transaction) => {
    const refsToRead = new Map<string, ReturnType<typeof doc>>();

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
      documents.map((snapshot) => [snapshot.id, snapshot.exists()])
    );

    for (const operation of operations) {
      const { category, existingDoc, newRef } = operation;

      if (existingDoc) {
        if (!existsById.get(existingDoc.id)) continue;

        const existingData = existingDoc.data();
        const updates: Record<string, unknown> = {};

        if (existingData.name !== category.name) updates.name = category.name;
        if (existingData.sortOrder !== category.sortOrder) {
          updates.sortOrder = category.sortOrder;
        }

        if (Object.keys(updates).length) {
          updates.updatedAt = serverTimestamp();
          transaction.update(
            doc(db, "categories", existingDoc.id),
            updates
          );
        }
      } else if (newRef && !existsById.get(newRef.id)) {
        transaction.set(newRef, {
          ...category,
          description: `${category.name} products on ANJIVO`,
          image: "",
          parentId: null,
          productCount: 0,
          featured: false,
          trending: false,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  });
}

async function ensureDefaultSubcategories(
  allCategories: Category[]
): Promise<void> {
  const parentBySlug = new Map(
    allCategories.map((category) => [
      category.slug.trim().toLowerCase(),
      category,
    ])
  );

  for (const subcategory of DEFAULT_SUBCATEGORIES) {
    const parent = parentBySlug.get(subcategory.parentSlug);

    if (!parent) {
      console.warn(
        `Skipping subcategory "${subcategory.name}": parent "${subcategory.parentSlug}" not found.`
      );
      continue;
    }

    const subcategoryRef = doc(db, "categories", subcategory.id);
    const existing = await getDoc(subcategoryRef);

    if (existing.exists()) {
      // Keep existing records and their fields unchanged.
      continue;
    }

    await setDoc(subcategoryRef, {
      name: subcategory.name,
      slug: subcategory.slug,
      icon: subcategory.icon,
      description: `${subcategory.name} on ANJIVO`,
      image: "",
      parentId: parent.id,
      productCount: 0,
      featured: false,
      trending: false,
      status: "active",
      sortOrder: subcategory.sortOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

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
    description: data.description != null ? String(data.description) : undefined,
    image: data.image != null ? String(data.image) : undefined,
    icon: data.icon != null ? String(data.icon) : undefined,
    parentId:
      data.parentId === null || data.parentId === undefined
        ? null
        : String(data.parentId),
    productCount:
      data.productCount !== undefined ? Number(data.productCount) || 0 : 0,
    featured: data.featured === true,
    trending: data.trending === true,
    status: status === "inactive" ? "inactive" : "active",
    sortOrder:
      data.sortOrder !== undefined ? Number(data.sortOrder) || 0 : 0,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function createCategory(
  data: Omit<Category, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const name = data.name.trim();
  const slug = data.slug.trim().toLowerCase();

  if (!name || !slug) {
    throw new Error("Category name and slug are required.");
  }

  if (data.parentId) {
    const parent = await getDoc(doc(db, "categories", data.parentId));
    if (!parent.exists()) {
      throw new Error("Selected parent category does not exist.");
    }
  }

  const existingQuery = query(categoriesCollection, where("slug", "==", slug));
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

export async function getCategories(): Promise<Category[]> {
  await initializeDefaultCategories();

  const firstSnapshot = await getDocs(categoriesCollection);
  const allBeforeSubcategories = firstSnapshot.docs.map((categoryDoc) =>
    mapCategory(
      categoryDoc.id,
      categoryDoc.data() as Record<string, unknown>
    )
  );

  await ensureDefaultSubcategories(allBeforeSubcategories);

  const snapshot = await getDocs(categoriesCollection);

  return snapshot.docs
    .map((categoryDoc) =>
      mapCategory(
        categoryDoc.id,
        categoryDoc.data() as Record<string, unknown>
      )
    )
    .filter((category) => category.status === "active")
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name)
    );
}

export async function getCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) return null;

  const categories = await getCategories();

  return (
    categories.find(
      (category) =>
        category.slug.trim().toLowerCase() === normalizedSlug
    ) ?? null
  );
}

export async function getSubcategories(
  parentId: string
): Promise<Category[]> {
  if (!parentId.trim()) return [];

  const categories = await getCategories();

  return categories
    .filter((category) => category.parentId === parentId)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.name.localeCompare(b.name)
    );
}
