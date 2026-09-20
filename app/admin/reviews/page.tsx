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
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type ReviewStatus =
  | "pending"
  | "approved"
  | "hidden"
  | "reported"
  | "rejected";

type Review = {
  id: string;

  productId: string;
  productName: string;

  sellerId: string;
  sellerName: string;

  customerId: string;
  customerName: string;
  customerEmail: string;

  rating: number;
  title: string;
  comment: string;

  images: string[];

  verifiedPurchase: boolean;

  helpfulCount: number;
  reportCount: number;

  status: ReviewStatus;

  adminNote: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : 0;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function arrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string"
  );
}

function timestampValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis ===
      "function"
  ) {
    return (
      value as { toMillis: () => number }
    ).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const time = new Date(value).getTime();

    return Number.isFinite(time) ? time : 0;
  }

  return 0;
}

function formatDate(value: unknown): string {
  const millis = timestampValue(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(millis));
}

function mapReview(
  id: string,
  data: Record<string, unknown>
): Review {
  const status =
    data.status === "approved" ||
    data.status === "hidden" ||
    data.status === "reported" ||
    data.status === "rejected"
      ? data.status
      : "pending";

  return {
    id,

    productId: stringValue(data.productId),
    productName: stringValue(data.productName),

    sellerId: stringValue(data.sellerId),
    sellerName: stringValue(data.sellerName),

    customerId: stringValue(data.customerId),
    customerName: stringValue(data.customerName),
    customerEmail: stringValue(data.customerEmail),

    rating: Math.min(
      5,
      Math.max(0, numberValue(data.rating))
    ),

    title: stringValue(data.title),
    comment: stringValue(data.comment),

    images: arrayValue(data.images),

    verifiedPurchase: booleanValue(
      data.verifiedPurchase
    ),

    helpfulCount: numberValue(
      data.helpfulCount
    ),

    reportCount: numberValue(
      data.reportCount
    ),

    status,

    adminNote: stringValue(
      data.adminNote
    ),

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function getRatingLabel(rating: number) {
  if (rating >= 5) return "Excellent";
  if (rating >= 4) return "Good";
  if (rating >= 3) return "Average";
  if (rating >= 2) return "Poor";
  return "Very Poor";
}

export default function AdminReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "all" | ReviewStatus
  >("all");

  const [ratingFilter, setRatingFilter] = useState<
    "all" | "1" | "2" | "3" | "4" | "5"
  >("all");

  const [verifiedFilter, setVerifiedFilter] = useState<
    "all" | "verified" | "unverified"
  >("all");

  const [selectedReview, setSelectedReview] =
    useState<Review | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          window.location.href =
            "/login?redirect=/admin/reviews";
          return;
        }

        try {
          const userSnap = await getDoc(
            doc(db, "users", user.uid)
          );

          if (!userSnap.exists()) {
            window.location.href = "/";
            return;
          }

          const userData = userSnap.data();

          if (userData.role !== "ADMIN") {
            window.location.href = "/account";
            return;
          }

          setAuthorized(true);

          await loadReviews();
        } catch (error) {
          console.error(
            "Admin authorization error:",
            error
          );

          window.location.href = "/";
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function loadReviews() {
    try {
      const snapshot = await getDocs(
        collection(db, "reviews")
      );

      const list = snapshot.docs.map((item) =>
        mapReview(item.id, item.data())
      );

      list.sort(
        (a, b) =>
          timestampValue(b.createdAt) -
          timestampValue(a.createdAt)
      );

      setReviews(list);
    } catch (error) {
      console.error(
        "Load reviews error:",
        error
      );

      alert(
        "Reviews load nahi ho paaye. Firestore rules check karein."
      );
    }
  }

  const filteredReviews = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return reviews.filter((review) => {
      const matchesSearch =
        !query ||
        review.productName
          .toLowerCase()
          .includes(query) ||
        review.productId
          .toLowerCase()
          .includes(query) ||
        review.sellerName
          .toLowerCase()
          .includes(query) ||
        review.customerName
          .toLowerCase()
          .includes(query) ||
        review.customerEmail
          .toLowerCase()
          .includes(query) ||
        review.title
          .toLowerCase()
          .includes(query) ||
        review.comment
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        review.status === statusFilter;

      const matchesRating =
        ratingFilter === "all" ||
        review.rating ===
          Number(ratingFilter);

      const matchesVerified =
        verifiedFilter === "all" ||
        (verifiedFilter === "verified" &&
          review.verifiedPurchase) ||
        (verifiedFilter === "unverified" &&
          !review.verifiedPurchase);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRating &&
        matchesVerified
      );
    });
  }, [
    reviews,
    search,
    statusFilter,
    ratingFilter,
    verifiedFilter,
  ]);

  const stats = useMemo(() => {
    const total = reviews.length;

    const approved = reviews.filter(
      (review) =>
        review.status === "approved"
    ).length;

    const pending = reviews.filter(
      (review) =>
        review.status === "pending"
    ).length;

    const reported = reviews.filter(
      (review) =>
        review.status === "reported"
    ).length;

    const hidden = reviews.filter(
      (review) =>
        review.status === "hidden"
    ).length;

    const rejected = reviews.filter(
      (review) =>
        review.status === "rejected"
    ).length;

    const verified = reviews.filter(
      (review) =>
        review.verifiedPurchase
    ).length;

    const totalReports = reviews.reduce(
      (sum, review) =>
        sum + review.reportCount,
      0
    );

    const averageRating =
      total > 0
        ? reviews.reduce(
            (sum, review) =>
              sum + review.rating,
            0
          ) / total
        : 0;

    return {
      total,
      approved,
      pending,
      reported,
      hidden,
      rejected,
      verified,
      totalReports,
      averageRating,
    };
  }, [reviews]);

  async function updateReviewStatus(
    review: Review,
    status: ReviewStatus
  ) {
    setSaving(true);

    try {
      await updateDoc(
        doc(db, "reviews", review.id),
        {
          status,
          updatedAt: serverTimestamp(),
        }
      );

      await loadReviews();

      if (
        selectedReview?.id === review.id
      ) {
        setSelectedReview({
          ...review,
          status,
        });
      }
    } catch (error) {
      console.error(
        "Update review status error:",
        error
      );

      alert(
        "Review status update nahi ho saka."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAdminNote(
    review: Review,
    note: string
  ) {
    setSaving(true);

    try {
      await updateDoc(
        doc(db, "reviews", review.id),
        {
          adminNote: note.trim(),
          updatedAt: serverTimestamp(),
        }
      );

      await loadReviews();

      setSelectedReview({
        ...review,
        adminNote: note.trim(),
      });

      alert("Admin note saved.");
    } catch (error) {
      console.error(
        "Save admin note error:",
        error
      );

      alert(
        "Admin note save nahi ho saka."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview(
    review: Review
  ) {
    const confirmed = window.confirm(
      `Kya aap "${review.productName}" ka review permanently delete karna chahte hain?`
    );

    if (!confirmed) return;

    try {
      await deleteDoc(
        doc(db, "reviews", review.id)
      );

      if (
        selectedReview?.id === review.id
      ) {
        setSelectedReview(null);
      }

      await loadReviews();
    } catch (error) {
      console.error(
        "Delete review error:",
        error
      );

      alert(
        "Review delete nahi ho saka."
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading reviews...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="shrink-0"
            >
              <img
                src="/logo/anjivo-logo.png"
                alt="ANJIVO"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="hidden border-l pl-4 sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin Panel
              </p>

              <h1 className="text-lg font-bold text-slate-900">
                Reviews & Ratings
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Admin Home
            </Link>

            <button
              onClick={loadReviews}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-indigo-600">
            Trust & Safety
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Reviews & Ratings
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Customer reviews, ratings, verified purchases
            aur reported reviews ko centrally moderate karein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label="Total"
            value={stats.total}
            icon="💬"
          />

          <StatCard
            label="Approved"
            value={stats.approved}
            icon="🟢"
          />

          <StatCard
            label="Pending"
            value={stats.pending}
            icon="🟡"
          />

          <StatCard
            label="Reported"
            value={stats.reported}
            icon="🚩"
          />

          <StatCard
            label="Hidden"
            value={stats.hidden}
            icon="🙈"
          />

          <StatCard
            label="Rejected"
            value={stats.rejected}
            icon="🔴"
          />

          <StatCard
            label="Verified"
            value={stats.verified}
            icon="✓"
          />

          <StatCard
            label="Avg Rating"
            value={Number(
              stats.averageRating.toFixed(1)
            )}
            icon="⭐"
            decimal
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_190px_auto]">
              <SearchBox
                value={search}
                onChange={setSearch}
              />

              <SelectBox
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value as
                      | "all"
                      | ReviewStatus
                  )
                }
                options={[
                  ["all", "All Status"],
                  ["pending", "Pending"],
                  ["approved", "Approved"],
                  ["reported", "Reported"],
                  ["hidden", "Hidden"],
                  ["rejected", "Rejected"],
                ]}
              />

              <SelectBox
                value={ratingFilter}
                onChange={(value) =>
                  setRatingFilter(
                    value as
                      | "all"
                      | "1"
                      | "2"
                      | "3"
                      | "4"
                      | "5"
                  )
                }
                options={[
                  ["all", "All Ratings"],
                  ["5", "5 Stars"],
                  ["4", "4 Stars"],
                  ["3", "3 Stars"],
                  ["2", "2 Stars"],
                  ["1", "1 Star"],
                ]}
              />

              <SelectBox
                value={verifiedFilter}
                onChange={(value) =>
                  setVerifiedFilter(
                    value as
                      | "all"
                      | "verified"
                      | "unverified"
                  )
                }
                options={[
                  ["all", "All Purchases"],
                  [
                    "verified",
                    "Verified Purchase",
                  ],
                  [
                    "unverified",
                    "Unverified",
                  ],
                ]}
              />

              <button
                onClick={loadReviews}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <EmptyState
              title="No reviews found"
              description={
                reviews.length === 0
                  ? "Abhi reviews collection mein koi review nahi hai."
                  : "Current filters ke according koi review nahi mila."
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredReviews.map(
                (review) => (
                  <ReviewRow
                    key={review.id}
                    review={review}
                    onOpen={() =>
                      setSelectedReview(
                        review
                      )
                    }
                    onApprove={() =>
                      updateReviewStatus(
                        review,
                        "approved"
                      )
                    }
                    onHide={() =>
                      updateReviewStatus(
                        review,
                        "hidden"
                      )
                    }
                    onReject={() =>
                      updateReviewStatus(
                        review,
                        "rejected"
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      {selectedReview && (
        <ReviewDetailsModal
          review={selectedReview}
          saving={saving}
          onClose={() =>
            setSelectedReview(null)
          }
          onStatusChange={(
            status
          ) =>
            updateReviewStatus(
              selectedReview,
              status
            )
          }
          onSaveNote={(note) =>
            saveAdminNote(
              selectedReview,
              note
            )
          }
          onDelete={() =>
            deleteReview(
              selectedReview
            )
          }
        />
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  decimal = false,
}: {
  label: string;
  value: number;
  icon: string;
  decimal?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {decimal
              ? value.toFixed(1)
              : value.toLocaleString(
                  "en-IN"
                )}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        🔎
      </span>

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder="Search product, customer, seller, review..."
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value
        )
      }
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
    >
      {options.map(
        ([optionValue, label]) => (
          <option
            key={optionValue}
            value={optionValue}
          >
            {label}
          </option>
        )
      )}
    </select>
  );
}

function ReviewRow({
  review,
  onOpen,
  onApprove,
  onHide,
  onReject,
}: {
  review: Review;
  onOpen: () => void;
  onApprove: () => void;
  onHide: () => void;
  onReject: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RatingStars
              rating={review.rating}
            />

            <span className="text-sm font-bold text-slate-800">
              {review.rating}/5
            </span>

            <StatusBadge
              status={review.status}
            />

            {review.verifiedPurchase && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                ✓ Verified Purchase
              </span>
            )}

            {review.reportCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                🚩 {review.reportCount} Report
                {review.reportCount > 1
                  ? "s"
                  : ""}
              </span>
            )}
          </div>

          <h3 className="mt-2 text-base font-bold text-slate-900">
            {review.title ||
              "Untitled Review"}
          </h3>

          <p className="mt-1 line-clamp-3 max-w-4xl text-sm leading-6 text-slate-600">
            {review.comment ||
              "No written comment."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <InfoBadge
              label={`Product: ${
                review.productName ||
                review.productId ||
                "Unknown"
              }`}
            />

            <InfoBadge
              label={`Customer: ${
                review.customerName ||
                "Unknown"
              }`}
            />

            <InfoBadge
              label={`Seller: ${
                review.sellerName ||
                "Unknown"
              }`}
            />

            <InfoBadge
              label={getRatingLabel(
                review.rating
              )}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:w-[250px] lg:justify-end">
          <button
            onClick={onOpen}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            👁 View
          </button>

          <button
            onClick={onApprove}
            className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            ✓ Approve
          </button>

          <button
            onClick={onHide}
            className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          >
            🙈 Hide
          </button>

          <button
            onClick={onReject}
            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Reject
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="text-xs text-slate-500">
          {formatDate(
            review.createdAt
          )}
        </div>

        <div className="flex gap-4 text-xs text-slate-500">
          <span>
            👍 {review.helpfulCount}
          </span>

          <span>
            🚩 {review.reportCount}
          </span>

          <span>
            {review.images.length} image
            {review.images.length === 1
              ? ""
              : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}

function RatingStars({
  rating,
}: {
  rating: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(
        (star) => (
          <span
            key={star}
            className={
              star <= rating
                ? "text-amber-500"
                : "text-slate-300"
            }
          >
            ★
          </span>
        )
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ReviewStatus;
}) {
  const styles: Record<
    ReviewStatus,
    string
  > = {
    pending:
      "bg-amber-100 text-amber-700",
    approved:
      "bg-emerald-100 text-emerald-700",
    hidden:
      "bg-slate-100 text-slate-700",
    reported:
      "bg-red-100 text-red-700",
    rejected:
      "bg-red-100 text-red-700",
  };

  const labels: Record<
    ReviewStatus,
    string
  > = {
    pending: "Pending",
    approved: "Approved",
    hidden: "Hidden",
    reported: "Reported",
    rejected: "Rejected",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function InfoBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="max-w-full rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
      {label}
    </span>
  );
}

function ReviewDetailsModal({
  review,
  saving,
  onClose,
  onStatusChange,
  onSaveNote,
  onDelete,
}: {
  review: Review;
  saving: boolean;
  onClose: () => void;
  onStatusChange: (
    status: ReviewStatus
  ) => void;
  onSaveNote: (
    note: string
  ) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(
    review.adminNote
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Review Moderation
            </p>

            <h2 className="text-xl font-bold text-slate-900">
              Review Details
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <RatingStars
                  rating={review.rating}
                />

                <span className="text-sm font-bold text-slate-800">
                  {review.rating}/5
                </span>

                <StatusBadge
                  status={review.status}
                />

                {review.verifiedPurchase && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    ✓ Verified Purchase
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-xl font-bold text-slate-900">
                {review.title ||
                  "Untitled Review"}
              </h3>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {review.comment ||
                  "No written comment."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailCard
                label="Customer"
                value={
                  review.customerName ||
                  "Unknown"
                }
              />

              <DetailCard
                label="Email"
                value={
                  review.customerEmail ||
                  "—"
                }
              />

              <DetailCard
                label="Product"
                value={
                  review.productName ||
                  review.productId ||
                  "Unknown"
                }
              />

              <DetailCard
                label="Seller"
                value={
                  review.sellerName ||
                  review.sellerId ||
                  "Unknown"
                }
              />

              <DetailCard
                label="Helpful Votes"
                value={String(
                  review.helpfulCount
                )}
              />

              <DetailCard
                label="Reports"
                value={String(
                  review.reportCount
                )}
              />

              <DetailCard
                label="Created"
                value={formatDate(
                  review.createdAt
                )}
              />

              <DetailCard
                label="Review ID"
                value={review.id}
              />

              <DetailCard
                label="Product ID"
                value={
                  review.productId ||
                  "—"
                }
              />
            </div>

            {review.images.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Customer Images
                </h3>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {review.images.map(
                    (image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                      >
                        <img
                          src={image}
                          alt={`Review image ${
                            index + 1
                          }`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Moderation Actions
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    onStatusChange(
                      "approved"
                    )
                  }
                  disabled={saving}
                  className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                >
                  ✓ Approve
                </button>

                <button
                  onClick={() =>
                    onStatusChange(
                      "hidden"
                    )
                  }
                  disabled={saving}
                  className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                >
                  🙈 Hide
                </button>

                <button
                  onClick={() =>
                    onStatusChange(
                      "rejected"
                    )
                  }
                  disabled={saving}
                  className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                >
                  ✕ Reject
                </button>

                <button
                  onClick={() =>
                    onStatusChange(
                      "pending"
                    )
                  }
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ↩ Pending
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Admin Note
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Internal note. Customer ko nahi dikhaya
                jayega.
              </p>

              <textarea
                value={note}
                onChange={(event) =>
                  setNote(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Moderation reason / internal note..."
                className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />

              <button
                onClick={() =>
                  onSaveNote(note)
                }
                disabled={saving}
                className="mt-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Save Note
              </button>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800">
                Permanent Delete
              </p>

              <p className="mt-1 text-xs leading-5 text-red-700">
                Normal moderation ke liye Hide/Reject use
                karein. Permanent delete sirf exceptional
                cases mein use karein.
              </p>

              <button
                onClick={onDelete}
                disabled={saving}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        ⭐
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
