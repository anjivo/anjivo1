"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";

type Listing = {
  title?: string;
  name?: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  subcategory?: string;
  productType?: string;
  brand?: string;
  highlights?: string[];
  keywords?: string[];
  attributes?: Record<string, unknown>;
  attributeValues?: Record<string, unknown>;
  variantOptions?: unknown[];
  seo?: Record<string, unknown>;
  confidence?: number;
  missingInformation?: string[];
  warnings?: string[];
  [key: string]: unknown;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-blue-500";

export default function SellerAIListingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const [listing, setListing] = useState<Listing | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function selectFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);

    if (!selected.length) return;

    if (
      selected.length > 10 ||
      selected.some(
        (f) =>
          !f.type.startsWith("image/") ||
          f.size > 10 * 1024 * 1024
      )
    ) {
      setError(
        "Maximum 10 photos, each image up to 10 MB. Please select valid image files."
      );
      return;
    }

    setFiles(selected);

    setPreviews(
      selected.map((f) => URL.createObjectURL(f))
    );

    setSourceUrls([]);
    setImages([]);
    setListing(null);
    setStatus("");
    setError("");
  }

  async function getToken() {
    if (!user) {
      throw new Error(
        "Please login to your seller account."
      );
    }

    return user.getIdToken();
  }

  async function uploadOriginals(): Promise<string[]> {
    if (sourceUrls.length) return sourceUrls;

    const urls: string[] = [];

    for (const file of files) {
      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const objectRef = ref(
        storage,
        `ai-listings/${user!.uid}/${Date.now()}-${safeName}`
      );

      await uploadBytes(objectRef, file, {
        contentType: file.type,
      });

      urls.push(await getDownloadURL(objectRef));
    }

    setSourceUrls(urls);

    return urls;
  }

  async function generate() {
    setBusy(true);
    setError("");
    setStatus("Uploading product photos...");

    try {
      const token = await getToken();

      const originals = await uploadOriginals();

      setStatus(
        "AI is identifying your product and preparing listing details..."
      );

      const response = await fetch(
        "/api/ai/generate-listing",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            images: originals,
            language: "English",
            marketplace: "ANJIVO",
            generateSEO: true,
            generateAttributes: true,
            generateHighlights: true,
            generateKeywords: true,
            generateVariants: true,
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.listing
      ) {
        throw new Error(
          data.error ||
            "AI listing generation failed."
        );
      }

      const generated: Listing = data.listing;

      setListing(generated);

      setTitle(
        String(
          generated.title ||
            generated.name ||
            ""
        )
      );

      setDescription(
        String(generated.description || "")
      );

      setImages(originals);

      // Automatically create a catalog-ready
      // white-background image from the first original photo.

      setStatus(
        "Generating a clean product catalog image..."
      );

      try {
        const imageResponse = await fetch(
          "/api/ai/generate-images",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              draft: true,
              imageUrl: originals[0],
              productName: String(
                generated.title ||
                  generated.name ||
                  "Product"
              ),
              scene: "white_background",
            }),
          }
        );

        const imageData =
          await imageResponse.json();

        if (
          imageResponse.ok &&
          imageData.success &&
          typeof imageData.image === "string" &&
          imageData.image.startsWith("data:image/")
        ) {
          const blob = await (
            await fetch(imageData.image)
          ).blob();

          const generatedRef = ref(
            storage,
            `ai-listings/${user!.uid}/generated-${Date.now()}-white-background.jpg`
          );

          await uploadBytes(
            generatedRef,
            blob,
            {
              contentType: "image/jpeg",
            }
          );

          const generatedUrl =
            await getDownloadURL(generatedRef);

          setImages((prev) => [
            ...prev,
            generatedUrl,
          ]);
        } else {
          setStatus(
            "Listing details generated. AI image generation was unavailable; original photos are retained."
          );
        }
      } catch {
        setStatus(
          "Listing details generated. AI image generation failed; original photos are retained."
        );
      }

      setStatus(
        "AI listing is ready. Check the generated details, enter price and stock, then confirm."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to generate listing."
      );

      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmListing() {
    if (!listing) return;

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (!title.trim() || !description.trim()) {
      return setError(
        "Please confirm the product title and description."
      );
    }

    if (
      !price.trim() ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0
    ) {
      return setError(
        "Enter the actual selling price."
      );
    }

    if (
      !stock.trim() ||
      !Number.isInteger(parsedStock) ||
      parsedStock < 0
    ) {
      return setError(
        "Enter the actual available stock quantity."
      );
    }

    if (!images.length) {
      return setError(
        "At least one product image is required."
      );
    }

    setSaving(true);
    setError("");

    setStatus(
      "Submitting listing for ANJIVO review..."
    );

    try {
      const token = await getToken();

      const keywords = Array.isArray(
        listing.keywords
      )
        ? listing.keywords.filter(
            (x): x is string =>
              typeof x === "string"
          )
        : [];

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
              ...listing,

              title: title.trim(),
              name: title.trim(),
              description: description.trim(),

              shortDescription: String(
                listing.shortDescription ||
                  description
              ).trim(),

              category: String(
                listing.category || ""
              ),

              subcategory: String(
                listing.subcategory || ""
              ),

              productType: String(
                listing.productType || ""
              ),

              brand: String(
                listing.brand || ""
              ),

              price: parsedPrice,
              stock: parsedStock,

              images,
              imageUrls: images,

              keywords,

              highlights: Array.isArray(
                listing.highlights
              )
                ? listing.highlights
                : [],

              attributes:
                listing.attributes &&
                typeof listing.attributes ===
                  "object"
                  ? listing.attributes
                  : {},

              seo:
                listing.seo &&
                typeof listing.seo === "object"
                  ? listing.seo
                  : {},
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Could not submit listing."
        );
      }

      setStatus(
        `Listing submitted successfully. Product ID: ${
          data.productId || "created"
        }. Status: ${
          data.status || "pending review"
        }.`
      );

      setListing(null);
      setFiles([]);
      setPreviews([]);
      setSourceUrls([]);
      setImages([]);

      setTitle("");
      setDescription("");
      setPrice("");
      setStock("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to submit listing."
      );

      setStatus("");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen p-8">
        Checking seller login...
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
            Please login with your seller account
            to create a listing.
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
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            ANJIVO Seller Center
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            AI Listing Studio
          </h1>

          <p className="mt-2 text-gray-600">
            Product ki photos upload karein. AI
            title, description, category, keywords,
            SEO aur catalog image banayega. Aapko
            sirf details confirm karke price aur
            stock bharna hai.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {status && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
            {status}
          </div>
        )}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            1. Product photos
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            1–10 clear photos, maximum 10 MB each.
            Front, back and close-up photos help AI
            identify the product.
          </p>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-blue-500">
            <span className="text-4xl">
              📷
            </span>

            <span className="mt-3 font-semibold">
              Select product photos
            </span>

            <span className="mt-1 text-sm text-gray-500">
              JPG, PNG or WebP
            </span>

            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={selectFiles}
            />
          </label>

          {previews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {previews.map((url, i) => (
                <div
                  key={url}
                  className="overflow-hidden rounded-lg border"
                >
                  <img
                    src={url}
                    alt={`Product photo ${i + 1}`}
                    className="h-36 w-full bg-gray-50 object-contain"
                  />

                  <p className="truncate p-2 text-xs text-gray-500">
                    {files[i]?.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={generate}
            disabled={busy || !files.length}
            className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-4 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {busy
              ? "AI is working..."
              : listing
                ? "Regenerate AI listing"
                : "Generate listing automatically"}
          </button>
        </section>

        {listing && (
          <section className="mt-6 space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold">
                2. Review and confirm AI details
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                AI suggestions ko verify karein.
                Photo se confirm na hone wali details
                ko fact na samjhein.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="overflow-hidden rounded-lg border"
                >
                  <img
                    src={url}
                    alt={`Listing image ${i + 1}`}
                    className="h-56 w-full bg-gray-50 object-contain"
                  />

                  <p className="p-2 text-xs text-gray-500">
                    {i < sourceUrls.length
                      ? "Original product photo"
                      : "AI-generated catalog photo"}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                AI Product Title
              </label>

              <input
                className={inputClass}
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  Category
                </p>

                <p className="font-medium">
                  {String(
                    listing.category ||
                      "Needs confirmation"
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  Subcategory
                </p>

                <p className="font-medium">
                  {String(
                    listing.subcategory || "—"
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  Product type
                </p>

                <p className="font-medium">
                  {String(
                    listing.productType || "—"
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Product description
              </label>

              <textarea
                className={inputClass}
                rows={5}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
              />
            </div>

            {Array.isArray(listing.highlights) &&
              listing.highlights.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">
                    Key highlights
                  </h3>

                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {listing.highlights.map(
                      (x, i) => (
                        <li key={i}>{x}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

            {listing.attributes && (
              <div>
                <h3 className="mb-2 font-semibold">
                  AI-identified attributes (verify
                  before publishing)
                </h3>

                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(
                    listing.attributes
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-lg bg-gray-50 p-3 text-sm"
                    >
                      <span className="font-medium">
                        {k}:{" "}
                      </span>

                      {typeof v === "string" ||
                      typeof v === "number"
                        ? String(v)
                        : JSON.stringify(v)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {listing.seo && (
              <div>
                <h3 className="mb-2 font-semibold">
                  SEO preview
                </h3>

                <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
                  {Object.entries(
                    listing.seo
                  )
                    .filter(([k]) =>
                      [
                        "metaTitle",
                        "metaDescription",
                        "slug",
                        "primaryKeyword",
                        "secondaryKeywords",
                        "tags",
                        "searchTerms",
                      ].includes(k)
                    )
                    .map(([k, v]) => (
                      <p key={k}>
                        <span className="font-medium">
                          {k}:{" "}
                        </span>

                        {Array.isArray(v)
                          ? v.join(", ")
                          : String(v ?? "")}
                      </p>
                    ))}
                </div>
              </div>
            )}

            {Array.isArray(
              listing.missingInformation
            ) &&
              listing.missingInformation.length >
                0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold text-amber-900">
                    Seller confirmation needed
                  </h3>

                  <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                    {listing.missingInformation.map(
                      (x, i) => (
                        <li key={i}>{x}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

            {Array.isArray(listing.warnings) &&
              listing.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {listing.warnings.map(
                    (x, i) => (
                      <p key={i}>• {x}</p>
                    )
                  )}
                </div>
              )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Actual selling price (₹) —
                  required
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value)
                  }
                  placeholder="Enter your selling price"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Available stock — required
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={stock}
                  onChange={(e) =>
                    setStock(e.target.value)
                  }
                  placeholder="Enter available quantity"
                />
              </div>
            </div>

            <button
              onClick={confirmListing}
              disabled={saving}
              className="w-full rounded-xl bg-green-600 px-5 py-4 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              {saving
                ? "Submitting..."
                : "Confirm & Submit Listing"}
            </button>

            <p className="text-xs text-gray-500">
              Price, stock, brand, exact material,
              tax/HSN and compliance details are
              not guessed by AI. Confirm them from
              actual product and business records.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
