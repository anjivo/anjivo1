"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function getPiecesPerSet(product: Product): number {
  const configured = Number(product.wholesaleConfiguration?.setSize ?? 0);

  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }

  const composition = product.wholesaleConfiguration?.composition;

  if (Array.isArray(composition)) {
    const total = composition.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    if (Number.isFinite(total) && total > 0) {
      return Math.floor(total);
    }
  }

  return 0;
}

function getWholesaleDisplay(product: Product): {
  label: string;
  unitLabel: string;
  price: number;
} {
  const config = product.wholesaleConfiguration;

  if (config?.enabled && config.priceUnit === "SET") {
    return {
      label: "Wholesale Set",
      unitLabel: config.setName
        ? `${config.setName} / set`
        : "per set",
      price: product.wholesalePrice,
    };
  }

  return {
    label: "Wholesale",
    unitLabel: " / piece",
    price: product.wholesalePrice,
  };
}

function getStockDisplay(product: Product): {
  value: number;
  label: string;
} {
  const piecesPerSet = getPiecesPerSet(product);
  const isSetProduct =
    product.wholesaleConfiguration?.enabled === true &&
    product.wholesaleConfiguration.saleUnit === "SET";

  if (isSetProduct && piecesPerSet > 0) {
    return {
      value: Math.floor(product.stock / piecesPerSet),
      label: "sets available",
    };
  }

  return {
    value: product.stock,
    label: "pieces",
  };
}

function getSellingModeLabel(product: Product): string {
  if (product.sellingMode === "SET") return "SET";
  if (product.sellingMode === "BOTH") return "PIECE + SET";
  return "PIECE";
}

type StatusFilter =
  | "all"
  | "active"
  | "draft"
  | "out_of_stock"
  | "blocked";

export default function SellerProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [stockValues, setStockValues] = useState<
    Record<string, string>
  >({});

  const [updatingStock, setUpdatingStock] =
    useState<string | null>(null);

  const [deletingProduct, setDeletingProduct] =
    useState<string | null>(null);

  /* =========================================================
     LOAD PRODUCTS
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
          setLoading(true);
          setError("");

          const userSnapshot = await getDoc(
            doc(db, "users", user.uid)
          );

          if (!userSnapshot.exists()) {
            setError("Seller profile not found.");
            setLoading(false);
            return;
          }

          const userData = userSnapshot.data();

          if (userData.role !== "SELLER") {
            setError("Seller access required.");
            setLoading(false);
            return;
          }

          const sellerSnapshot = await getDoc(
            doc(db, "sellers", user.uid)
          );

          const sellerData = sellerSnapshot.exists()
            ? sellerSnapshot.data()
            : null;

          const sellerStatus = String(
            sellerData?.status ??
              sellerData?.sellerStatus ??
              userData.sellerStatus ??
              ""
          ).toLowerCase();

          const isApproved =
            sellerStatus === "approved" ||
            userData.adminApproved === true ||
            sellerData?.adminApproved === true;

          if (!isApproved) {
            setError(
              "Your seller account is not approved yet."
            );
            setLoading(false);
            return;
          }

          const result = await getSellerProducts(
            user.uid
          );

          setProducts(result);

          const initialStock: Record<string, string> = {};

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
     STATISTICS
  ========================================================= */

  const stats = useMemo(() => {
    const active = products.filter(
      (product) => product.status === "active"
    ).length;

    const draft = products.filter(
      (product) => product.status === "draft"
    ).length;

    const outOfStock = products.filter(
      (product) =>
        product.status === "out_of_stock" ||
        product.stock <= 0
    ).length;

    const blocked = products.filter(
      (product) => product.status === "blocked"
    ).length;

    const totalStock = products.reduce(
      (sum, product) => sum + product.stock,
      0
    );

    return {
      total: products.length,
      active,
      draft,
      outOfStock,
      blocked,
      totalStock,
    };
  }, [products]);

  /* =========================================================
     FILTERED PRODUCTS
  ========================================================= */

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        product.categoryName
          ?.toLowerCase()
          .includes(query);

      let matchesStatus = true;

      if (statusFilter === "active") {
        matchesStatus =
          product.status === "active";
      }

      if (statusFilter === "draft") {
        matchesStatus =
          product.status === "draft";
      }

      if (statusFilter === "blocked") {
        matchesStatus =
          product.status === "blocked";
      }

      if (statusFilter === "out_of_stock") {
        matchesStatus =
          product.status === "out_of_stock" ||
          product.stock <= 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  /* =========================================================
     STOCK UPDATE
  ========================================================= */

  async function handleStockUpdate(
    product: Product
  ) {
    const value = stockValues[product.id];

    const stock = Number(value);

    if (!Number.isFinite(stock) || stock < 0) {
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

      const newStock = Math.floor(stock);

      await updateSellerStock(
        user.uid,
        product.id,
        newStock
      );

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                stock: newStock,
                status:
                  item.status === "out_of_stock" &&
                  newStock > 0
                    ? "active"
                    : item.status,
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

    if (!confirmed) return;

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
          (item) => item.id !== product.id
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
     STATUS UI
  ========================================================= */

  function getStatusClasses(
    status: Product["status"]
  ) {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";

      case "blocked":
        return "bg-red-100 text-red-700";

      case "out_of_stock":
        return "bg-orange-100 text-orange-700";

      default:
        return "bg-yellow-100 text-yellow-700";
    }
  }

  function getStatusLabel(
    status: Product["status"]
  ) {
    switch (status) {
      case "out_of_stock":
        return "Out of Stock";

      case "active":
        return "Active";

      case "blocked":
        return "Blocked";

      default:
        return "Draft";
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
            <div className="text-4xl">⏳</div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading your products...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =========================================================
     PAGE
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

          <div>
            <Link
              href="/seller"
              className="text-xs font-bold text-gray-400 transition hover:text-black"
            >
              ← Seller Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              My Products
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage your ANJIVO marketplace products,
              pricing and inventory.
            </p>

            <p className="mt-2 max-w-3xl text-[11px] leading-5 text-gray-400">
              Wholesale SET products keep their configured set composition
              and cannot be treated as loose pieces when set breaking is disabled.
            </p>
          </div>

          <Link
            href="/seller/products/new"
            className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
          >
            + Add Product
          </Link>
        </div>

        {/* =================================================
            SUCCESS
        ================================================= */}

        {successMessage && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-700">
              ✓ {successMessage}
            </p>
          </div>
        )}

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => setError("")}
              className="mt-2 text-xs font-bold text-red-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-2xl border bg-white p-4 text-left transition ${
              statusFilter === "all"
                ? "border-black shadow-sm"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Total
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.total}
            </p>
          </button>

          <button
            onClick={() => setStatusFilter("active")}
            className={`rounded-2xl border bg-white p-4 text-left transition ${
              statusFilter === "active"
                ? "border-black shadow-sm"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">
              Active
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.active}
            </p>
          </button>

          <button
            onClick={() => setStatusFilter("draft")}
            className={`rounded-2xl border bg-white p-4 text-left transition ${
              statusFilter === "draft"
                ? "border-black shadow-sm"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-yellow-600">
              Draft
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.draft}
            </p>
          </button>

          <button
            onClick={() =>
              setStatusFilter("out_of_stock")
            }
            className={`rounded-2xl border bg-white p-4 text-left transition ${
              statusFilter === "out_of_stock"
                ? "border-black shadow-sm"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">
              Out of Stock
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.outOfStock}
            </p>
          </button>

          <button
            onClick={() =>
              setStatusFilter("blocked")
            }
            className={`rounded-2xl border bg-white p-4 text-left transition ${
              statusFilter === "blocked"
                ? "border-black shadow-sm"
                : "border-gray-200 hover:border-gray-400"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">
              Blocked
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.blocked}
            </p>
          </button>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Total Stock
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.totalStock.toLocaleString(
                "en-IN"
              )}
            </p>
          </div>
        </div>

        {/* =================================================
            SEARCH + FILTERS
        ================================================= */}

        <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-4 sm:p-5">

          <div className="flex flex-col gap-4 lg:flex-row">

            {/* SEARCH */}

            <div className="flex-1">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Search Products
              </label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  🔎
                </span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search by product name, slug or category..."
                  className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-black"
                />
              </div>
            </div>

            {/* STATUS */}

            <div className="lg:w-64">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Product Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as StatusFilter
                  )
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-black"
              >
                <option value="all">
                  All Products
                </option>

                <option value="active">
                  Active
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="out_of_stock">
                  Out of Stock
                </option>

                <option value="blocked">
                  Blocked
                </option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <p className="text-xs font-semibold text-gray-500">
              Showing{" "}
              <span className="font-black text-black">
                {filteredProducts.length}
              </span>{" "}
              of{" "}
              <span className="font-black text-black">
                {products.length}
              </span>{" "}
              products
            </p>

            {(search || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="text-xs font-bold text-red-600 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* =================================================
            EMPTY
        ================================================= */}

        {products.length === 0 && (
          <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">

            <div className="text-5xl">
              📦
            </div>

            <h2 className="mt-4 text-xl font-black">
              No products yet
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Add your first product to start selling
              on ANJIVO.
            </p>

            <Link
              href="/seller/products/new"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              Add Your First Product
            </Link>
          </div>
        )}

        {/* =================================================
            NO FILTER RESULTS
        ================================================= */}

        {products.length > 0 &&
          filteredProducts.length === 0 && (
            <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-12 text-center">

              <div className="text-4xl">
                🔎
              </div>

              <h2 className="mt-4 text-lg font-black">
                No matching products
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or filter.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="mt-5 rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
              >
                Clear Filters
              </button>
            </div>
          )}

        {/* =================================================
            PRODUCT GRID
        ================================================= */}

        {filteredProducts.length > 0 && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >

                {/* IMAGE */}

                <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-100">

                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">
                      📦
                    </span>
                  )}

                  <div className="absolute right-3 top-3">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase shadow-sm ${getStatusClasses(
                        product.status
                      )}`}
                    >
                      {getStatusLabel(
                        product.status
                      )}
                    </span>
                  </div>

                  {getStockDisplay(product).value <= 5 &&
                    getStockDisplay(product).value > 0 && (
                      <div className="absolute bottom-3 left-3">
                        <span className="rounded-full bg-orange-500 px-3 py-1.5 text-[9px] font-black text-white shadow-sm">
                          LOW STOCK
                        </span>
                      </div>
                    )}
                </div>

                {/* INFO */}

                <div className="p-4">

                  <h2 className="line-clamp-2 min-h-[42px] text-sm font-black text-gray-900">
                    {product.name}
                  </h2>

                  {product.categoryName && (
                    <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      {product.categoryName}
                    </p>
                  )}

                  {/* PRICE */}

                  <div className="mt-4 grid grid-cols-2 gap-2">

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[9px] font-bold text-gray-400">
                        Retail
                      </p>

                      <p className="mt-1 text-sm font-black">
                        ₹
                        {product.retailPrice.toLocaleString(
                          "en-IN"
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-[9px] font-bold text-gray-400">
                        {getStockDisplay(product).label === "sets available"
                          ? "Set Stock"
                          : "Piece Stock"}
                      </p>

                      <p
                        className={`mt-1 text-sm font-black ${
                          getStockDisplay(product).value <= 5
                            ? "text-orange-600"
                            : "text-gray-900"
                        }`}
                      >
                        {getStockDisplay(product).value.toLocaleString(
                          "en-IN"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* WHOLESALE */}

                  {(() => {
                    const wholesale = getWholesaleDisplay(product);
                    const piecesPerSet = getPiecesPerSet(product);
                    const stockDisplay = getStockDisplay(product);
                    const config = product.wholesaleConfiguration;

                    return (
                      <div className="mt-2 rounded-xl bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[9px] font-bold text-gray-400">
                            {wholesale.label}
                          </p>

                          <p className="rounded-full bg-white px-2 py-1 text-[8px] font-black text-gray-500">
                            {getSellingModeLabel(product)}
                          </p>
                        </div>

                        <div className="mt-2 flex items-end justify-between gap-3">
                          <p className="text-sm font-black">
                            ₹
                            {wholesale.price.toLocaleString("en-IN")}
                            <span className="ml-1 text-[9px] font-medium text-gray-400">
                              {wholesale.unitLabel}
                            </span>
                          </p>

                          <p className="text-[9px] font-bold text-gray-400">
                            MOQ {config?.saleUnit === "SET"
                              ? `${config.moqSets ?? product.moq} set${(config?.moqSets ?? product.moq) > 1 ? "s" : ""}`
                              : product.moq}
                          </p>
                        </div>

                        {config?.saleUnit === "SET" &&
                          piecesPerSet > 0 && (
                            <p className="mt-1 text-[9px] font-semibold text-gray-500">
                              {config.setName
                                ? `${config.setName} • `
                                : ""}
                              1 set = {piecesPerSet} pieces
                              {config.setBreakAllowed === false
                                ? " • Set cannot be broken"
                                : ""}
                            </p>
                          )}

                        {product.wholesaleTiers?.length > 0 && (
                          <p className="mt-1 text-[9px] font-semibold text-gray-400">
                            {product.wholesaleTiers.length} quantity tier
                            {product.wholesaleTiers.length > 1 ? "s" : ""}
                          </p>
                        )}

                        {config?.composition &&
                          config.composition.length > 0 && (
                            <p className="mt-1 truncate text-[9px] font-medium text-gray-400">
                              Composition:{" "}
                              {config.composition
                                .map(
                                  (item) =>
                                    `${item.value} × ${item.quantity}`
                                )
                                .join(" • ")}
                            </p>
                          )}

                        <p className="mt-2 text-[9px] font-bold text-gray-400">
                          Available: {stockDisplay.value.toLocaleString("en-IN")}{" "}
                          {stockDisplay.label}
                        </p>
                      </div>
                    );
                  })()}

                  {/* QUICK STOCK */}

                  <div className="mt-3 rounded-2xl border border-gray-200 p-3">

                    <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
                      Quick Stock Update
                    </p>

                    <div className="mt-2 flex gap-2">

                      <input
                        type="number"
                        min="0"
                        value={
                          stockValues[product.id] ??
                          ""
                        }
                        onChange={(event) =>
                          setStockValues(
                            (current) => ({
                              ...current,
                              [product.id]:
                                event.target.value,
                            })
                          )
                        }
                        className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-black"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          handleStockUpdate(product)
                        }
                        disabled={
                          updatingStock ===
                          product.id
                        }
                        className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updatingStock ===
                        product.id
                          ? "..."
                          : "Save"}
                      </button>
                    </div>
                  </div>

                  {/* ACTIONS */}

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
                      handleDeleteProduct(product)
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
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
