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

function createDefaultTiers(
  moq = "10"
): Tier[] {
  const numericMoq =
    Number(moq) >= 1
      ? String(Math.floor(Number(moq)))
      : "10";

  return [
    {
      minQuantity: numericMoq,
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
}

export default function EditSellerProductPage() {
  const router = useRouter();
  const params = useParams();

  const productId =
    typeof params.productId === "string"
      ? params.productId
      : "";

  /* =========================================================
     STATE
  ========================================================= */

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
    useState<Tier[]>([]);

  /* =========================================================
     LOAD SELLER + PRODUCT
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

            /* ===============================================
               USER PROFILE
            =============================================== */

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

            /* ===============================================
               PRODUCT
            =============================================== */

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

            /* ===============================================
               FORM VALUES
            =============================================== */

            setName(
              loadedProduct.name
            );

            setSlug(
              loadedProduct.slug
            );

            setDescription(
              loadedProduct.description ?? ""
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

            /* ===============================================
               WHOLESALE TIERS
            =============================================== */

            if (
              loadedProduct.wholesaleTiers &&
              loadedProduct.wholesaleTiers
                .length > 0
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

                    price:
                      String(
                        tier.price
                      ),
                  })
                )
              );
            } else {
              setTiers(
                createDefaultTiers(
                  String(
                    loadedProduct.moq
                  )
                )
              );
            }

            /* ===============================================
               CATEGORIES
            =============================================== */

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
              err instanceof Error
                ? err.message
                : "Unable to load product."
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
      current.map(
        (tier, tierIndex) =>
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

  function removeTier(
    index: number
  ) {
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
      setSaving(true);

      /* ===============================================
         BASIC
      =============================================== */

      if (!name.trim()) {
        throw new Error(
          "Product name is required."
        );
      }

      if (
        name.trim().length < 3
      ) {
        throw new Error(
          "Product name must contain at least 3 characters."
        );
      }

      if (!categoryId) {
        throw new Error(
          "Please select a category."
        );
      }

      if (!categoryName) {
        throw new Error(
          "Selected category is invalid."
        );
      }

      /* ===============================================
         SLUG
      =============================================== */

      const cleanSlug =
        slug
          .trim()
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            "");

      if (!cleanSlug) {
        throw new Error(
          "Please enter a valid product slug."
        );
      }

      /* ===============================================
         PRICE
      =============================================== */

      const mrpValue =
        Number(mrp);

      const retailValue =
        Number(retailPrice);

      const wholesaleValue =
        Number(wholesalePrice);

      if (
        !Number.isFinite(
          mrpValue
        ) ||
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

      /* ===============================================
         MOQ
      =============================================== */

      const moqValue =
        Number(moq);

      if (
        !Number.isFinite(
          moqValue
        ) ||
        moqValue < 1
      ) {
        throw new Error(
          "MOQ must be at least 1."
        );
      }

      if (
        !Number.isInteger(
          moqValue
        )
      ) {
        throw new Error(
          "MOQ must be a whole number."
        );
      }

      /* ===============================================
         STOCK
      =============================================== */

      const stockValue =
        Number(stock);

      if (
        stock === "" ||
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
        !Number.isInteger(
          stockValue
        )
      ) {
        throw new Error(
          "Stock must be a whole number."
        );
      }

      if (
        stockValue > 0 &&
        moqValue > stockValue
      ) {
        throw new Error(
          "MOQ cannot be greater than available stock."
        );
      }

      /* ===============================================
         WHOLESALE TIERS
      =============================================== */

      if (tiers.length === 0) {
        throw new Error(
          "Add at least one wholesale tier."
        );
      }

      const wholesaleTiers =
        tiers.map(
          (tier, index) => {
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
              !tier.minQuantity.trim() ||
              !Number.isFinite(
                minQuantity
              ) ||
              minQuantity < 1
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: enter a valid minimum quantity.`
              );
            }

            if (
              !Number.isInteger(
                minQuantity
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: minimum quantity must be a whole number.`
              );
            }

            if (
              !tier.price.trim() ||
              !Number.isFinite(
                price
              ) ||
              price <= 0
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: enter a valid price.`
              );
            }

            if (
              !Number.isInteger(
                price
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: price must be a whole number.`
              );
            }

            if (
              maxQuantity !==
                undefined &&
              (
                !Number.isFinite(
                  maxQuantity
                ) ||
                maxQuantity <
                  minQuantity
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: maximum quantity cannot be smaller than minimum quantity.`
              );
            }

            if (
              maxQuantity !==
                undefined &&
              !Number.isInteger(
                maxQuantity
              )
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: maximum quantity must be a whole number.`
              );
            }

            if (
              price >
              retailValue
            ) {
              throw new Error(
                `Wholesale Tier ${
                  index + 1
                }: price cannot be higher than retail price.`
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
          }
        );

      /* ===============================================
         SORT CHECK
      =============================================== */

      for (
        let i = 1;
        i < wholesaleTiers.length;
        i++
      ) {
        if (
          wholesaleTiers[i]
            .minQuantity <=
          wholesaleTiers[i - 1]
            .minQuantity
        ) {
          throw new Error(
            "Wholesale tiers must be in increasing quantity order."
          );
        }
      }

      /* ===============================================
         MOQ = FIRST TIER MIN
      =============================================== */

      if (
        wholesaleTiers[0]
          .minQuantity !==
        moqValue
      ) {
        throw new Error(
          "The first wholesale tier minimum quantity must match MOQ."
        );
      }

      /* ===============================================
         BASE WHOLESALE = FIRST TIER PRICE
      =============================================== */

      if (
        wholesaleTiers[0].price !==
        wholesaleValue
      ) {
        throw new Error(
          "Base wholesale price must match the first wholesale tier price."
        );
      }

      /* ===============================================
         RANGE VALIDATION
      =============================================== */

      for (
        let i = 1;
        i < wholesaleTiers.length;
        i++
      ) {
        const previous =
          wholesaleTiers[i - 1];

        const current =
          wholesaleTiers[i];

        /*
         * Previous tier cannot be unlimited
         * if another tier exists.
         */

        if (
          previous.maxQuantity ===
          undefined
        ) {
          throw new Error(
            `Wholesale Tier ${
              i
            }: previous tier has no maximum quantity, so no tier can come after it.`
          );
        }

        /* ---------------------------------------------
           OVERLAP
        --------------------------------------------- */

        if (
          current.minQuantity <=
          previous.maxQuantity
        ) {
          throw new Error(
            "Wholesale quantity ranges cannot overlap."
          );
        }

        /* ---------------------------------------------
           NO GAP
        --------------------------------------------- */

        if (
          current.minQuantity !==
          previous.maxQuantity + 1
        ) {
          throw new Error(
            "Wholesale quantity ranges should be continuous without gaps."
          );
        }
      }

      /* ===============================================
         LAST TIER
      =============================================== */

      const lastTier =
        wholesaleTiers[
          wholesaleTiers.length - 1
        ];

      if (
        lastTier.maxQuantity !==
          undefined &&
        lastTier.maxQuantity <
          lastTier.minQuantity
      ) {
        throw new Error(
          "Last wholesale tier has an invalid quantity range."
        );
      }

      /* ===============================================
         IMAGE
      =============================================== */

      const images =
        imageUrl.trim()
          ? [imageUrl.trim()]
          : [];

      /* ===============================================
         AUTH
      =============================================== */

      const user =
        auth.currentUser;

      if (!user) {
        throw new Error(
          "Your session has expired. Please login again."
        );
      }

      /* ===============================================
         UPDATE
      =============================================== */

      await updateSellerProduct(
        user.uid,
        product.id,
        {
          name: name.trim(),

          slug: cleanSlug,

          description:
            description.trim(),

          categoryId,

          categoryName,

          images,

          mrp: mrpValue,

          retailPrice:
            retailValue,

          wholesalePrice:
            wholesaleValue,

          moq: Math.floor(
            moqValue
          ),

          wholesaleTiers,

          stock: Math.floor(
            stockValue
          ),
        }
      );

      setSuccess(
        "Product updated successfully."
      );

      setTimeout(() => {
        router.push(
          "/seller/products"
        );
      }, 1000);
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

        {/* ===================================================
            HEADER
        =================================================== */}

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
            Update your ANJIVO product information.
          </p>

        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* ===================================================
            SUCCESS
        =================================================== */}

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

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 1
            </p>

            <h2 className="mt-1 text-xl font-black">
              Basic Information
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Product title, description and category.
            </p>

            <div className="mt-6 grid gap-5">

              {/* NAME */}

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

              {/* SLUG */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Product Slug *
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

                <p className="mt-1 text-[10px] text-gray-400">
                  Use lowercase letters, numbers and hyphens.
                </p>

              </div>

              {/* DESCRIPTION */}

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

              {/* CATEGORY */}

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
                        key={category.id}
                        value={category.id}
                      >
                        {category.icon
                          ? `${category.icon} `
                          : ""}
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

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 2
            </p>

            <h2 className="mt-1 text-xl font-black">
              Product Image
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Enter a publicly accessible image URL.
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
              <div className="mt-5 flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">

                <img
                  src={imageUrl}
                  alt={
                    name ||
                    "Product preview"
                  }
                  className="h-full w-full object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display =
                      "none";
                  }}
                />

              </div>
            )}

          </section>

          {/* =================================================
              PRICING
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 3
            </p>

            <h2 className="mt-1 text-xl font-black">
              Pricing
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">

              {/* MRP */}

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

              {/* RETAIL */}

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

              {/* WHOLESALE */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Base Wholesale Price *
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

            <div className="mt-4 rounded-xl bg-gray-50 p-3">
              <p className="text-[10px] font-semibold leading-5 text-gray-500">
                Base Wholesale Price must match
                the first wholesale tier price.
              </p>
            </div>

          </section>

          {/* =================================================
              WHOLESALE TIERS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Step 4
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Wholesale Pricing
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Set quantity-based prices for bulk buyers.
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
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
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
                          className="text-[10px] font-bold text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}

                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">

                      {/* MIN */}

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
                          onChange={(event) =>
                            updateTier(
                              index,
                              "minQuantity",
                              event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                        />

                      </div>

                      {/* MAX */}

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
                          onChange={(event) =>
                            updateTier(
                              index,
                              "maxQuantity",
                              event.target.value
                            )
                          }
                          placeholder="No limit"
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                        />

                      </div>

                      {/* PRICE */}

                      <div>

                        <label className="text-[10px] font-bold text-gray-500">
                          Price / Piece
                        </label>

                        <div className="mt-1 flex items-center rounded-xl border border-gray-200 bg-white">

                          <span className="px-3 text-xs font-bold text-gray-400">
                            ₹
                          </span>

                          <input
                            type="number"
                            min="0"
                            value={
                              tier.price
                            }
                            onChange={(event) =>
                              updateTier(
                                index,
                                "price",
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl px-1 py-2.5 text-sm outline-none"
                          />

                        </div>

                      </div>

                    </div>

                    {index === 0 && (
                      <p className="mt-3 text-[10px] font-semibold text-gray-400">
                        First tier minimum quantity must match MOQ.
                      </p>
                    )}

                    {index ===
                      tiers.length - 1 && (
                      <p className="mt-3 text-[10px] font-semibold text-gray-400">
                        Leave maximum quantity empty for unlimited quantity.
                      </p>
                    )}

                  </div>
                )
              )}

            </div>
          </section>

          {/* =================================================
              INVENTORY
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 5
            </p>

            <h2 className="mt-1 text-xl font-black">
              MOQ & Inventory
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">

              {/* MOQ */}

              <div>

                <label className="text-xs font-bold text-gray-700">
                  Minimum Order Quantity (MOQ) *
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

                <p className="mt-1.5 text-[10px] text-gray-400">
                  Wholesale buyers must purchase at least this quantity.
                </p>

              </div>

              {/* STOCK */}

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

                <p className="mt-1.5 text-[10px] text-gray-400">
                  Total quantity currently available for sale.
                </p>

              </div>

            </div>
          </section>

          {/* =================================================
              CURRENT STATUS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Marketplace
            </p>

            <h2 className="mt-1 text-xl font-black">
              Product Status
            </h2>

            <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">

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
                className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold uppercase ${
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
              Product status, featured placement,
              best-seller designation and trending
              placement are controlled by ANJIVO
              marketplace administration.
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
