
import Link from "next/link";
import { notFound } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";

import { getCategories } from "@/lib/categories";
import { searchProducts } from "@/lib/products";

import type { Category } from "@/types/category";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getIcon(category: Category): string {
  const slug = normalizeSlug(category.slug || category.name);
  return CATEGORY_ICONS[slug] || category.icon || "🛍️";
}

export default async function CategoryDetailPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params;

  let categories: Category[];

  try {
    categories = await getCategories();
  } catch (error) {
    console.error("Failed to load categories:", error);

    return (
      <div className="min-h-screen bg-gray-50 text-gray-950">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-16">
          <h1 className="text-2xl font-black">
            Categories could not be loaded
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            Please check the connection and try again.
          </p>
          <Link
            href="/categories"
            className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Browse Categories
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const category = categories.find(
    (item) =>
      normalizeSlug(item.slug || item.name) === normalizeSlug(slug)
  );

  if (!category) {
    notFound();
  }

  let products: Product[] = [];
  let productsError = false;

  try {
    products = await searchProducts(
      {
        categoryId: category.id,
        sort: "newest",
      },
      48
    );
  } catch (error) {
    console.error("Failed to load category products:", error);
    productsError = true;
  }

  const icon = getIcon(category);

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <Header />

      <main>
        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
            <nav className="mb-6 text-xs text-gray-500">
              <Link href="/" className="hover:text-black">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href="/categories" className="hover:text-black">
                Categories
              </Link>
              <span className="mx-2">/</span>
              <span className="font-semibold text-gray-900">
                {category.name}
              </span>
            </nav>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-4xl sm:h-24 sm:w-24">
                {icon}
              </div>

              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  ANJIVO Marketplace
                </p>

                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  {category.name}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                  {category.description?.trim() ||
                    `Explore ${category.name} products on ANJIVO. Compare options and discover products from marketplace sellers.`}
                </p>
              </div>

              <Link
                href="/categories"
                className="inline-flex w-fit shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold transition hover:border-black"
              >
                All Categories
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">
                {category.name} Products
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {productsError
                  ? "We could not retrieve the product list."
                  : `${products.length} products found`}
              </p>
            </div>

            <Link
              href={`/products?category=${encodeURIComponent(category.id)}`}
              className="text-sm font-bold text-gray-700 transition hover:text-black"
            >
              View Product Listing →
            </Link>
          </div>

          {productsError ? (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
              <h3 className="text-lg font-bold">
                Products could not be loaded
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Please refresh the page and try again.
              </p>
              <Link
                href="/products"
                className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
              >
                Browse All Products
              </Link>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
              <div className="text-5xl">{icon}</div>
              <h3 className="mt-4 text-xl font-black">
                No products found
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                There are no active products in this category yet.
                Please explore other categories or check back later.
              </p>
              <Link
                href="/categories"
                className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
              >
                Explore Other Categories
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
