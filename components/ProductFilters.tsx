"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProductFiltersProps = {
  currentPricing: string;
  currentRating?: number;
  currentSort: string;
};

export default function ProductFilters({
  currentPricing,
  currentRating,
  currentSort,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  function updateParam(
    key: string,
    value?: string
  ) {
    const params = new URLSearchParams(
      searchParams.toString()
    );

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    router.push(
      `${pathname}?${params.toString()}`
    );
  }

  function clearFilters() {
    router.push("/products");
    setMobileOpen(false);
  }

  return (
    <>
      {/* DESKTOP FILTER SIDEBAR */}

      <aside className="hidden lg:block">

        <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-5">

          <div className="flex items-center justify-between">

            <h2 className="text-sm font-black">
              Filters
            </h2>

            <button
              type="button"
              onClick={clearFilters}
              className="text-[10px] font-bold text-gray-400 hover:text-black"
            >
              Clear
            </button>

          </div>

          {/* BUYING TYPE */}

          <div className="mt-6">

            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Buying Type
            </p>

            <div className="mt-3 space-y-2">

              <button
                type="button"
                onClick={() =>
                  updateParam("pricing", "retail")
                }
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs ${
                  currentPricing === "retail"
                    ? "bg-black text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>🛍️ Retail</span>

                {currentPricing === "retail" && (
                  <span>✓</span>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  updateParam(
                    "pricing",
                    "wholesale"
                  )
                }
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs ${
                  currentPricing === "wholesale"
                    ? "bg-black text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span>📦 Wholesale</span>

                {currentPricing === "wholesale" && (
                  <span>✓</span>
                )}
              </button>

            </div>
          </div>

          {/* PRICE */}

          <div className="mt-6">

            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Price Range
            </p>

            <form
              action="/products"
              method="GET"
              className="mt-3 space-y-2"
            >

              <input
                type="number"
                name="minPrice"
                placeholder="₹ Minimum"
                min="0"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-black"
              />

              <input
                type="number"
                name="maxPrice"
                placeholder="₹ Maximum"
                min="0"
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-black"
              />

              {currentPricing !== "all" && (
                <input
                  type="hidden"
                  name="pricing"
                  value={currentPricing}
                />
              )}

              <button
                type="submit"
                className="w-full rounded-lg bg-black py-2.5 text-[11px] font-bold text-white"
              >
                Apply Price
              </button>

            </form>

          </div>

          {/* RATING */}

          <div className="mt-6">

            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Customer Rating
            </p>

            <div className="mt-3 space-y-2">

              {[4, 3, 2].map(
                (rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() =>
                      updateParam(
                        "rating",
                        String(rating)
                      )
                    }
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      currentRating === rating
                        ? "bg-black text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >

                    <span>
                      {"★".repeat(rating)}
                    </span>

                    <span>& above</span>

                  </button>
                )
              )}

            </div>

          </div>

          {/* SORT */}

          <div className="mt-6">

            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Sort By
            </p>

            <div className="mt-3 space-y-2">

              <button
                type="button"
                onClick={() =>
                  updateParam(
                    "sort",
                    "newest"
                  )
                }
                className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                  currentSort === "newest"
                    ? "bg-black text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                ✨ Newest
              </button>

              <button
                type="button"
                onClick={() =>
                  updateParam(
                    "sort",
                    "price_low"
                  )
                }
                className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                  currentSort === "price_low"
                    ? "bg-black text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                ₹ Price: Low to High
              </button>

              <button
                type="button"
                onClick={() =>
                  updateParam(
                    "sort",
                    "price_high"
                  )
                }
                className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                  currentSort === "price_high"
                    ? "bg-black text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                ₹ Price: High to Low
              </button>

              <button
                type="button"
                onClick={() =>
                  updateParam(
                    "sort",
                    "rating_high"
                  )
                }
                className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                  currentSort === "rating_high"
                    ? "bg-black text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                ⭐ Top Rated
              </button>

              <button
                type="button"
                onClick={() =>
                  updateParam(
                    "sort",
                    "name_az"
                  )
                }
                className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                  currentSort === "name_az"
                    ? "bg-black text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                A–Z
              </button>

            </div>

          </div>

        </div>

      </aside>

      {/* MOBILE FILTER BUTTON */}

      <div className="mb-5 lg:hidden">

        <button
          type="button"
          onClick={() =>
            setMobileOpen(true)
          }
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold"
        >
          <span>⚙️ Filters & Sort</span>

          <span className="text-gray-400">
            Open →
          </span>
        </button>

      </div>

      {/* MOBILE DRAWER */}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">

          {/* BACKDROP */}

          <button
            type="button"
            aria-label="Close filters"
            onClick={() =>
              setMobileOpen(false)
            }
            className="absolute inset-0 bg-black/50"
          />

          {/* DRAWER */}

          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  ANJIVO
                </p>

                <h2 className="mt-1 text-lg font-black">
                  Filters
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMobileOpen(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm"
              >
                ✕
              </button>

            </div>

            <div className="space-y-7 p-5">

              {/* BUYING TYPE */}

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Buying Type
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">

                  <button
                    type="button"
                    onClick={() =>
                      updateParam(
                        "pricing",
                        "retail"
                      )
                    }
                    className={`rounded-xl border p-3 text-left text-xs font-bold ${
                      currentPricing === "retail"
                        ? "border-black bg-black text-white"
                        : "border-gray-200"
                    }`}
                  >
                    🛍️ Retail
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateParam(
                        "pricing",
                        "wholesale"
                      )
                    }
                    className={`rounded-xl border p-3 text-left text-xs font-bold ${
                      currentPricing === "wholesale"
                        ? "border-black bg-black text-white"
                        : "border-gray-200"
                    }`}
                  >
                    📦 Wholesale
                  </button>

                </div>

              </div>

              {/* SORT */}

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Sort Products
                </p>

                <div className="mt-3 space-y-2">

                  {[
                    ["newest", "✨ Newest"],
                    [
                      "price_low",
                      "₹ Price: Low to High",
                    ],
                    [
                      "price_high",
                      "₹ Price: High to Low",
                    ],
                    [
                      "rating_high",
                      "⭐ Top Rated",
                    ],
                    ["name_az", "A–Z"],
                  ].map(
                    ([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateParam(
                            "sort",
                            value
                          )
                        }
                        className={`w-full rounded-xl px-4 py-3 text-left text-xs font-semibold ${
                          currentSort === value
                            ? "bg-black text-white"
                            : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}

                </div>

              </div>

              {/* RATING */}

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Rating
                </p>

                <div className="mt-3 space-y-2">

                  {[4, 3, 2].map(
                    (rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() =>
                          updateParam(
                            "rating",
                            String(rating)
                          )
                        }
                        className={`w-full rounded-xl px-4 py-3 text-left text-xs font-semibold ${
                          currentRating === rating
                            ? "bg-black text-white"
                            : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {"★".repeat(rating)}
                        {" "}
                        & above
                      </button>
                    )
                  )}

                </div>

              </div>

              {/* PRICE */}

              <div>

                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Price Range
                </p>

                <form
                  action="/products"
                  method="GET"
                  className="mt-3 space-y-2"
                >

                  <input
                    type="number"
                    name="minPrice"
                    min="0"
                    placeholder="₹ Minimum"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-black"
                  />

                  <input
                    type="number"
                    name="maxPrice"
                    min="0"
                    placeholder="₹ Maximum"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-black"
                  />

                  {currentPricing !== "all" && (
                    <input
                      type="hidden"
                      name="pricing"
                      value={currentPricing}
                    />
                  )}

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white"
                  >
                    Apply Price
                  </button>

                </form>

              </div>

              {/* CLEAR */}

              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-xl border border-gray-200 py-3 text-xs font-bold text-gray-700"
              >
                Clear All Filters
              </button>

            </div>

          </div>

        </div>
      )}
    </>
  );
}
