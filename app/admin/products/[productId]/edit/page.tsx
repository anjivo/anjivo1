"use client";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

import { auth, db } from "@/lib/firebase";
import {
  getAdminProduct,
  updateAdminProduct,
} from "@/lib/admin-products";

import type { Product } from "@/types/product";
import type { Category } from "@/types/category";

type Tier = {
  minQuantity: number;
  maxQuantity?: number;
  price: number;
};

export default function AdminEditProductPage() {
  const router = useRouter();
  const params = useParams();

  const productId =
    typeof params.productId === "string"
      ? params.productId
      : "";

  const [user, setUser] = useState<User | null>(null);

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

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const [categoryId, setCategoryId] =
    useState("");

  const [categoryName, setCategoryName] =
    useState("");

  const [imageUrl, setImageUrl] =
    useState("");

  const [mrp, setMrp] = useState("");
  const [retailPrice, setRetailPrice] =
    useState("");

  const [wholesalePrice, setWholesalePrice] =
    useState("");

  const [moq, setMoq] = useState("");
  const [stock, setStock] = useState("");

  const [status, setStatus] =
    useState<Product["status"]>("draft");

  const [featured, setFeatured] =
    useState(false);

  const [bestSeller, setBestSeller] =
    useState(false);

  const [trending, setTrending] =
    useState(false);

  const [tiers, setTiers] =
    useState<Tier[]>([
      {
        minQuantity: 10,
        maxQuantity: 24,
        price: 0,
      },
      {
        minQuantity: 25,
        maxQuantity: 49,
        price: 0,
      },
      {
        minQuantity: 50,
        maxQuantity: 99,
        price: 0,
      },
      {
        minQuantity: 100,
        price: 0,
      },
    ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.replace("/login");
          return;
        }

        setUser(currentUser);

        try {
          const userSnap = await getDocs(
            query(
              collection(db, "users")
            )
          );

          const adminUser = userSnap.docs.find(
            (item) =>
              item.id === currentUser.uid
          );

          if (
            !adminUser ||
            adminUser.data().role !== "ADMIN"
          ) {
            router.replace("/");
            return;
          }

          await loadData();
        } catch (err) {
          console.error(err);
          setError(
            "Admin verification failed."
          );
        }
      }
    );

    return () => unsubscribe();
  }, [router, productId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [productData, categorySnapshot] =
        await Promise.all([
          getAdminProduct(productId),
          getDocs(
            query(
              collection(db, "categories"),
              orderBy("name", "asc")
            )
          ),
        ]);

      if (!productData) {
        setError("Product not found.");
        return;
      }

      setProduct(productData);

      setName(productData.name || "");
      setSlug(productData.slug || "");
      setDescription(
        productData.description || ""
      );

      setCategoryId(
        productData.categoryId || ""
      );

      setCategoryName(
        productData.categoryName || ""
      );

      setImageUrl(
        productData.images?.[0] || ""
      );

      setMrp(
        String(productData.mrp ?? "")
      );

      setRetailPrice(
        String(productData.retailPrice ?? "")
      );

      setWholesalePrice(
        String(productData.wholesalePrice ?? "")
      );

      setMoq(
        String(productData.moq ?? "")
      );

      setStock(
        String(productData.stock ?? "")
      );

      setStatus(
        productData.status || "draft"
      );

      setFeatured(
        productData.featured ?? false
      );

      setBestSeller(
        productData.bestSeller ?? false
      );

      setTrending(
        productData.trending ?? false
      );

      if (
        productData.wholesaleTiers &&
        productData.wholesaleTiers.length > 0
      ) {
        setTiers(
          productData.wholesaleTiers.map(
            (tier) => ({
              minQuantity:
                tier.minQuantity,
              ...(tier.maxQuantity !== undefined
                ? {
                    maxQuantity:
                      tier.maxQuantity,
                  }
                : {}),
              price: tier.price,
            })
          )
        );
      }

      const categoryData =
        categorySnapshot.docs.map(
          (item) => ({
            id: item.id,
            ...(item.data() as Omit<
              Category,
              "id"
            >),
          })
        );

      setCategories(categoryData);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to load product."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateTier(
    index: number,
    field:
      | "minQuantity"
      | "maxQuantity"
      | "price",
    value: string
  ) {
    setTiers((current) =>
      current.map((tier, i) => {
        if (i !== index) {
          return tier;
        }

        if (
          field === "minQuantity"
        ) {
          return {
            ...tier,
            minQuantity:
              Number(value) || 0,
          };
        }

        if (
          field === "maxQuantity"
        ) {
          return {
            ...tier,
            maxQuantity:
              value === ""
                ? undefined
                : Number(value),
          };
        }

        return {
          ...tier,
          price:
            Number(value) || 0,
        };
      })
    );
  }

  function addTier() {
    setTiers((current) => [
      ...current,
      {
        minQuantity: 0,
        maxQuantity: undefined,
        price: 0,
      },
    ]);
  }

  function removeTier(index: number) {
    setTiers((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  function validateTiers() {
    if (tiers.length === 0) {
      return "At least one wholesale tier is required.";
    }

    const sorted = [...tiers].sort(
      (a, b) =>
        a.minQuantity - b.minQuantity
    );

    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i];

      if (
        tier.minQuantity <= 0
      ) {
        return "Tier minimum quantity must be greater than 0.";
      }

      if (tier.price <= 0) {
        return "All wholesale tier prices must be greater than 0.";
      }

      if (
        tier.maxQuantity !== undefined &&
        tier.maxQuantity < tier.minQuantity
      ) {
        return "Tier maximum quantity cannot be smaller than minimum quantity.";
      }

      if (i > 0) {
        const previous =
          sorted[i - 1];

        if (
          previous.maxQuantity !==
            undefined &&
          tier.minQuantity <=
            previous.maxQuantity
        ) {
          return "Wholesale tiers cannot overlap.";
        }
      }
    }

    return "";
  }

  async function handleSave(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!user || !product) {
      return;
    }

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!categoryId) {
      setError("Please select a category.");
      return;
    }

    const mrpValue = Number(mrp);
    const retailValue =
      Number(retailPrice);
    const wholesaleValue =
      Number(wholesalePrice);
    const moqValue = Number(moq);
    const stockValue = Number(stock);

    if (
      mrpValue <= 0 ||
      retailValue <= 0 ||
      wholesaleValue <= 0
    ) {
      setError(
        "MRP and prices must be greater than 0."
      );
      return;
    }

    if (retailValue > mrpValue) {
      setError(
        "Retail price cannot be greater than MRP."
      );
      return;
    }

    if (moqValue <= 0) {
      setError(
        "MOQ must be greater than 0."
      );
      return;
    }

    if (stockValue < 0) {
      setError(
        "Stock cannot be negative."
      );
      return;
    }

    const tierError =
      validateTiers();

    if (tierError) {
      setError(tierError);
      return;
    }

    const selectedCategory =
      categories.find(
        (category) =>
          category.id === categoryId
      );

    try {
      setSaving(true);

      await updateAdminProduct(
        product.id,
        {
          name: name.trim(),
          slug:
            slug.trim() ||
            name
              .toLowerCase()
              .trim()
              .replace(
                /[^a-z0-9]+/g,
                "-"
              )
              .replace(
                /^-+|-+$/g,
                ""
              ),

          description:
            description.trim(),

          categoryId,

          categoryName:
            selectedCategory?.name ||
            categoryName,

          images: imageUrl.trim()
            ? [imageUrl.trim()]
            : [],

          mrp: mrpValue,
          retailPrice: retailValue,
          wholesalePrice:
            wholesaleValue,

          moq: moqValue,
          stock: stockValue,

          wholesaleTiers:
            [...tiers].sort(
              (a, b) =>
                a.minQuantity -
                b.minQuantity
            ),

          status,

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
          "/admin/products"
        );
      }, 700);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to update product. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="mt-4 text-sm text-slate-600">
            Loading product...
          </p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Product not found
          </h1>

          <p className="mt-2 text-slate-500">
            {error ||
              "This product does not exist."}
          </p>

          <button
            onClick={() =>
              router.push(
                "/admin/products"
              )
            }
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Products
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ANJIVO ADMIN
            </p>

            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Edit Product
            </h1>
          </div>

          <button
            onClick={() =>
              router.push(
                "/admin/products"
              )
            }
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="space-y-6"
        >
          {/* PRODUCT ID / SELLER */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Product Information
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Product Name
                </label>

                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  placeholder="Product name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Slug
                </label>

                <input
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  placeholder="product-slug"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  rows={5}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  placeholder="Product description"
                />
              </div>
            </div>
          </section>

          {/* SELLER */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Seller
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Seller Name
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {product.sellerName ||
                    "Unknown Seller"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Seller ID
                </p>

                <p className="mt-1 break-all text-sm text-slate-700">
                  {product.sellerId}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Seller ownership is protected and cannot
              be changed from this page.
            </p>
          </section>

          {/* CATEGORY + IMAGE */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Category & Image
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Category
                </label>

                <select
                  value={categoryId}
                  onChange={(e) => {
                    const value =
                      e.target.value;

                    setCategoryId(value);

                    const selected =
                      categories.find(
                        (item) =>
                          item.id === value
                      );

                    setCategoryName(
                      selected?.name || ""
                    );
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900"
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
                        {category.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Product Image URL
                </label>

                <input
                  value={imageUrl}
                  onChange={(e) =>
                    setImageUrl(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  placeholder="https://..."
                />
              </div>
            </div>

            {imageUrl && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Preview
                </p>

                <img
                  src={imageUrl}
                  alt={name}
                  className="h-40 w-40 rounded-2xl border object-cover"
                />
              </div>
            )}
          </section>

          {/* PRICING */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Pricing & Inventory
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  MRP
                </label>

                <input
                  type="number"
                  min="0"
                  value={mrp}
                  onChange={(e) =>
                    setMrp(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Retail Price
                </label>

                <input
                  type="number"
                  min="0"
                  value={retailPrice}
                  onChange={(e) =>
                    setRetailPrice(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Base Wholesale
                </label>

                <input
                  type="number"
                  min="0"
                  value={wholesalePrice}
                  onChange={(e) =>
                    setWholesalePrice(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  MOQ
                </label>

                <input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={(e) =>
                    setMoq(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Stock
                </label>

                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) =>
                    setStock(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3"
                />
              </div>
            </div>
          </section>

          {/* WHOLESALE TIERS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Wholesale Quantity Tiers
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Set different prices according to
                  purchase quantity.
                </p>
              </div>

              <button
                type="button"
                onClick={addTier}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                + Add Tier
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {tiers.map(
                (tier, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold text-slate-900">
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
                          className="text-sm font-semibold text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-600">
                          Min Quantity
                        </label>

                        <input
                          type="number"
                          min="1"
                          value={
                            tier.minQuantity
                          }
                          onChange={(e) =>
                            updateTier(
                              index,
                              "minQuantity",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-600">
                          Max Quantity
                        </label>

                        <input
                          type="number"
                          min={
                            tier.minQuantity
                          }
                          value={
                            tier.maxQuantity ??
                            ""
                          }
                          onChange={(e) =>
                            updateTier(
                              index,
                              "maxQuantity",
                              e.target.value
                            )
                          }
                          placeholder="100+"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-600">
                          Price
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={
                            tier.price
                          }
                          onChange={(e) =>
                            updateTier(
                              index,
                              "price",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* STATUS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Marketplace Controls
            </h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Product Status
                </label>

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target
                        .value as Product["status"]
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="draft">
                    Draft
                  </option>

                  <option value="out_of_stock">
                    Out of Stock
                  </option>

                  <option value="blocked">
                    Blocked
                  </option>
                </select>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  Current Seller Verification
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {product.sellerVerified
                    ? "Verified Seller"
                    : "Not Verified"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) =>
                    setFeatured(
                      e.target.checked
                    )
                  }
                  className="h-5 w-5"
                />

                <span className="text-sm font-semibold text-slate-800">
                  Featured
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={bestSeller}
                  onChange={(e) =>
                    setBestSeller(
                      e.target.checked
                    )
                  }
                  className="h-5 w-5"
                />

                <span className="text-sm font-semibold text-slate-800">
                  Best Seller
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={trending}
                  onChange={(e) =>
                    setTrending(
                      e.target.checked
                    )
                  }
                  className="h-5 w-5"
                />

                <span className="text-sm font-semibold text-slate-800">
                  Trending
                </span>
              </label>
            </div>
          </section>

          {/* SAVE */}

          <div className="sticky bottom-0 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold text-slate-900">
                  Ready to save?
                </p>

                <p className="text-xs text-slate-500">
                  Changes will immediately update the
                  Firestore product.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/admin/products"
                    )
                  }
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : "Save Product"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
