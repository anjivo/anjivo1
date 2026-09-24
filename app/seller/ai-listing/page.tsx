
"use client";

import { useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { useEffect } from "react";

// IMPORTANT:
// If your Firebase client exports use different names or path,
// update this import to match your existing Firebase configuration.
import { auth, storage } from "@/lib/firebase";

type Listing = {
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

export default function SellerAIListingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [keywords, setKeywords] = useState("");

  const [variants, setVariants] = useState<
    Array<{
      sku: string;
      size: string;
      color: string;
      price: string;
      stock: string;
    }>
  >([]);

  const [listing, setListing] = useState<Listing | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > 10) {
      setError("Ek product ke liye maximum 10 images select karein.");
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !file.type.startsWith("image/") ||
        file.size > 10 * 1024 * 1024
    );

    if (invalidFile) {
      setError("Sirf image files, maximum 10 MB per image.");
      return;
    }

    previewUrls.forEach((url) => URL.revokeObjectURL(url));

    setFiles(selectedFiles);
    setPreviewUrls(
      selectedFiles.map((file) => URL.createObjectURL(file))
    );

    setListing(null);
    setUploadedImages([]);
    setMessage("");
    setError("");
  }

  async function uploadImages(): Promise<string[]> {
    if (!user) {
      throw new Error("Please login first.");
    }

    const urls: string[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const storageRef = ref(
        storage,
        `ai-listings/${user.uid}/${Date.now()}-${safeName}`
      );

      await uploadBytes(storageRef, file, {
        contentType: file.type,
      });

      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }

    return urls;
  }

  async function generateAIListing() {
    setError("");
    setMessage("");

    if (!user) {
      setError("Please login as a seller first.");
      return;
    }

    if (files.length === 0) {
      setError("Pehle product ki images select karein.");
      return;
    }

    setLoading(true);

    try {
      const token = await user.getIdToken();

      // Upload original images to Firebase Storage.
      const imageUrls = await uploadImages();

      setUploadedImages(imageUrls);

      const response = await fetch("/api/ai/generate-listing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          images: imageUrls,
          productName: title || undefined,
          category: category || undefined,
          brand: brand || undefined,
          language: "English",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "AI listing generation failed."
        );
      }

      const result: Listing = data.listing;

      setListing(result);

      setTitle(String(result.title ?? result.name ?? ""));
      setDescription(String(result.description ?? ""));
      setCategory(String(result.category ?? ""));
      setBrand(String(result.brand ?? ""));

      setPrice(
        result.price != null ? String(result.price) : ""
      );

      setStock(
        result.stock != null ? String(result.stock) : ""
      );

      setKeywords(
        Array.isArray(result.keywords)
          ? result.keywords.join(", ")
          : ""
      );

      setVariants(
        Array.isArray(result.variants)
          ? result.variants.map((variant) => ({
              sku: String(variant.sku ?? ""),
              size: String(variant.size ?? ""),
              color: String(variant.color ?? ""),
              price:
                variant.price != null
                  ? String(variant.price)
                  : "",
              stock:
                variant.stock != null
                  ? String(variant.stock)
                  : "",
            }))
          : []
      );

      setMessage(
        "AI draft ready. Details check karke price aur stock confirm karein."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function addVariant() {
    setVariants((previous) => [
      ...previous,
      {
        sku: "",
        size: "",
        color: "",
        price: "",
        stock: "",
      },
    ]);
  }

  function updateVariant(
    index: number,
    field: string,
    value: string
  ) {
    setVariants((previous) =>
      previous.map((variant, i) =>
        i === index
          ? { ...variant, [field]: value }
          : variant
      )
    );
  }

  function removeVariant(index: number) {
    setVariants((previous) =>
      previous.filter((_, i) => i !== index)
    );
  }

  async function confirmListing() {
    setError("");
    setMessage("");

    if (!user) {
      setError("Please login first.");
      return;
    }

    if (!listing || uploadedImages.length === 0) {
      setError("Pehle AI listing generate karein.");
      return;
    }

    if (
      !title.trim() ||
      !description.trim() ||
      !category.trim()
    ) {
      setError("Title, description aur category required hain.");
      return;
    }

    if (
      price.trim() === "" ||
      stock.trim() === "" ||
      !Number.isFinite(Number(price)) ||
      !Number.isFinite(Number(stock)) ||
      Number(price) < 0 ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0
    ) {
      setError("Valid selling price aur stock enter karein.");
      return;
    }

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];

      if (
        !variant.sku.trim() ||
        variant.price.trim() === "" ||
        variant.stock.trim() === "" ||
        !Number.isFinite(Number(variant.price)) ||
        !Number.isInteger(Number(variant.stock)) ||
        Number(variant.price) < 0 ||
        Number(variant.stock) < 0
      ) {
        setError(
          `Variant ${i + 1}: SKU, price aur stock sahi bharein.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/ai/confirm-listing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          listing: {
            title: title.trim(),
            description: description.trim(),
            category: category.trim(),
            brand: brand.trim(),
            price: Number(price),
            stock: Number(stock),
            images: uploadedImages,
            keywords: keywords
              .split(",")
              .map((keyword) => keyword.trim())
              .filter(Boolean),
            attributes: listing.attributes ?? {},
            variants: variants.map((variant) => ({
              sku: variant.sku.trim(),
              size: variant.size.trim(),
              color: variant.color.trim(),
              price: Number(variant.price),
              stock: Number(variant.stock),
            })),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to save listing."
        );
      }

      setMessage(
        `Listing submitted successfully! Product ID: ${data.productId}. Status: ${data.status}`
      );

      setListing(null);
      setFiles([]);
      setPreviewUrls([]);
      setUploadedImages([]);
      setTitle("");
      setDescription("");
      setCategory("");
      setBrand("");
      setPrice("");
      setStock("");
      setKeywords("");
      setVariants([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save listing."
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-600">Checking login...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-xl rounded-xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold">
            ANJIVO AI Listing Studio
          </h1>
          <p className="mt-3 text-gray-600">
            Listing generate karne ke liye pehle seller account se login karein.
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            ANJIVO Seller Center
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            AI Listing Studio
          </h1>

          <p className="mt-2 text-gray-600">
            Upload product photos, generate AI details, edit and submit your listing.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Image upload */}
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              1. Upload Product Images
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Maximum 10 images, 10 MB per image.
            </p>

            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-500">
              <span className="text-4xl">📷</span>
              <span className="mt-3 font-semibold">
                Select Product Photos
              </span>
              <span className="mt-1 text-sm text-gray-500">
                JPG, PNG or WebP
              </span>

              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {previewUrls.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {previewUrls.map((url, index) => (
                  <div
                    key={url}
                    className="overflow-hidden rounded-lg border"
                  >
                    <img
                      src={url}
                      alt={`Product ${index + 1}`}
                      className="h-36 w-full object-contain bg-gray-50"
                    />
                    <p className="truncate p-2 text-xs text-gray-500">
                      {files[index]?.name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium">
                Product Name (optional)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Men's Cotton T-Shirt"
                className="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">
                Category (optional)
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Men's Clothing"
                className="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">
                Brand (optional)
              </label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Enter actual brand"
                className="w-full rounded-lg border p-3 outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={generateAIListing}
              disabled={loading || files.length === 0}
              className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {loading
                ? "Generating AI Listing..."
                : "Generate AI Listing"}
            </button>
          </section>

          {/* Listing review */}
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              2. Review Product Details
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              AI output ko check aur edit karna zaroori hai.
            </p>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium">
                Product Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="Product title"
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full rounded-lg border p-3"
                placeholder="Product description"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Selling Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter price"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Available Stock
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="Enter stock"
                  className="w-full rounded-lg border p-3"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">
                Keywords (comma separated)
              </label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="fashion, cotton, casual wear"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div className="mt-6 border-t pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Product Variants
                </h3>

                <button
                  onClick={addVariant}
                  type="button"
                  className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  + Add Variant
                </button>
              </div>

              {variants.length === 0 && (
                <p className="mt-3 text-sm text-gray-500">
                  No variants. Add size, color or other options if required.
                </p>
              )}

              {variants.map((variant, index) => (
                <div
                  key={index}
                  className="mt-4 rounded-xl border p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-medium">
                      Variant {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="text-sm text-red-600"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={variant.sku}
                      onChange={(e) =>
                        updateVariant(index, "sku", e.target.value)
                      }
                      placeholder="SKU"
                      className="rounded-lg border p-2"
                    />

                    <input
                      value={variant.size}
                      onChange={(e) =>
                        updateVariant(index, "size", e.target.value)
                      }
                      placeholder="Size"
                      className="rounded-lg border p-2"
                    />

                    <input
                      value={variant.color}
                      onChange={(e) =>
                        updateVariant(index, "color", e.target.value)
                      }
                      placeholder="Color"
                      className="rounded-lg border p-2"
                    />

                    <input
                      type="number"
                      min="0"
                      value={variant.price}
                      onChange={(e) =>
                        updateVariant(index, "price", e.target.value)
                      }
                      placeholder="Price (₹)"
                      className="rounded-lg border p-2"
                    />

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={variant.stock}
                      onChange={(e) =>
                        updateVariant(index, "stock", e.target.value)
                      }
                      placeholder="Stock"
                      className="rounded-lg border p-2"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={confirmListing}
              disabled={saving || !listing}
              className="mt-6 w-full rounded-xl bg-green-600 px-5 py-4 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {saving
                ? "Submitting..."
                : "Confirm & Submit for Review"}
            </button>

            <p className="mt-3 text-xs text-gray-500">
              Listing admin review ke liye submit hogi. Yeh button product ko directly publish nahi karta.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
