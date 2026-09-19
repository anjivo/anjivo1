"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

import {
  deleteSellerProduct,
  getSellerProducts,
  updateSellerStock,
} from "@/lib/seller-products";

import type { Product } from "@/types/product";

export default function SellerProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stockValues, setStockValues] = useState<
    Record<string, string>
  >({});

  const [updatingStock, setUpdatingStock] =
    useState<string | null>(null);

  const [deletingProduct, setDeletingProduct] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState("");

  /* =========================================================
     LOAD SELLER PRODUCTS
  ========================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace(
            "/login?redirect=/seller/products"
          );
          return;
        }

        try {
          setError("");

          const userSnapshot = await getDoc(
            doc(db, "users", user.uid)
          );

          if (!userSnapshot.exists()) {
            setError(
              "Seller profile not found."
            );
            setLoading(false);
            return;
          }

          const userData = userSnapshot.data();

          if (userData.role !== "SELLER") {
            setError(
              "Seller access required."
            );
            setLoading(false);
            return;
          }

          if (
            userData.sellerStatus !==
            "approved"
          ) {
            setError(
              "Your seller account is not approved yet."
            );
            setLoading(false);
            return;
          }

          const result =
            await getSellerProducts(
              user.uid
            );

          setProducts(result);

          const initialStock: Record<
            string,
            string
          > = {};

          result.forEach((product) => {
            initialStock[product.id] =
              String(product.stock);
          });

          setStockValues(initialStock);
        } catch (err) {
          console.error(
            "Seller products error:",
            err
          );

          setError(
            "Unable to load products. Please try again."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  /* =========================================================
     QUICK STOCK UPDATE
  ========================================================= */

  async function handleStockUpdate(
    product: Product
  ) {
    const value =
      stockValues[product.id];

    const stock = Number(value);

    if (
      !Number.isFinite(stock) ||
      stock < 0
    ) {
      setError(
        "Please enter a valid stock quantity."
      );
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setUpdatingStock(product.id);

      const user = auth.currentUser;

      if (!user) {
        router.replace(
          "/login?redirect=/seller/products"
        );
        return;
      }

      await updateSellerStock(
        user.uid,
        product.id,
        Math.floor(stock)
      );

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                stock: Math.floor(stock),
              }
            : item
        )
      );

      setSuccessMessage(
        `"${product.name}" stock updated successfully.`
      );

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      console.error(
        "Stock update error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update stock."
      );
    } finally {
      setUpdatingStock(null);
    }
  }

  /* =========================================================
     DELETE PRODUCT
  ========================================================= */

  async function handleDeleteProduct(
    product: Product
  ) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setDeletingProduct(product.id);

      const user = auth.currentUser;

      if (!user) {
        router.replace(
          "/login?redirect=/seller/products"
        );
        return;
      }

      await deleteSellerProduct(
        user.uid,
        product.id
      );

      setProducts((current) =>
        current.filter(
          (item) =>
            item.id !== product.id
        )
      );

      setSuccessMessage(
        `"${product.name}" deleted successfully.`
      );

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      console.error(
        "Delete product error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete product."
      );
    } finally {
      setDeletingProduct(null);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-500">
              Loading your products...
            </p>
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* HEADER */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/seller"
              className="text-xs font-bold text-gray-400 hover:text-black"
            >
              ← Seller Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-black tracking-tight">
              My Products
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage your ANJIVO marketplace
              products.
            </p>
          </div>

          <Link
            href="/seller/products/new"
            className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
          >
            + Add Product
          </Link>
        </div>

        {/* SUCCESS */}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-700">
              ✓ {successMessage}
            </p>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => setError("")}
              className="mt-3 text-xs font-bold text-red-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* EMPTY STATE */}

        {!error &&
          products.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <div className="text-5xl">
                📦
              </div>

              <h2 className="mt-4 text-xl font-black">
                No products yet
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Add your first product to
                start selling on ANJIVO.
              </p>

              <Link
                href="/seller/products/new"
                className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
              >
                Add Your First Product
              </Link>
            </div>
          )}

        {/* PRODUCT GRID */}

        {!error &&
          products.length > 0 && (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {products.map(
                (product) => (
                  <div
                    key={product.id}
                    className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >

                    {/* IMAGE */}

                    <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-100">
                      {product.images &&
                      product.images.length > 0 &&
                      product.images[0] ? (
                        <img
                          src={
                            product.images[0]
                          }
                          alt={
                            product.name
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl">
                          📦
                        </span>
                      )}

                      {/* STATUS */}

                      <div className="absolute right-3 top-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase shadow-sm ${
                            product.status ===
                            "active"
                              ? "bg-green-100 text-green-700"
                              : product.status ===
                                "blocked"
                              ? "bg-red-100 text-red-700"
                              : product.status ===
                                "out_of_stock"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {product.status.replace(
                            "_",
                            " "
                          )}
                        </span>
                      </div>
                    </div>

                    {/* PRODUCT INFO */}

                    <div className="p-4">

                      <div className="min-h-[42px]">
                        <h2 className="line-clamp-2 text-sm font-black text-gray-900">
                          {product.name}
                        </h2>
                      </div>

                      {/* CATEGORY */}

                      {product.categoryName && (
                        <p className="mt-2 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {product.categoryName}
                        </p>
                      )}

                      {/* PRICE / STOCK */}

                      <div className="mt-4 grid grid-cols-2 gap-2">

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[9px] font-semibold text-gray-400">
                            Retail
                          </p>

                          <p className="mt-1 text-sm font-black text-gray-900">
                            ₹
                            {product.retailPrice.toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <p className="text-[9px] font-semibold text-gray-400">
                            Current Stock
                          </p>

                          <p className="mt-1 text-sm font-black text-gray-900">
                            {product.stock.toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>

                      </div>

                      {/* WHOLESALE */}

                      <div className="mt-2 rounded-xl bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-semibold text-gray-400">
                            Wholesale From
                          </p>

                          <p className="text-[9px] font-semibold text-gray-400">
                            MOQ {product.moq}
                          </p>
                        </div>

                        <p className="mt-1 text-sm font-black text-gray-900">
                          ₹
                          {product.wholesalePrice.toLocaleString(
                            "en-IN"
                          )}

                          <span className="ml-1 text-[9px] font-medium text-gray-400">
                            / piece
                          </span>
                        </p>
                      </div>

                      {/* QUICK STOCK */}

                      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                          Quick Stock Update
                        </p>

                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            min="0"
                            value={
                              stockValues[
                                product.id
                              ] ?? ""
                            }
                            onChange={(event) =>
                              setStockValues(
                                (current) => ({
                                  ...current,
                                  [product.id]:
                                    event.target
                                      .value,
                                })
                              )
                            }
                            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-black"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              handleStockUpdate(
                                product
                              )
                            }
                            disabled={
                              updatingStock ===
                              product.id
                            }
                            className="rounded-xl bg-black px-3 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingStock ===
                            product.id
                              ? "..."
                              : "Save"}
                          </button>
                        </div>
                      </div>

                      {/* VIEW / EDIT */}

                      <div className="mt-4 grid grid-cols-2 gap-2">

                        <Link
                          href={`/products/${product.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-gray-200 py-2.5 text-center text-xs font-bold text-gray-700 transition hover:border-black hover:text-black"
                        >
                          View
                        </Link>

                        <Link
                          href={`/seller/products/${product.id}/edit`}
                          className="rounded-xl bg-black py-2.5 text-center text-xs font-bold text-white transition hover:bg-gray-800"
                        >
                          Edit
                        </Link>

                      </div>

                      {/* DELETE */}

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteProduct(
                            product
                          )
                        }
                        disabled={
                          deletingProduct ===
                          product.id
                        }
                        className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingProduct ===
                        product.id
                          ? "Deleting..."
                          : "Delete Product"}
                      </button>

                    </div>
                  </div>
                )
              )}

            </div>
          )}

      </main>

      <Footer />
    </div>
  );
}
