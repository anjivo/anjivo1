import Link from "next/link";

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";

import {
  getBestSellerProducts,
  getFeaturedProducts,
  getProducts,
  getTrendingProducts,
} from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [
    featuredProducts,
    bestSellerProducts,
    trendingProducts,
    latestProducts,
  ] = await Promise.all([
    getFeaturedProducts(8),
    getBestSellerProducts(8),
    getTrendingProducts(8),
    getProducts(12),
  ]);

  /*
   * Agar Firestore me featured/bestseller/trending products
   * abhi nahi hain, to homepage blank na rahe.
   *
   * Latest active products fallback ke roop me use honge.
   */

  const featured =
    featuredProducts.length > 0
      ? featuredProducts
      : latestProducts.slice(0, 8);

  const bestSellers =
    bestSellerProducts.length > 0
      ? bestSellerProducts
      : latestProducts.slice(0, 8);

  const trending =
    trendingProducts.length > 0
      ? trendingProducts
      : latestProducts.slice(0, 8);

  return (
    <main className="min-h-screen bg-white text-black">

      {/* ================= HEADER ================= */}

      <Header />

      {/* ================= HERO ================= */}

      <Hero />

      {/* ================= CATEGORIES ================= */}

      <Categories />

      {/* ================= FEATURED / FLASH SALE ================= */}

      <section className="border-b border-gray-100 bg-white py-10 sm:py-14">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="mb-6 flex items-end justify-between gap-4">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                ANJIVO Marketplace
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Featured Products
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Retail aur wholesale dono ke liye products
              </p>

            </div>

            <Link
              href="/products"
              className="shrink-0 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:bg-black hover:text-white"
            >
              View All
            </Link>

          </div>

          {featured.length > 0 ? (

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">

              {featured.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}

            </div>

          ) : (

            <EmptyProducts />

          )}

        </div>

      </section>

      {/* ================= WHOLESALE ZONE ================= */}

      <section className="border-b border-gray-100 bg-gray-50 py-12 sm:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                For Business Buyers
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Wholesale Zone
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                Bulk quantity par better pricing. MOQ aur quantity-based
                wholesale rates ke saath products purchase karein.
              </p>

            </div>

            <Link
              href="/products?type=wholesale"
              className="w-fit rounded-xl bg-black px-5 py-3 text-xs font-bold text-white transition hover:bg-gray-800"
            >
              Explore Wholesale
            </Link>

          </div>

          {trending.length > 0 ? (

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">

              {trending.slice(0, 8).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}

            </div>

          ) : (

            <EmptyProducts />

          )}

        </div>

      </section>

      {/* ================= RETAIL + BUSINESS ================= */}

      <section className="bg-white py-10 sm:py-14">

        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 md:grid-cols-2 lg:px-8">

          {/* Retail */}

          <Link
            href="/products"
            className="group overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 p-6 transition hover:border-gray-300 hover:shadow-lg sm:p-8"
          >

            <div className="flex min-h-[230px] flex-col justify-between">

              <div>

                <span className="inline-flex rounded-full bg-black px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                  Retail Shopping
                </span>

                <h3 className="mt-4 text-2xl font-black sm:text-3xl">
                  Everyday products
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
                  Quality products, verified sellers aur convenient online
                  shopping experience.
                </p>

              </div>

              <span className="mt-6 text-xs font-black transition group-hover:translate-x-1">
                Shop Retail →
              </span>

            </div>

          </Link>

          {/* Wholesale */}

          <Link
            href="/products?type=wholesale"
            className="group overflow-hidden rounded-3xl bg-black p-6 text-white transition hover:bg-gray-900 sm:p-8"
          >

            <div className="flex min-h-[230px] flex-col justify-between">

              <div>

                <span className="inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black">
                  Wholesale
                </span>

                <h3 className="mt-4 text-2xl font-black sm:text-3xl">
                  Buy more. Pay less.
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-gray-300">
                  MOQ aur quantity-based pricing ke saath retailers aur
                  businesses ke liye bulk purchasing.
                </p>

              </div>

              <span className="mt-6 text-xs font-black transition group-hover:translate-x-1">
                Explore Wholesale →
              </span>

            </div>

          </Link>

        </div>

      </section>

      {/* ================= BEST SELLERS ================= */}

      <section className="border-y border-gray-100 bg-white py-12 sm:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="mb-6 flex items-end justify-between gap-4">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Popular Right Now
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Best Sellers
              </h2>

            </div>

            <Link
              href="/products?sort=best-selling"
              className="shrink-0 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:bg-black hover:text-white"
            >
              View All
            </Link>

          </div>

          {bestSellers.length > 0 ? (

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">

              {bestSellers.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}

            </div>

          ) : (

            <EmptyProducts />

          )}

        </div>

      </section>

      {/* ================= SELLER CTA ================= */}

      <section className="bg-gray-50 py-12 sm:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="overflow-hidden rounded-3xl bg-black p-6 text-white sm:p-10 lg:p-12">

            <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Grow With ANJIVO
                </p>

                <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                  Sell your products on ANJIVO
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
                  Apne products list karein, retail aur wholesale customers
                  tak reach karein aur apna online business grow karein.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">

                  <Link
                    href="/seller/register"
                    className="rounded-xl bg-white px-5 py-3 text-xs font-black text-black transition hover:bg-gray-200"
                  >
                    Become a Seller
                  </Link>

                  <Link
                    href="/seller"
                    className="rounded-xl border border-gray-700 px-5 py-3 text-xs font-bold text-white transition hover:bg-white hover:text-black"
                  >
                    Seller Login
                  </Link>

                </div>

              </div>

              <div className="hidden text-right lg:block">

                <p className="text-6xl font-black tracking-tighter">
                  ANJIVO
                </p>

                <p className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-gray-500">
                  Wholesale + Retail
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ================= TRUST FEATURES ================= */}

      <section className="border-b border-gray-100 bg-white py-10">

        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 sm:grid-cols-4 sm:px-6 lg:px-8">

          <TrustItem
            icon="✓"
            title="Verified Sellers"
            description="Seller verification system"
          />

          <TrustItem
            icon="₹"
            title="Wholesale Pricing"
            description="Quantity-based rates"
          />

          <TrustItem
            icon="↗"
            title="Secure Orders"
            description="Order tracking system"
          />

          <TrustItem
            icon="★"
            title="Growing Marketplace"
            description="Retail + Business"
          />

        </div>

      </section>

      {/* ================= APP / PLATFORM CTA ================= */}

      <section className="bg-gray-50 py-12 sm:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-10">

            <div className="grid items-center gap-8 lg:grid-cols-2">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  ANJIVO Platform
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                  One marketplace for retail & wholesale
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">
                  Customers ke liye easy shopping aur businesses ke liye
                  bulk purchasing — dono experiences ek hi marketplace par.
                </p>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <PlatformBox
                  title="Retail"
                  description="Individual shopping"
                />

                <PlatformBox
                  title="Wholesale"
                  description="Bulk purchasing"
                />

                <PlatformBox
                  title="Sellers"
                  description="Sell online"
                />

                <PlatformBox
                  title="Business"
                  description="B2B buying"
                />

              </div>

            </div>

          </div>

        </div>

      </section>

      {/* ================= LATEST PRODUCTS ================= */}

      <section className="bg-white py-12 sm:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="mb-6 flex items-end justify-between gap-4">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Fresh Arrivals
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                New Products
              </h2>

            </div>

            <Link
              href="/products?sort=new"
              className="shrink-0 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:bg-black hover:text-white"
            >
              See All
            </Link>

          </div>

          {latestProducts.length > 0 ? (

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">

              {latestProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}

            </div>

          ) : (

            <EmptyProducts />

          )}

        </div>

      </section>

      {/* ================= FOOTER ================= */}

      <Footer />

    </main>
  );
}


/* =========================================================
   EMPTY PRODUCTS
========================================================= */

function EmptyProducts() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">

      <div className="text-4xl">
        📦
      </div>

      <h3 className="mt-3 text-sm font-black">
        Products coming soon
      </h3>

      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-gray-500">
        Sellers ke products approve hone ke baad yahan products
        automatically दिखाई देंगे.
      </p>

    </div>
  );
}


/* =========================================================
   TRUST ITEM
========================================================= */

function TrustItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">

      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-black text-white">
        {icon}
      </div>

      <h3 className="mt-3 text-xs font-black">
        {title}
      </h3>

      <p className="mt-1 text-[10px] leading-4 text-gray-400">
        {description}
      </p>

    </div>
  );
}


/* =========================================================
   PLATFORM BOX
========================================================= */

function PlatformBox({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">

      <h3 className="text-sm font-black">
        {title}
      </h3>

      <p className="mt-1 text-[10px] text-gray-500">
        {description}
      </p>

    </div>
  );
}
