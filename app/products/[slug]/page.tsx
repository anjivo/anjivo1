"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged, type User } from "firebase/auth";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getProductBySlug } from "@/lib/products";
import { auth } from "@/lib/firebase";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/types/product";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default function ProductDetailsPage({
  params,
}: ProductPageProps) {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [pricingType, setPricingType] = useState<
    "retail" | "wholesale"
  >("retail");

  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  useEffect(() => {
    async function loadProduct() {
      try {
        const { slug } = await params;

        const result = await getProductBySlug(slug);

        setProduct(result);
      } catch (error) {
        console.error("Failed to load product:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
      }
    );

    return () => unsubscribe();
  }, []);

  const wholesalePrice = useMemo(() => {
    if (!product) return 0;

    let price = product.wholesalePrice;

    for (const tier of product.wholesaleTiers) {
      if (
        quantity >= tier.minQuantity &&
        (
          tier.maxQuantity === undefined ||
          quantity <= tier.maxQuantity
        )
      ) {
        price = tier.price;
      }
    }

    return price;
  }, [product, quantity]);

  const selectedPrice =
    pricingType === "wholesale"
      ? wholesalePrice
      : product?.retailPrice ?? 0;

  const discount =
    product && product.mrp > product.retailPrice
      ? Math.round(
          ((product.mrp - product.retailPrice) /
            product.mrp) *
            100
        )
      : 0;

  async function handleAddToCart() {
    if (!product) return;

    if (!user) {
      router.push(
        `/login?redirect=/products/${product.slug}`
      );
      return;
    }

    if (product.stock <= 0) {
      return;
    }

    if (
      pricingType === "wholesale" &&
      quantity < product.moq
    ) {
      setCartMessage(
        `Wholesale minimum quantity is ${product.moq}.`
      );
      return;
    }

    if (quantity > product.stock) {
      setCartMessage(
        `Only ${product.stock} pieces are available.`
      );
      return;
    }

    try {
      setAddingToCart(true);
      setCartMessage("");

      await addToCart(user.uid, {
        productId: product.id,
        name: product.name,
        slug: product.slug,

        sellerId: product.sellerId,
        sellerName: product.sellerName,

        image: product.images[0],

        retailPrice: product.retailPrice,
        wholesalePrice: product.wholesalePrice,

        quantity,

        moq: product.moq,

        selectedPrice,

        pricingType,

        stock: product.stock,
      });

      setCartMessage("Product added to cart successfully.");

    } catch (error) {
      console.error("Failed to add product to cart:", error);

      setCartMessage(
        "Could not add product to cart. Please try again."
      );
    } finally {
      setAddingToCart(false);
    }
  }

  function handleBuyNow() {
    if (!user) {
      router.push(
        `/login?redirect=/products/${product?.slug}`
      );
      return;
    }

    handleAddToCart().then(() => {
      router.push("/cart");
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-3xl">⏳</div>

            <p className="mt-3 text-sm font-semibold text-gray-500">
              Loading product...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">

            <div className="text-5xl">📦</div>

            <h1 className="mt-4 text-2xl font-black">
              Product not found
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              This product may have been removed or is no longer available.
            </p>

            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
            >
              Browse Products
            </Link>

          </div>
        </main>

        <Footer />
      </div>
    );
  }

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

            <Link
              href="/products"
              className="hover:text-black"
            >
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

          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">

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

              {product.images.length > 1 && (
                <div className="mt-3 grid grid-cols-5 gap-2">

                  {product.images.slice(0, 5).map(
                    (image, index) => (
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
                    )
                  )}

                </div>
              )}

            </div>

            {/* ================= DETAILS ================= */}
            <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

              <div className="flex items-center justify-between gap-3">

                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                  {product.categoryName ||
                    product.categoryId}
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

              {product.rating !== undefined && (
                <div className="mt-3 flex items-center gap-2">

                  <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-black">
                    ★ {product.rating}
                  </span>

                  {product.reviewsCount !==
                    undefined && (
                    <span className="text-xs text-gray-400">
                      {product.reviewsCount.toLocaleString(
                        "en-IN"
                      )}{" "}
                      reviews
                    </span>
                  )}

                </div>
              )}

              {product.description && (
                <p className="mt-5 text-sm leading-6 text-gray-600">
                  {product.description}
                </p>
              )}

              {/* ================= BUYING MODE ================= */}
              <div className="mt-6">

                <p className="mb-2 text-xs font-black">
                  Choose buying option
                </p>

                <div className="grid grid-cols-2 gap-2">

                  <button
                    type="button"
                    onClick={() => {
                      setPricingType("retail");
                      setQuantity(1);
                      setCartMessage("");
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      pricingType === "retail"
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white hover:border-black"
                    }`}
                  >
                    <div className="text-lg">
                      🛍️
                    </div>

                    <p className="mt-1 text-xs font-black">
                      Retail
                    </p>

                    <p
                      className={`mt-1 text-[9px] ${
                        pricingType === "retail"
                          ? "text-gray-300"
                          : "text-gray-400"
                      }`}
                    >
                      Buy single pieces
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPricingType("wholesale");

                      setQuantity(
                        Math.max(1, product.moq)
                      );

                      setCartMessage("");
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      pricingType === "wholesale"
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white hover:border-black"
                    }`}
                  >
                    <div className="text-lg">
                      📦
                    </div>

                    <p className="mt-1 text-xs font-black">
                      Wholesale
                    </p>

                    <p
                      className={`mt-1 text-[9px] ${
                        pricingType === "wholesale"
                          ? "text-gray-300"
                          : "text-gray-400"
                      }`}
                    >
                      MOQ {product.moq}
                    </p>
                  </button>

                </div>

              </div>

              {/* ================= PRICE ================= */}
              <div className="mt-5 rounded-2xl bg-gray-50 p-4">

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {pricingType === "wholesale"
                    ? "Wholesale Price"
                    : "Retail Price"}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-3">

                  <span className="text-3xl font-black">
                    ₹{selectedPrice.toLocaleString("en-IN")}
                  </span>

                  {pricingType === "retail" &&
                    product.mrp >
                      product.retailPrice && (
                      <span className="text-sm text-gray-400 line-through">
                        ₹
                        {product.mrp.toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    )}

                  {pricingType === "retail" &&
                    discount > 0 && (
                      <span className="text-xs font-black">
                        {discount}% OFF
                      </span>
                    )}

                </div>

                {pricingType === "wholesale" && (
                  <p className="mt-1 text-[10px] text-gray-500">
                    Price updates automatically according to quantity.
                  </p>
                )}

              </div>

              {/* ================= WHOLESALE TIERS ================= */}
              {product.wholesaleTiers.length > 0 && (
                <div className="mt-4 rounded-2xl border border-gray-200 p-4">

                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black">
                      Wholesale Pricing
                    </p>

                    <span className="text-[9px] font-bold text-gray-400">
                      MOQ {product.moq}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">

                    {product.wholesaleTiers.map(
                      (tier, index) => (
                        <button
                          type="button"
                          key={`${tier.minQuantity}-${index}`}
                          onClick={() => {
                            setPricingType("wholesale");

                            setQuantity(
                              Math.max(
                                tier.minQuantity,
                                product.moq
                              )
                            );

                            setCartMessage("");
                          }}
                          className={`rounded-xl border p-3 text-center transition ${
                            pricingType === "wholesale" &&
                            quantity >=
                              tier.minQuantity &&
                            (
                              tier.maxQuantity ===
                                undefined ||
                              quantity <=
                                tier.maxQuantity
                            )
                              ? "border-black bg-black text-white"
                              : "border-gray-200 bg-gray-50 hover:border-black"
                          }`}
                        >
                          <p className="text-[9px] opacity-60">
                            {tier.maxQuantity
                              ? `${tier.minQuantity}-${tier.maxQuantity}`
                              : `${tier.minQuantity}+`}
                          </p>

                          <p className="mt-1 text-sm font-black">
                            ₹
                            {tier.price.toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </button>
                      )
                    )}

                  </div>

                </div>
              )}

              {/* ================= QUANTITY ================= */}
              <div className="mt-5">

                <div className="flex items-center justify-between">

                  <p className="text-xs font-black">
                    Quantity
                  </p>

                  <p className="text-[10px] text-gray-400">
                    {product.stock} available
                  </p>

                </div>

                <div className="mt-2 flex items-center gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        Math.max(
                          pricingType === "wholesale"
                            ? product.moq
                            : 1,
                          quantity - 1
                        )
                      )
                    }
                    disabled={
                      quantity <=
                      (pricingType === "wholesale"
                        ? product.moq
                        : 1)
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-lg font-bold disabled:opacity-40"
                  >
                    −
                  </button>

                  <div className="flex h-11 min-w-16 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-black">
                    {quantity}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        Math.min(
                          product.stock,
                          quantity + 1
                        )
                      )
                    }
                    disabled={
                      quantity >= product.stock
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-lg font-bold disabled:opacity-40"
                  >
                    +
                  </button>

                </div>

              </div>

              {/* ================= SELLER ================= */}
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-gray-200 p-4">

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-lg">
                    🏪
                  </div>

                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-gray-400">
                      Sold by
                    </p>

                    <p className="mt-0.5 text-sm font-black">
                      {product.sellerName ||
                        "ANJIVO Seller"}
                    </p>
                  </div>

                </div>

                {product.sellerVerified && (
                  <span className="text-[10px] font-bold">
                    ✓ Verified
                  </span>
                )}

              </div>

              {/* ================= CART MESSAGE ================= */}
              {cartMessage && (
                <div className="mt-4 rounded-xl bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-700">
                  {cartMessage}
                </div>
              )}

              {/* ================= ACTIONS ================= */}
              <div className="mt-5 grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={
                    addingToCart ||
                    product.stock <= 0
                  }
                  className="rounded-xl border border-black bg-white py-3.5 text-sm font-bold text-black transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {addingToCart
                    ? "Adding..."
                    : "🛒 Add to Cart"}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={
                    addingToCart ||
                    product.stock <= 0
                  }
                  className="rounded-xl bg-black py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Buy Now
                </button>

              </div>

              {/* ================= VIEW CART ================= */}
              {cartMessage.includes("successfully") && (
                <Link
                  href="/cart"
                  className="mt-3 block rounded-xl border border-gray-200 bg-gray-50 py-3 text-center text-xs font-bold hover:border-black"
                >
                  View Cart →
                </Link>
              )}

              {/* ================= TRUST ================= */}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-5">

                <div className="text-center">
                  <div>🔒</div>
                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Secure
                  </p>
                </div>

                <div className="text-center">
                  <div>✓</div>
                  <p className="mt-1 text-[9px] font-bold text-gray-500">
                    Verified
                  </p>
                </div>

                <div className="text-center">
                  <div>📦</div>
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
