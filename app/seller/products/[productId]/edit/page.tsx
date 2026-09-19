"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  getSellerProduct,
  updateSellerProduct,
} from "@/lib/seller-products";

import { getCategories } from "@/lib/categories";
import type { Category } from "@/types/category";
import type { Product, WholesaleTier } from "@/types/product";

type Tier = {
  minQuantity: string;
  maxQuantity: string;
  price: string;
};

const defaultTiers: Tier[] = [
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
  const params = useParams();
  const router = useRouter();

  const productId = String(params.productId);

  const [user, setUser] = useState<User | null>(null);
  const [product, setProduct] = useState<Product | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");

  const [mrp, setMrp] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");

  const [moq, setMoq] = useState("");
  const [stock, setStock] = useState("");

  const [status, setStatus] = useState<
    "draft" | "active" | "out_of_stock" | "blocked"
  >("draft");

  const [featured, setFeatured] = useState(false);
  const [bestSeller, setBestSeller] = useState(false);
  const [trending, setTrending] = useState(false);

  const [tiers, setTiers] =
    useState<Tier[]>(defaultTiers);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.replace(
            `/login?redirect=/seller/products/${productId}/edit`
          );
          return;
        }

        setUser(currentUser);

        try {
          const userSnap = await getDoc(
            doc(db, "users", currentUser.uid)
          );

          if (!userSnap.exists()) {
            router.replace("/login");
            return;
          }

          const userData = userSnap.data();

          if (userData.role !== "SELLER") {
            router.replace("/");
            return;
          }

          if (userData.sellerStatus !== "approved") {
            router.replace("/seller/application");
            return;
          }

          const [productData, categoryData] =
            await Promise.all([
              getSellerProduct(
                currentUser.uid,
                productId
              ),
              getCategories(),
            ]);

          if (!productData) {
            setError(
              "Product nahi mila ya aapko is product ko edit karne ki permission nahi hai."
            );
            return;
          }

          setProduct(productData);
          setCategories(categoryData);

          setName(productData.name);
          setSlug(productData.slug);
          setDescription(
            productData.description ?? ""
          );

          setCategoryId(productData.categoryId);
          setCategoryName(
            productData.categoryName ?? ""
          );

          setMrp(String(productData.mrp));
          setRetailPrice(
            String(productData.retailPrice)
          );
          setWholesalePrice(
            String(productData.wholesalePrice)
          );

          setMoq(String(productData.moq));
          setStock(String(productData.stock));

          setStatus(productData.status);

          setFeatured(
            Boolean(productData.featured)
          );

          setBestSeller(
            Boolean(productData.bestSeller)
          );

          setTrending(
            Boolean(productData.trending)
          );

          if (
            productData.wholesaleTiers &&
            productData.wholesaleTiers.length > 0
          ) {
            setTiers(
              productData.wholesaleTiers.map(
                (tier: WholesaleTier) => ({
                  minQuantity: String(
                    tier.minQuantity
                  ),
                  maxQuantity:
                    tier.maxQuantity !== undefined
                      ? String(tier.maxQuantity)
                      : "",
                  price: String(tier.price),
                })
              )
            );
          }
        } catch (err) {
          console.error(err);

          setError(
            "Product load karte waqt error aa gaya."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [productId, router]);

  function updateTier(
    index: number,
    field: keyof Tier,
    value: string
  ) {
    setTiers((current) =>
      current.map((tier, i) =>
        i === index
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

  function removeTier(index: number) {
    setTiers((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  async function handleSave(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!user || !product) return;

    setError("");
    setSuccess("");

    const mrpValue = Number(mrp);
    const retailValue = Number(retailPrice);
    const wholesaleValue = Number(
      wholesalePrice
    );
    const moqValue = Number(moq);
    const stockValue = Number(stock);

    if (!name.trim()) {
      setError("Product name required hai.");
      return;
    }

    if (!categoryId) {
      setError("Category select karein.");
      return;
    }

    if (
      !Number.isFinite(mrpValue) ||
      mrpValue <= 0
    ) {
      setError("Valid MRP enter karein.");
      return;
    }

    if (
      !Number.isFinite(retailValue) ||
      retailValue <= 0
    ) {
      setError("Valid retail price enter karein.");
      return;
    }

    if (retailValue > mrpValue) {
      setError(
        "Retail price MRP se zyada nahi ho sakta."
      );
      return;
    }

    if (
      !Number.isFinite(wholesaleValue) ||
      wholesaleValue <= 0
    ) {
      setError(
        "Valid wholesale price enter karein."
      );
      return;
    }

    if (wholesaleValue > retailValue) {
      setError(
        "Wholesale price retail price se zyada nahi ho sakta."
      );
      return;
    }

    if (
      !Number.isFinite(moqValue) ||
      moqValue < 1
    ) {
      setError("MOQ minimum 1 hona chahiye.");
      return;
    }

    if (
      !Number.isFinite(stockValue) ||
      stockValue < 0
    ) {
      setError(
        "Stock 0 ya usse zyada hona chahiye."
      );
      return;
    }

    const wholesaleTiers: WholesaleTier[] = [];

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];

      if (
        !tier.minQuantity &&
        !tier.price &&
        !tier.maxQuantity
      ) {
        continue;
      }

      const min = Number(tier.minQuantity);
      const price = Number(tier.price);

      const max = tier.maxQuantity
        ? Number(tier.maxQuantity)
        : undefined;

      if (
        !Number.isFinite(min) ||
        min < 1
      ) {
        setError(
          `Wholesale Tier ${i + 1}: valid minimum quantity enter karein.`
        );
        return;
      }

      if (
        max !== undefined &&
        (!Number.isFinite(max) || max < min)
      ) {
        setError(
          `Wholesale Tier ${i + 1}: maximum quantity invalid hai.`
        );
        return;
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        setError(
          `Wholesale Tier ${i + 1}: valid price enter karein.`
        );
        return;
      }

      if (price > retailValue) {
        setError(
          `Wholesale Tier ${i + 1}: price retail price se zyada nahi ho sakta.`
        );
        return;
      }

      wholesaleTiers.push({
        minQuantity: min,
        ...(max !== undefined
          ? { maxQuantity: max }
          : {}),
        price,
      });
    }

    wholesaleTiers.sort(
      (a, b) =>
        a.minQuantity - b.minQuantity
    );

    setSaving(true);

    try {
      await updateSellerProduct(
        user.uid,
        productId,
        {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          categoryId,
          categoryName,
          mrp: mrpValue,
          retailPrice: retailValue,
          wholesalePrice: wholesaleValue,
          moq: moqValue,
          stock: stockValue,
          wholesaleTiers,
          status:
            stockValue === 0
              ? "out_of_stock"
              : status === "out_of_stock"
                ? "draft"
                : status,
          featured,
          bestSeller,
          trending,
        }
      );

      setSuccess(
        "Product successfully update ho gaya."
      );

      setTimeout(() => {
        router.push("/seller/products");
      }, 1000);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Product update nahi ho paya."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header />

        <main className="min-h-screen bg-gray-50 px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="animate-pulse text-gray-500">
              Product load ho raha hai...
            </div>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />

        <main className="min-h-screen bg-gray-50 px-4 py-16">
          <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-4xl">
              ⚠️
            </div>

            <h1 className="text-xl font-bold text-gray-900">
              Product nahi mila
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {error ||
                "Product available nahi hai."}
            </p>

            <Link
              href="/seller/products"
              className="mt-6 inline-block rounded-xl bg-black px-6 py-3 text-sm font-semibold text-white"
            >
              Back to Products
            </Link>
          </div>
        </main>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href="/seller/products"
                className="text-sm font-medium text-gray-500 hover:text-black"
              >
                ← Back to Products
              </Link>

              <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
                Edit Product
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                {product.name}
              </p>
            </div>

            <div className="rounded-full bg-gray-100 px-4 py-2 text-xs font-semibold uppercase text-gray-600">
              {product.status}
            </div>
          </div>

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
            {/* BASIC INFORMATION */}
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">
                Basic Information
              </h2>

              <div className="mt-5 grid gap-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Product Name
                  </label>

                  <input
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                    placeholder="Product name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Slug
                  </label>

                  <input
                    value={slug}
                    onChange={(e) =>
                      setSlug(e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                    placeholder="product-slug"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Description
                  </label>

                  <textarea
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    rows={5}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                    placeholder="Product description"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Category
                  </label>

                  <select
                    value={categoryId}
                    onChange={(e) => {
                      const selected =
                        categories.find(
                          (category) =>
                            category.id ===
                            e.target.value
                        );

                      setCategoryId(
                        e.target.value
                      );

                      setCategoryName(
                        selected?.name ?? ""
                      );
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="">
                      Select Category
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
              </div>
            </section>

            {/* PRICING */}
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">
                Pricing
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    MRP
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={mrp}
                    onChange={(e) =>
                      setMrp(e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Base Wholesale Price
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
                    className="w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>
              </div>
            </section>

            {/* WHOLESALE TIERS */}
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Wholesale Quantity Tiers
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Quantity badhne par different
                    wholesale price set karein.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addTier}
                  className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white"
                >
                  + Add Tier
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-bold">
                        Tier {index + 1}
                      </span>

                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeTier(index)
                          }
                          className="text-sm font-semibold text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-600">
                          Minimum Qty
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
                          className="w-full rounded-xl border border-gray-300 px-3 py-2.5"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-600">
                          Maximum Qty
                        </label>

                        <input
                          type="number"
                          min="1"
                          value={
                            tier.maxQuantity
                          }
                          onChange={(e) =>
                            updateTier(
                              index,
                              "maxQuantity",
                              e.target.value
                            )
                          }
                          placeholder="100+"
                          className="w-full rounded-xl border border-gray-300 px-3 py-2.5"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-600">
                          Price / Unit
                        </label>

                        <input
                          type="number"
                          min="0"
                          value={tier.price}
                          onChange={(e) =>
                            updateTier(
                              index,
                              "price",
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* INVENTORY */}
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">
                Inventory
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Minimum Order Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={moq}
                    onChange={(e) =>
                      setMoq(e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Stock
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) =>
                      setStock(e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3"
                  />
                </div>
              </div>
            </section>

            {/* STATUS */}
            <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
              <h2 className="text-lg font-bold text-gray-900">
                Product Settings
              </h2>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold">
                  Status
                </label>

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(
                      e.target.value as
                        | "draft"
                        | "active"
                        | "out_of_stock"
                        | "blocked"
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 sm:max-w-md"
                >
                  <option value="draft">
                    Draft
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="out_of_stock">
                    Out of Stock
                  </option>

                  <option value="blocked">
                    Blocked
                  </option>
                </select>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) =>
                      setFeatured(
                        e.target.checked
                      )
                    }
                    className="h-4 w-4"
                  />

                  <span className="text-sm font-semibold">
                    Featured
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">
                  <input
                    type="checkbox"
                    checked={bestSeller}
                    onChange={(e) =>
                      setBestSeller(
                        e.target.checked
                      )
                    }
                    className="h-4 w-4"
                  />

                  <span className="text-sm font-semibold">
                    Best Seller
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">
                  <input
                    type="checkbox"
                    checked={trending}
                    onChange={(e) =>
                      setTrending(
                        e.target.checked
                      )
                    }
                    className="h-4 w-4"
                  />

                  <span className="text-sm font-semibold">
                    Trending
                  </span>
                </label>
              </div>
            </section>

            {/* SAVE */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/seller/products"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-700"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-black px-8 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
}
