"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCategories } from "@/lib/categories";
import type { Category } from "@/types/category";

const CATEGORY_ICONS: Record<string, string> = {
  fashion: "👗",
  "mens-clothing": "👔",
  "womens-clothing": "👚",
  footwear: "👟",
  "beauty-personal-care": "💄",
  electronics: "📱",
  "mobile-accessories": "🎧",
  "home-kitchen": "🏠",
  grocery: "🛒",
  "toys-games": "🧸",
  "bags-accessories": "👜",
  jewellery: "💍",
  "sports-fitness": "🏋️",
  "books-stationery": "📚",
  automotive: "🚗",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  fashion: "Clothing & Style",
  "mens-clothing": "Men's Wear",
  "womens-clothing": "Women's Wear",
  footwear: "Shoes & Sandals",
  "beauty-personal-care": "Beauty & Care",
  electronics: "Gadgets & More",
  "mobile-accessories": "Mobile Essentials",
  "home-kitchen": "Home & Living",
  grocery: "Everyday Essentials",
  "toys-games": "Kids & Toys",
  "bags-accessories": "Bags & Accessories",
  jewellery: "Jewellery & Accessories",
  "sports-fitness": "Sports & Fitness",
  "books-stationery": "Books & Stationery",
  automotive: "Car & Bike Accessories",
};

/** Create a consistent URL-safe slug when a category has no usable slug. */
function getCategorySlug(category: Category): string {
  const existingSlug = typeof category.slug === "string" ? category.slug.trim() : "";
  const source = existingSlug || category.name.trim();

  return source
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Older/admin-created category records may use "Active", "ACTIVE", or may
 * not have a status field at all. Only an explicitly non-active status hides
 * a category; a missing status is treated as active for backward compatibility.
 */
function isCategoryVisible(category: Category): boolean {
  const status = (category.status ?? "active").toString().trim().toLowerCase();
  return status === "active" && category.name.trim() !== "";
}

function getCategoryIcon(category: Category, slug: string): string {
  const existingIcon = typeof category.icon === "string" ? category.icon.trim() : "";

  // Use a saved emoji when one exists, unless a standard icon is defined for
  // this known category slug.
  if (existingIcon && CATEGORY_ICONS[slug] === undefined) {
    if (/\p{Extended_Pictographic}/u.test(existingIcon)) {
      return existingIcon;
    }
  }

  return CATEGORY_ICONS[slug] ?? (existingIcon || "🛍️");
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const result = await getCategories();

        if (cancelled) return;

        // Keep valid categories visible even when legacy records have no
        // status field or use a different capitalization for "active".
        const visibleCategories = (Array.isArray(result) ? result : []).filter(
          (category) =>
            category &&
            typeof category.name === "string" &&
            isCategoryVisible(category) &&
            getCategorySlug(category) !== ""
        );

        setCategories(visibleCategories);
        setLoadError(false);
      } catch (error) {
        console.error("Homepage categories load error:", error);

        if (!cancelled) {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:py-12 md:py-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
              Explore
            </p>
          </div>

          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
            Shop by Category
          </h2>

          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            Discover products across popular categories
          </p>
        </div>

        <Link
          href="/categories"
          className="shrink-0 text-xs font-bold text-gray-700 transition hover:text-black sm:text-sm"
        >
          View All →
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
            >
              <div className="mx-auto h-16 w-16 rounded-full bg-gray-100" />
              <div className="mx-auto mt-4 h-3 w-20 rounded bg-gray-100" />
              <div className="mx-auto mt-2 h-2 w-14 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Categories could not be loaded. Please try refreshing the page.
        </p>
      ) : categories.length === 0 ? (
        <p className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
          Categories will appear here soon.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
          {categories.map((category) => {
            const slug = getCategorySlug(category);
            const icon = getCategoryIcon(category, slug);
            const description =
              CATEGORY_DESCRIPTIONS[slug] ??
              (typeof category.description === "string" && category.description.trim()
                ? category.description
                : "Explore Products");
            const productCount =
              typeof category.productCount === "number" &&
              Number.isFinite(category.productCount)
                ? Math.max(0, category.productCount)
                : 0;

            return (
              <Link
                key={category.id || slug}
               href={`/products?category=${encodeURIComponent(category.id)}`}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-center transition duration-300 hover:-translate-y-1 hover:border-black hover:shadow-xl sm:p-5"
              >
                <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-gray-50 transition duration-300 group-hover:scale-150" />

                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl transition duration-300 group-hover:scale-110 group-hover:bg-black group-hover:shadow-lg sm:h-[68px] sm:w-[68px] sm:text-[2rem]">
                  <span className="transition duration-300 group-hover:grayscale group-hover:brightness-0 group-hover:invert">
                    {icon}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-black text-gray-900">
                  {category.name}
                </h3>

                <p className="mt-1 hidden text-[10px] text-gray-400 sm:block">
                  {description}
                </p>

                <p className="mt-1 text-[10px] font-semibold text-gray-500">
                  {productCount.toLocaleString("en-IN")} Products
                </p>

                <div className="mt-2 text-[10px] font-bold text-gray-400 transition group-hover:text-black">
                  Explore →
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-5 text-center sm:hidden">
        <Link
          href="/categories"
          className="inline-flex rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-bold text-gray-800 transition hover:border-black hover:bg-black hover:text-white"
        >
          View All Categories →
        </Link>
      </div>
    </section>
  );
}
