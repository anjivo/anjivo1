"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type ProductStatus =
  | "active"
  | "draft"
  | "out_of_stock"
  | "blocked";

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
  status: ProductStatus;
  images: string[];
  featured?: boolean;
  bestSeller?: boolean;
  trending?: boolean;
  createdAt?: unknown;
};

type Filter =
  | "all"
  | "draft"
  | "active"
  | "blocked"
  | "out_of_stock";

export default function AdminProductsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [filter, setFilter] =
    useState<Filter>("all");

  const [search, setSearch] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* =========================================================
     ADMIN AUTH
  ========================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/products";
            return;
          }

          try {
            setError("");

            const userSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !userSnapshot.exists()
            ) {
              window.location.href =
                "/";
              return;
            }

            if (
              userSnapshot.data()
                .role !== "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadProducts();
          } catch (err) {
            console.error(
              "Admin products error:",
              err
            );

            setError(
              "Unable to load products."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     LOAD PRODUCTS
  ========================================================= */

  async function loadProducts() {
    const productsQuery =
      query(
        collection(db, "products"),
        orderBy(
          "createdAt",
          "desc"
        )
      );

    const snapshot =
      await getDocs(
        productsQuery
      );

    const list: Product[] =
      snapshot.docs.map(
        (item) => {
          const data =
            item.data();

          return {
            id: item.id,

            name: String(
              data.name ?? ""
            ),

            slug: String(
              data.slug ?? ""
            ),

            categoryName:
              data.categoryName !==
              undefined
                ? String(
                    data.categoryName
                  )
                : undefined,

            sellerId: String(
              data.sellerId ?? ""
            ),

            sellerName:
              data.sellerName !==
              undefined
                ? String(
                    data.sellerName
                  )
                : undefined,

            mrp: Number(
              data.mrp ?? 0
            ),

            retailPrice: Number(
              data.retailPrice ?? 0
            ),

            wholesalePrice:
              Number(
                data.wholesalePrice ??
                  0
              ),

            moq: Number(
              data.moq ?? 1
            ),

            stock: Number(
              data.stock ?? 0
            ),

            status:
              data.status ===
                "active" ||
              data.status ===
                "blocked" ||
              data.status ===
                "out_of_stock"
                ? data.status
                : "draft",

            images:
              Array.isArray(
                data.images
              )
                ? data.images.map(
                    String
                  )
                : [],

            featured: Boolean(
              data.featured
            ),

            bestSeller: Boolean(
              data.bestSeller
            ),

            trending: Boolean(
              data.trending
            ),

            createdAt:
              data.createdAt,
          };
        }
      );

    setProducts(list);
  }

  /* =========================================================
     STATUS CHANGE
  ========================================================= */

  async function changeProductStatus(
    productId: string,
    status:
      | "active"
      | "blocked"
      | "draft"
      | "out_of_stock"
  ) {
    const product =
      products.find(
        (item) =>
          item.id === productId
      );

    if (!product) {
      return;
    }

    const actionText =
      status === "active"
        ? "activate"
        : status === "blocked"
        ? "block"
        : status === "draft"
        ? "move to draft"
        : "mark as out of stock";

    const confirmed =
      window.confirm(
        `Are you sure you want to ${actionText} "${product.name}"?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(productId);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "products",
          productId
        ),
        {
          status,
          updatedAt:
            serverTimestamp(),
        }
      );

      setProducts(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              productId
                ? {
                    ...item,
                    status,
                  }
                : item
          )
      );

      setSuccess(
        `"${product.name}" status updated to ${status.replace(
          "_",
          " "
        )}.`
      );
    } catch (err) {
      console.error(
        "Product status update error:",
        err
      );

      setError(
        "Product status update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     DELETE PRODUCT
  ========================================================= */

  async function deleteProduct(
    productId: string
  ) {
    const product =
      products.find(
        (item) =>
          item.id === productId
      );

    if (!product) {
      return;
    }

    const confirmed =
      window.confirm(
        `DELETE "${product.name}"?\n\nThis permanently removes the product from ANJIVO.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(productId);
      setError("");
      setSuccess("");

      await deleteDoc(
        doc(
          db,
          "products",
          productId
        )
      );

      setProducts(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              productId
          )
      );

      setSuccess(
        `"${product.name}" deleted successfully.`
      );
    } catch (err) {
      console.error(
        "Product delete error:",
        err
      );

      setError(
        "Product deletion failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     FEATURE TOGGLE
  ========================================================= */

  async function toggleFeature(
    product: Product,
    field:
      | "featured"
      | "bestSeller"
      | "trending"
  ) {
    try {
      setProcessing(product.id);
      setError("");
      setSuccess("");

      const newValue =
        !Boolean(product[field]);

      await updateDoc(
        doc(
          db,
          "products",
          product.id
        ),
        {
          [field]: newValue,
          updatedAt:
            serverTimestamp(),
        }
      );

      setProducts(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              product.id
                ? {
                    ...item,
                    [field]:
                      newValue,
                  }
                : item
          )
      );

      setSuccess(
        `${field} ${
          newValue
            ? "enabled"
            : "disabled"
        }.`
      );
    } catch (err) {
      console.error(
        "Feature update error:",
        err
      );

      setError(
        "Unable to update product feature."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     SEARCH + FILTER
  ========================================================= */

  const filteredProducts =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          const matchesStatus =
            filter === "all" ||
            product.status ===
              filter;

          const matchesSearch =
            !searchText ||
            product.name
              .toLowerCase()
              .includes(
                searchText
              ) ||
            product.slug
              .toLowerCase()
              .includes(
                searchText
              ) ||
            (
              product.categoryName ??
              ""
            )
              .toLowerCase()
              .includes(
                searchText
              ) ||
            (
              product.sellerName ??
              ""
            )
              .toLowerCase()
              .includes(
                searchText
              );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      products,
      filter,
      search,
    ]);

  /* =========================================================
     COUNTS
  ========================================================= */

  const counts = {
    all: products.length,

    draft: products.filter(
      (product) =>
        product.status ===
        "draft"
    ).length,

    active: products.filter(
      (product) =>
        product.status ===
        "active"
    ).length,

    blocked: products.filter(
      (product) =>
        product.status ===
        "blocked"
    ).length,

    out_of_stock:
      products.filter(
        (product) =>
          product.status ===
          "out_of_stock"
      ).length,
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="text-4xl">
            ⏳
          </div>

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading ANJIVO Products...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <main className="min-h-screen bg-[#f5f6f8]">

      {/* HEADER */}

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">

          <Link href="/">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/admin/products/new"
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800"
            >
              + List Product
            </Link>

          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        {/* TITLE */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ADMIN / PRODUCTS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
              Product Management
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage seller products and
              ANJIVO Official products from
              one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadProducts()
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold hover:border-black"
          >
            ↻ Refresh Products
          </button>

        </div>

        {/* SUCCESS */}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-700">
              ✓ {success}
            </p>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* STATS */}

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

          <ProductCount
            label="All"
            count={counts.all}
            active={
              filter === "all"
            }
            onClick={() =>
              setFilter("all")
            }
          />

          <ProductCount
            label="Pending"
            count={counts.draft}
            active={
              filter === "draft"
            }
            onClick={() =>
              setFilter("draft")
            }
          />

          <ProductCount
            label="Active"
            count={counts.active}
            active={
              filter === "active"
            }
            onClick={() =>
              setFilter("active")
            }
          />

          <ProductCount
            label="Blocked"
            count={counts.blocked}
            active={
              filter === "blocked"
            }
            onClick={() =>
              setFilter("blocked")
            }
          />

          <ProductCount
            label="Out of Stock"
            count={
              counts.out_of_stock
            }
            active={
              filter ===
              "out_of_stock"
            }
            onClick={() =>
              setFilter(
                "out_of_stock"
              )
            }
          />

        </div>

        {/* SEARCH */}

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-3">

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search product, seller, category or slug..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
          />

        </div>

        {/* PRODUCTS */}

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          {filteredProducts.length ===
          0 ? (
            <div className="p-14 text-center">

              <div className="text-5xl">
                📦
              </div>

              <h2 className="mt-4 text-lg font-black">
                No products found
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Try another search or
                filter.
              </p>

              <Link
                href="/admin/products/new"
                className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
              >
                + List ANJIVO Product
              </Link>

            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {filteredProducts.map(
                (product) => (
                  <ProductRow
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                    processing={
                      processing ===
                      product.id
                    }
                    onApprove={() =>
                      changeProductStatus(
                        product.id,
                        "active"
                      )
                    }
                    onBlock={() =>
                      changeProductStatus(
                        product.id,
                        "blocked"
                      )
                    }
                    onDraft={() =>
                      changeProductStatus(
                        product.id,
                        "draft"
                      )
                    }
                    onOutOfStock={() =>
                      changeProductStatus(
                        product.id,
                        "out_of_stock"
                      )
                    }
                    onDelete={() =>
                      deleteProduct(
                        product.id
                      )
                    }
                    onToggleFeature={
                      toggleFeature
                    }
                  />
                )
              )}

            </div>
          )}

        </div>

      </div>
    </main>
  );
}

/* =========================================================
   PRODUCT COUNT
========================================================= */

function ProductCount({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-black bg-black text-white"
          : "border-gray-200 bg-white hover:border-gray-400"
      }`}
    >
      <p
        className={`text-[10px] font-black uppercase tracking-wide ${
          active
            ? "text-gray-400"
            : "text-gray-400"
        }`}
      >
        {label}
      </p>

      <p className="mt-1 text-2xl font-black">
        {count.toLocaleString(
          "en-IN"
        )}
      </p>
    </button>
  );
}

/* =========================================================
   PRODUCT ROW
========================================================= */

function ProductRow({
  product,
  processing,
  onApprove,
  onBlock,
  onDraft,
  onOutOfStock,
  onDelete,
  onToggleFeature,
}: {
  product: Product;
  processing: boolean;
  onApprove: () => void;
  onBlock: () => void;
  onDraft: () => void;
  onOutOfStock: () => void;
  onDelete: () => void;
  onToggleFeature: (
    product: Product,
    field:
      | "featured"
      | "bestSeller"
      | "trending"
  ) => void;
}) {
  const isAdminProduct =
    product.sellerName ===
      "ANJIVO Official" ||
    product.sellerId ===
      auth.currentUser?.uid;

  return (
    <div className="p-5 sm:p-6">

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

        {/* PRODUCT */}

        <div className="flex min-w-0 gap-4">

          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 sm:h-28 sm:w-28">

            {product.images[0] ? (
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
              <span className="text-4xl">
                📦
              </span>
            )}

          </div>

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h2 className="text-base font-black text-gray-900 sm:text-lg">
                {product.name}
              </h2>

              {isAdminProduct && (
                <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-black uppercase text-white">
                  ANJIVO
                </span>
              )}

            </div>

            <p className="mt-1 text-xs text-gray-500">
              Seller:{" "}
              <span className="font-bold text-gray-700">
                {product.sellerName ||
                  product.sellerId}
              </span>
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Category:{" "}
              {product.categoryName ||
                "—"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">

              <InfoBadge>
                MRP ₹
                {product.mrp.toLocaleString(
                  "en-IN"
                )}
              </InfoBadge>

              <InfoBadge>
                Retail ₹
                {product.retailPrice.toLocaleString(
                  "en-IN"
                )}
              </InfoBadge>

              <InfoBadge>
                Wholesale ₹
                {product.wholesalePrice.toLocaleString(
                  "en-IN"
                )}
              </InfoBadge>

              <InfoBadge>
                MOQ{" "}
                {product.moq}
              </InfoBadge>

              <InfoBadge>
                Stock{" "}
                {product.stock.toLocaleString(
                  "en-IN"
                )}
              </InfoBadge>

            </div>

            {/* LABELS */}

            <div className="mt-3 flex flex-wrap gap-2">

              <FeatureButton
                active={
                  Boolean(
                    product.featured
                  )
                }
                label="Featured"
                disabled={
                  processing
                }
                onClick={() =>
                  onToggleFeature(
                    product,
                    "featured"
                  )
                }
              />

              <FeatureButton
                active={
                  Boolean(
                    product.bestSeller
                  )
                }
                label="Best Seller"
                disabled={
                  processing
                }
                onClick={() =>
                  onToggleFeature(
                    product,
                    "bestSeller"
                  )
                }
              />

              <FeatureButton
                active={
                  Boolean(
                    product.trending
                  )
                }
                label="Trending"
                disabled={
                  processing
                }
                onClick={() =>
                  onToggleFeature(
                    product,
                    "trending"
                  )
                }
              />

            </div>

          </div>

        </div>

        {/* ACTIONS */}

        <div className="flex shrink-0 flex-col gap-3 xl:items-end">

          <StatusBadge
            status={
              product.status
            }
          />

          <div className="flex flex-wrap gap-2">

            <Link
              href={`/products/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold hover:border-black"
            >
              View
            </Link>

            <Link
              href={`/admin/products/${product.id}/edit`}
              className="rounded-xl bg-black px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
            >
              Edit
            </Link>

            {product.status !==
              "active" && (
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onApprove
                }
                className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {processing
                  ? "..."
                  : "Activate"}
              </button>
            )}

            {product.status ===
              "active" && (
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onBlock
                }
                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {processing
                  ? "..."
                  : "Block"}
              </button>
            )}

            {product.status ===
              "blocked" && (
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onApprove
                }
                className="rounded-xl bg-black px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {processing
                  ? "..."
                  : "Unblock"}
              </button>
            )}

            {product.status ===
              "active" && (
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onOutOfStock
                }
                className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 disabled:opacity-50"
              >
                Out of Stock
              </button>
            )}

            {product.status ===
              "out_of_stock" && (
              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onApprove
                }
                className="rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Back Active
              </button>
            )}

            <button
              type="button"
              disabled={
                processing
              }
              onClick={
                onDelete
              }
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              Delete
            </button>

          </div>

          {product.status ===
            "active" && (
            <button
              type="button"
              disabled={
                processing
              }
              onClick={
                onDraft
              }
              className="text-[10px] font-bold text-gray-400 hover:text-black"
            >
              Move to Draft
            </button>
          )}

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   INFO BADGE
========================================================= */

function InfoBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[10px] font-bold text-gray-600">
      {children}
    </span>
  );
}

/* =========================================================
   FEATURE BUTTON
========================================================= */

function FeatureButton({
  active,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[9px] font-bold transition ${
        active
          ? "bg-black text-white"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      } disabled:opacity-50`}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  );
}

/* =========================================================
   STATUS
========================================================= */

function StatusBadge({
  status,
}: {
  status: ProductStatus;
}) {
  const styles: Record<
    ProductStatus,
    string
  > = {
    active:
      "bg-green-100 text-green-700",

    draft:
      "bg-yellow-100 text-yellow-700",

    blocked:
      "bg-red-100 text-red-700",

    out_of_stock:
      "bg-orange-100 text-orange-700",
  };

  const labels: Record<
    ProductStatus,
    string
  > = {
    active: "ACTIVE",
    draft: "PENDING",
    blocked: "BLOCKED",
    out_of_stock:
      "OUT OF STOCK",
  };

  return (
    <span
      className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-black ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
