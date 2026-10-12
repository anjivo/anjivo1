
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { auth, storage } from "@/lib/firebase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type Listing = {
  title?: string;
  name?: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  keywords?: unknown[];
  highlights?: unknown[];
  attributes?: Record<string, unknown>;
  seo?: Record<string, unknown>;
};

type ProductStatus =
  | "waiting"
  | "uploading"
  | "ready"
  | "generating"
  | "generated"
  | "failed"
  | "saved";

type ProductRow = {
  id: string;
  file: File;
  preview: string;
  imageUrl?: string;
  title: string;
  description: string;
  category: string;
  brand: string;
  sellingPrice: string;
  wholesalePrice: string;
  mrp: string;
  stock: string;
  sizes: string;
  sku: string;
  keywords: string[];
  highlights: string[];
  attributes: Record<string, unknown>;
  seo: Record<string, unknown>;
  status: ProductStatus;
  error?: string;
  selected: boolean;
};

type BulkResult = {
  index: number;
  productId?: string;
  success: boolean;
  listing?: Listing;
  error?: string;
};

const MAX_FILES = 100;
const MAX_FILE_SIZE = 12 * 1024 * 1024;
const BATCH_SIZE = 10;

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function createId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is string | number =>
        typeof item === "string" ||
        typeof item === "number"
    )
    .map(String)
    .filter(Boolean);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export default function AdminAIBulkListingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rows, setRows] = useState<ProductRow[]>([]);

  const [categoryMode, setCategoryMode] = useState("auto");
  const [brandHint, setBrandHint] = useState("");
  const [language, setLanguage] = useState("English");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
  const rowsRef = useRef<ProductRow[]>([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      rowsRef.current.forEach((row) => {
        URL.revokeObjectURL(row.preview);
      });
    };
  }, []);

  const selectedCount = useMemo(
    () =>
      rows.filter(
        (row) => row.selected && row.status !== "saved"
      ).length,
    [rows]
  );

  const generatedCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.status === "generated" ||
          row.status === "saved"
      ).length,
    [rows]
  );

  const failedCount = useMemo(
    () => rows.filter((row) => row.status === "failed").length,
    [rows]
  );

  const generatedSelectedCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.selected && row.status === "generated"
      ).length,
    [rows]
  );

  const patchRow = useCallback(
    (id: string, patch: Partial<ProductRow>) => {
      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, ...patch } : row
        )
      );
    },
    []
  );

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    setError("");
    setMessage("");

    if (!files.length) return;

    const available = MAX_FILES - rows.length;

    if (available <= 0) {
      setError(`Maximum ${MAX_FILES} photos allowed hain.`);
      event.target.value = "";
      return;
    }

    const selected = files.slice(0, available);

    const invalid = selected.find(
      (file) =>
        !ACCEPTED_TYPES.includes(file.type) ||
        file.size > MAX_FILE_SIZE
    );

    if (invalid) {
      setError(
        "Sirf JPG, PNG, WebP aur maximum 12 MB per image allowed hai."
      );
      event.target.value = "";
      return;
    }

    const added: ProductRow[] = selected.map((file) => ({
      id: createId(),
      file,
      preview: URL.createObjectURL(file),
      title: file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]+/g, " "),
      description: "",
      category: categoryMode === "auto" ? "" : categoryMode,
      brand: brandHint,
      sellingPrice: "",
      wholesalePrice: "",
      mrp: "",
      stock: "",
      sizes: "",
      sku: "",
      keywords: [],
      highlights: [],
      attributes: {},
      seo: {},
      status: "waiting",
      selected: true,
    }));

    setRows((current) => [...current, ...added]);

    if (files.length > available) {
      setError(
        `Ek baar mein maximum ${MAX_FILES} photos add kar sakte hain.`
      );
    }

    event.target.value = "";
  }

  async function uploadPending(): Promise<Record<string, string>> {
    if (!user) {
      throw new Error("Admin login required.");
    }

    const pending = rowsRef.current.filter(
      (row) =>
        row.selected &&
        !row.imageUrl &&
        row.status !== "saved"
    );

    const uploaded: Record<string, string> = {};
    let completed = 0;

    for (const row of pending) {
      patchRow(row.id, {
        status: "uploading",
        error: undefined,
      });

      try {
        const safeName = row.file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const storageRef = ref(
          storage,
          `ai-listings/${user.uid}/${row.id}/${Date.now()}-${safeName}`
        );

        await uploadBytes(storageRef, row.file, {
          contentType: row.file.type,
          customMetadata: {
            uploadedBy: user.uid,
            source: "admin-ai-bulk-listing",
          },
        });

        const imageUrl = await getDownloadURL(storageRef);

        uploaded[row.id] = imageUrl;

        patchRow(row.id, {
          imageUrl,
          status: "ready",
          error: undefined,
        });
      } catch (uploadError) {
        patchRow(row.id, {
          status: "failed",
          error: getErrorMessage(uploadError),
        });
      }

      completed++;

      setProgress(
        Math.round(
          (completed / Math.max(1, pending.length)) * 30
        )
      );
    }

    return uploaded;
  }

  async function generateSelected() {
    setError("");
    setMessage("");

    if (!user) {
      setError("Admin login required.");
      return;
    }

    const targets = rowsRef.current.filter(
      (row) => row.selected && row.status !== "saved"
    );

    if (!targets.length) {
      setError("Pehle products select karein.");
      return;
    }

    setBusy(true);
    setProgress(0);

    try {
      const uploaded = await uploadPending();

      const currentRows = rowsRef.current;

      const readyRows = currentRows
        .filter(
          (row) =>
            row.selected &&
            row.status !== "saved" &&
            Boolean(row.imageUrl || uploaded[row.id])
        )
        .map((row) => ({
          ...row,
          imageUrl: row.imageUrl || uploaded[row.id],
        }));

      if (!readyRows.length) {
        throw new Error(
          "Koi photo upload nahi hui. Firebase Storage permissions check karein."
        );
      }

      const token = await user.getIdToken();

      let processed = 0;
      let successful = 0;
      let failed = 0;

      for (
        let start = 0;
        start < readyRows.length;
        start += BATCH_SIZE
      ) {
        const chunk = readyRows.slice(
          start,
          start + BATCH_SIZE
        );

        chunk.forEach((row) => {
          patchRow(row.id, {
            status: "generating",
            imageUrl: row.imageUrl,
            error: undefined,
          });
        });

        const response = await fetch("/api/ai/bulk-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            products: chunk.map((row) => ({
              id: row.id,
              images: [row.imageUrl!],
              productName: row.title || undefined,
              category:
                categoryMode === "auto"
                  ? undefined
                  : row.category || categoryMode,
              brand: row.brand || brandHint || undefined,
              language,
              generateSEO: true,
              generateAttributes: true,
              generateHighlights: true,
              generateKeywords: true,
              generateVariants: false,
            })),
            generateSEO: true,
            generateAttributes: true,
            generateHighlights: true,
            generateKeywords: true,
            generateVariants: false,
          }),
        });

        const payload = await response.json();

        if (!response.ok || !Array.isArray(payload.results)) {
          const apiError =
            typeof payload.error === "string"
              ? payload.error
              : "AI generation request failed.";

          throw new Error(apiError);
        }

        const results = payload.results as BulkResult[];
        const processedIds = new Set<string>();

        for (const result of results) {
          const row =
            chunk.find((item) => item.id === result.productId) ??
            chunk[result.index];

          if (!row) continue;

          processedIds.add(row.id);

          if (result.success && result.listing) {
            const listing = result.listing;

            patchRow(row.id, {
              imageUrl: row.imageUrl,
              title: String(
                listing.title || listing.name || row.title
              ),
              description: String(listing.description || ""),
              category: String(
                listing.category || row.category || ""
              ),
              brand: String(listing.brand || row.brand || ""),
              keywords: toStringArray(listing.keywords),
              highlights: toStringArray(listing.highlights),
              attributes:
                listing.attributes &&
                typeof listing.attributes === "object"
                  ? listing.attributes
                  : {},
              seo:
                listing.seo &&
                typeof listing.seo === "object"
                  ? listing.seo
                  : {},
              status: "generated",
              error: undefined,
            });

            successful++;
          } else {
            patchRow(row.id, {
              status: "failed",
              error: result.error || "AI generation failed.",
            });

            failed++;
          }

          processed++;

          setProgress(
            30 +
              Math.round(
                (processed / readyRows.length) * 60
              )
          );
        }

        // Handle any product omitted from the API results.
        for (const row of chunk) {
          if (!processedIds.has(row.id)) {
            patchRow(row.id, {
              status: "failed",
              error: "API response mein is product ka result nahi mila.",
            });

            failed++;
            processed++;
          }
        }

        setProgress(
          30 +
            Math.round(
              (processed / readyRows.length) * 60
            )
        );
      }

      setProgress(100);

      setMessage(
        `AI generation complete: ${successful} successful, ${failed} failed. Save karne se pehle details, price aur stock check karein.`
      );
    } catch (generationError) {
      setError(getErrorMessage(generationError));
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    setError("");
    setMessage("");

    if (!user) {
      setError("Admin login required.");
      return;
    }

    const targets = rowsRef.current.filter(
      (row) => row.selected && row.status === "generated"
    );

    if (!targets.length) {
      setError(
        "Save karne ke liye generated products select karein."
      );
      return;
    }

    for (const row of targets) {
      if (
        !row.title.trim() ||
        !row.description.trim() ||
        !row.category.trim()
      ) {
        setError(
          `${row.title || row.file.name}: title, description aur category required hain.`
        );
        return;
      }

      const price = optionalNumber(row.sellingPrice);
      const stock = optionalNumber(row.stock);
      const wholesalePrice = optionalNumber(row.wholesalePrice);
      const mrp = optionalNumber(row.mrp);

      if (price === undefined || price <= 0) {
        setError(`${row.title}: valid selling price bharein.`);
        return;
      }

      if (
        stock === undefined ||
        !Number.isInteger(stock) ||
        stock < 0
      ) {
        setError(
          `${row.title}: stock 0 ya usse zyada whole number hona chahiye.`
        );
        return;
      }

      if (
        wholesalePrice !== undefined &&
        wholesalePrice < 0
      ) {
        setError(`${row.title}: wholesale price invalid hai.`);
        return;
      }

      if (mrp !== undefined && mrp < 0) {
        setError(`${row.title}: MRP invalid hai.`);
        return;
      }

      if (!row.imageUrl) {
        setError(`${row.title}: product image missing hai.`);
        return;
      }
    }

    setBusy(true);
    setProgress(0);

    try {
      const token = await user.getIdToken();
      let saved = 0;
      const failed: string[] = [];

      for (let index = 0; index < targets.length; index++) {
        const row = targets[index];

        try {
          const attributes: Record<string, unknown> = {
            ...row.attributes,
          };

          if (row.sizes.trim()) {
            attributes.sizes = row.sizes
              .split(",")
              .map((size) => size.trim())
              .filter(Boolean);
          }

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
                  title: row.title.trim(),
                  name: row.title.trim(),
                  description: row.description.trim(),
                  shortDescription:
                    row.description.trim().slice(0, 240),
                  category: row.category.trim(),
                  brand: row.brand.trim(),
                  sellingPrice: Number(row.sellingPrice),
                  price: Number(row.sellingPrice),
                  wholesalePrice: optionalNumber(
                    row.wholesalePrice
                  ),
                  mrp: optionalNumber(row.mrp),
                  stock: Number(row.stock),
                  images: [row.imageUrl],
                  imageUrls: [row.imageUrl],
                  sku: row.sku.trim() || undefined,
                  keywords: row.keywords,
                  highlights: row.highlights,
                  attributes,
                  seo: row.seo,
                  variants: [],
                },
                confirmation: {
                  submitForApproval: false,
                  confirmedFields: [
                    "title",
                    "description",
                    "category",
                    "sellingPrice",
                    "stock",
                    "images",
                  ],
                },
              }),
            }
          );

          const payload = await response.json();

          if (!response.ok || !payload.success) {
            throw new Error(
              payload.error || "Product save failed."
            );
          }

          saved++;

          patchRow(row.id, {
            status: "saved",
            selected: false,
            error: undefined,
          });
        } catch (saveError) {
          const reason = getErrorMessage(saveError);

          failed.push(`${row.title}: ${reason}`);

          patchRow(row.id, {
            error: reason,
          });
        }

        setProgress(
          Math.round(((index + 1) / targets.length) * 100)
        );
      }

      setMessage(
        `${saved} products save ho gaye. ${failed.length} products mein error aaya.`
      );

      if (failed.length) {
        setError(failed.join(" | "));
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  function removeRow(id: string) {
    const row = rowsRef.current.find((item) => item.id === id);

    if (row) {
      URL.revokeObjectURL(row.preview);
    }

    setRows((current) =>
      current.filter((item) => item.id !== id)
    );
  }

  function updateField(
    id: string,
    field: keyof ProductRow,
    value: string
  ) {
    patchRow(id, { [field]: value } as Partial<ProductRow>);
  }

  if (authLoading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl p-8">
          Admin session check ho raha hai...
        </main>
        <Footer />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-2xl font-bold">
            Admin login required
          </h1>

          <p className="mt-2 text-gray-600">
            AI Bulk Listing use karne ke liye login karein.
          </p>

          <Link
            href="/login?redirect=/admin/ai-bulk-listing"
            className="mt-4 inline-block text-blue-700 underline"
          >
            Login karein
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-sm text-blue-700 hover:underline"
            >
              ← Admin dashboard
            </Link>

            <h1 className="mt-2 text-3xl font-bold">
              AI Bulk Listing
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Multiple product photos upload karein. AI product
              details generate karega. Price aur stock verify
              karke products save karein.
            </p>
          </div>

          <Link
            href="/admin/ai-single-listing"
            className="rounded-lg border px-4 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            AI Single Listing →
          </Link>
        </div>

        <section className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm md:grid-cols-3">
          <div>
            <label
              htmlFor="bulk-category"
              className="mb-1 block text-sm font-semibold"
            >
              Category
            </label>

            <select
              id="bulk-category"
              value={categoryMode}
              onChange={(event) =>
                setCategoryMode(event.target.value)
              }
              className="w-full rounded-lg border px-3 py-2.5"
              disabled={busy}
            >
              <option value="auto">AI detect kare</option>
              <option value="Clothing">Clothing</option>
              <option value="Footwear">Footwear</option>
              <option value="Cosmetics">Cosmetics</option>
              <option value="Electronics">Electronics</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="bulk-brand"
              className="mb-1 block text-sm font-semibold"
            >
              Brand hint (optional)
            </label>

            <input
              id="bulk-brand"
              value={brandHint}
              onChange={(event) =>
                setBrandHint(event.target.value)
              }
              placeholder="Brand name"
              className="w-full rounded-lg border px-3 py-2.5"
              disabled={busy}
            />
          </div>

          <div>
            <label
              htmlFor="bulk-language"
              className="mb-1 block text-sm font-semibold"
            >
              Description language
            </label>

            <select
              id="bulk-language"
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value)
              }
              className="w-full rounded-lg border px-3 py-2.5"
              disabled={busy}
            >
              <option>English</option>
              <option>Hindi</option>
              <option>Hinglish</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 md:col-span-3">
            <div>
              <p className="font-semibold">
                {rows.length}/{MAX_FILES} photos
              </p>

              <p className="text-xs text-gray-500">
                1 photo = 1 product · JPG, PNG, WebP · Maximum
                12 MB per photo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={addFiles}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy || rows.length >= MAX_FILES}
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                + Photos select karein
              </button>

              <button
                type="button"
                onClick={generateSelected}
                disabled={
                  busy ||
                  !rows.some(
                    (row) =>
                      row.selected && row.status !== "saved"
                  )
                }
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Processing..." : "Upload + AI Generate"}
              </button>
            </div>
          </div>
        </section>

        {(busy || progress > 0) && (
          <section className="rounded-xl border bg-blue-50 p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">
                Processing progress
              </span>
              <span>{progress}%</span>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-blue-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full bg-blue-700 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>
        )}

        {message && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <section className="rounded-2xl border-2 border-dashed bg-gray-50 px-6 py-16 text-center">
            <div className="text-4xl">🖼️</div>

            <h2 className="mt-3 text-lg font-bold">
              Abhi koi product photo nahi hai
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Multiple product photos select karke shuru karein.
            </p>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-4 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Photos select karein
            </button>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {selectedCount} selected · {generatedCount}{" "}
                generated/saved · {failedCount} failed
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) =>
                      current.map((row) => ({
                        ...row,
                        selected: row.status !== "saved",
                      }))
                    )
                  }
                  disabled={busy}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                >
                  Select all unsaved
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRows((current) =>
                      current.map((row) => ({
                        ...row,
                        selected: false,
                      }))
                    )
                  }
                  disabled={busy}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                >
                  Deselect all
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {rows.map((row, index) => (
                <article
                  key={row.id}
                  className="rounded-2xl border bg-white p-4 shadow-sm"
                >
                  <div className="grid gap-4 md:grid-cols-[130px_minmax(0,1fr)]">
                    <div>
                      <img
                        src={row.preview}
                        alt={row.title || "Product preview"}
                        className="aspect-[3/4] w-full rounded-xl border bg-gray-50 object-contain"
                      />

                      <label className="mt-3 flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={busy || row.status === "saved"}
                          onChange={(event) =>
                            patchRow(row.id, {
                              selected: event.target.checked,
                            })
                          }
                        />
                        Select product
                      </label>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeRow(row.id)}
                        className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>

                      <p className="mt-2 break-all text-[11px] text-gray-400">
                        {row.file.name}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-bold">
                          Product {index + 1}
                        </h2>

                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">
                          {row.status}
                        </span>
                      </div>

                      {row.error && (
                        <p className="mb-3 break-words rounded bg-red-50 p-2 text-xs text-red-700">
                          {row.error}
                        </p>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <Field
                          label="Product title *"
                          value={row.title}
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(row.id, "title", value)
                          }
                        />

                        <Field
                          label="Category *"
                          value={row.category}
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(row.id, "category", value)
                          }
                        />

                        <Field
                          label="Brand"
                          value={row.brand}
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(row.id, "brand", value)
                          }
                        />

                        <Field
                          label="Selling price (₹) *"
                          value={row.sellingPrice}
                          type="number"
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(
                              row.id,
                              "sellingPrice",
                              value
                            )
                          }
                        />

                        <Field
                          label="Stock quantity *"
                          value={row.stock}
                          type="number"
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(row.id, "stock", value)
                          }
                        />

                        <Field
                          label="Wholesale price (₹)"
                          value={row.wholesalePrice}
                          type="number"
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(
                              row.id,
                              "wholesalePrice",
                              value
                            )
                          }
                        />

                        <Field
                          label="MRP (₹)"
                          value={row.mrp}
                          type="number"
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(row.id, "mrp", value)
                          }
                        />

                        <Field
                          label="Sizes (comma separated)"
                          value={row.sizes}
                          disabled={busy || row.status === "saved"}
                          placeholder="28, 30, 32"
                          onChange={(value) =>
                            updateField(row.id, "sizes", value)
                          }
                        />

                        <Field
                          label="SKU (optional)"
                          value={row.sku}
                          disabled={busy || row.status === "saved"}
                          onChange={(value) =>
                            updateField(row.id, "sku", value)
                          }
                        />
                      </div>

                      <label className="mb-1 mt-3 block text-xs font-semibold text-gray-600">
                        Description *
                      </label>

                      <textarea
                        rows={4}
                        value={row.description}
                        disabled={busy || row.status === "saved"}
                        onChange={(event) =>
                          patchRow(row.id, {
                            description: event.target.value,
                          })
                        }
                        className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                      />

                      {row.keywords.length > 0 && (
                        <p className="mt-2 break-words text-xs text-gray-500">
                          <strong>AI keywords:</strong>{" "}
                          {row.keywords.join(", ")}
                        </p>
                      )}

                      {row.highlights.length > 0 && (
                        <p className="mt-1 break-words text-xs text-gray-500">
                          <strong>Highlights:</strong>{" "}
                          {row.highlights.join(" · ")}
                        </p>
                      )}

                      {row.status === "failed" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            patchRow(row.id, {
                              status: row.imageUrl
                                ? "ready"
                                : "waiting",
                              error: undefined,
                              selected: true,
                            })
                          }
                          className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          Retry this product
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <section className="sticky bottom-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur">
              <div>
                <p className="font-bold">
                  {generatedSelectedCount} generated products selected
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Save karne se pehle selling price, stock aur
                  product details check karein.
                </p>
              </div>

              <button
                type="button"
                onClick={saveSelected}
                disabled={busy || generatedSelectedCount === 0}
                className="rounded-lg bg-green-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Please wait..." : "Save selected products"}
              </button>
            </section>
          </>
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
  disabled?: boolean;
  placeholder?: string;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder,
}: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">
        {label}
      </label>

      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
      />
    </div>
  );
}
