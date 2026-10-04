"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type ProductStatus =
  | "active"
  | "draft"
  | "out_of_stock"
  | "blocked";

type InventoryFilter =
  | "all"
  | "healthy"
  | "low"
  | "out_of_stock"
  | "blocked";

type ProductVariant = {
  id?: string;
  sku?: string;
  name?: string;
  stock?: number;
  status?: string;
};

type InventoryProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  sellerId: string;
  sellerName: string;
  categoryName: string;
  stock: number;
  status: ProductStatus;
  retailPrice: number;
  wholesalePrice: number;
  mrp: number;
  images: string[];
  variantCount: number;
  variantStock: number;
  variants: ProductVariant[];
  updatedAt?: unknown;
};

const LOW_STOCK_THRESHOLD = 10;

/* =========================================================
   HELPERS
========================================================= */

function numberValue(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function timestampValue(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    const seconds = Number(
      (value as { seconds?: unknown }).seconds ?? 0
    );

    return seconds * 1000;
  }

  return 0;
}

function formatDate(value: unknown): string {
  const timestamp = timestampValue(value);

  if (!timestamp) {
    return "—";
  }

  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStockState(
  product: InventoryProduct
): "healthy" | "low" | "out_of_stock" {
  if (product.stock <= 0) {
    return "out_of_stock";
  }

  if (product.stock <= LOW_STOCK_THRESHOLD) {
    return "low";
  }

  return "healthy";
}

function mapProduct(
  id: string,
  data: Record<string, unknown>
): InventoryProduct {
  const rawVariants = Array.isArray(
    data.variantConfiguration &&
      typeof data.variantConfiguration === "object"
      ? (
          data.variantConfiguration as {
            variants?: unknown;
          }
        ).variants
      : undefined
  )
    ? (
        (
          data.variantConfiguration as {
            variants?: unknown[];
          }
        ).variants ?? []
      )
    : [];

  const variants: ProductVariant[] =
    rawVariants
      .filter(
        (variant): variant is Record<string, unknown> =>
          typeof variant === "object" &&
          variant !== null
      )
      .map((variant) => ({
        id:
          variant.id !== undefined
            ? String(variant.id)
            : undefined,

        sku:
          variant.sku !== undefined
            ? String(variant.sku)
            : undefined,

        name:
          variant.name !== undefined
            ? String(variant.name)
            : undefined,

        stock: numberValue(
          variant.stock
        ),

        status:
          variant.status !== undefined
            ? String(variant.status)
            : undefined,
      }));

  const variantStock = variants.reduce(
    (total, variant) =>
      total + numberValue(variant.stock),
    0
  );

  const productStock = numberValue(
    data.stock
  );

  /*
   * For variant products, use the aggregate
   * variant stock when variants exist.
   *
   * Otherwise use the normal product stock.
   */
  const stock =
    variants.length > 0
      ? variantStock
      : productStock;

  const rawStatus = data.status;

  const status: ProductStatus =
    rawStatus === "active" ||
    rawStatus === "draft" ||
    rawStatus === "blocked" ||
    rawStatus === "out_of_stock"
      ? rawStatus
      : stock <= 0
      ? "out_of_stock"
      : "draft";

  const rawImages = Array.isArray(
    data.images
  )
    ? data.images
    : [];

  return {
    id,

    name: stringValue(data.name),

    slug: stringValue(data.slug),

    sku:
      stringValue(data.sku) ||
      stringValue(data.productSku) ||
      "—",

    sellerId:
      stringValue(data.sellerId),

    sellerName:
      stringValue(data.sellerName) ||
      "ANJIVO Official",

    categoryName:
      stringValue(data.categoryName) ||
      stringValue(data.categoryId) ||
      "Uncategorized",

    stock,

    status,

    retailPrice:
      numberValue(data.retailPrice),

    wholesalePrice:
      numberValue(data.wholesalePrice),

    mrp:
      numberValue(data.mrp),

    images: rawImages
      .map((image) => String(image))
      .filter(Boolean),

    variantCount:
      variants.length,

    variantStock,

    variants,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminInventoryPage() {
  const [products, setProducts] =
    useState<InventoryProduct[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [authorized, setAuthorized] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<InventoryFilter>("all");

  const [sellerFilter, setSellerFilter] =
    useState("all");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(null);

  const [stockDrafts, setStockDrafts] =
    useState<Record<string, string>>({});

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
              "/login?redirect=/admin/inventory";

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

            if (!userSnapshot.exists()) {
              window.location.href = "/";
              return;
            }

            const userData =
              userSnapshot.data();

            if (
              userData.role !== "ADMIN"
            ) {
              window.location.href =
                "/account";

              return;
            }

            setAuthorized(true);

            await loadProducts();
          } catch (err) {
            console.error(
              "Inventory authentication error:",
              err
            );

            setError(
              "Unable to verify admin access."
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
  ========================================================== */

  async function loadProducts() {
    try {
      setError("");

      const snapshot =
        await getDocs(
          collection(db, "products")
        );

      const loaded =
        snapshot.docs
          .map((productDoc) =>
            mapProduct(
              productDoc.id,
              productDoc.data()
            )
          )
          .sort(
            (a, b) =>
              timestampValue(
                b.updatedAt
              ) -
              timestampValue(
                a.updatedAt
              )
          );

      setProducts(loaded);

      const drafts: Record<
        string,
        string
      > = {};

      loaded.forEach((product) => {
        drafts[product.id] =
          String(product.stock);
      });

      setStockDrafts(drafts);
    } catch (err) {
      console.error(
        "Inventory load error:",
        err
      );

      setError(
        "Unable to load inventory. Please check your Firebase permissions."
      );
    }
  }

  /* =========================================================
     REFRESH
  ========================================================== */

  async function refreshInventory() {
    try {
      setRefreshing(true);
      setSuccess("");
      await loadProducts();

      setSuccess(
        "Inventory refreshed successfully."
      );
    } catch {
      setError(
        "Unable to refresh inventory."
      );
    } finally {
      setRefreshing(false);
    }
  }

  /* =========================================================
     SELLERS
  ========================================================== */

  const sellers = useMemo(() => {
    const unique = new Map<
      string,
      string
    >();

    products.forEach((product) => {
      const id =
        product.sellerId || "unknown";

      const name =
        product.sellerName ||
        "Unknown Seller";

      unique.set(id, name);
    });

    return Array.from(
      unique.entries()
    ).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [products]);

  /* =========================================================
     STATS
  ========================================================== */

  const stats = useMemo(() => {
    let totalUnits = 0;
    let healthy = 0;
    let low = 0;
    let outOfStock = 0;
    let blocked = 0;

    products.forEach((product) => {
      totalUnits += product.stock;

      if (product.status === "blocked") {
        blocked += 1;
        return;
      }

      const state =
        getStockState(product);

      if (state === "healthy") {
        healthy += 1;
      }

      if (state === "low") {
        low += 1;
      }

      if (state === "out_of_stock") {
        outOfStock += 1;
      }
    });

    return {
      totalProducts:
        products.length,

      totalUnits,

      healthy,

      low,

      outOfStock,

      blocked,
    };
  }, [products]);

  /* =========================================================
     FILTER
  ========================================================== */

  const filteredProducts =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          const state =
            getStockState(product);

          const matchesSearch =
            !normalizedSearch ||
            product.name
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            product.slug
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            product.sku
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            product.sellerName
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            product.categoryName
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesFilter =
            filter === "all" ||
            (filter === "healthy" &&
              state === "healthy") ||
            (filter === "low" &&
              state === "low") ||
            (filter ===
              "out_of_stock" &&
              state ===
                "out_of_stock") ||
            (filter === "blocked" &&
              product.status ===
                "blocked");

          const matchesSeller =
            sellerFilter ===
              "all" ||
            product.sellerId ===
              sellerFilter;

          return (
            matchesSearch &&
            matchesFilter &&
            matchesSeller
          );
        }
      );
    }, [
      products,
      search,
      filter,
      sellerFilter,
    ]);

  /* =========================================================
     UPDATE STOCK
  ========================================================== */

  async function updateStock(
    product: InventoryProduct
  ) {
    const rawValue =
      stockDrafts[product.id];

    const newStock =
      Number(rawValue);

    if (
      !Number.isInteger(
        newStock
      ) ||
      newStock < 0
    ) {
      setError(
        `Invalid stock quantity for "${product.name}".`
      );

      return;
    }

    if (
      newStock === product.stock
    ) {
      setSuccess(
        "No stock change detected."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Update stock for "${product.name}" from ${product.stock} to ${newStock}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessing(product.id);
      setError("");
      setSuccess("");

      const productRef =
        doc(
          db,
          "products",
          product.id
        );

      /*
       * Do not silently change blocked products.
       *
       * Stock can still be corrected for
       * blocked products, but status remains
       * controlled by admin product workflow.
       */
      const updateData: Record<
        string,
        unknown
      > = {
        stock: newStock,
        updatedAt:
          serverTimestamp(),
      };

      /*
       * For normal products, automatically
       * keep out_of_stock status in sync.
       *
       * Do not automatically activate draft
       * or blocked products.
       */
      if (
        newStock <= 0 &&
        product.status === "active"
      ) {
        updateData.status =
          "out_of_stock";
      }

      if (
        newStock > 0 &&
        product.status ===
          "out_of_stock"
      ) {
        updateData.status =
          "active";
      }

      await updateDoc(
        productRef,
        updateData
      );

      setProducts(
        (current) =>
          current.map(
            (item) => {
              if (
                item.id !==
                product.id
              ) {
                return item;
              }

              const nextStatus =
                newStock <= 0 &&
                item.status ===
                  "active"
                  ? "out_of_stock"
                  : newStock > 0 &&
                    item.status ===
                      "out_of_stock"
                  ? "active"
                  : item.status;

              return {
                ...item,
                stock: newStock,
                status: nextStatus,
                updatedAt:
                  new Date(),
              };
            }
          )
      );

      setSuccess(
        `Stock updated for "${product.name}".`
      );
    } catch (err) {
      console.error(
        "Stock update error:",
        err
      );

      setError(
        "Stock update failed. Check Firestore permissions."
      );
    } finally {
      setProcessing(null);
    }
  }

  /* =========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-600">
              Loading inventory...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  /* =========================================================
     UI
  ========================================================== */

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">

        {/* HEADER */}

        <section className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <Link
                href="/admin"
                className="hover:text-slate-900"
              >
                Admin
              </Link>

              <span>/</span>

              <span className="font-medium text-slate-900">
                Inventory
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Inventory Management
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Monitor product stock and update
              inventory across ANJIVO.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshInventory}
              disabled={refreshing}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <Link
              href="/admin/products"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Manage Products
            </Link>
          </div>
        </section>

        {/* ALERTS */}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {/* STATS */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">

          <StatCard
            label="Total SKUs"
            value={stats.totalProducts}
          />

          <StatCard
            label="Total Units"
            value={stats.totalUnits}
          />

          <StatCard
            label="Healthy"
            value={stats.healthy}
          />

          <StatCard
            label="Low Stock"
            value={stats.low}
          />

          <StatCard
            label="Out of Stock"
            value={stats.outOfStock}
          />

          <StatCard
            label="Blocked"
            value={stats.blocked}
          />

        </section>

        {/* FILTERS */}

        <section className="rounded-2xl border bg-white p-4 shadow-sm">

          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search product, SKU, seller or category..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />

            <select
              value={sellerFilter}
              onChange={(event) =>
                setSellerFilter(
                  event.target.value
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
            >
              <option value="all">
                All sellers
              </option>

              {sellers.map(
                ([id, name]) => (
                  <option
                    key={id}
                    value={id}
                  >
                    {name}
                  </option>
                )
              )}
            </select>

          </div>

          <div className="mt-4 flex flex-wrap gap-2">

            <FilterButton
              active={
                filter === "all"
              }
              onClick={() =>
                setFilter("all")
              }
            >
              All
            </FilterButton>

            <FilterButton
              active={
                filter === "healthy"
              }
              onClick={() =>
                setFilter("healthy")
              }
            >
              Healthy
            </FilterButton>

            <FilterButton
              active={
                filter === "low"
              }
              onClick={() =>
                setFilter("low")
              }
            >
              Low Stock
            </FilterButton>

            <FilterButton
              active={
                filter ===
                "out_of_stock"
              }
              onClick={() =>
                setFilter(
                  "out_of_stock"
                )
              }
            >
              Out of Stock
            </FilterButton>

            <FilterButton
              active={
                filter === "blocked"
              }
              onClick={() =>
                setFilter("blocked")
              }
            >
              Blocked
            </FilterButton>

          </div>
        </section>

        {/* TABLE */}

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">

          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Inventory
              </h2>

              <p className="text-xs text-slate-500">
                Showing{" "}
                {filteredProducts.length}{" "}
                of{" "}
                {products.length}{" "}
                products
              </p>
            </div>
          </div>

          {filteredProducts.length ===
          0 ? (
            <div className="p-10 text-center">
              <p className="font-medium text-slate-900">
                No inventory found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing the search or
                inventory filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">

                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">
                      Product
                    </th>

                    <th className="px-5 py-3">
                      Seller
                    </th>

                    <th className="px-5 py-3">
                      Category
                    </th>

                    <th className="px-5 py-3">
                      Price
                    </th>

                    <th className="px-5 py-3">
                      Stock
                    </th>

                    <th className="px-5 py-3">
                      Status
                    </th>

                    <th className="px-5 py-3">
                      Updated
                    </th>

                    <th className="px-5 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">

                  {filteredProducts.map(
                    (product) => {
                      const stockState =
                        getStockState(
                          product
                        );

                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-slate-50"
                        >

                          {/* PRODUCT */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-slate-100">

                                {product
                                  .images[0] ? (
                                  <img
                                    src={
                                      product
                                        .images[0]
                                    }
                                    alt={
                                      product.name
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                                    No image
                                  </div>
                                )}

                              </div>

                              <div className="min-w-0">

                                <Link
                                  href={`/admin/products/${product.id}/edit`}
                                  className="line-clamp-2 font-medium text-slate-900 hover:underline"
                                >
                                  {
                                    product.name
                                  }
                                </Link>

                                <p className="mt-1 text-xs text-slate-500">
                                  SKU:{" "}
                                  {
                                    product.sku
                                  }
                                </p>

                                {product
                                  .variantCount >
                                  0 && (
                                  <p className="text-xs text-slate-500">
                                    {
                                      product.variantCount
                                    }{" "}
                                    variants
                                  </p>
                                )}

                              </div>

                            </div>

                          </td>

                          {/* SELLER */}

                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-800">
                              {
                                product.sellerName
                              }
                            </p>

                            <p className="mt-1 max-w-[160px] truncate text-xs text-slate-500">
                              {
                                product.sellerId
                              }
                            </p>
                          </td>

                          {/* CATEGORY */}

                          <td className="px-5 py-4 text-slate-700">
                            {
                              product.categoryName
                            }
                          </td>

                          {/* PRICE */}

                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-900">
                              {formatCurrency(
                                product.retailPrice
                              )}
                            </p>

                            {product.mrp >
                              product.retailPrice && (
                              <p className="text-xs text-slate-400 line-through">
                                {formatCurrency(
                                  product.mrp
                                )}
                              </p>
                            )}

                            {product
                              .wholesalePrice >
                              0 && (
                              <p className="mt-1 text-xs text-slate-500">
                                Wholesale:{" "}
                                {formatCurrency(
                                  product.wholesalePrice
                                )}
                              </p>
                            )}
                          </td>

                          {/* STOCK */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2">

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={
                                  stockDrafts[
                                    product.id
                                  ] ??
                                  String(
                                    product.stock
                                  )
                                }
                                onChange={(
                                  event
                                ) =>
                                  setStockDrafts(
                                    (
                                      current
                                    ) => ({
                                      ...current,
                                      [product.id]:
                                        event
                                          .target
                                          .value,
                                    })
                                  )
                                }
                                className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-slate-500"
                              />

                              {product
                                .variantCount >
                                0 && (
                                <span className="text-xs text-slate-500">
                                  /
                                  {
                                    product.variantStock
                                  }{" "}
                                  variant units
                                </span>
                              )}

                            </div>

                            <p
                              className={`mt-1 text-xs ${
                                stockState ===
                                "healthy"
                                  ? "text-emerald-600"
                                  : stockState ===
                                    "low"
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {stockState ===
                              "healthy"
                                ? "Healthy stock"
                                : stockState ===
                                  "low"
                                ? "Low stock"
                                : "Out of stock"}
                            </p>

                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                product.status
                              }
                            />
                          </td>

                          {/* UPDATED */}

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {formatDate(
                              product.updatedAt
                            )}
                          </td>

                          {/* ACTION */}

                          <td className="px-5 py-4 text-right">

                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                disabled={
                                  processing ===
                                  product.id
                                }
                                onClick={() =>
                                  updateStock(
                                    product
                                  )
                                }
                                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {processing ===
                                product.id
                                  ? "Saving..."
                                  : "Save"}
                              </button>

                              <Link
                                href={`/admin/products/${product.id}/edit`}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </Link>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>
              </table>
            </div>
          )}

        </section>

      </div>
    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

/* =========================================================
   FILTER BUTTON
========================================================= */

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}: {
  status: ProductStatus;
}) {
  const config: Record<
    ProductStatus,
    {
      label: string;
      className: string;
    }
  > = {
    active: {
      label: "Active",
      className:
        "bg-emerald-50 text-emerald-700",
    },

    draft: {
      label: "Draft",
      className:
        "bg-slate-100 text-slate-700",
    },

    out_of_stock: {
      label: "Out of stock",
      className:
        "bg-red-50 text-red-700",
    },

    blocked: {
      label: "Blocked",
      className:
        "bg-red-100 text-red-800",
    },
  };

  const item =
    config[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.className}`}
    >
      {item.label}
    </span>
  );
}
