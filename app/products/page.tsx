import Link from "next/link";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/products";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products: Product[] = [];
  let error = false;

  try {
    products = await getProducts(24);
  } catch (err) {
    console.error("Failed to load products:", err);
    error = true;
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <Header />

      <main>
        {/* ================= PAGE HEADER ================= */}

        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">

            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

              <div>

                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" />

                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    ANJIVO Marketplace
                  </p>
                </div>

                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  All Products
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                  Discover products from verified sellers. Buy retail
                  or unlock wholesale pricing when you buy in bulk.
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

        {/* ================= FILTER BAR ================= */}

        <section className="border-b border-gray-200 bg-white">

          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto whitespace-nowrap px-4 py-3">

            <Link
              href="/products"
              className="rounded-lg bg-black px-4 py-2 text-[11px] font-bold text-white"
            >
              All Products
            </Link>

            <Link
              href="/products?sort=new"
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              New Arrivals
            </Link>

            <Link
              href="/products?sort=best"
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              Best Sellers
            </Link>

            <Link
              href="/products?sort=trending"
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              Trending
            </Link>

            <Link
              href="/products?deal=true"
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              🔥 Deals
            </Link>

            <Link
              href="/wholesale"
              className="rounded-lg border border-gray-200 px-4 py-2 text-[11px] font-semibold text-gray-600 transition hover:border-black hover:text-black"
            >
              📦 Wholesale
            </Link>

          </div>

        </section>

        {/* ================= PRODUCTS ================= */}

        <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10">

          {error ? (

            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">

              <div className="text-3xl">
                ⚠️
              </div>

              <h2 className="mt-3 text-lg font-black">
                Products could not be loaded
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                Please check the Firebase connection and Firestore
                configuration, then refresh the page.
              </p>

            </div>

          ) : products.length === 0 ? (

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">

              <div className="text-5xl">
                📦
              </div>

              <h2 className="mt-4 text-xl font-black">
                No products available yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                Products added by ANJIVO sellers will appear here.
              </p>

              <Link
                href="/seller/register"
                className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white transition hover:bg-gray-800"
              >
                Become a Seller
              </Link>

            </div>

          ) : (

            <>

              {/* ================= PRODUCT COUNT ================= */}

              <div className="mb-5 flex items-center justify-between gap-4">

                <div>

                  <p className="text-sm font-black text-gray-900">
                    Products
                  </p>

                  <p className="mt-1 text-[11px] text-gray-400">
                    {products.length} products loaded from ANJIVO
                  </p>

                </div>

              </div>

              {/* ================= PRODUCT GRID ================= */}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-4">

                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}

              </div>

            </>

          )}

        </section>

      </main>

      <Footer />
    </div>
  );
}
