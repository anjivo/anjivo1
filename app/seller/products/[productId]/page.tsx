"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth } from "@/lib/firebase";
import { getSellerProduct } from "@/lib/seller-products";

import type { Product } from "@/types/product";

export default function SellerProductViewPage() {
  const router = useRouter();
  const params = useParams();

  const productId =
    typeof params.productId === "string"
      ? params.productId
      : "";

  const [product, setProduct] =
    useState<Product | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!productId) {
      setError("Invalid product.");
      setLoading(false);
      return;
    }

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              `/login?redirect=/seller/products/${productId}`
            );
            return;
          }

          try {
            setError("");

            const loadedProduct =
              await getSellerProduct(
                user.uid,
                productId
              );

            if (!loadedProduct) {
              setError(
                "Product not found."
              );
              return;
            }

            setProduct(
              loadedProduct
            );
          } catch (err) {
            console.error(
              "Seller product view error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "Unable to load product."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [productId, router]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-500">
              Loading product...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">

            <div className="text-4xl">
              ⚠️
            </div>

            <h1 className="mt-4 text-xl font-black text-red-800">
              Unable to load product
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error || "Product not found."}
            </p>

            <Link
              href="/seller/products"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              ← Back to Products
            </Link>

          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     STATUS
  ========================================================= */

  const statusLabel =
    product.status.replace(
      "_",
      " "
    );

  const statusClass =
    product.status === "active"
      ? "bg-green-100 text-green-700"
      : product.status ===
          "blocked"
      ? "bg-red-100 text-red-700"
      : product.status ===
          "out_of_stock"
      ? "bg-orange-100 text-orange-700"
      : "bg-yellow-100 text-yellow-700";

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <Link
              href="/seller/products"
              className="text-xs font-bold text-gray-400 hover:text-black"
            >
              ← My Products
            </Link>

            <h1 className="mt-3 text-3xl font-black tracking-tight">
              Product Details
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              View complete product information.
            </p>

          </div>

          <div className="flex gap-2">

            <Link
              href={`/seller/products/${product.id}/edit`}
              className="rounded-xl bg-black px-5 py-3 text-center text-xs font-bold text-white hover:bg-gray-800"
            >
              Edit Product
            </Link>

          </div>

        </div>

        {/* ===================================================
            PRODUCT OVERVIEW
        =================================================== */}

        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white">

          <div className="grid lg:grid-cols-[420px_1fr]">

            {/* IMAGE */}

            <div className="border-b border-gray-200 bg-gray-50 p-6 lg:border-b-0 lg:border-r">

              <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-2xl bg-white">

                {product.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="max-h-[420px] w-full object-contain"
                  />
                ) : (
                  <div className="text-center">

                    <div className="text-6xl">
                      📦
                    </div>

                    <p className="mt-3 text-xs font-semibold text-gray-400">
                      No product image
                    </p>

                  </div>
                )}

              </div>

            </div>

            {/* BASIC DETAILS */}

            <div className="p-6 sm:p-8">

              <div className="flex flex-wrap items-center gap-2">

                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${statusClass}`}
                >
                  {statusLabel}
                </span>

                {product.sellerVerified && (
                  <span className="rounded-full bg-blue-100 px-3 py-1.5 text-[10px] font-bold text-blue-700">
                    ✓ Seller Verified
                  </span>
                )}

                {product.featured && (
                  <span className="rounded-full bg-purple-100 px-3 py-1.5 text-[10px] font-bold text-purple-700">
                    Featured
                  </span>
                )}

                {product.bestSeller && (
                  <span className="rounded-full bg-yellow-100 px-3 py-1.5 text-[10px] font-bold text-yellow-700">
                    Best Seller
                  </span>
                )}

                {product.trending && (
                  <span className="rounded-full bg-pink-100 px-3 py-1.5 text-[10px] font-bold text-pink-700">
                    Trending
                  </span>
                )}

              </div>

              <h2 className="mt-5 text-2xl font-black leading-tight sm:text-3xl">
                {product.name}
              </h2>

              <p className="mt-2 break-all text-xs text-gray-400">
                /{product.slug}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">

                <div className="rounded-2xl bg-gray-50 p-4">

                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Category
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {product.categoryName ||
                      product.categoryId ||
                      "—"}
                  </p>

                </div>

                <div className="rounded-2xl bg-gray-50 p-4">

                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Seller
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {product.sellerName ||
                      "ANJIVO Seller"}
                  </p>

                </div>

              </div>

              {/* DESCRIPTION */}

              <div className="mt-6">

                <p className="text-xs font-black">
                  Description
                </p>

                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                  {product.description ||
                    "No description added."}
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* ===================================================
            PRICING
        =================================================== */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Pricing
              </p>

              <h2 className="mt-1 text-xl font-black">
                Product Pricing
              </h2>

            </div>

          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">

            {/* MRP */}

            <div className="rounded-2xl border border-gray-200 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                MRP
              </p>

              <p className="mt-2 text-2xl font-black">
                ₹{product.mrp.toLocaleString("en-IN")}
              </p>

            </div>

            {/* RETAIL */}

            <div className="rounded-2xl border border-gray-200 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                Retail Price
              </p>

              <p className="mt-2 text-2xl font-black">
                ₹
                {product.retailPrice.toLocaleString(
                  "en-IN"
                )}
              </p>

            </div>

            {/* WHOLESALE */}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                Wholesale From
              </p>

              <p className="mt-2 text-2xl font-black">
                ₹
                {product.wholesalePrice.toLocaleString(
                  "en-IN"
                )}
              </p>

            </div>

          </div>

        </section>

        {/* ===================================================
            WHOLESALE TIERS
        =================================================== */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Wholesale
            </p>

            <h2 className="mt-1 text-xl font-black">
              Quantity Pricing
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Prices configured for different order quantities.
            </p>

          </div>

          {product.wholesaleTiers &&
          product.wholesaleTiers.length >
            0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">

              <div className="grid grid-cols-3 bg-gray-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-gray-400">

                <span>
                  Quantity
                </span>

                <span>
                  Price / Piece
                </span>

                <span className="text-right">
                  Savings vs Retail
                </span>

              </div>

              {product.wholesaleTiers.map(
                (tier, index) => {

                  const quantityLabel =
                    tier.maxQuantity !==
                    undefined
                      ? `${tier.minQuantity} – ${tier.maxQuantity}`
                      : `${tier.minQuantity}+`;

                  const savings =
                    product.retailPrice -
                    tier.price;

                  const savingsPercent =
                    product.retailPrice >
                    0
                      ? Math.round(
                          (savings /
                            product.retailPrice) *
                            100
                        )
                      : 0;

                  return (
                    <div
                      key={`${tier.minQuantity}-${index}`}
                      className="grid grid-cols-3 items-center border-t border-gray-100 px-4 py-4"
                    >

                      <div className="text-sm font-bold">
                        {quantityLabel}
                      </div>

                      <div className="text-sm font-black">
                        ₹
                        {tier.price.toLocaleString(
                          "en-IN"
                        )}
                      </div>

                      <div className="text-right">

                        {savings > 0 ? (
                          <span className="text-xs font-bold text-green-600">
                            ₹
                            {savings.toLocaleString(
                              "en-IN"
                            )}{" "}
                            ({savingsPercent}%)
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            —
                          </span>
                        )}

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-gray-50 p-6 text-center">

              <p className="text-sm font-bold text-gray-500">
                No wholesale tiers configured.
              </p>

            </div>
          )}

        </section>

        {/* ===================================================
            INVENTORY
        =================================================== */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Inventory
          </p>

          <h2 className="mt-1 text-xl font-black">
            Stock Information
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">

            {/* STOCK */}

            <div className="rounded-2xl border border-gray-200 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                Available Stock
              </p>

              <p className="mt-2 text-2xl font-black">
                {product.stock.toLocaleString(
                  "en-IN"
                )}
              </p>

              {product.stock <= 10 &&
                product.stock > 0 && (
                  <p className="mt-1 text-xs font-bold text-orange-600">
                    Low stock
                  </p>
                )}

              {product.stock === 0 && (
                <p className="mt-1 text-xs font-bold text-red-600">
                  Out of stock
                </p>
              )}

            </div>

            {/* MOQ */}

            <div className="rounded-2xl border border-gray-200 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                MOQ
              </p>

              <p className="mt-2 text-2xl font-black">
                {product.moq.toLocaleString(
                  "en-IN"
                )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Minimum wholesale quantity
              </p>

            </div>

            {/* STOCK VALUE */}

            <div className="rounded-2xl border border-gray-200 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                Retail Stock Value
              </p>

              <p className="mt-2 text-2xl font-black">
                ₹
                {(
                  product.stock *
                  product.retailPrice
                ).toLocaleString(
                  "en-IN"
                )}
              </p>

            </div>

          </div>

        </section>

        {/* ===================================================
            RATING
        =================================================== */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Customer Performance
          </p>

          <h2 className="mt-1 text-xl font-black">
            Rating & Reviews
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">

            <div className="rounded-2xl bg-gray-50 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                Rating
              </p>

              <div className="mt-2 flex items-center gap-2">

                <span className="text-2xl font-black">
                  {product.rating !==
                  undefined
                    ? product.rating.toFixed(
                        1
                      )
                    : "—"}
                </span>

                {product.rating !==
                  undefined && (
                  <span className="text-lg">
                    ⭐
                  </span>
                )}

              </div>

            </div>

            <div className="rounded-2xl bg-gray-50 p-5">

              <p className="text-[10px] font-bold uppercase text-gray-400">
                Reviews
              </p>

              <p className="mt-2 text-2xl font-black">
                {(
                  product.reviewsCount ??
                  0
                ).toLocaleString(
                  "en-IN"
                )}
              </p>

            </div>

          </div>

        </section>

        {/* ===================================================
            MARKETPLACE STATUS
        =================================================== */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Marketplace
          </p>

          <h2 className="mt-1 text-xl font-black">
            Product Status
          </h2>

          <div className="mt-5 rounded-2xl bg-gray-50 p-5">

            <div className="flex flex-wrap items-center gap-3">

              <span
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase ${statusClass}`}
              >
                {statusLabel}
              </span>

              {product.featured && (
                <span className="rounded-full bg-purple-100 px-4 py-2 text-xs font-bold text-purple-700">
                  Featured
                </span>
              )}

              {product.bestSeller && (
                <span className="rounded-full bg-yellow-100 px-4 py-2 text-xs font-bold text-yellow-700">
                  Best Seller
                </span>
              )}

              {product.trending && (
                <span className="rounded-full bg-pink-100 px-4 py-2 text-xs font-bold text-pink-700">
                  Trending
                </span>
              )}

            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Product approval, visibility and marketplace
              promotional labels are managed by ANJIVO administration.
            </p>

          </div>

        </section>

        {/* ===================================================
            ACTIONS
        =================================================== */}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">

          <Link
            href="/seller/products"
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-center text-sm font-bold hover:border-black"
          >
            ← Back to Products
          </Link>

          <Link
            href={`/seller/products/${product.id}/edit`}
            className="rounded-xl bg-black px-7 py-3 text-center text-sm font-bold text-white hover:bg-gray-800"
          >
            Edit Product
          </Link>

        </div>

      </main>

      <Footer />

    </div>
  );
}
