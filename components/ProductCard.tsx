"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { addToCart } from "@/lib/cart";
import type { Product } from "@/types/product";

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({
  product,
}: ProductCardProps) {
  const router = useRouter();

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const {
    id,
    name,
    slug,
    categoryName,
    images,
    mrp,
    retailPrice,
    wholesalePrice,
    moq,
    stock,
    rating,
    reviewsCount,
    sellerName,
    sellerVerified,
    wholesaleTiers,
    featured,
    bestSeller,
    trending,
  } = product;

  const image = images?.[0] || "";

  const discount =
    mrp > retailPrice
      ? Math.round(((mrp - retailPrice) / mrp) * 100)
      : 0;

  const badge =
    featured
      ? "Featured"
      : bestSeller
        ? "Best Seller"
        : trending
          ? "Trending"
          : "";

  const wholesaleStartingPrice =
    wholesaleTiers && wholesaleTiers.length > 0
      ? Math.min(
          ...wholesaleTiers.map((tier) => tier.price)
        )
      : wholesalePrice;

  const isImage =
    image.startsWith("/") ||
    image.startsWith("http://") ||
    image.startsWith("https://");

  async function handleAddToCart() {
    try {
      setAdding(true);

      const userId =
        typeof window !== "undefined"
          ? localStorage.getItem("anjivo_user_id")
          : null;

      if (!userId) {
        router.push(
          `/login?redirect=/products/${slug}`
        );
        return;
      }

      await addToCart(userId, {
        productId: id,
        name,
        slug,
        sellerId: product.sellerId,
        sellerName,
        image,
        retailPrice,
        wholesalePrice,
        quantity: 1,
        moq,
        selectedPrice: retailPrice,
        pricingType: "retail",
        stock,
      });

      setAdded(true);

      setTimeout(() => {
        setAdded(false);
      }, 1800);
    } catch (error) {
      console.error("Add to cart error:", error);
      alert("Product cart me add nahi ho paya.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-black transition duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-xl">

      {/* ================= PRODUCT IMAGE ================= */}

      <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gray-100 sm:h-52">

        {/* Badge */}

        {badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            {badge}
          </span>
        )}

        {/* Discount */}

        {discount > 0 && (
          <span className="absolute bottom-3 left-3 z-10 rounded-md bg-white px-2 py-1 text-[10px] font-black text-gray-900 shadow-sm">
            {discount}% OFF
          </span>
        )}

        {/* Wishlist */}

        <button
          type="button"
          aria-label={`Add ${name} to wishlist`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg shadow-sm transition hover:scale-110 hover:bg-black hover:text-white"
        >
          ♡
        </button>

        {/* Product Image */}

        <Link
          href={`/products/${slug}`}
          className="absolute inset-0"
          aria-label={`View ${name}`}
        >
          {isImage ? (
            <Image
              src={image}
              alt={name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl transition duration-500 group-hover:scale-110">
              {image || "📦"}
            </div>
          )}
        </Link>

        {/* Quick View */}

        <Link
          href={`/products/${slug}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
          className="absolute bottom-3 right-3 z-10 hidden rounded-lg bg-white/95 px-3 py-2 text-[10px] font-bold shadow-sm backdrop-blur transition hover:bg-black hover:text-white sm:block"
        >
          View Product
        </Link>
      </div>

      {/* ================= PRODUCT INFO ================= */}

      <div className="p-3.5 sm:p-4">

        {/* Category */}

        <div className="flex items-center justify-between gap-2">

          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {categoryName || "General"}
          </p>

          {sellerVerified && (
            <span className="shrink-0 text-[9px] font-bold text-gray-500">
              ✓ Verified
            </span>
          )}

        </div>

        {/* Product Name */}

        <Link href={`/products/${slug}`}>
          <h3 className="mt-1.5 min-h-10 line-clamp-2 text-sm font-bold leading-5 text-gray-900 transition hover:text-gray-600">
            {name}
          </h3>
        </Link>

        {/* ================= RATING ================= */}

        {rating !== undefined && (
          <div className="mt-2 flex items-center gap-1.5">

            <span className="rounded-md bg-gray-100 px-1.5 py-1 text-[10px] font-black">
              ★ {rating.toFixed(1)}
            </span>

            {reviewsCount !== undefined && (
              <span className="text-[10px] text-gray-400">
                ({reviewsCount.toLocaleString("en-IN")})
              </span>
            )}

          </div>
        )}

        {/* ================= RETAIL PRICE ================= */}

        <div className="mt-3 flex flex-wrap items-center gap-2">

          <span className="text-lg font-black text-gray-950">
            ₹{retailPrice.toLocaleString("en-IN")}
          </span>

          {mrp > retailPrice && (
            <span className="text-xs text-gray-400 line-through">
              ₹{mrp.toLocaleString("en-IN")}
            </span>
          )}

          {discount > 0 && (
            <span className="text-[10px] font-black text-gray-700">
              {discount}% OFF
            </span>
          )}

        </div>

        {/* ================= WHOLESALE PRICE ================= */}

        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">

          <div className="flex items-center justify-between gap-2">

            <div>

              <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                Wholesale From
              </p>

              <p className="mt-0.5 text-sm font-black text-gray-950">
                ₹
                {wholesaleStartingPrice.toLocaleString(
                  "en-IN"
                )}

                <span className="ml-1 text-[10px] font-medium text-gray-500">
                  / piece
                </span>
              </p>

            </div>

            <div className="rounded-lg bg-white px-2 py-1 text-right shadow-sm">

              <p className="text-[8px] font-bold uppercase text-gray-400">
                MOQ
              </p>

              <p className="text-[10px] font-black">
                {moq}
              </p>

            </div>

          </div>

        </div>

        {/* ================= SELLER ================= */}

        {sellerName && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">

            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100">
              🏪
            </span>

            <span className="truncate">
              {sellerName}
            </span>

            {sellerVerified && (
              <span className="shrink-0 font-bold text-gray-700">
                ✓
              </span>
            )}

          </div>
        )}

        {/* ================= STOCK ================= */}

        <div className="mt-2">

          {stock <= 0 ? (
            <p className="text-[10px] font-bold text-red-600">
              Out of stock
            </p>
          ) : stock <= 10 ? (
            <p className="text-[10px] font-bold text-gray-700">
              ⚡ Only {stock} left
            </p>
          ) : (
            <p className="text-[10px] font-medium text-gray-400">
              In stock
            </p>
          )}

        </div>

        {/* ================= ACTIONS ================= */}

        <div className="mt-3 grid grid-cols-2 gap-2">

          {/* View */}

          <Link
            href={`/products/${slug}`}
            className="rounded-xl border border-gray-200 py-3 text-center text-xs font-bold text-gray-900 transition hover:bg-gray-100"
          >
            View
          </Link>

          {/* Add To Cart */}

          <button
            type="button"
            disabled={adding || stock <= 0}
            onClick={handleAddToCart}
            className={`rounded-xl py-3 text-xs font-bold text-white transition active:scale-[0.98] ${
              stock <= 0
                ? "cursor-not-allowed bg-gray-300"
                : added
                  ? "bg-gray-700"
                  : "bg-black hover:bg-gray-800"
            }`}
          >
            {stock <= 0
              ? "Out of Stock"
              : adding
                ? "Adding..."
                : added
                  ? "✓ Added"
                  : "Add to Cart"}
          </button>

        </div>

      </div>
    </article>
  );
}
