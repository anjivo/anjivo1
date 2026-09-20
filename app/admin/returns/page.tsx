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

type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "pickup_pending"
  | "picked_up"
  | "received"
  | "qc_pending"
  | "qc_passed"
  | "qc_failed"
  | "refund_pending"
  | "refund_initiated"
  | "completed"
  | "disputed";

type RefundStatus =
  | "not_applicable"
  | "pending"
  | "approved"
  | "initiated"
  | "completed"
  | "failed";

type ReturnRequest = {
  id: string;

  orderId: string;
  productId: string;

  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  sellerId: string;
  sellerName: string;

  productName: string;
  quantity: number;
  amount: number;

  reason: string;
  description: string;

  returnStatus: ReturnStatus;
  refundStatus: RefundStatus;

  refundAmount: number;

  images: string[];

  qcStatus: string;
  dispute: boolean;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type ReturnFilter =
  | "all"
  | "requested"
  | "approved"
  | "rejected"
  | "pickup"
  | "received"
  | "qc"
  | "refund"
  | "completed"
  | "disputed";

function stringValue(
  value: unknown
): string {
  return value === undefined ||
    value === null
    ? ""
    : String(value);
}

function numberValue(
  value: unknown
): number {
  const valueNumber =
    Number(value);

  return Number.isFinite(
    valueNumber
  )
    ? valueNumber
    : 0;
}

function booleanValue(
  value: unknown
): boolean {
  return value === true;
}

function timestampValue(
  value: unknown
): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    return Number(
      (
        value as {
          seconds?: unknown;
        }
      ).seconds ?? 0
    );
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function normalizeReturnStatus(
  value: unknown
): ReturnStatus {
  const status =
    stringValue(value);

  const allowed: ReturnStatus[] =
    [
      "requested",
      "approved",
      "rejected",
      "pickup_pending",
      "picked_up",
      "received",
      "qc_pending",
      "qc_passed",
      "qc_failed",
      "refund_pending",
      "refund_initiated",
      "completed",
      "disputed",
    ];

  return allowed.includes(
    status as ReturnStatus
  )
    ? (status as ReturnStatus)
    : "requested";
}

function normalizeRefundStatus(
  value: unknown
): RefundStatus {
  const status =
    stringValue(value);

  const allowed: RefundStatus[] =
    [
      "not_applicable",
      "pending",
      "approved",
      "initiated",
      "completed",
      "failed",
    ];

  return allowed.includes(
    status as RefundStatus
  )
    ? (status as RefundStatus)
    : "pending";
}

function mapReturn(
  id: string,
  data: Record<string, unknown>
): ReturnRequest {
  const rawImages =
    Array.isArray(data.images)
      ? data.images
      : [];

  return {
    id,

    orderId:
      stringValue(
        data.orderId
      ),

    productId:
      stringValue(
        data.productId ||
          data.id
      ),

    customerId:
      stringValue(
        data.customerId ||
          data.userId
      ),

    customerName:
      stringValue(
        data.customerName
      ),

    customerEmail:
      stringValue(
        data.customerEmail
      ),

    customerPhone:
      stringValue(
        data.customerPhone
      ),

    sellerId:
      stringValue(
        data.sellerId
      ),

    sellerName:
      stringValue(
        data.sellerName
      ),

    productName:
      stringValue(
        data.productName ||
          data.name
      ),

    quantity:
      numberValue(
        data.quantity
      ),

    amount:
      numberValue(
        data.amount ||
          data.orderAmount
      ),

    reason:
      stringValue(
        data.reason
      ),

    description:
      stringValue(
        data.description
      ),

    returnStatus:
      normalizeReturnStatus(
        data.returnStatus ||
          data.status
      ),

    refundStatus:
      normalizeRefundStatus(
        data.refundStatus
      ),

    refundAmount:
      numberValue(
        data.refundAmount
      ),

    images:
      rawImages
        .map(
          (image) =>
            String(image)
        )
        .filter(Boolean),

    qcStatus:
      stringValue(
        data.qcStatus
      ) || "pending",

    dispute:
      booleanValue(
        data.dispute
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export default function AdminReturnsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [returns, setReturns] =
    useState<
      ReturnRequest[]
    >([]);

  const [filter, setFilter] =
    useState<ReturnFilter>(
      "all"
    );

  const [search, setSearch] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(
      null
    );

  const [selectedReturn, setSelectedReturn] =
    useState<ReturnRequest | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/returns";

            return;
          }

          try {
            const snapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !snapshot.exists()
            ) {
              window.location.href =
                "/";

              return;
            }

            if (
              snapshot.data()
                .role !== "ADMIN"
            ) {
              window.location.href =
                "/account";

              return;
            }

            setAuthorized(true);

            await loadReturns();
          } catch (err) {
            console.error(
              err
            );

            setError(
              "Admin access verify nahi ho saka."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  async function loadReturns() {
    try {
      setError("");

      const snapshot =
        await getDocs(
          collection(
            db,
            "returns"
          )
        );

      const list =
        snapshot.docs.map(
          (item) =>
            mapReturn(
              item.id,
              item.data()
            )
        );

      list.sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      );

      setReturns(list);
    } catch (err) {
      console.error(
        "Load returns error:",
        err
      );

      setError(
        "Returns load nahi ho paaye."
      );
    }
  }

  async function updateReturnStatus(
    request: ReturnRequest,
    status: ReturnStatus
  ) {
    if (
      request.returnStatus ===
      status
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Return #${request.id.slice(
          0,
          10
        )} ko "${status}" status dena hai?`
      );

    if (!confirmed) return;

    try {
      setProcessing(
        request.id
      );

      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "returns",
          request.id
        ),
        {
          returnStatus:
            status,

          updatedAt:
            serverTimestamp(),
        }
      );

      setReturns(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              request.id
                ? {
                    ...item,
                    returnStatus:
                      status,
                  }
                : item
          )
      );

      setSelectedReturn(
        (current) =>
          current &&
          current.id ===
            request.id
            ? {
                ...current,
                returnStatus:
                  status,
              }
            : current
      );

      setSuccess(
        `Return status updated to ${status}.`
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        "Return status update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function updateRefundStatus(
    request: ReturnRequest,
    status: RefundStatus
  ) {
    if (
      request.refundStatus ===
      status
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Refund status "${status}" set karna hai?`
      );

    if (!confirmed) return;

    try {
      setProcessing(
        request.id
      );

      setError("");
      setSuccess("");

      const updateData: Record<
        string,
        unknown
      > = {
        refundStatus:
          status,

        updatedAt:
          serverTimestamp(),
      };

      if (
        status ===
        "completed"
      ) {
        updateData.returnStatus =
          "completed";
      }

      await updateDoc(
        doc(
          db,
          "returns",
          request.id
        ),
        updateData
      );

      setReturns(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              request.id
                ? {
                    ...item,
                    refundStatus:
                      status,
                    returnStatus:
                      status ===
                      "completed"
                        ? "completed"
                        : item.returnStatus,
                  }
                : item
          )
      );

      setSelectedReturn(
        (current) =>
          current &&
          current.id ===
            request.id
            ? {
                ...current,
                refundStatus:
                  status,
                returnStatus:
                  status ===
                  "completed"
                    ? "completed"
                    : current.returnStatus,
              }
            : current
      );

      setSuccess(
        "Refund status updated."
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        "Refund status update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function markDispute(
    request: ReturnRequest
  ) {
    const nextValue =
      !request.dispute;

    const confirmed =
      window.confirm(
        nextValue
          ? "Is return ko dispute ke liye flag karna hai?"
          : "Dispute flag remove karna hai?"
      );

    if (!confirmed) return;

    try {
      setProcessing(
        request.id
      );

      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "returns",
          request.id
        ),
        {
          dispute:
            nextValue,

          returnStatus:
            nextValue
              ? "disputed"
              : request.returnStatus,

          updatedAt:
            serverTimestamp(),
        }
      );

      setReturns(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              request.id
                ? {
                    ...item,
                    dispute:
                      nextValue,
                    returnStatus:
                      nextValue
                        ? "disputed"
                        : item.returnStatus,
                  }
                : item
          )
      );

      setSelectedReturn(
        (current) =>
          current &&
          current.id ===
            request.id
            ? {
                ...current,
                dispute:
                  nextValue,
                returnStatus:
                  nextValue
                    ? "disputed"
                    : current.returnStatus,
              }
            : current
      );

      setSuccess(
        nextValue
          ? "Return dispute flagged."
          : "Dispute flag removed."
      );
    } catch (err) {
      console.error(
        err
      );

      setError(
        "Dispute update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  const filteredReturns =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return returns.filter(
        (request) => {
          let matchesFilter =
            true;

          if (
            filter ===
            "requested"
          ) {
            matchesFilter =
              request.returnStatus ===
              "requested";
          }

          if (
            filter ===
            "approved"
          ) {
            matchesFilter =
              request.returnStatus ===
              "approved";
          }

          if (
            filter ===
            "rejected"
          ) {
            matchesFilter =
              request.returnStatus ===
              "rejected";
          }

          if (
            filter ===
            "pickup"
          ) {
            matchesFilter =
              request.returnStatus ===
                "pickup_pending" ||
              request.returnStatus ===
                "picked_up";
          }

          if (
            filter ===
            "received"
          ) {
            matchesFilter =
              request.returnStatus ===
              "received";
          }

          if (
            filter ===
            "qc"
          ) {
            matchesFilter =
              request.returnStatus ===
                "qc_pending" ||
              request.returnStatus ===
                "qc_passed" ||
              request.returnStatus ===
                "qc_failed";
          }

          if (
            filter ===
            "refund"
          ) {
            matchesFilter =
              request.returnStatus ===
                "refund_pending" ||
              request.returnStatus ===
                "refund_initiated" ||
              request.refundStatus ===
                "initiated" ||
              request.refundStatus ===
                "pending";
          }

          if (
            filter ===
            "completed"
          ) {
            matchesFilter =
              request.returnStatus ===
              "completed";
          }

          if (
            filter ===
            "disputed"
          ) {
            matchesFilter =
              request.dispute ||
              request.returnStatus ===
                "disputed";
          }

          const searchableText = [
            request.id,
            request.orderId,
            request.productId,
            request.productName,
            request.customerName,
            request.customerEmail,
            request.customerPhone,
            request.sellerName,
            request.reason,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            searchableText.includes(
              query
            );

          return (
            matchesFilter &&
            matchesSearch
          );
        }
      );
    }, [
      returns,
      filter,
      search,
    ]);

  const counts =
    useMemo(
      () => ({
        all:
          returns.length,

        requested:
          returns.filter(
            (item) =>
              item.returnStatus ===
              "requested"
          ).length,

        approved:
          returns.filter(
            (item) =>
              item.returnStatus ===
              "approved"
          ).length,

        pickup:
          returns.filter(
            (item) =>
              item.returnStatus ===
                "pickup_pending" ||
              item.returnStatus ===
                "picked_up"
          ).length,

        received:
          returns.filter(
            (item) =>
              item.returnStatus ===
              "received"
          ).length,

        qc:
          returns.filter(
            (item) =>
              item.returnStatus ===
                "qc_pending" ||
              item.returnStatus ===
                "qc_passed" ||
              item.returnStatus ===
                "qc_failed"
          ).length,

        refund:
          returns.filter(
            (item) =>
              item.refundStatus ===
                "pending" ||
              item.refundStatus ===
                "initiated"
          ).length,

        completed:
          returns.filter(
            (item) =>
              item.returnStatus ===
              "completed"
          ).length,

        disputed:
          returns.filter(
            (item) =>
              item.dispute
          ).length,
      }),
      [returns]
    );

  const refundValue =
    returns.reduce(
      (sum, item) =>
        sum +
        item.refundAmount,
      0
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Returns Management...
          </p>

        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

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
              href="/admin/orders"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Orders
            </Link>

            <button
              type="button"
              onClick={() =>
                loadReturns()
              }
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white"
            >
              ↻ Refresh
            </button>

          </div>

        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        {/* TITLE */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ADMIN / RETURNS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Returns & Refunds
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Customer return requests, QC,
              disputes aur refund workflow
              manage karein.
            </p>

          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">

            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Refund Value
            </p>

            <p className="mt-1 text-xl font-black">
              ₹
              {refundValue.toLocaleString(
                "en-IN"
              )}
            </p>

          </div>

        </div>

        {/* ALERTS */}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-bold text-green-700">
              ✓ {success}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* FILTER CARDS */}

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

          <ReturnCount
            label="All"
            count={counts.all}
            active={
              filter === "all"
            }
            onClick={() =>
              setFilter("all")
            }
          />

          <ReturnCount
            label="Requested"
            count={
              counts.requested
            }
            active={
              filter ===
              "requested"
            }
            onClick={() =>
              setFilter(
                "requested"
              )
            }
          />

          <ReturnCount
            label="Approved"
            count={
              counts.approved
            }
            active={
              filter ===
              "approved"
            }
            onClick={() =>
              setFilter(
                "approved"
              )
            }
          />

          <ReturnCount
            label="Pickup"
            count={
              counts.pickup
            }
            active={
              filter === "pickup"
            }
            onClick={() =>
              setFilter("pickup")
            }
          />

          <ReturnCount
            label="Received"
            count={
              counts.received
            }
            active={
              filter ===
              "received"
            }
            onClick={() =>
              setFilter(
                "received"
              )
            }
          />

          <ReturnCount
            label="QC"
            count={counts.qc}
            active={
              filter === "qc"
            }
            onClick={() =>
              setFilter("qc")
            }
          />

          <ReturnCount
            label="Refund"
            count={
              counts.refund
            }
            active={
              filter === "refund"
            }
            onClick={() =>
              setFilter(
                "refund"
              )
            }
          />

          <ReturnCount
            label="Completed"
            count={
              counts.completed
            }
            active={
              filter ===
              "completed"
            }
            onClick={() =>
              setFilter(
                "completed"
              )
            }
          />

          <ReturnCount
            label="Disputed"
            count={
              counts.disputed
            }
            active={
              filter ===
              "disputed"
            }
            onClick={() =>
              setFilter(
                "disputed"
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
            placeholder="Search return ID, order ID, product, customer, seller or reason..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
          />

        </div>

        {/* LIST */}

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          {filteredReturns.length ===
          0 ? (
            <div className="p-14 text-center">

              <div className="text-5xl">
                ↩️
              </div>

              <h2 className="mt-4 text-lg font-black">
                No return requests
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Is filter ke according
                koi return request nahi
                mili.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {filteredReturns.map(
                (request) => (
                  <ReturnRow
                    key={
                      request.id
                    }
                    request={
                      request
                    }
                    processing={
                      processing ===
                      request.id
                    }
                    onView={() =>
                      setSelectedReturn(
                        request
                      )
                    }
                    onStatusChange={(
                      status
                    ) =>
                      updateReturnStatus(
                        request,
                        status
                      )
                    }
                    onRefundChange={(
                      status
                    ) =>
                      updateRefundStatus(
                        request,
                        status
                      )}
                    onDispute={() =>
                      markDispute(
                        request
                      )
                    }
                  />
                )
              )}

            </div>
          )}

        </div>

      </div>

      {/* DETAIL MODAL */}

      {selectedReturn && (
        <ReturnModal
          request={
            selectedReturn
          }
          processing={
            processing ===
            selectedReturn.id
          }
          onClose={() =>
            setSelectedReturn(
              null
            )
          }
          onStatusChange={(
            status
          ) =>
            updateReturnStatus(
              selectedReturn,
              status
            )
          }
          onRefundChange={(
            status
          ) =>
            updateRefundStatus(
              selectedReturn,
              status
            )
          }
          onDispute={() =>
            markDispute(
              selectedReturn
            )
          }
        />
      )}

    </main>
  );
}

/* =========================================================
   COUNT CARD
========================================================= */

function ReturnCount({
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

      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-black">
        {count.toLocaleString(
          "en-IN"
        )}
      </p>

    </button>
  );
}

/* =========================================================
   RETURN ROW
========================================================= */

function ReturnRow({
  request,
  processing,
  onView,
  onStatusChange,
  onRefundChange,
  onDispute,
}: {
  request: ReturnRequest;
  processing: boolean;
  onView: () => void;
  onStatusChange: (
    status: ReturnStatus
  ) => void;
  onRefundChange: (
    status: RefundStatus
  ) => void;
  onDispute: () => void;
}) {
  return (
    <div className="p-5 sm:p-6">

      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <h2 className="text-base font-black">
              #{request.id.slice(
                0,
                12
              )}
            </h2>

            <ReturnStatusBadge
              status={
                request.returnStatus
              }
            />

            <RefundStatusBadge
              status={
                request.refundStatus
              }
            />

            {request.dispute && (
              <span className="rounded-full bg-red-100 px-3 py-1.5 text-[9px] font-black text-red-700">
                ⚠ DISPUTED
              </span>
            )}

          </div>

          <div className="mt-3 flex flex-wrap gap-2">

            <InfoBadge>
              📦{" "}
              {request.productName ||
                "Product"}
            </InfoBadge>

            <InfoBadge>
              👤{" "}
              {request.customerName ||
                "Customer"}
            </InfoBadge>

            <InfoBadge>
              🏪{" "}
              {request.sellerName ||
                "Seller"}
            </InfoBadge>

            <InfoBadge>
              Qty:{" "}
              {request.quantity}
            </InfoBadge>

          </div>

          <p className="mt-3 text-xs text-gray-500">
            Reason:{" "}
            <span className="font-bold text-gray-700">
              {request.reason ||
                "Not specified"}
            </span>
          </p>

        </div>

        <div className="flex flex-col gap-3 xl:items-end">

          <p className="text-xl font-black">
            ₹
            {request.refundAmount ||
              request.amount
            .toLocaleString(
              "en-IN"
            )}
          </p>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={onView}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black hover:border-black"
            >
              View
            </button>

            <select
              value={
                request.returnStatus
              }
              disabled={
                processing
              }
              onChange={(event) =>
                onStatusChange(
                  event.target
                    .value as ReturnStatus
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-black"
            >
              <option value="requested">
                Requested
              </option>

              <option value="approved">
                Approved
              </option>

              <option value="rejected">
                Rejected
              </option>

              <option value="pickup_pending">
                Pickup Pending
              </option>

              <option value="picked_up">
                Picked Up
              </option>

              <option value="received">
                Received
              </option>

              <option value="qc_pending">
                QC Pending
              </option>

              <option value="qc_passed">
                QC Passed
              </option>

              <option value="qc_failed">
                QC Failed
              </option>

              <option value="refund_pending">
                Refund Pending
              </option>

              <option value="refund_initiated">
                Refund Initiated
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="disputed">
                Disputed
              </option>
            </select>

            <button
              type="button"
              disabled={
                processing
              }
              onClick={
                onDispute
              }
              className={`rounded-xl px-4 py-2.5 text-xs font-black ${
                request.dispute
                  ? "bg-red-600 text-white"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {request.dispute
                ? "Remove Dispute"
                : "Flag Dispute"}
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   RETURN MODAL
========================================================= */

function ReturnModal({
  request,
  processing,
  onClose,
  onStatusChange,
  onRefundChange,
  onDispute,
}: {
  request: ReturnRequest;
  processing: boolean;
  onClose: () => void;
  onStatusChange: (
    status: ReturnStatus
  ) => void;
  onRefundChange: (
    status: RefundStatus
  ) => void;
  onDispute: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">

      <div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b p-5 sm:p-6">

          <div>

            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              RETURN DETAILS
            </p>

            <h2 className="mt-1 text-xl font-black">
              #{request.id}
            </h2>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black"
          >
            Close
          </button>

        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">

          {/* CUSTOMER / SELLER */}

          <div className="grid gap-4 md:grid-cols-2">

            <DetailBox
              label="Customer"
              value={
                request.customerName ||
                "—"
              }
            />

            <DetailBox
              label="Seller"
              value={
                request.sellerName ||
                "—"
              }
            />

            <DetailBox
              label="Mobile"
              value={
                request.customerPhone ||
                "—"
              }
            />

            <DetailBox
              label="Email"
              value={
                request.customerEmail ||
                "—"
              }
            />

          </div>

          {/* PRODUCT */}

          <div className="mt-6 rounded-2xl border border-gray-200 p-5">

            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Product
            </p>

            <h3 className="mt-2 text-lg font-black">
              {request.productName ||
                "Product"}
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">

              <InfoBadge>
                Order:{" "}
                {request.orderId ||
                  "—"}
              </InfoBadge>

              <InfoBadge>
                Product ID:{" "}
                {request.productId ||
                  "—"}
              </InfoBadge>

              <InfoBadge>
                Quantity:{" "}
                {request.quantity}
              </InfoBadge>

              <InfoBadge>
                Amount: ₹
                {request.amount.toLocaleString(
                  "en-IN"
                )}
              </InfoBadge>

            </div>

          </div>

          {/* REASON */}

          <div className="mt-6 rounded-2xl border border-gray-200 p-5">

            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Return Reason
            </p>

            <p className="mt-2 text-sm font-black">
              {request.reason ||
                "Not specified"}
            </p>

            {request.description && (
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {request.description}
              </p>
            )}

          </div>

          {/* CONTROLS */}

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl border border-gray-200 p-4">

              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Return Status
              </p>

              <select
                value={
                  request.returnStatus
                }
                disabled={
                  processing
                }
                onChange={(
                  event
                ) =>
                  onStatusChange(
                    event.target
                      .value as ReturnStatus
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black"
              >
                <option value="requested">
                  Requested
                </option>

                <option value="approved">
                  Approved
                </option>

                <option value="rejected">
                  Rejected
                </option>

                <option value="pickup_pending">
                  Pickup Pending
                </option>

                <option value="picked_up">
                  Picked Up
                </option>

                <option value="received">
                  Received
                </option>

                <option value="qc_pending">
                  QC Pending
                </option>

                <option value="qc_passed">
                  QC Passed
                </option>

                <option value="qc_failed">
                  QC Failed
                </option>

                <option value="refund_pending">
                  Refund Pending
                </option>

                <option value="refund_initiated">
                  Refund Initiated
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="disputed">
                  Disputed
                </option>

              </select>

            </div>

            <div className="rounded-2xl border border-gray-200 p-4">

              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Refund Status
              </p>

              <select
                value={
                  request.refundStatus
                }
                disabled={
                  processing
                }
                onChange={(
                  event
                ) =>
                  onRefundChange(
                    event.target
                      .value as RefundStatus
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black"
              >
                <option value="not_applicable">
                  Not Applicable
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="approved">
                  Approved
                </option>

                <option value="initiated">
                  Initiated
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="failed">
                  Failed
                </option>

              </select>

            </div>

          </div>

          {/* REFUND */}

          <div className="mt-6 rounded-2xl bg-gray-50 p-5">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  Refund Amount
                </p>

                <p className="mt-1 text-2xl font-black">
                  ₹
                  {request.refundAmount.toLocaleString(
                    "en-IN"
                  )}
                </p>

              </div>

              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  onDispute
                }
                className={`rounded-xl px-5 py-3 text-xs font-black ${
                  request.dispute
                    ? "bg-red-600 text-white"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {request.dispute
                  ? "Remove Dispute Flag"
                  : "Flag As Dispute"}
              </button>

            </div>

          </div>

          {/* CUSTOMER IMAGES */}

          {request.images.length >
            0 && (
            <div className="mt-6">

              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Return Evidence
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">

                {request.images.map(
                  (
                    image,
                    index
                  ) => (
                    <a
                      key={`${image}-${index}`}
                      href={image}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-2xl border border-gray-200"
                    >
                      <img
                        src={image}
                        alt={`Return evidence ${
                          index + 1
                        }`}
                        className="aspect-square w-full object-cover"
                      />
                    </a>
                  )
                )}

              </div>

            </div>
          )}

          {/* WORKFLOW */}

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">

            <p className="text-xs font-black text-blue-800">
              Recommended ANJIVO return flow
            </p>

            <p className="mt-2 text-xs leading-6 text-blue-700">
              Request → Approval → Pickup →
              Received → QC → Refund
              Approval → Refund Initiated →
              Completed
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   BADGES
========================================================= */

function ReturnStatusBadge({
  status,
}: {
  status: ReturnStatus;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${returnStatusStyle(
        status
      )}`}
    >
      {status
        .replaceAll(
          "_",
          " "
        )
        .toUpperCase()}
    </span>
  );
}

function RefundStatusBadge({
  status,
}: {
  status: RefundStatus;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${
        status === "completed"
          ? "bg-green-100 text-green-700"
          : status === "failed"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      REFUND:{" "}
      {status
        .replaceAll(
          "_",
          " "
        )
        .toUpperCase()}
    </span>
  );
}

function returnStatusStyle(
  status: ReturnStatus
): string {
  if (
    status ===
      "completed" ||
    status === "qc_passed"
  ) {
    return "bg-green-100 text-green-700";
  }

  if (
    status ===
      "rejected" ||
    status === "qc_failed"
  ) {
    return "bg-red-100 text-red-700";
  }

  if (
    status ===
      "disputed"
  ) {
    return "bg-red-100 text-red-700";
  }

  if (
    status ===
      "requested" ||
    status ===
      "refund_pending"
  ) {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-blue-100 text-blue-700";
}

function InfoBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-600">
      {children}
    </span>
  );
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">

      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-bold text-gray-700">
        {value}
      </p>

    </div>
  );
}
