
"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

type ImportResult = {
  success?: boolean;
  message?: string;
  error?: string;
  productsProcessed?: number;
  variantsProcessed?: number;
  warning?: string;
  results?: Array<{
    slug: string;
    productId: string;
    action: "created" | "updated";
  }>;
};

export default function CatalogueImportPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function importCatalogue() {
    if (loading) return;

    setLoading(true);
    setResult(null);

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error(
          "Please log in with your ANJIVO admin account first."
        );
      }

      const token = await user.getIdToken();

      const response = await fetch("/api/admin/catalogue-import", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as ImportResult;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error || "Catalogue import failed."
        );
      }

      setResult(payload);
    } catch (error) {
      setResult({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">
          ANJIVO Catalogue Import
        </h1>

        <p className="text-sm text-gray-600">
          Import or update the prepared product catalogue in
          Firestore. Existing products are matched by slug.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border p-5">
        <div>
          <p className="font-medium">Catalogue data</p>
          <p className="text-sm text-gray-600">
            Source: data/catalogue-import.json
          </p>
        </div>

        <div>
          <p className="font-medium">Product images</p>
          <p className="text-sm text-gray-600">
            Source: public/catalogue-import/
          </p>
        </div>

        <p className="text-sm text-amber-700">
          Before importing, verify product photos, category
          mapping, variant prices and physical stock. Some
          quantities may be provisional.
        </p>

        <button
          type="button"
          onClick={importCatalogue}
          disabled={loading}
          className="rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Importing catalogue..."
            : "Import / Update Catalogue"}
        </button>
      </section>

      {result && (
        <section
          aria-live="polite"
          className="space-y-3 rounded-xl border p-5"
        >
          <h2 className="text-lg font-semibold">
            {result.success
              ? "Import completed"
              : "Import failed"}
          </h2>

          {result.message && <p>{result.message}</p>}

          {result.productsProcessed !== undefined && (
            <p>
              Products processed: {result.productsProcessed}
            </p>
          )}

          {result.variantsProcessed !== undefined && (
            <p>
              Variants processed: {result.variantsProcessed}
            </p>
          )}

          {result.error && (
            <p className="text-sm text-red-700">
              {result.error}
            </p>
          )}

          {result.warning && (
            <p className="text-sm text-amber-700">
              {result.warning}
            </p>
          )}

          {result.results && result.results.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Product results</h3>

              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {result.results.map((item) => (
                  <li
                    key={item.productId}
                    className="rounded border p-2"
                  >
                    <p className="font-medium">{item.slug}</p>
                    <p className="text-gray-600">
                      {item.action} · ID: {item.productId}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
