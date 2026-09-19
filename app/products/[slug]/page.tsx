import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getProductBySlug } from "@/lib/products";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ProductDetailsPage({
  params,
}: ProductPageProps) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const discount =
    product.mrp > product.retailPrice
      ? Math.round(
          ((product.mrp - product.retailPrice) / product.mrp) * 100
        )
      : 0;

  const mainImage = product.images[0];

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">
      <Header />

      <main>
        {/* ================= BREADCRUMB ================= */}
        <div className="mx-auto max-w-7xl px-4 pt-5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-black">
              Home
            </Link>

            <span>›</span>

            <Link href="/products" className="hover:text-black">
              Products
            </Link>

            <span>›</span>

            <span className="font-semibold text-gray-700">
              {product.name}
            </span>
          </div>
        </div>

        {/* ================= PRODUCT ================= */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">

            {/* ================= IMAGE ================= */}
            <div>
              <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-200 bg-white">
                {mainImage ? (
                  <Image
                    src={mainImage}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-8xl">
                    📦
                  </div>
                )}

                {product.bestSeller && (
                  <span className="absolute left-4 top-4 rounded-full bg-black px-3 py-1.5 text-[10px] font-bold text-white">
                    Bestseller
                  </span>
                )}

                {discount > 0 && (
                  <span className="absolute bottom-4 left-4 rounded-lg bg-white px-3 py-2 text-xs font-black shadow-lg">
                    {discount}% OFF
                  </span>
                )}
              </div>

              {/* IMAGE THUMBNAILS */}
              {product.images.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {product.images.slice(0, 5).map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-white"
                    >
                      <Image
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ================= DETAILS ================= */}
            <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                  {product.categoryName || product.categoryId}
                </span>

                {product.sellerVerified && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold text-gray-700">
                    ✓ Verified Seller
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {product.name}
              </h1>

              {/* RATING */}
              {product.rating !== undefined && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-black">
                    ★ {product.rating}
                  </span>

                  {product.reviewsCount !== undefined && (
                    <span className="text-xs text-gray-400">
                      {product.reviewsCount.toLocaleString("en-IN")} reviews
                    </span>
                  )}
                </div>
              )}

              {/* DESCRIPTION */}
              {product.description && (
                <p className="mt-5 text-sm leading-6 text-gray-600">
                  {product.description}
                </p>
              )}

              {/* RETAIL PRICE */}
              <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Retail Price
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="text-3xl font-black">
                    ₹{product.retailPrice.toLocaleString("en-IN")}
                  </span>

                  {product.mrp > product.retailPrice && (
                    <span className="text-sm text-gray-400 line-through">
                      ₹{product.mrp.toLocaleString("en-IN")}
                    </span>
                  )}

                  {discount > 0 && (
                    <span className="text-xs font-black text-gray-700">
                      {discount}% OFF
                    </span>
                  )}
                </div>
              </div>

              {/* WHOLESALE */}
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Wholesale Price
                    </p>

                    <p className="mt-1 text-2xl font-black">
                      ₹{product.wholesalePrice.toLocaleString("en-IN")}
                      <span className="ml-1 text-xs font-medium text-gray-500">
                        / piece
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl bg-gray-100 px-3 py-2 text-center">
                    <p className="text-[9px] font-bold uppercase text-gray-400">
                      MOQ
                    </p>
                    <p className="text-sm font-black">
                      {product.moq}
                    </p>
                  </div>
                </div>

                {/* WHOLESALE TIERS */}
                {product.wholesaleTiers.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {product.wholesaleTiers.map((tier, index) => (
                      <div
                        key={`${tier.minQuantity}-${index}`}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center"
                      >
                        <p className="text-[9px] text-gray-400">
                          {tier.maxQuantity
                            ? `${tier.minQuantity}-${tier.maxQuantity}`
                            : `${tier.minQuantity}+`}
                        </p>

                        <p className="mt-1 text-sm font-black">
                          ₹{tier.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SELLER */}
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-lg">
                    🏪
                  </div>

                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-400">
                      Sold by
                    </p>

                    <p className="mt-0.5 text-sm font-black">
                      {product.sellerName || "ANJIVO Seller"}
                    </p>
                  </div>
                </div>

                {product.sellerVerified && (
                  <span className="text-[10px] font-bold text-gray-700">
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* STOCK */}
              <div className="mt-4">
                {product.stock > 0 ? (
                  <p className="text-xs font-bold text-gray-700">
                    ✓ In Stock
                    {product.stock <= 10 && (
                      <span className="ml-2 text-gray-500">
                        Only {product.stock} left
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-gray-700">
                    Currently out of stock
                  </p>
                )}
              </div>

              {/* ACTIONS */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={product.stock <= 0}
                  className="rounded-xl border border-black bg-white py-3.5 text-sm font-bold text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🛒 Add to Cart
                </button>

                <button
                  type="button"
                  disabled={product.stock <= 0}
                  className="rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Buy Now
                </button>
              </div>

              {/* TRUST */}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-5">
                <div className="text-center">
                  <div className="text-sm">🔒</div>
                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Secure
                  </p>
                </div>

                <div className="text-center">
                  <div className="text-sm">✓</div>
                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Verified
                  </p>
                </div>

                <div className="text-center">
                  <div className="text-sm">📦</div>
                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Tracked
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
