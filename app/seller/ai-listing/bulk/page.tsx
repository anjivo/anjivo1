
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { auth, storage } from "@/lib/firebase";

type BulkProduct = {
  id: string;
  files: File[];
  previews: string[];
  productName: string;
  category: string;
  brand: string;
};

type GeneratedListing = {
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  brand?: string;
  price?: number | null;
  stock?: number | null;
  images?: string[];
  imageUrls?: string[];
  keywords?: string[];
  attributes?: Record<string, unknown>;
  variants?: Array<{
    sku?: string;
    size?: string;
    color?: string;
    price?: number | null;
    stock?: number | null;
  }>;
  [key: string]: unknown;
};

type BulkResult = {
  index: number;
  success: boolean;
  listing?: GeneratedListing;
  error?: string;
};

type ReviewItem = {
  id: string;
  originalIndex: number;
  listing: GeneratedListing;
  imageUrls: string[];
  title: string;
  description: string;
  category: string;
  brand: string;
  price: string;
  stock: string;
  keywords: string;
};

function createProduct(): BulkProduct {
  return {
    id: crypto.randomUUID(),
    files: [],
    previews: [],
    productName: "",
    category: "",
    brand: "",
  };
}

export default function SellerBulkAIListingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [products, setProducts] = useState<BulkProduct[]>([
    createProduct(),
  ]);

  const [results, setResults] = useState<BulkResult[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  function updateProduct(
    id: string,
    field: "productName" | "category" | "brand",
    value: string
  ) {
    setProducts((previous) =>
      previous.map((product) =>
        product.id === id
          ? { ...product, [field]: value }
          : product
      )
    );
  }

  function handleFiles(
    id: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > 10) {
      setError("Har product ke liye maximum 10 images allowed hain.");
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !file.type.startsWith("image/") ||
        file.size > 10 * 1024 * 1024
    );

    if (invalidFile) {
      setError("Images maximum 10 MB ki honi chahiye.");
      return;
    }

    setError("");

    setProducts((previous) =>
      previous.map((product) => {
        if (product.id !== id) return product;

        product.previews.forEach((url) =>
          URL.revokeObjectURL(url)
        );

        return {
          ...product,
          files: selectedFiles,
          previews: selectedFiles.map((file) =>
            URL.createObjectURL(file)
          ),
        };
      })
    );
  }

  function addProduct() {
    if (products.length >= 10) {
      setError("Maximum 10 products ek batch mein add kar sakte hain.");
      return;
    }

    setProducts((previous) => [
      ...previous,
      createProduct(),
    ]);

    setError("");
  }

  function removeProduct(id: string) {
    setProducts((previous) => {
      const product = previous.find((item) => item.id === id);

      product?.previews.forEach((url) =>
        URL.revokeObjectURL(url)
      );

      return previous.filter((item) => item.id !== id);
    });
  }

  async function uploadProductImages(
    product: BulkProduct
  ): Promise<string[]> {
    if (!user) {
      throw new Error("Please login first.");
    }

    const urls: string[] = [];

    for (const file of product.files) {
      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const storageRef = ref(
        storage,
        `ai-listings/${user.uid}/${product.id}/${Date.now()}-${safeName}`
      );

      await uploadBytes(storageRef, file, {
        contentType: file.type,
      });

      urls.push(await getDownloadURL(storageRef));
    }

    return urls;
  }

  async function generateBulkListings() {
    setError("");
    setMessage("");
    setResults([]);
    setReviewItems([]);

    if (!user) {
      setError("Please login as a seller.");
      return;
    }

    if (
      products.length === 0 ||
      products.length > 10 ||
      products.some((product) => product.files.length === 0)
    ) {
      setError(
        "Har product mein kam se kam ek photo upload karein."
      );
      return;
    }

    setGenerating(true);

    try {
      const token = await user.getIdToken();

      const requestProducts = [];

      // Upload each product's images separately.
      for (const product of products) {
        const imageUrls = await uploadProductImages(product);

        requestProducts.push({
          images: imageUrls,
          productName: product.productName || undefined,
          category: product.category || undefined,
          brand: product.brand || undefined,
          language: "English",
        });
      }

      const response = await fetch(
        "/api/ai/bulk-generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            products: requestProducts,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Bulk generation failed."
        );
      }

      const bulkResults: BulkResult[] = data.results ?? [];

      setResults(bulkResults);

      const successful: ReviewItem[] = [];

      for (const result of bulkResults) {
        if (!result.success || !result.listing) continue;

        const original = products[result.index];

        const listing = result.listing;

        const imageUrls =
          Array.isArray(listing.images) &&
          listing.images.length > 0
            ? listing.images
            : Array.isArray(listing.imageUrls)
              ? listing.imageUrls
              : requestProducts[result.index]?.images ?? [];

        successful.push({
          id: crypto.randomUUID(),
          originalIndex: result.index,
          listing,
          imageUrls,
          title: String(
            listing.title ??
              listing.name ??
              original?.productName ??
              ""
          ),
          description: String(listing.description ?? ""),
          category: String(
            listing.category ?? original?.category ?? ""
          ),
          brand: String(
            listing.brand ?? original?.brand ?? ""
          ),
          price:
            listing.price != null
              ? String(listing.price)
              : "",
          stock:
            listing.stock != null
              ? String(listing.stock)
              : "",
          keywords: Array.isArray(listing.keywords)
            ? listing.keywords.join(", ")
            : "",
        });
      }

      setReviewItems(successful);

      setMessage(
        `${successful.length} listings generated successfully. Please review each listing before saving.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate bulk listings."
      );
    } finally {
      setGenerating(false);
    }
  }

  function updateReviewItem(
    id: string,
    field:
      | "title"
      | "description"
      | "category"
      | "brand"
      | "price"
      | "stock"
      | "keywords",
    value: string
  ) {
    setReviewItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  async function saveBulkListings() {
    if (!user) {
      setError("Please login first.");
      return;
    }

    if (reviewItems.length === 0) {
      setError("No generated listings to save.");
      return;
    }

    const incomplete = reviewItems.find(
      (item) =>
        !item.title.trim() ||
        !item.description.trim() ||
        !item.category.trim() ||
        item.price.trim() === "" ||
        item.stock.trim() === "" ||
        !Number.isFinite(Number(item.price)) ||
        !Number.isInteger(Number(item.stock)) ||
        Number(item.price) < 0 ||
        Number(item.stock) < 0
    );

    if (incomplete) {
      setError(
        `Product ${incomplete.originalIndex + 1}: title, description, category, price and stock verify karein.`
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token = await user.getIdToken();

      let saved = 0;
      const failed: string[] = [];

      for (const item of reviewItems) {
        try {
          const response = await fetch(
            "/api/ai/confirm-listing",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                listing: {
                  title: item.title.trim(),
                  description: item.description.trim(),
                  category: item.category.trim(),
                  brand: item.brand.trim(),
                  price: Number(item.price),
                  stock: Number(item.stock),
                  images: item.imageUrls,
                  keywords: item.keywords
                    .split(",")
                    .map((keyword) => keyword.trim())
                    .filter(Boolean),
                  attributes: item.listing.attributes ?? {},
                  variants: [],
                },
              }),
            }
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(
              data.error || "Unable to save listing."
            );
          }

          saved++;
        } catch {
          failed.push(item.title);
        }
      }

      setMessage(
        `${saved} listings submitted for admin review. ${
          failed.length
        } failed.`
      );

      if (failed.length > 0) {
        setError(
          `Failed products: ${failed.join(", ")}. Please retry these individually.`
        );
      }

      setReviewItems((previous) =>
        previous.filter((item) => failed.includes(item.title))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save listings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        Checking login...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-lg rounded-xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold">
            ANJIVO Bulk Listing Studio
          </h1>

          <p className="mt-3 text-gray-600">
            Please login as a seller to continue.
          </p>

          <a
            href="/login"
            className="mt-5 inline-block rounded-lg bg-black px-5 py-3 text-white"
          >
            Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              ANJIVO Seller Center
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Bulk AI Listing Studio
            </h1>

            <p className="mt-2 text-gray-600">
              Generate multiple product listings using AI.
            </p>
          </div>

          <a
            href="/seller/ai-listing"
            className="rounded-lg border bg-white px-4 py-3 font-medium hover:bg-gray-100"
          >
            Single Listing
          </a>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                1. Add Products
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Har product ki photos alag group mein upload karein.
              </p>
            </div>

            <button
              onClick={addProduct}
              disabled={products.length >= 10 || generating}
              className="rounded-lg border px-4 py-3 font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              + Add Product
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {products.map((product, index) => (
              <div
                key={product.id}
                className="rounded-xl border p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">
                    Product {index + 1}
                  </h3>

                  {products.length > 1 && (
                    <button
                      onClick={() => removeProduct(product.id)}
                      disabled={generating}
                      className="text-sm font-medium text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <input
                    value={product.productName}
                    onChange={(e) =>
                      updateProduct(
                        product.id,
                        "productName",
                        e.target.value
                      )
                    }
                    placeholder="Product name (optional)"
                    className="rounded-lg border p-3"
                  />

                  <input
                    value={product.category}
                    onChange={(e) =>
                      updateProduct(
                        product.id,
                        "category",
                        e.target.value
                      )
                    }
                    placeholder="Category"
                    className="rounded-lg border p-3"
                  />

                  <input
                    value={product.brand}
                    onChange={(e) =>
                      updateProduct(
                        product.id,
                        "brand",
                        e.target.value
                      )
                    }
                    placeholder="Brand"
                    className="rounded-lg border p-3"
                  />
                </div>

                <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-blue-500">
                  <div>
                    <span className="text-3xl">📷</span>
                    <p className="mt-2 font-medium">
                      Select Photos for Product {index + 1}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Maximum 10 images, 10 MB each
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={generating}
                    onChange={(e) =>
                      handleFiles(product.id, e)
                    }
                    className="hidden"
                  />
                </label>

                {product.previews.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {product.previews.map((url, imageIndex) => (
                      <img
                        key={url}
                        src={url}
                        alt={`Product ${index + 1} image ${imageIndex + 1}`}
                        className="h-32 w-full rounded-lg border bg-gray-50 object-contain"
                      />
                    ))}
                  </div>
                )}

                <p className="mt-3 text-sm text-gray-500">
                  {product.files.length} image(s) selected
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={generateBulkListings}
            disabled={
              generating ||
              products.length === 0 ||
              products.some((product) => product.files.length === 0)
            }
            className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {generating
              ? "Uploading Photos & Generating Listings..."
              : `Generate ${products.length} AI Listing(s)`}
          </button>
        </section>

        {results.length > 0 && (
          <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              2. Generation Results
            </h2>

            <div className="mt-4 space-y-3">
              {results.map((result) => (
                <div
                  key={result.index}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <span className="font-medium">
                    Product {result.index + 1}
                  </span>

                  <span
                    className={
                      result.success
                        ? "text-sm font-medium text-green-600"
                        : "text-sm font-medium text-red-600"
                    }
                  >
                    {result.success
                      ? "Generated"
                      : result.error || "Failed"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {reviewItems.length > 0 && (
          <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              3. Review & Confirm Listings
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              AI-generated information verify karein. Price aur stock aapko enter karna hoga.
            </p>

            <div className="mt-6 space-y-8">
              {reviewItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border p-5"
                >
                  <h3 className="text-lg font-semibold">
                    Product {item.originalIndex + 1}
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {item.imageUrls.map((url, imageIndex) => (
                      <img
                        key={`${url}-${imageIndex}`}
                        src={url}
                        alt={`Product image ${imageIndex + 1}`}
                        className="h-36 w-full rounded-lg border bg-gray-50 object-contain"
                      />
                    ))}
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Product Title
                      </label>
                      <input
                        value={item.title}
                        onChange={(e) =>
                          updateReviewItem(
                            item.id,
                            "title",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border p-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Category
                      </label>
                      <input
                        value={item.category}
                        onChange={(e) =>
                          updateReviewItem(
                            item.id,
                            "category",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border p-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Brand
                      </label>
                      <input
                        value={item.brand}
                        onChange={(e) =>
                          updateReviewItem(
                            item.id,
                            "brand",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border p-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Selling Price (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) =>
                          updateReviewItem(
                            item.id,
                            "price",
                            e.target.value
                          )
                        }
                        placeholder="Enter price"
                        className="w-full rounded-lg border p-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.stock}
                        onChange={(e) =>
                          updateReviewItem(
                            item.id,
                            "stock",
                            e.target.value
                          )
                        }
                        placeholder="Enter stock"
                        className="w-full rounded-lg border p-3"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">
                        Keywords
                      </label>
                      <input
                        value={item.keywords}
                        onChange={(e) =>
                          updateReviewItem(
                            item.id,
                            "keywords",
                            e.target.value
                          )
                        }
                        placeholder="Comma-separated keywords"
                        className="w-full rounded-lg border p-3"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium">
                      Description
                    </label>
                    <textarea
                      value={item.description}
                      onChange={(e) =>
                        updateReviewItem(
                          item.id,
                          "description",
                          e.target.value
                        )
                      }
                      rows={5}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveBulkListings}
              disabled={saving || reviewItems.length === 0}
              className="mt-6 w-full rounded-xl bg-green-600 px-5 py-4 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {saving
                ? "Submitting Listings..."
                : `Confirm & Submit ${reviewItems.length} Listing(s)`}
            </button>

            <p className="mt-3 text-xs text-gray-500">
              Listings admin approval ke liye submit hongi, directly publish nahi hongi.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
