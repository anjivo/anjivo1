"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

import {
  createAdminProduct,
} from "@/lib/admin-products";

import { getCategories } from "@/lib/categories";

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

export default function AdminNewProductPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [categories, setCategories] =
    useState<Category[]>([]);

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

  const [imageUrl, setImageUrl] =
    useState("");

  const [mrp, setMrp] =
    useState("");

  const [retailPrice, setRetailPrice] =
    useState("");

  const [wholesalePrice, setWholesalePrice] =
    useState("");

  const [moq, setMoq] =
    useState("10");

  const [stock, setStock] =
    useState("0");

  const [tiers, setTiers] =
    useState<Tier[]>(
      DEFAULT_TIERS
    );

  const [featured, setFeatured] =
    useState(false);

  const [bestSeller, setBestSeller] =
    useState(false);

  const [trending, setTrending] =
    useState(false);

  const [status, setStatus] =
    useState<
      "active" | "draft"
    >("active");

  /* =========================================================
     ADMIN AUTH
  ========================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/admin/products/new"
            );
            return;
          }

          try {
            const { doc, getDoc } =
              await import(
                "firebase/firestore"
              );

            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const userSnapshot =
              await getDoc(userRef);

            if (
              !userSnapshot.exists()
            ) {
              setError(
                "Admin profile not found."
              );
              setLoading(false);
              return;
            }

            const userData =
              userSnapshot.data();

            if (
              userData.role !== "ADMIN"
            ) {
              setError(
                "Admin access required."
              );
              setLoading(false);
              return;
            }

            const result =
              await getCategories();

            setCategories(
              result.filter(
                (category) =>
                  category.status ===
                  "active"
              )
            );
          } catch (err) {
            console.error(
              "Admin product auth error:",
              err
            );

            setError(
              "Unable to load admin product page."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  /* =========================================================
     CATEGORY
  ========================================================= */

  function handleCategoryChange(
    value: string
  ) {
    setCategoryId(value);

    const category =
      categories.find(
        (item) =>
          item.id === value
      );

    setCategoryName(
      category?.name ?? ""
    );
  }

  /* =========================================================
     TIER
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
     SLUG
  ========================================================= */

  function generateSlug(
    value: string
  ) {
    return value
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );
  }

  /* =========================================================
     SAVE
  ========================================================= */

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    try {
      setError("");
      setSaving(true);

      const user =
        auth.currentUser;

      if (!user) {
        throw new Error(
          "Admin session expired. Please login again."
        );
      }

      /* -------------------------
         BASIC
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
          "Stock cannot be negative."
        );
      }

      /* -------------------------
         TIERS
      ------------------------- */

      const wholesaleTiers =
        tiers
          .filter(
            (tier) =>
              tier.minQuantity ||
              tier.price
          )
          .map((tier) => {
            const minQuantity =
              Number(
                tier.minQuantity
              );

            const maxQuantity =
              tier.maxQuantity
                ? Number(
                    tier.maxQuantity
                  )
                : undefined;

            const price =
              Number(
                tier.price
              );

            if (
              !Number.isFinite(
                minQuantity
              ) ||
              minQuantity < 1
            ) {
              throw new Error(
                "Invalid wholesale minimum quantity."
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
                "Invalid wholesale quantity range."
              );
            }

            if (
              !Number.isFinite(
                price
              ) ||
              price <= 0
            ) {
              throw new Error(
                "Invalid wholesale tier price."
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
         OVERLAP
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
         SLUG
      ------------------------- */

      const finalSlug =
        slug.trim() ||
        generateSlug(name);

      /* -------------------------
         IMAGE
      ------------------------- */

      const images =
        imageUrl.trim()
          ? [imageUrl.trim()]
          : [];

      /* -------------------------
         CREATE
      ------------------------- */

      await createAdminProduct(
        user.uid,
        {
          name: name.trim(),
          slug: finalSlug,
          description:
            description.trim(),

          categoryId,
          categoryName,

          sellerId: user.uid,
          sellerName:
            "ANJIVO Official",
          sellerVerified: true,

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

          status,

          featured,
          bestSeller,
          trending,

          rating: 0,
          reviewsCount: 0,
        }
      );

      router.push(
        "/admin/products"
      );
    } catch (err) {
      console.error(
        "Admin create product error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create product."
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
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading Admin Product Manager...
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

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-black text-red-800">
              Admin Product Manager
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

            <Link
              href="/admin"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              ← Admin Dashboard
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">

        {/* HEADER */}

        <div className="mb-8">
          <Link
            href="/admin"
            className="text-xs font-bold text-gray-400 hover:text-black"
          >
            ← Admin Dashboard
          </Link>

          <h1 className="mt-3 text-3xl font-black tracking-tight">
            List ANJIVO Product
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Add a product directly to the
            ANJIVO marketplace.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* BASIC */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <h2 className="text-lg font-black">
              Basic Information
            </h2>

            <div className="mt-6 space-y-5">

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
                  placeholder="Example: Premium Cotton T-Shirt"
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
                  placeholder="premium-cotton-t-shirt"
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
                  placeholder="Product description..."
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

          {/* IMAGE */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <h2 className="text-lg font-black">
              Product Image
            </h2>

            <input
              type="url"
              value={imageUrl}
              onChange={(event) =>
                setImageUrl(
                  event.target.value
                )
              }
              placeholder="https://example.com/product.jpg"
              className="mt-5 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
            />

            {imageUrl && (
              <div className="mt-5 flex h-52 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
                <img
                  src={imageUrl}
                  alt={name}
                  className="h-full w-full object-contain"
                />
              </div>
            )}

          </section>

          {/* PRICING */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <h2 className="text-lg font-black">
              Pricing
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-3">

              <PriceInput
                label="MRP *"
                value={mrp}
                onChange={setMrp}
              />

              <PriceInput
                label="Retail Price *"
                value={retailPrice}
                onChange={setRetailPrice}
              />

              <PriceInput
                label="Wholesale From *"
                value={wholesalePrice}
                onChange={
                  setWholesalePrice
                }
              />

            </div>
          </section>

          {/* WHOLESALE */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-lg font-black">
                  Wholesale Tiers
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Quantity based pricing.
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

                      <TierInput
                        label="Minimum Qty"
                        value={
                          tier.minQuantity
                        }
                        onChange={(value) =>
                          updateTier(
                            index,
                            "minQuantity",
                            value
                          )
                        }
                      />

                      <TierInput
                        label="Maximum Qty"
                        value={
                          tier.maxQuantity
                        }
                        placeholder="No limit"
                        onChange={(value) =>
                          updateTier(
                            index,
                            "maxQuantity",
                            value
                          )
                        }
                      />

                      <TierInput
                        label="Price / Piece"
                        value={
                          tier.price
                        }
                        onChange={(value) =>
                          updateTier(
                            index,
                            "price",
                            value
                          )
                        }
                      />

                    </div>
                  </div>
                )
              )}

            </div>
          </section>

          {/* INVENTORY */}

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
                  Stock *
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

          {/* STATUS */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <h2 className="text-lg font-black">
              Publishing
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">

              <button
                type="button"
                onClick={() =>
                  setStatus("active")
                }
                className={`rounded-2xl border p-4 text-left ${
                  status === "active"
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm font-black">
                  Publish Now
                </p>

                <p
                  className={`mt-1 text-xs ${
                    status === "active"
                      ? "text-gray-300"
                      : "text-gray-500"
                  }`}
                >
                  Product will be visible on
                  the marketplace.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatus("draft")
                }
                className={`rounded-2xl border p-4 text-left ${
                  status === "draft"
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm font-black">
                  Save as Draft
                </p>

                <p
                  className={`mt-1 text-xs ${
                    status === "draft"
                      ? "text-gray-300"
                      : "text-gray-500"
                  }`}
                >
                  Keep product hidden until
                  it is ready.
                </p>
              </button>

            </div>
          </section>

          {/* FEATURES */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <h2 className="text-lg font-black">
              Marketplace Labels
            </h2>

            <div className="mt-5 space-y-3">

              <CheckOption
                checked={featured}
                onChange={setFeatured}
                title="Featured Product"
              />

              <CheckOption
                checked={bestSeller}
                onChange={setBestSeller}
                title="Best Seller"
              />

              <CheckOption
                checked={trending}
                onChange={setTrending}
                title="Trending Product"
              />

            </div>
          </section>

          {/* ACTIONS */}

          <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:justify-end">

            <Link
              href="/admin/products"
              className="rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-bold text-gray-700 hover:border-black"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-black px-7 py-3 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving
                ? "Listing Product..."
                : "List Product"}
            </button>

          </div>

        </form>
      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   PRICE INPUT
========================================================= */

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-700">
        {label}
      </label>

      <div className="mt-2 flex items-center rounded-xl border border-gray-200">
        <span className="px-3 text-sm font-bold text-gray-400">
          ₹
        </span>

        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="w-full rounded-xl px-2 py-3 text-sm outline-none"
        />
      </div>
    </div>
  );
}

/* =========================================================
   TIER INPUT
========================================================= */

function TierInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-500">
        {label}
      </label>

      <input
        type="number"
        min="1"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-black"
      />
    </div>
  );
}

/* =========================================================
   CHECK OPTION
========================================================= */

function CheckOption({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
  title: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
        className="h-4 w-4"
      />

      <p className="text-sm font-bold">
        {title}
      </p>
    </label>
  );
}
