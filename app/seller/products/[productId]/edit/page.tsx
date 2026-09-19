"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

import {
  getSellerProduct,
  updateSellerProduct,
} from "@/lib/seller-products";

import { getCategories } from "@/lib/categories";

import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

type Tier = {
  minQuantity: string;
  maxQuantity: string;
  price: string;
};

const DEFAULT_TIERS: Tier[] = [
  {
    minQuantity: "10",
    maxQuantity: "24",
    price: "",
  },
  {
    minQuantity: "25",
    maxQuantity: "49",
    price: "",
  },
  {
    minQuantity: "50",
    maxQuantity: "99",
    price: "",
  },
  {
    minQuantity: "100",
    maxQuantity: "",
    price: "",
  },
];

export default function EditSellerProductPage() {
  const router = useRouter();
  const params = useParams();

  const productId =
    typeof params.productId === "string"
      ? params.productId
      : "";

  const [product, setProduct] =
    useState<Product | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =========================================================
     FORM
  ========================================================= */

  const [name, setName] =
    useState("");

  const [slug, setSlug] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [categoryId, setCategoryId] =
    useState("");

  const [categoryName, setCategoryName] =
    useState("");

  const [mrp, setMrp] =
    useState("");

  const [retailPrice, setRetailPrice] =
    useState("");

  const [wholesalePrice, setWholesalePrice] =
    useState("");

  const [moq, setMoq] =
    useState("");

  const [stock, setStock] =
    useState("");

  const [imageUrl, setImageUrl] =
    useState("");

  const [tiers, setTiers] =
    useState<Tier[]>(DEFAULT_TIERS);

  const [featured, setFeatured] =
    useState(false);

  const [bestSeller, setBestSeller] =
    useState(false);

  const [trending, setTrending] =
    useState(false);

  /* =========================================================
     LOAD PRODUCT + SELLER
  ========================================================= */

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
              `/login?redirect=/seller/products/${productId}/edit`
            );
            return;
          }

          try {
            setError("");

            /* -------------------------
               USER
            ------------------------- */

            const userQuery = query(
              collection(db, "users"),
              where("uid", "==", user.uid)
            );

            const userSnapshot =
              await getDocs(userQuery);

            if (userSnapshot.empty) {
              setError(
                "Seller profile not found."
              );
              setLoading(false);
              return;
            }

            const userData =
              userSnapshot.docs[0].data();

            if (
              userData.role !== "SELLER"
            ) {
              setError(
                "Seller access required."
              );
              setLoading(false);
              return;
            }

            if (
              userData.sellerStatus !==
              "approved"
            ) {
              setError(
                "Your seller account is not approved yet."
              );
              setLoading(false);
              return;
            }

            /* -------------------------
               PRODUCT
            ------------------------- */

            const loadedProduct =
              await getSellerProduct(
                user.uid,
                productId
              );

            if (!loadedProduct) {
              setError(
                "Product not found or you do not have permission to edit it."
              );
              setLoading(false);
              return;
            }

            setProduct(
              loadedProduct
            );

            /* -------------------------
               FORM VALUES
            ------------------------- */

            setName(
              loadedProduct.name
            );

            setSlug(
              loadedProduct.slug
            );

            setDescription(
              loadedProduct.description ??
                ""
            );

            setCategoryId(
              loadedProduct.categoryId
            );

            setCategoryName(
              loadedProduct.categoryName ??
                ""
            );

            setMrp(
              String(
                loadedProduct.mrp
              )
            );

            setRetailPrice(
              String(
                loadedProduct.retailPrice
              )
            );

            setWholesalePrice(
              String(
                loadedProduct.wholesalePrice
              )
            );

            setMoq(
              String(
                loadedProduct.moq
              )
            );

            setStock(
              String(
                loadedProduct.stock
              )
            );

            setImageUrl(
              loadedProduct.images?.[0] ??
                ""
            );

            setFeatured(
              Boolean(
                loadedProduct.featured
              )
            );

            setBestSeller(
              Boolean(
                loadedProduct.bestSeller
              )
            );

            setTrending(
              Boolean(
                loadedProduct.trending
              )
            );

            /* -------------------------
               WHOLESALE TIERS
            ------------------------- */

            if (
              loadedProduct.wholesaleTiers
                ?.length
            ) {
              setTiers(
                loadedProduct.wholesaleTiers.map(
                  (tier) => ({
                    minQuantity:
                      String(
                        tier.minQuantity
                      ),
                    maxQuantity:
                      tier.maxQuantity !==
                      undefined
                        ? String(
                            tier.maxQuantity
                          )
                        : "",
                    price: String(
                      tier.price
                    ),
                  })
                )
              );
            }

            /* -------------------------
               CATEGORIES
            ------------------------- */

            const categoryResult =
              await getCategories();

            setCategories(
              categoryResult.filter(
                (category) =>
                  category.status ===
                  "active"
              )
            );
          } catch (err) {
            console.error(
              "Edit product error:",
              err
            );

            setError(
              "Unable to load product."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [productId, router]);

  /* =========================================================
     UPDATE TIER
  ========================================================= */

  function updateTier(
    index: number,
    field: keyof Tier,
    value: string
  ) {
    setTiers((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              [field]: value,
            }
          : tier
      )
    );
  }

  /* =========================================================
     ADD TIER
  ========================================================= */

  function addTier() {
    setTiers((current) => [
      ...current,
      {
        minQuantity: "",
        maxQuantity: "",
        price: "",
      },
    ]);
  }

  /* =========================================================
     REMOVE TIER
  ========================================================= */

  function removeTier(index: number) {
    setTiers((current) =>
      current.filter(
        (_, tierIndex) =>
          tierIndex !== index
      )
    );
  }

  /* =========================================================
     CATEGORY CHANGE
  ========================================================= */

  function handleCategoryChange(
    value: string
  ) {
    setCategoryId(value);

    const selected =
      categories.find(
        (category) =>
          category.id === value
      );

    setCategoryName(
      selected?.name ?? ""
    );
  }

  /* =========================================================
     SAVE PRODUCT
  ========================================================= */

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!product) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      /* -------------------------
         BASIC VALIDATION
      ------------------------- */

      if (!name.trim()) {
        throw new Error(
          "Product name is required."
        );
      }

      if (!categoryId) {
        throw new Error(
          "Please select a category."
        );
      }

      const mrpValue =
        Number(mrp);

      const retailValue =
        Number(retailPrice);

      const wholesaleValue =
        Number(wholesalePrice);

      const moqValue =
        Number(moq);

      const stockValue =
        Number(stock);

      if (
        !Number.isFinite(mrpValue) ||
        mrpValue <= 0
      ) {
        throw new Error(
          "Enter a valid MRP."
        );
      }

      if (
        !Number.isFinite(
          retailValue
        ) ||
        retailValue <= 0
      ) {
        throw new Error(
          "Enter a valid retail price."
        );
      }

      if (
        !Number.isFinite(
          wholesaleValue
        ) ||
        wholesaleValue <= 0
      ) {
        throw new Error(
          "Enter a valid wholesale price."
        );
      }

      if (
        retailValue > mrpValue
      ) {
        throw new Error(
          "Retail price cannot be higher than MRP."
        );
      }

      if (
        wholesaleValue >
        retailValue
      ) {
        throw new Error(
          "Wholesale price cannot be higher than retail price."
        );
      }

      if (
        !Number.isFinite(moqValue) ||
        moqValue < 1
      ) {
        throw new Error(
          "MOQ must be at least 1."
        );
      }

      if (
        !Number.isFinite(
          stockValue
        ) ||
        stockValue < 0
      ) {
        throw new Error(
          "Enter a valid stock quantity."
        );
      }

      if (
        moqValue > stockValue &&
        stockValue > 0
      ) {
        throw new Error(
          "MOQ cannot be greater than available stock."
        );
      }

      /* -------------------------
         WHOLESALE TIERS
      ------------------------- */

      const wholesaleTiers = tiers
        .filter(
          (tier) =>
            tier.minQuantity.trim() ||
            tier.price.trim()
        )
        .map((tier) => {
          const minQuantity =
            Number(
              tier.minQuantity
            );

          const maxQuantity =
            tier.maxQuantity.trim()
              ? Number(
                  tier.maxQuantity
                )
              : undefined;

          const price =
            Number(tier.price);

          if (
            !Number.isFinite(
              minQuantity
            ) ||
            minQuantity < 1
          ) {
            throw new Error(
              "Wholesale minimum quantity must be valid."
            );
          }

          if (
            maxQuantity !==
              undefined &&
            (!Number.isFinite(
              maxQuantity
            ) ||
              maxQuantity <
                minQuantity)
          ) {
            throw new Error(
              "Wholesale maximum quantity must be greater than or equal to minimum quantity."
            );
          }

          if (
            !Number.isFinite(
              price
            ) ||
            price <= 0
          ) {
            throw new Error(
              "Wholesale tier price must be valid."
            );
          }

          if (
            price >
            retailValue
          ) {
            throw new Error(
              "Wholesale tier price cannot be higher than retail price."
            );
          }

          return {
            minQuantity,
            ...(maxQuantity !==
            undefined
              ? {
                  maxQuantity,
                }
              : {}),
            price,
          };
        })
        .sort(
          (a, b) =>
            a.minQuantity -
            b.minQuantity
        );

      /* -------------------------
         TIER OVERLAP CHECK
      ------------------------- */

      for (
        let i = 0;
        i <
        wholesaleTiers.length - 1;
        i++
      ) {
        const current =
          wholesaleTiers[i];

        const next =
          wholesaleTiers[i + 1];

        if (
          current.maxQuantity !==
            undefined &&
          current.maxQuantity >=
            next.minQuantity
        ) {
          throw new Error(
            "Wholesale quantity ranges cannot overlap."
          );
        }
      }

      /* -------------------------
         IMAGE
      ------------------------- */

      const images =
        imageUrl.trim()
          ? [imageUrl.trim()]
          : [];

      /* -------------------------
         UPDATE
      ------------------------- */

      setSaving(true);

      const user =
        auth.currentUser;

      if (!user) {
        throw new Error(
          "Your session has expired. Please login again."
        );
      }

      await updateSellerProduct(
        user.uid,
        product.id,
        {
          name: name.trim(),
          slug: slug.trim(),
          description:
            description.trim(),
          categoryId,
          categoryName,
          images,
          mrp: mrpValue,
          retailPrice: retailValue,
          wholesalePrice:
            wholesaleValue,
          moq: Math.floor(moqValue),
          wholesaleTiers,
          stock: Math.floor(
            stockValue
          ),
          featured,
          bestSeller,
          trending,
        }
      );

      setSuccess(
        "Product updated successfully."
      );

      setTimeout(() => {
        router.push(
          "/seller/products"
        );
      }, 1200);
    } catch (err) {
      console.error(
        "Save product error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update product."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-10">
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

  if (error && !product) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-black text-red-800">
              Unable to edit product
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error}
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

  if (!product) {
    return null;
  }

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">

        {/* HEADER */}

        <div className="mb-8">
          <Link
            href="/seller/products"
            className="text-xs font-bold text-gray-400 hover:text-black"
          >
            ← My Products
          </Link>

          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Edit Product
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Update your ANJIVO product
            information.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">
              ✓ {success}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* =================================================
             BASIC INFORMATION
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <h2 className="text-lg font-black">
              Basic Information
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Product title, description and
              category.
            </p>

            <div className="mt-6 grid gap-5">

              <div>
                <label className="text-xs font-bold text-gray-700">
                  Product Name *
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Enter product name"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">
                  Product Slug
                </label>

                <input
                  value={slug}
                  onChange={(event) =>
                    setSlug(
                      event.target.value
                    )
                  }
                  placeholder="product-slug"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Describe your product..."
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">
                  Category *
                </label>

                <select
                  value={categoryId}
                  onChange={(event) =>
                    handleCategoryChange(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="">
                    Select category
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {category.name}
                      </option>
                    )
                  )}
                </select>
              </div>

            </div>
          </section>

          {/* =================================================
             IMAGE
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <h2 className="text-lg font-black">
              Product Image
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Enter a publicly accessible image
              URL.
            </p>

            <div className="mt-5">
              <input
                type="url"
                value={imageUrl}
                onChange={(event) =>
                  setImageUrl(
                    event.target.value
                  )
                }
                placeholder="https://example.com/product.jpg"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
              />
            </div>

            {imageUrl && (
              <div className="mt-5 flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
                <img
                  src={imageUrl}
                  alt={name}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </section>

          {/* =================================================
             PRICING
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <h2 className="text-lg font-black">
              Pricing
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">

              <div>
                <label className="text-xs font-bold text-gray-700">
                  MRP *
                </label>

                <div className="mt-2 flex items-center rounded-xl border border-gray-200">
                  <span className="px-3 text-sm font-bold text-gray-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={mrp}
                    onChange={(event) =>
                      setMrp(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl px-2 py-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">
                  Retail Price *
                </label>

                <div className="mt-2 flex items-center rounded-xl border border-gray-200">
                  <span className="px-3 text-sm font-bold text-gray-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={retailPrice}
                    onChange={(event) =>
                      setRetailPrice(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl px-2 py-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">
                  Wholesale From *
                </label>

                <div className="mt-2 flex items-center rounded-xl border border-gray-200">
                  <span className="px-3 text-sm font-bold text-gray-400">
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={wholesalePrice}
                    onChange={(event) =>
                      setWholesalePrice(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl px-2 py-3 text-sm outline-none"
                  />
                </div>
              </div>

            </div>
          </section>

          {/* =================================================
             WHOLESALE
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black">
                  Wholesale Pricing
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Set quantity-based prices for
                  bulk buyers.
                </p>
              </div>

              <button
                type="button"
                onClick={addTier}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
              >
                + Add Tier
              </button>
            </div>

            <div className="mt-6 space-y-3">

              {tiers.map(
                (tier, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-gray-200 p-4"
                  >

                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-black">
                        Tier {index + 1}
                      </p>

                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeTier(
                              index
                            )
                          }
                          className="text-[10px] font-bold text-red-500"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">

                      <div>
                        <label className="text-[10px] font-bold text-gray-500">
                          Minimum Qty
                        </label>

                        <input
                          type="number"
                          min="1"
                          value={
                            tier.minQuantity
                          }
                          onChange={(
                            event
                          ) =>
                            updateTier(
                              index,
                              "minQuantity",
                              event.target
                                .value
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500">
                          Maximum Qty
                        </label>

                        <input
                          type="number"
                          min="1"
                          value={
                            tier.maxQuantity
                          }
                          onChange={(
                            event
                          ) =>
                            updateTier(
                              index,
                              "maxQuantity",
                              event.target
                                .value
                            )
                          }
                          placeholder="No limit"
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500">
                          Price / Piece
                        </label>

                        <div className="mt-1 flex items-center rounded-xl border border-gray-200">
                          <span className="px-3 text-xs font-bold text-gray-400">
                            ₹
                          </span>

                          <input
                            type="number"
                            min="0"
                            value={
                              tier.price
                            }
                            onChange={(
                              event
                            ) =>
                              updateTier(
                                index,
                                "price",
                                event.target
                                  .value
                              )
                            }
                            className="w-full rounded-xl px-1 py-2.5 text-sm outline-none"
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                )
              )}

            </div>
          </section>

          {/* =================================================
             INVENTORY
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <h2 className="text-lg font-black">
              Inventory
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              <div>
                <label className="text-xs font-bold text-gray-700">
                  MOQ *
                </label>

                <input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={(event) =>
                    setMoq(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700">
                  Available Stock *
                </label>

                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(event) =>
                    setStock(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />
              </div>

            </div>
          </section>

          {/* =================================================
             MARKETPLACE OPTIONS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <h2 className="text-lg font-black">
              Marketplace Options
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              These options may be managed by
              marketplace rules/admin approval.
            </p>

            <div className="mt-6 space-y-3">

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(event) =>
                    setFeatured(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />

                <div>
                  <p className="text-sm font-bold">
                    Featured Product
                  </p>

                  <p className="text-xs text-gray-500">
                    Request featured placement.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={bestSeller}
                  onChange={(event) =>
                    setBestSeller(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />

                <div>
                  <p className="text-sm font-bold">
                    Best Seller
                  </p>

                  <p className="text-xs text-gray-500">
                    Product can be marked as a
                    best seller by marketplace.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 p-4">
                <input
                  type="checkbox"
                  checked={trending}
                  onChange={(event) =>
                    setTrending(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />

                <div>
                  <p className="text-sm font-bold">
                    Trending Product
                  </p>

                  <p className="text-xs text-gray-500">
                    Product can appear in trending
                    sections.
                  </p>
                </div>
              </label>

            </div>
          </section>

          {/* =================================================
             CURRENT STATUS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <h2 className="text-lg font-black">
              Product Status
            </h2>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-gray-50 p-4">
              <div>
                <p className="text-xs font-bold text-gray-400">
                  Current Status
                </p>

                <p className="mt-1 text-sm font-black uppercase">
                  {product.status.replace(
                    "_",
                    " "
                  )}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${
                  product.status ===
                  "active"
                    ? "bg-green-100 text-green-700"
                    : product.status ===
                      "blocked"
                    ? "bg-red-100 text-red-700"
                    : product.status ===
                      "out_of_stock"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {product.status.replace(
                  "_",
                  " "
                )}
              </span>
            </div>

            <p className="mt-3 text-[11px] leading-5 text-gray-400">
              Product status is controlled by
              ANJIVO marketplace administration.
              Sellers cannot directly activate or
              block products.
            </p>
          </section>

          {/* =================================================
             ACTIONS
          ================================================= */}

          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end">

            <Link
              href="/seller/products"
              className="rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-bold text-gray-700 hover:border-black hover:text-black"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-7 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>

          </div>

        </form>
      </main>

      <Footer />
    </div>
  );
}
