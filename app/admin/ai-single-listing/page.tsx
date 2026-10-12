
"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { auth, storage } from "@/lib/firebase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type GeneratedListing = {
  title?: string;
  name?: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  subcategory?: string;
  productType?: string;
  brand?: string;
  keywords?: string[];
  highlights?: string[];
  attributes?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  warnings?: string[];
  images?: string[];
  [key: string]: unknown;
};

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 12 * 1024 * 1024;

export default function AdminAISingleListingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [listing, setListing] =
    useState<GeneratedListing | null>(null);

  const [sellingPrice, setSellingPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [stock, setStock] = useState("");
  const [sizes, setSizes] = useState("");
  const [sku, setSku] = useState("");
  const [language, setLanguage] = useState("English");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function updateListing(field: string, value: unknown) {
    setListing((current) =>
      current ? { ...current, [field]: value } : current
    );
  }

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);

    setError("");
    setMessage("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!selected.length) return;

    if (selected.length > MAX_IMAGES) {
      setError(
        `Ek product ke liye maximum ${MAX_IMAGES} photos select karein.`
      );
      event.target.value = "";
      return;
    }

    const invalid = selected.find(
      (file) =>
        !allowedTypes.includes(file.type) ||
        file.size > MAX_FILE_SIZE
    );

    if (invalid) {
      setError(
        "Sirf JPG, PNG ya WebP images allowed hain. Har image 12 MB se chhoti honi chahiye."
      );
      event.target.value = "";
      return;
    }

    setPreviews(
      selected.map((file) => URL.createObjectURL(file))
    );
    setFiles(selected);
    setListing(null);

    // Reset optional price and stock values for a new product.
    setSellingPrice("");
    setWholesalePrice("");
    setMrp("");
    setStock("");
    setSizes("");
    setSku("");
  }

  /**
   * Always fetch a fresh Firebase ID token.
   * The backend must verify this token using Firebase Admin.
   */
  async function getToken(): Promise<string> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Login session nahi mila. Dobara login karein."
      );
    }

    try {
      return await currentUser.getIdToken(true);
    } catch (err) {
      console.error("Firebase ID token refresh failed:", err);

      throw new Error(
        "Login session refresh nahi ho paya. Logout karke dobara login karein."
      );
    }
  }

  async function readApiResponse(response: Response) {
    const text = await response.text();

    let data: Record<string, unknown>;

    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Server ne valid JSON response nahi diya (HTTP ${response.status}).`
      );
    }

    if (!response.ok || data.success !== true) {
      const apiError =
        typeof data.error === "string"
          ? data.error
          : `Request failed (HTTP ${response.status}).`;

      throw new Error(apiError);
    }

    return data;
  }

  async function uploadImages(): Promise<string[]> {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("Admin login required.");
    }

    setUploading(true);

    try {
      const urls: string[] = [];

      for (const file of files) {
        // Confirm the session is still active for each upload.
        if (!auth.currentUser) {
          throw new Error("Login session expire ho gaya.");
        }

        const safeName = file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const imageRef = ref(
          storage,
          `ai-listings/admin/${currentUser.uid}/${Date.now()}-${safeName}`
        );

        await uploadBytes(imageRef, file, {
          contentType: file.type,
        });

        urls.push(await getDownloadURL(imageRef));
      }

      return urls;
    } catch (err) {
      console.error("AI listing image upload failed:", err);

      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "storage/unauthorized"
      ) {
        throw new Error(
          "Image upload permission denied. Firebase Storage Rules aur login UID check karein."
        );
      }

      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function generateListing() {
    setError("");
    setMessage("");

    if (!auth.currentUser) {
      setError("Admin account se login karein.");
      return;
    }

    if (!files.length) {
      setError("Pehle product ki photo upload karein.");
      return;
    }

    setGenerating(true);

    try {
      // Refresh token before uploading or calling the API.
      const token = await getToken();
      const imageUrls = await uploadImages();

      const response = await fetch("/api/ai/generate-listing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          images: imageUrls,
          language,
          generateSEO: true,
          generateAttributes: true,
          generateHighlights: true,
          generateKeywords: true,
          generateVariants: false,
        }),
      });

      const data = await readApiResponse(response);
      const generated = data.listing as GeneratedListing | undefined;

      if (!generated || typeof generated !== "object") {
        throw new Error(
          "API response mein generated listing nahi mili."
        );
      }

      setListing({
        ...generated,
        title: generated.title || generated.name || "",
        category: generated.category || "",
        brand: generated.brand || "",
        description: generated.description || "",
        shortDescription: generated.shortDescription || "",
        images: imageUrls,
      });

      setMessage(
        "AI details generate ho gayi hain. Save karne se pehle sabhi fields check karein."
      );
    } catch (err) {
      console.error("AI listing generation failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Listing generate karte waqt error aaya."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function saveListing(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!auth.currentUser || !listing) {
      setError("Pehle AI listing generate karein.");
      return;
    }

    const price = Number(sellingPrice);
    const quantity = Number(stock);

    const wholesale = wholesalePrice.trim()
      ? Number(wholesalePrice)
      : null;

    const maximumRetailPrice = mrp.trim()
      ? Number(mrp)
      : null;

    if (
      sellingPrice.trim() === "" ||
      stock.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      setError(
        "Valid selling price aur stock quantity enter karein."
      );
      return;
    }

    if (
      wholesale !== null &&
      (!Number.isFinite(wholesale) || wholesale < 0)
    ) {
      setError("Wholesale price valid nahi hai.");
      return;
    }

    if (
      maximumRetailPrice !== null &&
      (
        !Number.isFinite(maximumRetailPrice) ||
        maximumRetailPrice < 0
      )
    ) {
      setError("MRP valid nahi hai.");
      return;
    }

    if (
      !String(listing.title || "").trim() ||
      !String(listing.description || "").trim() ||
      !String(listing.category || "").trim()
    ) {
      setError(
        "Product title, description aur category required hain."
      );
      return;
    }

    setSaving(true);

    try {
      const token = await getToken();

      const imageUrls = Array.isArray(listing.images)
        ? listing.images.filter(
            (image): image is string =>
              typeof image === "string"
          )
        : [];

      if (!imageUrls.length) {
        throw new Error(
          "Product ki uploaded photos missing hain. Dobara generate karein."
        );
      }

      const response = await fetch("/api/ai/confirm-listing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          listing: {
            ...listing,
            title: String(listing.title).trim(),
            name: String(listing.title).trim(),
            category: String(listing.category).trim(),
            brand: String(listing.brand || "").trim(),
            sellingPrice: price,
            wholesalePrice: wholesale,
            mrp: maximumRetailPrice,
            stock: quantity,
            images: imageUrls,
            imageUrls,
            sku: sku.trim() || undefined,
            attributes: {
              ...(listing.attributes || {}),
              ...(sizes.trim()
                ? { sizes: sizes.trim() }
                : {}),
            },
          },
          confirmation: {
            confirmedFields: [
              "title",
              "description",
              "category",
              "brand",
              "sellingPrice",
              "wholesalePrice",
              "mrp",
              "stock",
              "images",
            ],
            submitForApproval: false,
          },
        }),
      });

      const data = await readApiResponse(response);

      const productId =
        typeof data.productId === "string"
          ? data.productId
          : "unknown";

      const status =
        typeof data.status === "string"
          ? data.status
          : "pending";

      setMessage(
        `Product save ho gaya. Product ID: ${productId}. Status: ${status}. Yeh abhi public website par publish nahi hua hai.`
      );
    } catch (err) {
      console.error("AI listing save failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Product save karte waqt error aaya."
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <main className="p-8">
        Admin login check ho raha hai...
      </main>
    );
  }

  if (!user) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl p-6">
          <h1 className="text-2xl font-bold">
            Admin AI Single Listing
          </h1>
          <p className="mt-3 text-red-600">
            Is page ko use karne ke liye admin account se login karein.
          </p>
          <Link
            href="/admin/login"
            className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-white"
          >
            Admin Login
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">ANJIVO Admin</p>
            <h1 className="text-3xl font-bold">
              AI Single Listing
            </h1>
            <p className="mt-2 text-gray-600">
              Photo upload karein, AI se product details banwayein
              aur price/stock khud confirm karein.
            </p>
          </div>

          <Link
            href="/admin/ai-bulk-listing"
            className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
          >
            AI Bulk Listing →
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800"
          >
            {message}
          </div>
        )}

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">
            1. Product photos
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Ek product ke liye maximum 10 JPG, PNG ya WebP photos.
            Har image maximum 12 MB.
          </p>

          <input
            className="mt-4 block w-full rounded-lg border p-3"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImages}
          />

          {previews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {previews.map((src, index) => (
                <div
                  key={src}
                  className="overflow-hidden rounded-lg border"
                >
                  <img
                    src={src}
                    alt={`Product photo ${index + 1}`}
                    className="h-36 w-full object-contain"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 max-w-xs">
            <label className="mb-1 block text-sm font-medium">
              AI description language
            </label>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="w-full rounded-lg border p-3"
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Hinglish">Hinglish</option>
            </select>
          </div>

          <button
            type="button"
            onClick={generateListing}
            disabled={generating || uploading || files.length === 0}
            className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Photos upload ho rahi hain..."
              : generating
                ? "AI details generate kar raha hai..."
                : "✨ Generate Listing with AI"}
          </button>
        </section>

        {listing && (
          <form
            onSubmit={saveListing}
            className="space-y-6 rounded-xl border bg-white p-5 shadow-sm"
          >
            <div>
              <h2 className="text-xl font-semibold">
                2. Review aur product details
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                AI ke suggestions ko verify aur edit karein.
                Price aur stock AI se automatically decide nahi honge.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Product title"
                value={String(listing.title || "")}
                onChange={(value) => updateListing("title", value)}
                required
              />

              <Field
                label="Category"
                value={String(listing.category || "")}
                onChange={(value) => updateListing("category", value)}
                required
              />

              <Field
                label="Subcategory"
                value={String(listing.subcategory || "")}
                onChange={(value) => updateListing("subcategory", value)}
              />

              <Field
                label="Brand"
                value={String(listing.brand || "")}
                onChange={(value) => updateListing("brand", value)}
              />

              <Field
                label="Selling price (₹)"
                value={sellingPrice}
                onChange={setSellingPrice}
                type="number"
                required
              />

              <Field
                label="Wholesale price (₹)"
                value={wholesalePrice}
                onChange={setWholesalePrice}
                type="number"
              />

              <Field
                label="MRP (₹)"
                value={mrp}
                onChange={setMrp}
                type="number"
              />

              <Field
                label="Total stock quantity"
                value={stock}
                onChange={setStock}
                type="number"
                required
              />

              <Field
                label="Available sizes (e.g. 28, 30, 32)"
                value={sizes}
                onChange={setSizes}
                placeholder="Optional"
              />

              <Field
                label="SKU / product code"
                value={sku}
                onChange={setSku}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Product description
              </label>
              <textarea
                value={String(listing.description || "")}
                onChange={(event) =>
                  updateListing("description", event.target.value)
                }
                rows={6}
                required
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Short description
              </label>
              <textarea
                value={String(listing.shortDescription || "")}
                onChange={(event) =>
                  updateListing(
                    "shortDescription",
                    event.target.value
                  )
                }
                rows={3}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  AI highlights
                </label>
                <textarea
                  value={
                    Array.isArray(listing.highlights)
                      ? listing.highlights.join("\n")
                      : ""
                  }
                  onChange={(event) =>
                    updateListing(
                      "highlights",
                      event.target.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    )
                  }
                  rows={5}
                  placeholder="Har highlight alag line mein"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Search keywords
                </label>
                <textarea
                  value={
                    Array.isArray(listing.keywords)
                      ? listing.keywords.join(", ")
                      : ""
                  }
                  onChange={(event) =>
                    updateListing(
                      "keywords",
                      event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    )
                  }
                  rows={5}
                  placeholder="jeans, black jeans, baggy jeans"
                  className="w-full rounded-lg border p-3"
                />
              </div>
            </div>

            {Array.isArray(listing.warnings) &&
              listing.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>AI verification warnings</strong>
                  <ul className="mt-2 list-disc pl-5">
                    {listing.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Product save ho raha hai..." : "Save AI Listing"}
            </button>
          </form>
        )}
      </main>

      <Footer />
    </>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        className="w-full rounded-lg border p-3"
      />
    </div>
  );
}
