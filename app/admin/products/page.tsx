"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Product = {
  id: string;
  name: string;
  slug: string;
  categoryName?: string;
  sellerId: string;
  sellerName?: string;
  mrp: number;
  retailPrice: number;
  wholesalePrice: number;
  moq: number;
  stock: number;
  status: "active" | "draft" | "out_of_stock" | "blocked";
  images: string[];
  createdAt?: unknown;
};

export default function AdminProductsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<
    "all" | "draft" | "active" | "blocked"
  >("all");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      try {
        const userSnapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        if (!userSnapshot.exists()) {
          window.location.href = "/";
          return;
        }

        if (userSnapshot.data().role !== "ADMIN") {
          window.location.href = "/account";
          return;
        }

        setAuthorized(true);
        await loadProducts();
      } catch (error) {
        console.error("Admin products error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function loadProducts() {
    const productsQuery = query(
      collection(db, "products"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(productsQuery);

    const list: Product[] = snapshot.docs.map((item) => {
      const data = item.data();

      return {
        id: item.id,
        name: String(data.name ?? ""),
        slug: String(data.slug ?? ""),
        categoryName:
          data.categoryName !== undefined
            ? String(data.categoryName)
            : undefined,
        sellerId: String(data.sellerId ?? ""),
        sellerName:
          data.sellerName !== undefined
            ? String(data.sellerName)
            : undefined,
        mrp: Number(data.mrp ?? 0),
        retailPrice: Number(data.retailPrice ?? 0),
        wholesalePrice: Number(data.wholesalePrice ?? 0),
        moq: Number(data.moq ?? 1),
        stock: Number(data.stock ?? 0),
        status:
          data.status === "active" ||
          data.status === "blocked" ||
          data.status === "out_of_stock"
            ? data.status
            : "draft",
        images: Array.isArray(data.images)
          ? data.images.map(String)
          : [],
        createdAt: data.createdAt,
      };
    });

    setProducts(list);
  }

  async function changeProductStatus(
    productId: string,
    status: "active" | "blocked"
  ) {
    const confirmed = window.confirm(
      status === "active"
        ? "Approve this product?"
        : "Block this product?"
    );

    if (!confirmed) return;

    try {
      setProcessing(productId);

      await updateDoc(doc(db, "products", productId), {
        status,
        updatedAt: serverTimestamp(),
      });

      await loadProducts();
    } catch (error) {
      console.error("Product status update error:", error);
      alert("Product status update failed.");
    } finally {
      setProcessing(null);
    }
  }

  async function deleteProduct(productId: string) {
    alert(
      "Permanent delete अभी enable नहीं किया गया है. Product को Block करें."
    );
  }

  const filteredProducts =
    filter === "all"
      ? products
      : products.filter((product) => product.status === filter);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <p className="text-sm text-gray-500">
            Loading products...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex gap-2">
            <Link
              href="/admin"
              className="rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Store
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Title */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500">
            ADMIN / PRODUCTS
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Product Management
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Review and control products submitted by sellers.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["draft", "Pending"],
            ["active", "Active"],
            ["blocked", "Blocked"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() =>
                setFilter(
                  value as
                    | "all"
                    | "draft"
                    | "active"
                    | "blocked"
                )
              }
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                filter === value
                  ? "bg-black text-white"
                  : "border bg-white text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Products */}
        <div className="overflow-hidden rounded-2xl border bg-white">
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl">📦</div>

              <h2 className="mt-4 text-lg font-bold">
                No products found
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                There are no products in this category.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    {/* Product */}
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">
                            📦
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-gray-900">
                          {product.name}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                          Seller:{" "}
                          {product.sellerName ||
                            product.sellerId}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Category:{" "}
                          {product.categoryName || "—"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-lg bg-gray-100 px-2 py-1">
                            MRP ₹{product.mrp}
                          </span>

                          <span className="rounded-lg bg-gray-100 px-2 py-1">
                            Retail ₹{product.retailPrice}
                          </span>

                          <span className="rounded-lg bg-gray-100 px-2 py-1">
                            Wholesale ₹
                            {product.wholesalePrice}
                          </span>

                          <span className="rounded-lg bg-gray-100 px-2 py-1">
                            MOQ {product.moq}
                          </span>

                          <span className="rounded-lg bg-gray-100 px-2 py-1">
                            Stock {product.stock}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex shrink-0 flex-col gap-3 lg:items-end">
                      <StatusBadge status={product.status} />

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/products/${product.slug}`}
                          target="_blank"
                          className="rounded-lg border px-3 py-2 text-xs font-semibold"
                        >
                          View
                        </Link>

                        {product.status !== "active" && (
                          <button
                            disabled={
                              processing === product.id
                            }
                            onClick={() =>
                              changeProductStatus(
                                product.id,
                                "active"
                              )
                            }
                            className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {processing === product.id
                              ? "Processing..."
                              : "Approve"}
                          </button>
                        )}

                        {product.status === "active" && (
                          <button
                            disabled={
                              processing === product.id
                            }
                            onClick={() =>
                              changeProductStatus(
                                product.id,
                                "blocked"
                              )
                            }
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {processing === product.id
                              ? "Processing..."
                              : "Block"}
                          </button>
                        )}

                        {product.status === "blocked" && (
                          <button
                            disabled={
                              processing === product.id
                            }
                            onClick={() =>
                              changeProductStatus(
                                product.id,
                                "active"
                              )
                            }
                            className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Unblock
                          </button>
                        )}

                        <button
                          onClick={() =>
                            deleteProduct(product.id)
                          }
                          className="rounded-lg border px-3 py-2 text-xs font-semibold text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatusBadge({
  status,
}: {
  status: Product["status"];
}) {
  const styles = {
    active: "bg-green-100 text-green-700",
    draft: "bg-yellow-100 text-yellow-700",
    blocked: "bg-red-100 text-red-700",
    out_of_stock: "bg-gray-100 text-gray-700",
  };

  const labels = {
    active: "ACTIVE",
    draft: "PENDING",
    blocked: "BLOCKED",
    out_of_stock: "OUT OF STOCK",
  };

  return (
    <span
      className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
        styles[status]
      }`}
    >
      {labels[status]}
    </span>
  );
}
