
"use client";

import { useCallback, useEffect, useState } from "react";

type Listing = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  brand?: string;
  price?: number | string;
  stock?: number | string;
  images?: string[];
  sellerId?: string;
  status?: string;
  createdAt?: string | number | null;
};

export default function AdminAIListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("pending_review");

  const getToken = useCallback(async () => {
    const { getAuth } = await import("firebase/auth");
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please login with your admin account.");
    }

    return user.getIdToken();
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      const response = await fetch(
        "/api/admin/review-listing",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load AI listings."
        );
      }

      const fetchedListings: Listing[] = Array.isArray(
        data.listings
      )
        ? data.listings
        : [];

      setListings(fetchedListings);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const reviewListing = async (
    listingId: string,
    action: "approve" | "reject"
  ) => {
    setProcessingId(listingId);
    setError("");
    setMessage("");

    try {
      const token = await getToken();

      const response = await fetch(
        "/api/admin/review-listing",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listingId,
            action,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to review listing."
        );
      }

      setMessage(
        action === "approve"
          ? "Listing approved successfully."
          : "Listing rejected successfully."
      );

      setListings((previous) =>
        previous.filter((item) => item.id !== listingId)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Review failed."
      );
    } finally {
      setProcessingId("");
    }
  };

  const filteredListings = listings.filter((listing) => {
    if (filter === "all") return true;
    return listing.status === filter;
  });

  const formatDate = (value?: string | number | null) => {
    if (!value) return "N/A";

    try {
      const date =
        typeof value === "number"
          ? new Date(value)
          : new Date(value);

      if (isNaN(date.getTime())) return "N/A";

      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              AI Listing Review
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              Review and manage AI-generated product listings
              submitted by sellers.
            </p>
          </div>

          <button
            onClick={fetchListings}
            disabled={loading}
            className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Listings"}
          </button>
        </div>

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Loaded
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {listings.length}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Pending Review
            </p>

            <p className="mt-2 text-3xl font-bold text-yellow-600">
              {
                listings.filter(
                  (item) =>
                    item.status === "pending_review"
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Displayed Listings
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {filteredListings.length}
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Filter */}
        <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Product Listings
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Review product information before approval.
            </p>
          </div>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-black"
          >
            <option value="pending_review">
              Pending Review
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="all">
              All Loaded
            </option>
          </select>
        </div>

        {/* Listing Content */}
        {loading ? (
          <div className="rounded-xl border bg-white p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

            <p className="mt-4 text-sm text-gray-600">
              Loading listings...
            </p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center">
            <div className="text-5xl">📦</div>

            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No listings found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              There are no listings available for this filter.
            </p>

            <button
              onClick={fetchListings}
              className="mt-5 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Reload
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                className="overflow-hidden rounded-xl border bg-white shadow-sm"
              >
                <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[180px_1fr]">
                  {/* Product Image */}
                  <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg bg-gray-100 md:h-44">
                    {listing.images &&
                    listing.images.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={listing.images[0]}
                        alt={listing.title || "Product"}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <div className="text-4xl">📷</div>
                        <p className="mt-2 text-xs">
                          No product image
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {listing.title || "Untitled Product"}
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                          Listing ID: {listing.id}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          listing.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : listing.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {listing.status || "pending_review"}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {listing.description ||
                        "No description available."}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Price
                        </p>

                        <p className="mt-1 font-semibold text-gray-900">
                          ₹
                          {Number(listing.price || 0).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Stock
                        </p>

                        <p className="mt-1 font-semibold text-gray-900">
                          {listing.stock ?? 0}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Category
                        </p>

                        <p className="mt-1 truncate font-semibold text-gray-900">
                          {listing.category || "N/A"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                          Brand
                        </p>

                        <p className="mt-1 truncate font-semibold text-gray-900">
                          {listing.brand || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <div className="text-xs text-gray-500">
                        <p>
                          Seller ID: {listing.sellerId || "N/A"}
                        </p>

                        <p className="mt-1">
                          Submitted: {formatDate(listing.createdAt)}
                        </p>
                      </div>

                      {listing.status === "pending_review" && (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() =>
                              reviewListing(
                                listing.id,
                                "reject"
                              )
                            }
                            disabled={
                              processingId === listing.id
                            }
                            className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {processingId === listing.id
                              ? "Processing..."
                              : "Reject"}
                          </button>

                          <button
                            onClick={() =>
                              reviewListing(
                                listing.id,
                                "approve"
                              )
                            }
                            disabled={
                              processingId === listing.id
                            }
                            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                          >
                            {processingId === listing.id
                              ? "Processing..."
                              : "Approve"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
