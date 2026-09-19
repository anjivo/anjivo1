import Link from "next/link";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import {
  searchProducts,
  type ProductFilters,
} from "@/lib/products";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{
    search?: string;
    category?: string;
    seller?: string;
    minPrice?: string;
    maxPrice?: string;
    rating?: string;
    pricing?: string;
    sort?: string;
  }>;
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  const search =
    typeof params.search === "string"
      ? params.search.trim()
      : "";

  const categoryId =
    typeof params.category === "string"
      ? params.category
      : "";

  const sellerId =
    typeof params.seller === "string"
      ? params.seller
      : "";

  const minPrice =
    params.minPrice &&
    !Number.isNaN(Number(params.minPrice))
      ? Number(params.minPrice)
      : undefined;

  const maxPrice =
    params.maxPrice &&
    !Number.isNaN(Number(params.maxPrice))
      ? Number(params.maxPrice)
      : undefined;

  const minRating =
    params.rating &&
    !Number.isNaN(Number(params.rating))
      ? Number(params.rating)
      : undefined;

  const pricingType =
    params.pricing === "retail" ||
    params.pricing === "wholesale"
      ? params.pricing
      : "all";

  const sort =
    params.sort === "price_low"
      ? "price_low"
      : params.sort === "price_high"
        ? "price_high"
        : params.sort === "rating_high"
          ? "rating_high"
          : params.sort === "name_az"
            ? "name_az"
            : "newest";

  const filters: ProductFilters = {
    search,
    categoryId,
    sellerId,
    minPrice,
    maxPrice,
    minRating,
    pricingType,
    sort,
  };

  let products: Product[] = [];
  let error = false;

  try {
    products = await searchProducts(
      filters,
      48
    );
  } catch (err) {
    console.error(
      "Failed to load products:",
      err
    );
    error = true;
  }

  function buildUrl(
    changes: Record<string, string | undefined>
  ) {
    const query = new URLSearchParams();

    const current: Record<string, string> = {
      search,
      category: categoryId,
      seller: sellerId,
      minPrice:
        minPrice !== undefined
          ? String(minPrice)
          : "",
      maxPrice:
        maxPrice !== undefined
          ? String(maxPrice)
          : "",
      rating:
        minRating !== undefined
          ? String(minRating)
          : "",
      pricing:
        pricingType !== "all"
          ? pricingType
          : "",
      sort:
        sort !== "newest"
          ? sort
          : "",
    };

    Object.entries(current).forEach(
      ([key, value]) => {
        if (value) {
          query.set(key, value);
        }
      }
    );

    Object.entries(changes).forEach(
      ([key, value]) => {
        if (value) {
          query.set(key, value);
        } else {
          query.delete(key);
        }
      }
    );

    const queryString =
      query.toString();

    return queryString
      ? `/products?${queryString}`
      : "/products";
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <Header />

      <main>

        {/* ================= PAGE HEADER ================= */}

        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

              <div>

                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    ANJIVO Marketplace
                  </p>
                </div>

                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  {search
                    ? `Search results for "${search}"`
                    : "All Products"}
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                  Discover products from ANJIVO
                  sellers. Buy retail or unlock
                  wholesale pricing when you buy
                  in bulk.
                </p>

              </div>

              <Link
                href="/wholesale"
                className="inline-flex w-fit items-center rounded-xl bg-black px-5 py-3 text-xs font-bold text-white transition hover:bg-gray-800"
              >
                📦 Explore Wholesale
              </Link>

            </div>

          </div>
        </section>

        {/* ================= SEARCH ================= */}

        <section className="border-b border-gray-200 bg-white">

          <div className="mx-auto max-w-7xl px-4 py-4">

            <form
              action="/products"
              method="GET"
              className="flex flex-col gap-2 sm:flex-row"
            >

              <div className="relative flex-1">

                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm">
                  🔎
                </span>

                <input
                  type="search"
                  name="search"
                  defaultValue={search}
                  placeholder="Search products, categories or sellers..."
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none transition focus:border-black focus:bg-white"
                />

              </div>

              {pricingType !== "all" && (
                <input
                  type="hidden"
                  name="pricing"
                  value={pricingType}
                />
              )}

              <button
                type="submit"
                className="h-12 rounded-xl bg-black px-7 text-sm font-bold text-white transition hover:bg-gray-800"
              >
                Search
              </button>

            </form>

          </div>

        </section>

        {/* ================= QUICK FILTERS ================= */}

        <section className="border-b border-gray-200 bg-white">

          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto whitespace-nowrap px-4 py-3">

            <Link
              href="/products"
              className={`rounded-lg px-4 py-2 text-[11px] font-bold ${
                !search &&
                !categoryId &&
                !sellerId
                  ? "bg-black text-white"
                  : "border border-gray-200 text-gray-600 hover:border-black hover:text-black"
              }`}
            >
              All Products
            </Link>

            <Link
              href={buildUrl({
                sort: "newest",
              })}
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              ✨ New Arrivals
            </Link>

            <Link
              href={buildUrl({
                sort: "rating_high",
              })}
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              ⭐ Top Rated
            </Link>

            <Link
              href={buildUrl({
                sort: "price_low",
              })}
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              ₹ Low to High
            </Link>

            <Link
              href={buildUrl({
                sort: "price_high",
              })}
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              ₹ High to Low
            </Link>

            <Link
              href={buildUrl({
                pricing: "wholesale",
              })}
              className={`rounded-lg border px-4 py-2 text-[11px] font-semibold transition ${
                pricingType === "wholesale"
                  ? "border-black bg-black text-white"
                  : "border-gray-200 text-gray-600 hover:border-black hover:text-black"
              }`}
            >
              📦 Wholesale
            </Link>

            <Link
              href={buildUrl({
                pricing: "retail",
              })}
              className={`rounded-lg border px-4 py-2 text-[11px] font-semibold transition ${
                pricingType === "retail"
                  ? "border-black bg-black text-white"
                  : "border-gray-200 text-gray-600 hover:border-black hover:text-black"
              }`}
            >
              🛍️ Retail
            </Link>

          </div>

        </section>

        {/* ================= MAIN CONTENT ================= */}

        <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10">

          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">

            {/* ================= FILTER SIDEBAR ================= */}

            <aside className="hidden lg:block">

              <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-5">

                <div className="flex items-center justify-between">

                  <h2 className="text-sm font-black">
                    Filters
                  </h2>

                  <Link
                    href="/products"
                    className="text-[10px] font-bold text-gray-400 hover:text-black"
                  >
                    Clear
                  </Link>

                </div>

                {/* PRICING TYPE */}

                <div className="mt-6">

                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Buying Type
                  </p>

                  <div className="mt-3 space-y-2">

                    <Link
                      href={buildUrl({
                        pricing: "retail",
                      })}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                        pricingType === "retail"
                          ? "bg-black text-white"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>
                        🛍️ Retail
                      </span>

                      {pricingType === "retail" && (
                        <span>✓</span>
                      )}
                    </Link>

                    <Link
                      href={buildUrl({
                        pricing: "wholesale",
                      })}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                        pricingType === "wholesale"
                          ? "bg-black text-white"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>
                        📦 Wholesale
                      </span>

                      {pricingType === "wholesale" && (
                        <span>✓</span>
                      )}
                    </Link>

                  </div>

                </div>

                {/* MIN PRICE */}

                <div className="mt-6">

                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Minimum Price
                  </p>

                  <form
                    action="/products"
                    method="GET"
                    className="mt-3"
                  >

                    <input
                      type="number"
                      name="minPrice"
                      defaultValue={
                        minPrice !== undefined
                          ? minPrice
                          : ""
                      }
                      placeholder="₹ Min"
                      min="0"
                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-black"
                    />

                    <input
                      type="hidden"
                      name="maxPrice"
                      value={
                        maxPrice !== undefined
                          ? maxPrice
                          : ""
                      }
                    />

                    <input
                      type="hidden"
                      name="pricing"
                      value={
                        pricingType !== "all"
                          ? pricingType
                          : ""
                      }
                    />

                    <button
                      type="submit"
                      className="mt-2 w-full rounded-lg bg-black py-2.5 text-[11px] font-bold text-white"
                    >
                      Apply Price
                    </button>

                  </form>

                </div>

                {/* MAX PRICE */}

                <div className="mt-6">

                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Maximum Price
                  </p>

                  <form
                    action="/products"
                    method="GET"
                    className="mt-3"
                  >

                    <input
                      type="number"
                      name="maxPrice"
                      defaultValue={
                        maxPrice !== undefined
                          ? maxPrice
                          : ""
                      }
                      placeholder="₹ Max"
                      min="0"
                      className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-black"
                    />

                    <input
                      type="hidden"
                      name="minPrice"
                      value={
                        minPrice !== undefined
                          ? minPrice
                          : ""
                      }
                    />

                    <input
                      type="hidden"
                      name="pricing"
                      value={
                        pricingType !== "all"
                          ? pricingType
                          : ""
                      }
                    />

                    <button
                      type="submit"
                      className="mt-2 w-full rounded-lg bg-black py-2.5 text-[11px] font-bold text-white"
                    >
                      Apply Price
                    </button>

                  </form>

                </div>

                {/* RATING */}

                <div className="mt-6">

                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Rating
                  </p>

                  <div className="mt-3 space-y-2">

                    {[4, 3, 2].map(
                      (rating) => (
                        <Link
                          key={rating}
                          href={buildUrl({
                            rating: String(
                              rating
                            ),
                          })}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                            minRating === rating
                              ? "bg-black text-white"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <span>
                            {"★".repeat(
                              rating
                            )}
                          </span>

                          <span>
                            & above
                          </span>
                        </Link>
                      )
                    )}

                  </div>

                </div>

              </div>

            </aside>

            {/* ================= PRODUCTS AREA ================= */}

            <div>

              {/* TOP BAR */}

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <p className="text-sm font-black text-gray-900">
                    {products.length} Products
                  </p>

                  <p className="mt-1 text-[11px] text-gray-400">
                    {search
                      ? `Showing results for "${search}"`
                      : "Products loaded from ANJIVO marketplace"}
                  </p>

                </div>

                {/* SORT */}

                <div className="flex items-center gap-2">

                  <span className="text-[10px] font-bold text-gray-400">
                    Sort:
                  </span>

                  <select
                    defaultValue={sort}
                    onChange={() => {}}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[11px] font-semibold outline-none"
                  >
                    <option value="newest">
                      Newest
                    </option>

                    <option value="price_low">
                      Price: Low to High
                    </option>

                    <option value="price_high">
                      Price: High to Low
                    </option>

                    <option value="rating_high">
                      Top Rated
                    </option>

                    <option value="name_az">
                      Name A-Z
                    </option>
                  </select>

                </div>

              </div>

              {/* ERROR */}

              {error ? (

                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">

                  <div className="text-3xl">
                    ⚠️
                  </div>

                  <h2 className="mt-3 text-lg font-black">
                    Products could not be loaded
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                    Please check the Firebase
                    connection and Firestore
                    configuration, then refresh
                    the page.
                  </p>

                </div>

              ) : products.length === 0 ? (

                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">

                  <div className="text-5xl">
                    🔎
                  </div>

                  <h2 className="mt-4 text-xl font-black">
                    No products found
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                    Try another search term or
                    remove some filters.
                  </p>

                  <Link
                    href="/products"
                    className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white transition hover:bg-gray-800"
                  >
                    Clear All Filters
                  </Link>

                </div>

              ) : (

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">

                  {products.map(
                    (product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                      />
                    )
                  )}

                </div>

              )}

            </div>

          </div>

        </section>

      </main>

      <Footer />
    </div>
  );
}
