"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

import { createSellerProduct } from "@/lib/seller-products";

import { getCategories } from "@/lib/categories";

import type { Category } from "@/types/category";

type Tier = {
  minQuantity: string;
  maxQuantity: string;
  price: string;
};

const emptyTier: Tier = {
  minQuantity: "",
  maxQuantity: "",
  price: "",
};

export default function NewSellerProductPage() {
  const router = useRouter();

  /* =========================================================
     SELLER STATE
  ========================================================= */

  const [sellerId, setSellerId] = useState("");
  const [sellerName, setSellerName] = useState("");

  /* =========================================================
     PAGE STATE
  ========================================================= */

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =========================================================
     CATEGORY STATE
  ========================================================= */

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] =
    useState(true);

  /* =========================================================
     PRODUCT STATE
  ========================================================= */

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");

  const [imageUrl, setImageUrl] = useState("");

  const [mrp, setMrp] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");

  const [moq, setMoq] = useState("10");
  const [stock, setStock] = useState("");

  /* =========================================================
     WHOLESALE TIERS
  ========================================================= */

  const [tiers, setTiers] = useState<Tier[]>([
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
  ]);

  /* =========================================================
     LOAD SELLER + CATEGORIES
  ========================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace(
            "/login?redirect=/seller/products/new"
          );
          return;
        }

        try {
          setError("");

          /* =================================================
             SELLER PROFILE
          ================================================= */

          const userRef = doc(
            db,
            "users",
            user.uid
          );

          const snapshot = await getDoc(userRef);

          if (!snapshot.exists()) {
            setError(
              "Seller profile not found."
            );
            setLoading(false);
            return;
          }

          const data = snapshot.data();

          if (data.role !== "SELLER") {
            setError(
              "Only sellers can add products."
            );
            setLoading(false);
            return;
          }

          if (data.sellerStatus !== "approved") {
            setError(
              "Your seller account is not approved yet."
            );
            setLoading(false);
            return;
          }

          setSellerId(user.uid);

          setSellerName(
            String(
              data.name ||
                user.displayName ||
                "ANJIVO Seller"
            )
          );

          /* =================================================
             LOAD CATEGORIES
          ================================================= */

          setCategoriesLoading(true);

          try {
            const categoryData =
              await getCategories();

            setCategories(categoryData);
          } catch (categoryError) {
            console.error(
              "Category loading error:",
              categoryError
            );

            setError(
              "Unable to load categories. Please try again."
            );
          } finally {
            setCategoriesLoading(false);
          }
        } catch (err) {
          console.error(
            "Seller verification error:",
            err
          );

          setError(
            "Unable to verify seller account."
          );

          setCategoriesLoading(false);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  /* =========================================================
     CREATE SLUG
  ========================================================= */

  function createSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* =========================================================
     UPDATE WHOLESALE TIER
  ========================================================= */

  function updateTier(
    index: number,
    field: keyof Tier,
    value: string
  ) {
    setTiers((previous) =>
      previous.map((tier, tierIndex) =>
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
    setTiers((previous) => [
      ...previous,
      {
        ...emptyTier,
      },
    ]);
  }

  /* =========================================================
     REMOVE TIER
  ========================================================= */

  function removeTier(index: number) {
    setTiers((previous) =>
      previous.filter(
        (_, tierIndex) =>
          tierIndex !== index
      )
    );
  }

  /* =========================================================
     SELECT CATEGORY
  ========================================================= */

  function handleCategoryChange(
    selectedId: string
  ) {
    setCategoryId(selectedId);

    const selectedCategory =
      categories.find(
        (category) =>
          category.id === selectedId
      );

    setCategoryName(
      selectedCategory?.name || ""
    );
  }

  /* =========================================================
     VALIDATION
  ========================================================= */

  function validate() {
    /* -------------------------------------------------------
       BASIC
    ------------------------------------------------------- */

    if (!name.trim()) {
      return "Product name is required.";
    }

    if (name.trim().length < 3) {
      return "Product name must contain at least 3 characters.";
    }

    if (!categoryId.trim()) {
      return "Please select a category.";
    }

    if (!categoryName.trim()) {
      return "Selected category is invalid.";
    }

    /* -------------------------------------------------------
       PRICES
    ------------------------------------------------------- */

    const numericMrp = Number(mrp);
    const numericRetailPrice =
      Number(retailPrice);
    const numericWholesalePrice =
      Number(wholesalePrice);

    if (
      !mrp ||
      !Number.isFinite(numericMrp) ||
      numericMrp <= 0
    ) {
      return "Enter a valid MRP.";
    }

    if (
      !retailPrice ||
      !Number.isFinite(numericRetailPrice) ||
      numericRetailPrice <= 0
    ) {
      return "Enter a valid retail price.";
    }

    if (
      numericRetailPrice > numericMrp
    ) {
      return "Retail price cannot be higher than MRP.";
    }

    if (
      !wholesalePrice ||
      !Number.isFinite(numericWholesalePrice) ||
      numericWholesalePrice <= 0
    ) {
      return "Enter a valid wholesale price.";
    }

    if (
      numericWholesalePrice >
      numericRetailPrice
    ) {
      return "Wholesale price should not be higher than retail price.";
    }

    /* -------------------------------------------------------
       MOQ
    ------------------------------------------------------- */

    const numericMoq = Number(moq);

    if (
      !moq ||
      !Number.isFinite(numericMoq) ||
      numericMoq < 1
    ) {
      return "Enter a valid MOQ.";
    }

    if (
      !Number.isInteger(numericMoq)
    ) {
      return "MOQ must be a whole number.";
    }

    /* -------------------------------------------------------
       STOCK
    ------------------------------------------------------- */

    const numericStock = Number(stock);

    if (
      stock === "" ||
      !Number.isFinite(numericStock) ||
      numericStock < 0
    ) {
      return "Enter valid stock.";
    }

    if (
      !Number.isInteger(numericStock)
    ) {
      return "Stock must be a whole number.";
    }

    if (numericMoq > numericStock) {
      return "MOQ cannot be greater than stock.";
    }

    /* -------------------------------------------------------
       WHOLESALE TIERS
    ------------------------------------------------------- */

    if (tiers.length === 0) {
      return "Add at least one wholesale tier.";
    }

    const numericTiers = tiers.map(
      (tier) => ({
        min: Number(tier.minQuantity),
        max: tier.maxQuantity
          ? Number(tier.maxQuantity)
          : null,
        price: Number(tier.price),
      })
    );

    /* -------------------------------------------------------
       EACH TIER
    ------------------------------------------------------- */

    for (
      let i = 0;
      i < numericTiers.length;
      i++
    ) {
      const current = numericTiers[i];

      if (
        !tiers[i].minQuantity ||
        !Number.isFinite(current.min) ||
        current.min < 1
      ) {
        return `Wholesale Tier ${
          i + 1
        }: enter a valid minimum quantity.`;
      }

      if (
        !Number.isInteger(current.min)
      ) {
        return `Wholesale Tier ${
          i + 1
        }: minimum quantity must be a whole number.`;
      }

      if (
        !tiers[i].price ||
        !Number.isFinite(current.price) ||
        current.price <= 0
      ) {
        return `Wholesale Tier ${
          i + 1
        }: enter a valid price.`;
      }

      if (
        !Number.isInteger(current.price)
      ) {
        return `Wholesale Tier ${
          i + 1
        }: price must be a whole number.`;
      }

      if (
        current.max !== null &&
        (
          !Number.isFinite(current.max) ||
          current.max < current.min
        )
      ) {
        return `Wholesale Tier ${
          i + 1
        }: maximum quantity cannot be smaller than minimum quantity.`;
      }

      if (
        current.max !== null &&
        !Number.isInteger(current.max)
      ) {
        return `Wholesale Tier ${
          i + 1
        }: maximum quantity must be a whole number.`;
      }

      if (
        current.price >
        numericRetailPrice
      ) {
        return `Wholesale Tier ${
          i + 1
        }: wholesale price cannot be higher than retail price.`;
      }
    }

    /* -------------------------------------------------------
       TIER ORDER + OVERLAP
    ------------------------------------------------------- */

    for (
      let i = 1;
      i < numericTiers.length;
      i++
    ) {
      const previous =
        numericTiers[i - 1];

      const current =
        numericTiers[i];

      if (
        current.min <= previous.min
      ) {
        return "Wholesale tiers must be in increasing quantity order.";
      }

      if (
        previous.max !== null &&
        current.min <= previous.max
      ) {
        return "Wholesale tier quantity ranges cannot overlap.";
      }
    }

    /* -------------------------------------------------------
       MOQ MUST MATCH FIRST TIER
    ------------------------------------------------------- */

    const firstTier =
      numericTiers[0];

    if (
      firstTier.min !== numericMoq
    ) {
      return "The first wholesale tier minimum quantity must match MOQ.";
    }

    /* -------------------------------------------------------
       FIRST TIER PRICE MUST MATCH BASE WHOLESALE PRICE
    ------------------------------------------------------- */

    if (
      firstTier.price !==
      numericWholesalePrice
    ) {
      return "Base wholesale price must match the first wholesale tier price.";
    }

    /* -------------------------------------------------------
       CONTINUOUS RANGE
    ------------------------------------------------------- */

    for (
      let i = 1;
      i < numericTiers.length;
      i++
    ) {
      const previous =
        numericTiers[i - 1];

      const current =
        numericTiers[i];

      /*
       * If previous tier has a maximum,
       * next tier must begin exactly at
       * previous maximum + 1.
       *
       * Example:
       *
       * 10-24
       * 25-49
       * 50-99
       * 100+
       */

      if (
        previous.max !== null &&
        current.min !==
          previous.max + 1
      ) {
        return "Wholesale quantity ranges should be continuous without gaps.";
      }
    }

    return "";
  }

  /* =========================================================
     SUBMIT
  ========================================================= */

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!sellerId) {
      setError(
        "Seller authentication is missing."
      );
      return;
    }

    if (categoriesLoading) {
      setError(
        "Please wait until categories finish loading."
      );
      return;
    }

    try {
      setSaving(true);

      /* =====================================================
         WHOLESALE TIERS
      ===================================================== */

      const wholesaleTiers =
        tiers
          .filter(
            (tier) =>
              tier.minQuantity &&
              tier.price
          )
          .map((tier) => ({
            minQuantity:
              Number(
                tier.minQuantity
              ),

            ...(tier.maxQuantity
              ? {
                  maxQuantity:
                    Number(
                      tier.maxQuantity
                    ),
                }
              : {}),

            price:
              Number(tier.price),
          }));

      /* =====================================================
         IMAGE
      ===================================================== */

      const images = imageUrl.trim()
        ? [imageUrl.trim()]
        : [];

      /* =====================================================
         SLUG
      ===================================================== */

      const slug =
        createSlug(name);

      if (!slug) {
        setError(
          "Unable to create product slug."
        );
        return;
      }

      /* =====================================================
         CREATE PRODUCT
      ===================================================== */

      const productId =
        await createSellerProduct(
          sellerId,
          {
            name: name.trim(),

            slug,

            description:
              description.trim(),

            categoryId,

            categoryName,

            images,

            mrp: Number(mrp),

            retailPrice:
              Number(retailPrice),

            wholesalePrice:
              Number(
                wholesalePrice
              ),

            moq: Number(moq),

            wholesaleTiers,

            stock: Number(stock),
          }
        );

      console.log(
        "Created product:",
        productId
      );

      setSuccess(
        "Product saved as draft successfully."
      );

      setTimeout(() => {
        router.push(
          "/seller/products"
        );
      }, 1000);
    } catch (err) {
      console.error(
        "Create seller product error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create product. Please try again."
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

        <main className="mx-auto max-w-4xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-3xl">
              ⏳
            </div>

            <p className="mt-3 text-sm font-bold text-gray-500">
              Checking seller account...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     SELLER ACCESS ERROR
  ========================================================= */

  if (
    error &&
    !sellerId
  ) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-3xl border border-red-200 bg-white p-8 text-center">

            <div className="text-5xl">
              🔒
            </div>

            <h1 className="mt-4 text-xl font-black">
              Seller Access Required
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {error}
            </p>

            <Link
              href="/seller"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              Seller Dashboard
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     MAIN PAGE
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="mb-6">

          <Link
            href="/seller/products"
            className="text-xs font-bold text-gray-400 transition hover:text-black"
          >
            ← My Products
          </Link>

          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Add New Product
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Add your product to the ANJIVO marketplace.
          </p>
        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="mt-2 text-xs font-bold text-red-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ===================================================
            SUCCESS
        =================================================== */}

        {success && (
          <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-semibold text-green-700">
              {success}
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
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

            <div className="mt-6 space-y-5">

              {/* PRODUCT NAME */}

              <div>

                <label className="mb-2 block text-xs font-bold">
                  Product Name *
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Example: Premium Cotton T-Shirt"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
                />

                {name && (
                  <p className="mt-2 text-[10px] text-gray-400">
                    Slug:{" "}
                    {createSlug(name)}
                  </p>
                )}
              </div>

              {/* DESCRIPTION */}

              <div>

                <label className="mb-2 block text-xs font-bold">
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
                  placeholder="Describe your product, material, features, size, usage etc."
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
                />
              </div>

              {/* CATEGORY */}

              <div>

                <label className="mb-2 block text-xs font-bold">
                  Category *
                </label>

                <select
                  value={categoryId}
                  onChange={(event) =>
                    handleCategoryChange(
                      event.target.value
                    )
                  }
                  disabled={
                    categoriesLoading
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black disabled:cursor-not-allowed disabled:bg-gray-100"
                >

                  <option value="">
                    {categoriesLoading
                      ? "Loading categories..."
                      : "Select Category"}
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

                {categories.length === 0 &&
                  !categoriesLoading && (
                    <p className="mt-2 text-xs font-semibold text-red-500">
                      No active categories available.
                      Please ask admin to create a category first.
                    </p>
                  )}

                {categoryId && (
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] text-gray-400">
                      Selected Category
                    </p>

                    <p className="text-xs font-bold text-gray-700">
                      {categoryName}
                    </p>
                  </div>
                )}
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

            <p className="mt-1 text-xs text-gray-400">
              Image upload/storage integration will be connected later.
              For now use a public image URL.
            </p>

            <div className="mt-5">

              <label className="mb-2 block text-xs font-bold">
                Product Image URL
              </label>

              <input
                type="url"
                value={imageUrl}
                onChange={(event) =>
                  setImageUrl(
                    event.target.value
                  )
                }
                placeholder="https://example.com/product-image.jpg"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-black"
              />
            </div>

            {imageUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">

                <img
                  src={imageUrl}
                  alt="Product preview"
                  className="h-64 w-full object-contain"
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

            <div className="mt-6 grid gap-4 sm:grid-cols-3">

              {/* MRP */}

              <div>

                <label className="mb-2 block text-xs font-bold">
                  MRP *
                </label>

                <div className="relative">

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
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
                    placeholder="499"
                    className="w-full rounded-xl border border-gray-200 py-3 pl-8 pr-4 text-sm outline-none focus:border-black"
                  />

                </div>
              </div>

              {/* RETAIL */}

              <div>

                <label className="mb-2 block text-xs font-bold">
                  Retail Price *
                </label>

                <div className="relative">

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
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
                    placeholder="399"
                    className="w-full rounded-xl border border-gray-200 py-3 pl-8 pr-4 text-sm outline-none focus:border-black"
                  />

                </div>
              </div>

              {/* WHOLESALE */}

              <div>

                <label className="mb-2 block text-xs font-bold">
                  Base Wholesale Price *
                </label>

                <div className="relative">

                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
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
                    placeholder="299"
                    className="w-full rounded-xl border border-gray-200 py-3 pl-8 pr-4 text-sm outline-none focus:border-black"
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

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Step 4
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Wholesale Pricing
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  Set different prices for different quantities.
                </p>

              </div>

              <button
                type="button"
                onClick={addTier}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:border-black"
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

                        <label className="mb-1.5 block text-[10px] font-bold text-gray-500">
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
                          placeholder="10"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                        />
                      </div>

                      {/* MAX */}

                      <div>

                        <label className="mb-1.5 block text-[10px] font-bold text-gray-500">
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
                          placeholder="Leave empty for +"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                        />
                      </div>

                      {/* PRICE */}

                      <div>

                        <label className="mb-1.5 block text-[10px] font-bold text-gray-500">
                          Price / Piece
                        </label>

                        <div className="relative">

                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
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
                            placeholder="299"
                            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-7 pr-3 text-sm outline-none focus:border-black"
                          />

                        </div>
                      </div>

                    </div>

                    {index === 0 && (
                      <p className="mt-3 text-[10px] font-semibold text-gray-400">
                        The first tier minimum must
                        match your MOQ.
                      </p>
                    )}

                    {index ===
                      tiers.length - 1 && (
                      <p className="mt-3 text-[10px] font-semibold text-gray-400">
                        Leave maximum quantity empty
                        for an unlimited upper range.
                      </p>
                    )}
                  </div>
                )
              )}

            </div>
          </section>

          {/* =================================================
              MOQ + INVENTORY
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Step 5
            </p>

            <h2 className="mt-1 text-xl font-black">
              MOQ & Inventory
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              {/* MOQ */}

              <div>

                <label className="mb-2 block text-xs font-bold">
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
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <p className="mt-1.5 text-[10px] text-gray-400">
                  Wholesale customers must purchase
                  at least this quantity.
                </p>

              </div>

              {/* STOCK */}

              <div>

                <label className="mb-2 block text-xs font-bold">
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
                  placeholder="100"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                />

                <p className="mt-1.5 text-[10px] text-gray-400">
                  Enter the total quantity currently
                  available for sale.
                </p>

              </div>

            </div>
          </section>

          {/* =================================================
              APPROVAL
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="rounded-2xl bg-gray-50 p-4">

              <p className="text-xs font-black">
                Product Approval
              </p>

              <p className="mt-1 text-[10px] leading-5 text-gray-500">
                Your product will be saved as a draft.
                ANJIVO admin will review and approve it
                before it becomes visible to customers.
              </p>

            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <Link
                href="/seller/products"
                className="rounded-xl border border-gray-200 px-6 py-3 text-center text-sm font-bold transition hover:border-black"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={
                  saving ||
                  categoriesLoading ||
                  categories.length === 0
                }
                className="rounded-xl bg-black px-7 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving Product..."
                  : "Save Product as Draft"}
              </button>

            </div>
          </section>

        </form>
      </main>

      <Footer />
    </div>
  );
}
