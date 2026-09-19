"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/types/product";

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({
  product,
}: ProductCardProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });

    return () => unsubscribe();
  }, []);

  const {
    id,
    name,
    slug,
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
    categoryName,
    featured,
    bestSeller,
    trending,
  } = product;

  const image =
    images && images.length > 0
      ? images[0]
      : "/placeholder-product.png";

  const discount =
    mrp > retailPrice
      ? Math.round(((mrp - retailPrice) / mrp) * 100)
      : 0;

  const handleAddToCart = async () => {
    setError("");

    if (!userId) {
      window.location.href = `/login?redirect=${encodeURIComponent(
        `/products/${slug}`
      )}`;
      return;
    }

    if (stock <= 0) {
      setError("Product is out of stock.");
      return;
    }

    try {
      setAdding(true);

      await addToCart(
        userId,
        {
          id,
          name,
          slug,
          sellerId: product.sellerId,
          sellerName: product.sellerName,
          image,
          mrp,
          retailPrice,
          wholesalePrice,
          wholesaleTiers: product.wholesaleTiers || [],
          moq,
          pricingType: "retail",
          stock,
        },
        1
      );

      setAdded(true);

      setTimeout(() => {
        setAdded(false);
      }, 2000);
    } catch (err) {
      console.error("Add to cart error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to add product to cart."
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      {/* Product Image */}
      <Link
        href={`/products/${slug}`}
        className="relative block aspect-square overflow-hidden bg-gray-100"
      >
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {discount > 0 && (
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
              {discount}% OFF
            </span>
          )}

          {featured && (
            <span className="rounded-full bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white">
              Featured
            </span>
          )}

          {bestSeller && (
            <span className="rounded-full bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white">
              Best Seller
            </span>
          )}

          {trending && (
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
              Trending
            </span>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        {categoryName && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            {categoryName}
          </p>
        )}

        {/* Product Name */}
        <Link href={`/products/${slug}`}>
          <h3 className="line-clamp-2 min-h-[48px] text-base font-semibold text-gray-900 transition group-hover:text-blue-600">
            {name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="mt-2 flex items-center gap-1 text-sm">
          <span className="font-semibold text-gray-900">
            {(rating ?? 0).toFixed(1)}
          </span>

          <span className="text-yellow-500">★</span>

          <span className="text-gray-500">
            ({reviewsCount ?? 0})
          </span>
        </div>

        {/* Retail Price */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">
            ₹{retailPrice.toLocaleString("en-IN")}
          </span>

          {mrp > retailPrice && (
            <span className="text-sm text-gray-400 line-through">
              ₹{mrp.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* Wholesale */}
        <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2">
          <div className="text-xs font-medium text-blue-700">
            Wholesale Price
          </div>

          <div className="mt-0.5 flex items-center justify-between">
            <span className="font-bold text-blue-900">
              ₹{wholesalePrice.toLocaleString("en-IN")}
            </span>

            <span className="text-xs text-blue-700">
              MOQ {moq}+
            </span>
          </div>
        </div>

        {/* Seller */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">
              Sold by
            </p>

            <p className="truncate text-sm font-medium text-gray-800">
              {sellerName || "ANJIVO Seller"}
            </p>
          </div>

          {sellerVerified && (
            <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
              ✓ Verified
            </span>
          )}
        </div>

        {/* Stock */}
        <div className="mt-2">
          {stock > 0 ? (
            <span
              className={`text-xs font-medium ${
                stock <= 10
                  ? "text-orange-600"
                  : "text-green-600"
              }`}
            >
              {stock <= 10
                ? `Only ${stock} left`
                : "In Stock"}
            </span>
          ) : (
            <span className="text-xs font-semibold text-red-600">
              Out of Stock
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href={`/products/${slug}`}
            className="flex items-center justify-center rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            View
          </Link>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={adding || stock <= 0}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition ${
              stock <= 0
                ? "cursor-not-allowed bg-gray-400"
                : added
                ? "bg-green-600"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {adding
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
