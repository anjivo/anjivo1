
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
  createdAt?: string | null;
  updatedAt?: string | null;
  cashfreeRefundId?: string;
  cashfreeRefundStatus?: string;
  cashfreeRefundArn?: string;
  refundProvider?: string;
};

const RETURN_STATUSES: ReturnStatus[] = [
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
  "disputed",
];

const REASONS: Record<string, string> = {
  damaged: "Damaged Product",
  wrong_item: "Wrong Item",
  missing_item: "Missing Item",
  quality_issue: "Quality Issue",
  size_issue: "Size Issue",
  not_as_described: "Not As Described",
  other: "Other",
};

function textValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeReturn(data: Record<string, unknown>): ReturnRequest {
  const validStatuses: ReturnStatus[] = [
    "requested", "approved", "rejected", "pickup_pending",
    "picked_up", "received", "qc_pending", "qc_passed",
    "qc_failed", "refund_pending", "refund_initiated",
    "completed", "disputed",
  ];

  const validRefundStatuses: RefundStatus[] = [
    "not_applicable", "pending", "approved",
    "initiated", "completed", "failed",
  ];

  const rawStatus = textValue(data.returnStatus || data.status);
  const rawRefundStatus = textValue(data.refundStatus);

  return {
    id: textValue(data.id),
    orderId: textValue(data.orderId),
    productId: textValue(data.productId || data.id),
    customerId: textValue(data.customerId || data.userId),
    customerName: textValue(data.customerName),
    customerEmail: textValue(data.customerEmail),
    customerPhone: textValue(data.customerPhone),
    sellerId: textValue(data.sellerId),
    sellerName: textValue(data.sellerName),
    productName: textValue(data.productName || data.name),
    quantity: numberValue(data.quantity),
    amount: numberValue(data.amount || data.orderAmount),
    reason: textValue(data.reason),
    description: textValue(data.description),
    returnStatus: validStatuses.includes(rawStatus as ReturnStatus)
      ? (rawStatus as ReturnStatus)
      : "requested",
    refundStatus: validRefundStatuses.includes(rawRefundStatus as RefundStatus)
      ? (rawRefundStatus as RefundStatus)
      : "pending",
    refundAmount: numberValue(data.refundAmount),
    images: Array.isArray(data.images)
      ? data.images.map(String).filter(Boolean)
      : [],
    qcStatus: textValue(data.qcStatus || "pending"),
    dispute: data.dispute === true,
    createdAt: textValue(data.createdAt) || null,
    updatedAt: textValue(data.updatedAt) || null,
    cashfreeRefundId: textValue(data.cashfreeRefundId),
    cashfreeRefundStatus: textValue(data.cashfreeRefundStatus),
    cashfreeRefundArn: textValue(data.cashfreeRefundArn),
    refundProvider: textValue(data.refundProvider),
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN");
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function statusLabel(value: string): string {
  return value.replaceAll("_", " ").toUpperCase();
}

function statusStyle(status: string): string {
  if (["completed", "qc_passed"].includes(status)) {
    return "bg-green-100 text-green-700";
  }
  if (["rejected", "qc_failed", "disputed", "failed"].includes(status)) {
    return "bg-red-100 text-red-700";
  }
  if (["requested", "refund_pending", "pending"].includes(status)) {
    return "bg-yellow-100 text-yellow-800";
  }
  return "bg-blue-100 text-blue-700";
}

export default function AdminReturnsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [filter, setFilter] = useState<ReturnFilter>("all");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Please login again.");
    return user.getIdToken();
  }, []);

  const apiRequest = useCallback(async (
    url: string,
    method: "GET" | "POST" | "PATCH",
    body?: Record<string, unknown>,
  ) => {
    const token = await getToken();

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      throw new Error(result.error || result.message || "Request failed.");
    }

    return result;
  }, [getToken]);

  const loadReturns = useCallback(async () => {
    try {
      setError("");
      const result = await apiRequest("/api/admin/returns", "GET");

      const list = Array.isArray(result.returns)
        ? result.returns.map((item: Record<string, unknown>) =>
            normalizeReturn(item)
          )
        : [];

      list.sort((a: ReturnRequest, b: ReturnRequest) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setReturns(list);

      setSelectedReturn((current) => {
        if (!current) return null;
        return list.find((item: ReturnRequest) => item.id === current.id) || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Returns load nahi ho paaye.");
    }
  }, [apiRequest]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login?redirect=/admin/returns";
        return;
      }

      try {
        await user.getIdToken();
        setAuthorized(true);
        await loadReturns();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Admin access verify nahi ho saka.");
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [loadReturns]);

  async function updateReturnStatus(
    request: ReturnRequest,
    status: ReturnStatus,
  ) {
    if (request.returnStatus === status) return;

    if (status === "completed" || status === "refund_initiated") {
      setError("Refund completion/initiation Cashfree confirmation se hi hoga.");
      return;
    }

    const confirmed = window.confirm(
      `Return #${request.id.slice(0, 10)} ka status "${statusLabel(status)}" karna hai?`,
    );
    if (!confirmed) return;

    try {
      setProcessing(request.id);
      setError("");
      setSuccess("");

      await apiRequest("/api/admin/returns", "PATCH", {
        returnId: request.id,
        action: "return_status",
        value: status,
      });

      setSuccess(`Return status updated: ${statusLabel(status)}`);
      await loadReturns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Return status update failed.");
    } finally {
      setProcessing(null);
    }
  }

  async function updateRefundStatus(
    request: ReturnRequest,
    status: RefundStatus,
  ) {
    if (["initiated", "completed"].includes(status)) {
      setError("Initiated aur Completed status provider confirmation se update honge.");
      return;
    }

    if (request.refundStatus === status) return;

    const confirmed = window.confirm(
      `Refund status "${statusLabel(status)}" set karna hai?`,
    );
    if (!confirmed) return;

    try {
      setProcessing(request.id);
      setError("");
      setSuccess("");

      await apiRequest("/api/admin/returns", "PATCH", {
        returnId: request.id,
        action: "refund_status",
        value: status,
      });

      setSuccess("Refund status updated.");
      await loadReturns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund status update failed.");
    } finally {
      setProcessing(null);
    }
  }

  async function markDispute(request: ReturnRequest) {
    const nextValue = !request.dispute;

    if (!window.confirm(
      nextValue ? "Is return ko dispute ke liye flag karna hai?"
        : "Dispute flag remove karna hai?",
    )) return;

    try {
      setProcessing(request.id);
      setError("");
      setSuccess("");

      await apiRequest("/api/admin/returns", "PATCH", {
        returnId: request.id,
        action: "dispute",
        value: nextValue,
      });

      setSuccess(nextValue ? "Return dispute flagged." : "Dispute flag removed.");
      await loadReturns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispute update failed.");
    } finally {
      setProcessing(null);
    }
  }

  async function processCashfreeRefund(request: ReturnRequest) {
    if (!["qc_passed", "refund_pending", "refund_initiated"].includes(request.returnStatus)) {
      setError("Cashfree refund se pehle return QC Passed hona chahiye.");
      return;
    }

    if (!window.confirm(
      request.cashfreeRefundId
        ? "Cashfree se existing refund ka latest status check karna hai?"
        : `Cashfree par ${formatMoney(request.refundAmount || request.amount)} ka refund initiate karna hai?`,
    )) return;

    try {
      setProcessing(request.id);
      setError("");
      setSuccess("");

      const action = request.cashfreeRefundId ? "sync" : "initiate";

      const result = await apiRequest(
        "/api/admin/returns/refund",
        "POST",
        {
          returnId: request.id,
          action,
        },
      );

      setSuccess(
        result.message || "Cashfree refund status updated.",
      );
      await loadReturns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cashfree refund process failed.");
    } finally {
      setProcessing(null);
    }
  }

  const filteredReturns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return returns.filter((item) => {
      let matchesFilter = true;

      switch (filter) {
        case "requested":
          matchesFilter = item.returnStatus === "requested";
          break;
        case "approved":
          matchesFilter = item.returnStatus === "approved";
          break;
        case "rejected":
          matchesFilter = item.returnStatus === "rejected";
          break;
        case "pickup":
          matchesFilter = ["pickup_pending", "picked_up"].includes(item.returnStatus);
          break;
        case "received":
          matchesFilter = item.returnStatus === "received";
          break;
        case "qc":
          matchesFilter = ["qc_pending", "qc_passed", "qc_failed"].includes(item.returnStatus);
          break;
        case "refund":
          matchesFilter = [
            "refund_pending",
            "refund_initiated",
          ].includes(item.returnStatus) ||
            ["pending", "approved", "initiated", "failed"].includes(item.refundStatus);
          break;
        case "completed":
          matchesFilter = item.returnStatus === "completed";
          break;
        case "disputed":
          matchesFilter = item.dispute || item.returnStatus === "disputed";
          break;
        default:
          matchesFilter = true;
      }

      const searchable = [
        item.id,
        item.orderId,
        item.productId,
        item.productName,
        item.customerName,
        item.customerEmail,
        item.customerPhone,
        item.sellerName,
        item.reason,
      ].join(" ").toLowerCase();

      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [returns, filter, search]);

  const counts = useMemo(() => ({
    all: returns.length,
    requested: returns.filter((x) => x.returnStatus === "requested").length,
    approved: returns.filter((x) => x.returnStatus === "approved").length,
    pickup: returns.filter((x) => ["pickup_pending", "picked_up"].includes(x.returnStatus)).length,
    received: returns.filter((x) => x.returnStatus === "received").length,
    qc: returns.filter((x) => ["qc_pending", "qc_passed", "qc_failed"].includes(x.returnStatus)).length,
    refund: returns.filter((x) => ["pending", "approved", "initiated"].includes(x.refundStatus)).length,
    completed: returns.filter((x) => x.returnStatus === "completed").length,
    disputed: returns.filter((x) => x.dispute || x.returnStatus === "disputed").length,
  }), [returns]);

  const refundValue = returns.reduce(
    (sum, item) => sum + (item.refundAmount || item.amount),
    0,
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8] p-10 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
        <p className="mt-4 text-sm font-bold text-gray-500">
          Loading Returns Management...
        </p>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-[#f5f6f8]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/">
            <img src="/logo/anjivo-logo.png" alt="ANJIVO" className="h-10 w-auto" />
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-xl border px-4 py-2.5 text-xs font-bold">
              Admin Dashboard
            </Link>
            <Link href="/admin/orders" className="rounded-xl border px-4 py-2.5 text-xs font-bold">
              Orders
            </Link>
            <button
              type="button"
              onClick={() => loadReturns()}
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ADMIN / RETURNS
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Returns & Refunds
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Customer return requests, pickup, QC, disputes aur refunds manage karein.
            </p>
          </div>

          <div className="rounded-2xl border bg-white px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Total Refund Value
            </p>
            <p className="mt-1 text-xl font-black">{formatMoney(refundValue)}</p>
          </div>
        </div>

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-700">
            ✓ {success}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {([
            ["all", "All", counts.all],
            ["requested", "Requested", counts.requested],
            ["approved", "Approved", counts.approved],
            ["pickup", "Pickup", counts.pickup],
            ["received", "Received", counts.received],
            ["qc", "QC", counts.qc],
            ["refund", "Refund", counts.refund],
            ["completed", "Completed", counts.completed],
            ["disputed", "Disputed", counts.disputed],
          ] as [ReturnFilter, string, number][]).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-2xl border p-4 text-left transition ${
                filter === key
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white hover:border-gray-400"
              }`}
            >
              <p className="text-[9px] font-black uppercase tracking-wide opacity-70">
                {label}
              </p>
              <p className="mt-1 text-xl font-black">
                {count.toLocaleString("en-IN")}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border bg-white p-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search return ID, order ID, product, customer, seller..."
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-black"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border bg-white">
          {filteredReturns.length === 0 ? (
            <div className="p-14 text-center">
              <div className="text-5xl">↩️</div>
              <h2 className="mt-4 text-lg font-black">No return requests</h2>
              <p className="mt-2 text-sm text-gray-500">
                Is filter ke according koi return request nahi mili.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredReturns.map((request) => (
                <ReturnRow
                  key={request.id}
                  request={request}
                  processing={processing === request.id}
                  onView={() => setSelectedReturn(request)}
                  onStatusChange={(status) => updateReturnStatus(request, status)}
                  onRefundChange={(status) => updateRefundStatus(request, status)}
                  onDispute={() => markDispute(request)}
                  onCashfreeRefund={() => processCashfreeRefund(request)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedReturn && (
        <ReturnModal
          request={selectedReturn}
          processing={processing === selectedReturn.id}
          onClose={() => setSelectedReturn(null)}
          onStatusChange={(status) => updateReturnStatus(selectedReturn, status)}
          onRefundChange={(status) => updateRefundStatus(selectedReturn, status)}
          onDispute={() => markDispute(selectedReturn)}
          onCashfreeRefund={() => processCashfreeRefund(selectedReturn)}
        />
      )}
    </main>
  );
}

function ReturnRow({
  request,
  processing,
  onView,
  onStatusChange,
  onRefundChange,
  onDispute,
  onCashfreeRefund,
}: {
  request: ReturnRequest;
  processing: boolean;
  onView: () => void;
  onStatusChange: (status: ReturnStatus) => void;
  onRefundChange: (status: RefundStatus) => void;
  onDispute: () => void;
  onCashfreeRefund: () => void;
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black">#{request.id.slice(0, 12)}</h2>
            <StatusBadge status={request.returnStatus} />
            <StatusBadge status={`refund_${request.refundStatus}`} />
            {request.dispute && (
              <span className="rounded-full bg-red-100 px-3 py-1.5 text-[9px] font-black text-red-700">
                DISPUTED
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-gray-600">
            <InfoBadge>📦 {request.productName || "Product"}</InfoBadge>
            <InfoBadge>👤 {request.customerName || "Customer"}</InfoBadge>
            <InfoBadge>🏪 {request.sellerName || "Seller"}</InfoBadge>
            <InfoBadge>Qty: {request.quantity}</InfoBadge>
            <InfoBadge>Order: {request.orderId || "—"}</InfoBadge>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Reason: <b className="text-gray-700">
              {REASONS[request.reason] || request.reason || "Not specified"}
            </b>
          </p>
          <p className="mt-1 text-[10px] text-gray-400">
            Created: {formatDate(request.createdAt)}
          </p>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <p className="text-xl font-black">
            {formatMoney(request.refundAmount || request.amount)}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onView}
              className="rounded-xl border px-4 py-2.5 text-xs font-black"
            >
              View
            </button>

            <select
              value={request.returnStatus}
              disabled={processing}
              onChange={(event) => onStatusChange(event.target.value as ReturnStatus)}
              className="rounded-xl border bg-white px-3 py-2.5 text-xs font-black"
            >
              {RETURN_STATUSES.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
              {request.returnStatus === "completed" && (
                <option value="completed">COMPLETED</option>
              )}
            </select>

            <button
              type="button"
              disabled={processing}
              onClick={onDispute}
              className={`rounded-xl px-4 py-2.5 text-xs font-black ${
                request.dispute
                  ? "bg-red-600 text-white"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {request.dispute ? "Remove Dispute" : "Flag Dispute"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReturnModal({
  request,
  processing,
  onClose,
  onStatusChange,
  onRefundChange,
  onDispute,
  onCashfreeRefund,
}: {
  request: ReturnRequest;
  processing: boolean;
  onClose: () => void;
  onStatusChange: (status: ReturnStatus) => void;
  onRefundChange: (status: RefundStatus) => void;
  onDispute: () => void;
  onCashfreeRefund: () => void;
}) {
  const canProcessRefund = [
    "qc_passed",
    "refund_pending",
    "refund_initiated",
  ].includes(request.returnStatus);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              RETURN DETAILS
            </p>
            <h2 className="mt-1 break-all text-xl font-black">#{request.id}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-xs font-black"
          >
            Close
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DetailBox label="Customer" value={request.customerName || "—"} />
            <DetailBox label="Seller" value={request.sellerName || "—"} />
            <DetailBox label="Mobile" value={request.customerPhone || "—"} />
            <DetailBox label="Email" value={request.customerEmail || "—"} />
            <DetailBox label="Order ID" value={request.orderId || "—"} />
            <DetailBox label="Product ID" value={request.productId || "—"} />
          </div>

          <div className="mt-6 rounded-2xl border p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Product
            </p>
            <h3 className="mt-2 text-lg font-black">{request.productName || "Product"}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <InfoBadge>Quantity: {request.quantity}</InfoBadge>
              <InfoBadge>Amount: {formatMoney(request.amount)}</InfoBadge>
              <InfoBadge>Refund: {formatMoney(request.refundAmount || request.amount)}</InfoBadge>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border p-5">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Return Reason
            </p>
            <p className="mt-2 text-sm font-black">
              {REASONS[request.reason] || request.reason || "Not specified"}
            </p>
            {request.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {request.description}
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Return Status
              </p>
              <select
                value={request.returnStatus}
                disabled={processing}
                onChange={(event) => onStatusChange(event.target.value as ReturnStatus)}
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm font-black"
              >
                {RETURN_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusLabel(status)}</option>
                ))}
                {request.returnStatus === "completed" && (
                  <option value="completed">COMPLETED</option>
                )}
              </select>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Refund Status
              </p>
              <select
                value={request.refundStatus}
                disabled={processing}
                onChange={(event) => onRefundChange(event.target.value as RefundStatus)}
                className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm font-black"
              >
                <option value="not_applicable">Not Applicable</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-gray-50 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  Refund Amount
                </p>
                <p className="mt-1 text-2xl font-black">
                  {formatMoney(request.refundAmount || request.amount)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Provider: {request.refundProvider || "Not processed"}
                </p>
                {request.cashfreeRefundId && (
                  <p className="mt-1 break-all text-xs text-gray-500">
                    Cashfree Refund ID: {request.cashfreeRefundId}
                  </p>
                )}
                {request.cashfreeRefundStatus && (
                  <p className="mt-1 text-xs text-gray-500">
                    Cashfree Status: {request.cashfreeRefundStatus}
                  </p>
                )}
                {request.cashfreeRefundArn && (
                  <p className="mt-1 break-all text-xs text-gray-500">
                    ARN: {request.cashfreeRefundArn}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={onDispute}
                  className={`rounded-xl px-5 py-3 text-xs font-black ${
                    request.dispute
                      ? "bg-red-600 text-white"
                      : "border border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {request.dispute ? "Remove Dispute" : "Flag Dispute"}
                </button>

                <button
                  type="button"
                  disabled={processing || !canProcessRefund || request.refundStatus === "completed"}
                  onClick={onCashfreeRefund}
                  className="rounded-xl bg-black px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {processing
                    ? "Processing..."
                    : request.cashfreeRefundId
                      ? "Check Cashfree Refund"
                      : "Initiate Cashfree Refund"}
                </button>
              </div>
            </div>
            {!canProcessRefund && (
              <p className="mt-3 text-xs text-gray-500">
                Cashfree refund ke liye pehle Return Status ko QC Passed karein.
              </p>
            )}
          </div>

          {request.images.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Return Evidence
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {request.images.map((image, index) => (
                  <a
                    key={`${image}-${index}`}
                    href={image}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-2xl border"
                  >
                    <img
                      src={image}
                      alt={`Return evidence ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-black text-blue-800">
              Recommended ANJIVO Return Flow
            </p>
            <p className="mt-2 text-xs leading-6 text-blue-700">
              Request → Approval → Pickup → Received → QC → Refund Approval
              → Cashfree Refund → Provider Confirmation → Completed
            </p>
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Created: {formatDate(request.createdAt)} · Updated: {formatDate(request.updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${statusStyle(status.replace("refund_", ""))}`}>
      {statusLabel(status)}
    </span>
  );
}

function InfoBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-[10px] font-bold text-gray-600">
      {children}
    </span>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-bold text-gray-700">
        {value}
      </p>
    </div>
  );
}
