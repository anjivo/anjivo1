"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
} from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";

type Product = {
  id: string;
  name: string;
  brand: string;
  sellerId: string;
  sellerName: string;
  status: string;
  retailPrice: number;
  stock: number;
  category: string;
};

type BrandSummary = {
  name: string;
  products: number;
  activeProducts: number;
  sellers: number;
  stock: number;
};

export default function AdminBrandsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(
    null
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          window.location.href =
            "/admin/login?redirect=/admin/brands";
          return;
        }

        try {
          await loadProducts();
        } catch (err) {
          console.error("Brands page error:", err);
          setError(
            "Unable to load brand data. Please check Firestore permissions."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function loadProducts() {
    setError("");

    const snapshot = await getDocs(
      collection(db, "products")
    );

    const loadedProducts: Product[] = snapshot.docs.map(
      (productDoc) => {
        const data = productDoc.data();

        return {
          id: productDoc.id,

          name:
            typeof data.name === "string"
              ? data.name
              : "Unnamed Product",

          brand:
            typeof data.brand === "string"
              ? data.brand.trim()
              : "",

          sellerId:
            typeof data.sellerId === "string"
              ? data.sellerId
              : "",

          sellerName:
            typeof data.sellerName === "string"
              ? data.sellerName
              : "Unknown Seller",

          status:
            typeof data.status === "string"
              ? data.status
              : "draft",

          retailPrice:
            typeof data.retailPrice === "number"
              ? data.retailPrice
              : Number(data.retailPrice) || 0,

          stock:
            typeof data.stock === "number"
              ? data.stock
              : Number(data.stock) || 0,

          category:
            typeof data.categoryName === "string"
              ? data.categoryName
              : typeof data.category === "string"
              ? data.category
              : "",
        };
      }
    );

    setProducts(loadedProducts);
  }

  async function refresh() {
    try {
      setRefreshing(true);
      await loadProducts();
    } catch (err) {
      console.error(err);
      setError("Unable to refresh brands.");
    } finally {
      setRefreshing(false);
    }
  }

  const brands = useMemo(() => {
    const map = new Map<string, BrandSummary>();

    products.forEach((product) => {
      const brand =
        product.brand.trim() || "Unbranded";

      const existing = map.get(brand);

      if (!existing) {
        map.set(brand, {
          name: brand,
          products: 1,
          activeProducts:
            product.status === "active" ? 1 : 0,
          sellers: product.sellerId ? 1 : 0,
          stock: product.stock,
        });

        return;
      }

      existing.products += 1;

      if (product.status === "active") {
        existing.activeProducts += 1;
      }

      existing.stock += product.stock;
    });

    /*
     * Recalculate unique seller count per brand.
     */
    map.forEach((summary) => {
      const sellerIds = new Set(
        products
          .filter(
            (product) =>
              (product.brand.trim() ||
                "Unbranded") === summary.name
          )
          .map((product) => product.sellerId)
          .filter(Boolean)
      );

      summary.sellers = sellerIds.size;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [products]);

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase();

    return brands.filter((brand) =>
      brand.name.toLowerCase().includes(query)
    );
  }, [brands, search]);

  const selectedBrandProducts = useMemo(() => {
    if (!selectedBrand) {
      return [];
    }

    return products.filter(
      (product) =>
        (product.brand.trim() || "Unbranded") ===
        selectedBrand
    );
  }, [products, selectedBrand]);

  const totalBrands = brands.length;

  const brandedProducts = products.filter(
    (product) => product.brand.trim()
  ).length;

  const unbrandedProducts = products.filter(
    (product) => !product.brand.trim()
  ).length;

  const activeBrands = brands.filter(
    (brand) => brand.activeProducts > 0
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading Brands...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">

        {/* HEADER */}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-gray-400">
              <Link
                href="/admin"
                className="hover:text-black"
              >
                Admin
              </Link>

              <span>/</span>

              <span className="text-black">
                Brands
              </span>
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
              MARKETPLACE CATALOG
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Brands
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              View and monitor brands currently used by
              products across the ANJIVO marketplace.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/products"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold text-gray-700 hover:border-black"
            >
              Manage Products
            </Link>

            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="rounded-xl bg-black px-4 py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* STATS */}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Brands"
            value={totalBrands}
            icon="🏷️"
          />

          <StatCard
            title="Active Brands"
            value={activeBrands}
            icon="✅"
          />

          <StatCard
            title="Branded Products"
            value={brandedProducts}
            icon="📦"
          />

          <StatCard
            title="Unbranded Products"
            value={unbrandedProducts}
            icon="⚠️"
          />
        </section>

        {/* SEARCH */}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black">
                Brand Catalog
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {filteredBrands.length} brands found
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search brand..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black lg:max-w-sm"
            />
          </div>

          {/* BRAND TABLE */}

          <div className="mt-6 overflow-x-auto">
            {filteredBrands.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
                <div className="text-3xl">
                  🏷️
                </div>

                <p className="mt-3 text-sm font-black">
                  No brands found
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Try another search term.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[800px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] font-black uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-4">
                      Brand
                    </th>

                    <th className="px-4 py-4">
                      Products
                    </th>

                    <th className="px-4 py-4">
                      Active
                    </th>

                    <th className="px-4 py-4">
                      Sellers
                    </th>

                    <th className="px-4 py-4">
                      Stock
                    </th>

                    <th className="px-4 py-4 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredBrands.map((brand) => (
                    <tr
                      key={brand.name}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-lg">
                            🏷️
                          </div>

                          <div>
                            <p className="text-sm font-black">
                              {brand.name}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-400">
                              Marketplace brand
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm font-bold">
                        {brand.products.toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-black text-green-700">
                          {brand.activeProducts.toLocaleString(
                            "en-IN"
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm font-bold">
                        {brand.sellers.toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm font-bold">
                        {brand.stock.toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedBrand(
                              brand.name
                            )
                          }
                          className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black hover:border-black"
                        >
                          View Products →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* SELECTED BRAND */}

        {selectedBrand && (
          <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  BRAND PRODUCTS
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {selectedBrand}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {selectedBrandProducts.length} products
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedBrand(null)
                }
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold hover:border-black"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedBrandProducts.map(
                (product) => (
                  <Link
                    key={product.id}
                    href={`/admin/products/${product.id}/edit`}
                    className="rounded-2xl border border-gray-200 p-4 transition hover:border-black hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {product.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {product.category ||
                            "Uncategorized"}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${
                          product.status ===
                          "active"
                            ? "bg-green-50 text-green-700"
                            : product.status ===
                              "blocked"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {product.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">
                        Stock:{" "}
                        {product.stock.toLocaleString(
                          "en-IN"
                        )}
                      </span>

                      <span className="text-xs font-black">
                        Edit →
                      </span>
                    </div>
                  </Link>
                )
              )}
            </div>
          </section>
        )}

        {/* IMPORTANT NOTE */}

        <section className="mt-8 rounded-3xl border border-yellow-200 bg-yellow-50 p-5 sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-700">
            Current Implementation
          </p>

          <h2 className="mt-2 text-lg font-black text-yellow-900">
            Product-based brand catalog
          </h2>

          <p className="mt-2 max-w-4xl text-xs leading-6 text-yellow-800">
            This module currently derives brands from the
            existing product <strong>brand</strong> field.
            The current project does not have a separate
            Firestore brand collection/schema, so this page
            intentionally does not create a fake brand database
            or fake approval workflow.
          </p>
        </section>

      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
          {icon}
        </div>
      </div>

      <p className="mt-5 text-xs font-bold text-gray-400">
        {title}
      </p>

      <p className="mt-1 text-3xl font-black">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}
