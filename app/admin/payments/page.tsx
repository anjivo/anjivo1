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

/* =========================================================
   TYPES
========================================================= */

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cod";

type Order = {
  id: string;

  userId?: string;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  paymentMethod?: string;
  paymentStatus?: string;

  subtotal?: number;
  shippingCharge?: number;
  discount?: number;
  totalAmount?: number;

  status?: string;
  fulfillmentStatus?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function numberValue(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown): string {
  return numberValue(value).toLocaleString(
    "en-IN"
  );
}

function timeValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    const seconds = Number(
      (value as { seconds?: unknown }).seconds
    );

    if (Number.isFinite(seconds)) {
      return seconds * 1000;
    }
  }

  const date = new Date(
    value as string | number | Date
  );

  return Number.isNaN(date.getTime())
    ? 0
    : date.getTime();
}

function dateLabel(value: unknown): string {
  const time = timeValue(value);

  if (!time) return "—";

  return new Date(time).toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function normalizePaymentStatus(
  value: unknown,
  paymentMethod?: unknown
): PaymentStatus {
  const raw = text(value)
    .toLowerCase()
    .replace(/[ -]+/g, "_");

  const method = text(
    paymentMethod
  ).toLowerCase();

  if (
    method === "cod" &&
    (!raw ||
      raw === "pending" ||
      raw === "cod")
  ) {
    return "cod";
  }

  if (raw === "paid" || raw === "success") {
    return "paid";
  }

  if (
    raw === "failed" ||
    raw === "failure"
  ) {
    return "failed";
  }

  if (
    raw === "refunded" ||
    raw === "refund"
  ) {
    return "refunded";
  }

  if (raw === "cod") {
    return "cod";
  }

  return "pending";
}

function paymentLabel(
  status: PaymentStatus
): string {
  switch (status) {
    case "paid":
      return "Paid";

    case "failed":
      return "Failed";

    case "refunded":
      return "Refunded";

    case "cod":
      return "COD";

    default:
      return "Pending";
  }
}

function paymentClass(
  status: PaymentStatus
): string {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";

    case "failed":
      return "bg-red-100 text-red-700";

    case "refunded":
      return "bg-purple-100 text-purple-700";

    case "cod":
      return "bg-blue-100 text-blue-700";

    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function PaymentsAdminPage() {
  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<
      "all" | PaymentStatus
    >("all");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const [saving, setSaving] =
    useState(false);

  /* =======================================================
     LOAD ORDERS
  ======================================================= */

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const snapshot =
        await getDocs(
          collection(db, "orders")
        );

      const loaded =
        snapshot.docs.map(
          (orderDoc) => {
            const data =
              orderDoc.data();

            return {
              id: orderDoc.id,

              userId:
                data.userId || "",

              customerName:
                data.customerName ||
                "",

              customerEmail:
                data.customerEmail ||
                "",

              customerPhone:
                data.customerPhone ||
                "",

              paymentMethod:
                data.paymentMethod ||
                "COD",

              paymentStatus:
                data.paymentStatus ||
                "pending",

              subtotal:
                numberValue(
                  data.subtotal
                ),

              shippingCharge:
                numberValue(
                  data.shippingCharge
                ),

              discount:
                numberValue(
                  data.discount
                ),

              totalAmount:
                numberValue(
                  data.totalAmount ??
                    data.total
                ),

              status:
                data.status ||
                "",

              fulfillmentStatus:
                data.fulfillmentStatus ||
                "",

              createdAt:
                data.createdAt,

              updatedAt:
                data.updatedAt,
            } as Order;
          }
        );

      loaded.sort(
        (a, b) =>
          timeValue(
            b.updatedAt ||
              b.createdAt
          ) -
          timeValue(
            a.updatedAt ||
              a.createdAt
          )
      );

      setOrders(loaded);
    } catch (err) {
      console.error(err);

      setError(
        "Payment data load nahi ho saka."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/payments";

            return;
          }

          try {
            const userSnap =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (!userSnap.exists()) {
              window.location.href =
                "/";

              return;
            }

            const role =
              text(
                userSnap.data().role
              ).toUpperCase();

            if (role !== "ADMIN") {
              window.location.href =
                "/account";

              return;
            }

            setAuthorized(true);

            await loadOrders();
          } catch (err) {
            console.error(err);

            setError(
              "Admin authorization failed."
            );

            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    const getOrders = (
      status: PaymentStatus
    ) =>
      orders.filter(
        (order) =>
          normalizePaymentStatus(
            order.paymentStatus,
            order.paymentMethod
          ) === status
      );

    const paid =
      getOrders("paid");

    const pending =
      getOrders("pending");

    const failed =
      getOrders("failed");

    const refunded =
      getOrders("refunded");

    const cod =
      getOrders("cod");

    const sum = (
      list: Order[]
    ) =>
      list.reduce(
        (total, order) =>
          total +
          numberValue(
            order.totalAmount
          ),
        0
      );

    return {
      total: orders.length,

      paid: paid.length,
      paidValue: sum(paid),

      pending: pending.length,
      pendingValue: sum(pending),

      failed: failed.length,
      failedValue: sum(failed),

      refunded: refunded.length,
      refundedValue:
        sum(refunded),

      cod: cod.length,
      codValue: sum(cod),

      collected:
        sum(paid),
    };
  }, [orders]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          const paymentStatus =
            normalizePaymentStatus(
              order.paymentStatus,
              order.paymentMethod
            );

          if (
            filter !== "all" &&
            paymentStatus !== filter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable =
            `${order.id}
             ${order.customerName || ""}
             ${order.customerEmail || ""}
             ${order.customerPhone || ""}
             ${order.paymentMethod || ""}
             ${order.paymentStatus || ""}
             ${order.status || ""}`
              .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      orders,
      filter,
      search,
    ]);

  /* =======================================================
     UPDATE PAYMENT
  ======================================================= */

  async function updatePaymentStatus(
    orderId: string,
    status: PaymentStatus
  ) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "orders",
          orderId
        ),
        {
          paymentStatus: status,
          updatedAt:
            serverTimestamp(),
        }
      );

      setSuccess(
        `Payment status for #${orderId} updated to ${paymentLabel(
          status
        )}.`
      );

      setSelectedOrder(null);

      await loadOrders();
    } catch (err) {
      console.error(err);

      setError(
        "Payment status update nahi ho saka."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Payments Management...
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

            <Link
              href="/admin/refunds"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Refunds
            </Link>

            <button
              type="button"
              onClick={loadOrders}
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* TITLE */}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ADMIN / PAYMENTS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Payments Management
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Online payments, COD,
              pending, failed aur refunded
              orders ka central view.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Collected
            </p>

            <p className="mt-1 text-xl font-black">
              ₹
              {money(
                stats.collected
              )}
            </p>
          </div>
        </section>

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

        {/* STATS */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <PaymentStat
            title="All"
            count={stats.total}
            value={null}
            active={
              filter === "all"
            }
            onClick={() =>
              setFilter("all")
            }
          />

          <PaymentStat
            title="Paid"
            count={stats.paid}
            value={stats.paidValue}
            active={
              filter === "paid"
            }
            onClick={() =>
              setFilter("paid")
            }
          />

          <PaymentStat
            title="Pending"
            count={stats.pending}
            value={stats.pendingValue}
            active={
              filter === "pending"
            }
            onClick={() =>
              setFilter("pending")
            }
          />

          <PaymentStat
            title="Failed"
            count={stats.failed}
            value={stats.failedValue}
            active={
              filter === "failed"
            }
            onClick={() =>
              setFilter("failed")
            }
          />

          <PaymentStat
            title="COD"
            count={stats.cod}
            value={stats.codValue}
            active={
              filter === "cod"
            }
            onClick={() =>
              setFilter("cod")
            }
          />

          <PaymentStat
            title="Refunded"
            count={stats.refunded}
            value={stats.refundedValue}
            active={
              filter === "refunded"
            }
            onClick={() =>
              setFilter("refunded")
            }
          />
        </section>

        {/* SEARCH */}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search order, customer, phone, email, payment..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
          />
        </section>

        {/* TABLE */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="hidden grid-cols-[1.1fr_1.3fr_1fr_1fr_1fr_auto] gap-4 border-b bg-gray-50 px-5 py-3 text-[10px] font-black uppercase tracking-wide text-gray-400 lg:grid">
            <div>Order</div>
            <div>Customer</div>
            <div>Payment</div>
            <div>Status</div>
            <div>Amount</div>
            <div></div>
          </div>

          {filteredOrders.length ===
          0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl">
                💳
              </div>

              <h2 className="mt-4 text-lg font-black">
                No payments found
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Current filter/search ke
                according koi payment nahi mila.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredOrders.map(
                (order) => (
                  <PaymentRow
                    key={order.id}
                    order={order}
                    onOpen={() =>
                      setSelectedOrder(
                        order
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* MODAL */}

      {selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          saving={saving}
          onClose={() =>
            setSelectedOrder(null)
          }
          onUpdate={
            updatePaymentStatus
          }
        />
      )}
    </main>
  );
}

/* =========================================================
   STAT
========================================================= */

function PaymentStat({
  title,
  count,
  value,
  active,
  onClick,
}: {
  title: string;
  count: number;
  value: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-5 text-left transition ${
        active
          ? "border-black shadow-sm"
          : "border-gray-200 hover:border-gray-400"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {title}
      </p>

      <p className="mt-2 text-2xl font-black">
        {count}
      </p>

      {value !== null && (
        <p className="mt-1 text-xs font-bold text-gray-500">
          ₹{money(value)}
        </p>
      )}
    </button>
  );
}

/* =========================================================
   ROW
========================================================= */

function PaymentRow({
  order,
  onOpen,
}: {
  order: Order;
  onOpen: () => void;
}) {
  const paymentStatus =
    normalizePaymentStatus(
      order.paymentStatus,
      order.paymentMethod
    );

  return (
    <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1.1fr_1.3fr_1fr_1fr_1fr_auto] lg:items-center">
      <div>
        <p className="text-sm font-black">
          #{order.id}
        </p>

        <p className="mt-1 text-[10px] text-gray-400">
          {dateLabel(
            order.updatedAt ||
              order.createdAt
          )}
        </p>
      </div>

      <div>
        <p className="text-sm font-bold">
          {order.customerName ||
            "Customer"}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {order.customerPhone ||
            order.customerEmail ||
            "—"}
        </p>
      </div>

      <div>
        <p className="text-xs font-black">
          {order.paymentMethod ||
            "COD"}
        </p>

        <p className="mt-1 text-[10px] text-gray-400">
          {order.paymentStatus ||
            "pending"}
        </p>
      </div>

      <div>
        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black ${paymentClass(
            paymentStatus
          )}`}
        >
          {paymentLabel(
            paymentStatus
          )}
        </span>
      </div>

      <div>
        <p className="text-sm font-black">
          ₹
          {money(
            order.totalAmount
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black hover:border-black"
      >
        Manage
      </button>
    </div>
  );
}

/* =========================================================
   MODAL
========================================================= */

function PaymentModal({
  order,
  saving,
  onClose,
  onUpdate,
}: {
  order: Order;
  saving: boolean;
  onClose: () => void;
  onUpdate: (
    orderId: string,
    status: PaymentStatus
  ) => Promise<void>;
}) {
  const currentStatus =
    normalizePaymentStatus(
      order.paymentStatus,
      order.paymentMethod
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {/* HEADER */}

        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              PAYMENT
            </p>

            <h2 className="mt-1 text-2xl font-black">
              #{order.id}
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              {order.customerName ||
                "Customer"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* PAYMENT SUMMARY */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Payment Summary
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info
                label="Payment Method"
                value={
                  order.paymentMethod ||
                  "COD"
                }
              />

              <Info
                label="Current Status"
                value={
                  paymentLabel(
                    currentStatus
                  )
                }
              />

              <Info
                label="Order Total"
                value={`₹${money(
                  order.totalAmount
                )}`}
              />

              <Info
                label="Order Date"
                value={dateLabel(
                  order.createdAt
                )}
              />
            </div>
          </div>

          {/* CUSTOMER */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Customer
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info
                label="Name"
                value={
                  order.customerName ||
                  "—"
                }
              />

              <Info
                label="Phone"
                value={
                  order.customerPhone ||
                  "—"
                }
              />

              <Info
                label="Email"
                value={
                  order.customerEmail ||
                  "—"
                }
              />

              <Info
                label="User ID"
                value={
                  order.userId ||
                  "—"
                }
              />
            </div>
          </div>

          {/* PRICE */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Amount Breakdown
            </h3>

            <div className="mt-4 space-y-3 text-sm">
              <AmountRow
                label="Subtotal"
                value={
                  order.subtotal
                }
              />

              <AmountRow
                label="Shipping"
                value={
                  order.shippingCharge
                }
              />

              <AmountRow
                label="Discount"
                value={
                  order.discount
                }
                negative
              />

              <div className="border-t pt-3">
                <AmountRow
                  label="Total"
                  value={
                    order.totalAmount
                  }
                  bold
                />
              </div>
            </div>
          </div>

          {/* STATUS ACTIONS */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Update Payment Status
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Ye order ke Firestore
              <code className="mx-1 rounded bg-gray-100 px-1">
                paymentStatus
              </code>
              field ko update karega.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PaymentAction
                label="Mark Paid"
                status="paid"
                current={
                  currentStatus
                }
                disabled={saving}
                onClick={() =>
                  onUpdate(
                    order.id,
                    "paid"
                  )
                }
              />

              <PaymentAction
                label="Mark Pending"
                status="pending"
                current={
                  currentStatus
                }
                disabled={saving}
                onClick={() =>
                  onUpdate(
                    order.id,
                    "pending"
                  )
                }
              />

              <PaymentAction
                label="Mark Failed"
                status="failed"
                current={
                  currentStatus
                }
                disabled={saving}
                onClick={() =>
                  onUpdate(
                    order.id,
                    "failed"
                  )
                }
              />

              <PaymentAction
                label="Mark Refunded"
                status="refunded"
                current={
                  currentStatus
                }
                disabled={saving}
                onClick={() =>
                  onUpdate(
                    order.id,
                    "refunded"
                  )
                }
              />

              <PaymentAction
                label="Mark COD"
                status="cod"
                current={
                  currentStatus
                }
                disabled={saving}
                onClick={() =>
                  onUpdate(
                    order.id,
                    "cod"
                  )
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs leading-5 text-yellow-800">
              <strong>Important:</strong>{" "}
              ye admin panel payment status
              ko manually update karta hai.
              Ye Razorpay/UPI/bank transaction
              verify nahi karta. Actual payment
              gateway reconciliation alag
              integration ke through karni hogi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAYMENT ACTION
========================================================= */

function PaymentAction({
  label,
  status,
  current,
  disabled,
  onClick,
}: {
  label: string;
  status: PaymentStatus;
  current: PaymentStatus;
  disabled: boolean;
  onClick: () => void;
}) {
  const active =
    status === current;

  return (
    <button
      type="button"
      disabled={
        disabled || active
      }
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-xs font-black ${
        active
          ? "cursor-default bg-gray-100 text-gray-400"
          : status === "failed"
          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          : status === "refunded"
          ? "border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
          : "bg-black text-white hover:bg-gray-800"
      }`}
    >
      {active
        ? `✓ ${label}`
        : label}
    </button>
  );
}

/* =========================================================
   AMOUNT ROW
========================================================= */

function AmountRow({
  label,
  value,
  negative,
  bold,
}: {
  label: string;
  value?: number;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? "text-base" : ""
      }`}
    >
      <span
        className={
          bold
            ? "font-black"
            : "text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={
          bold
            ? "font-black"
            : "font-bold"
        }
      >
        {negative ? "-₹" : "₹"}
        {money(value)}
      </span>
    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-gray-800">
        {value || "—"}
      </p>
    </div>
  );
}
