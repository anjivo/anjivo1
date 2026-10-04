"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type DateRange =
  | "all"
  | "today"
  | "7days"
  | "30days"
  | "90days";

type Order = {
  id: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt?: unknown;
};

type ReturnRecord = {
  id: string;
  amount: number;
  refundAmount: number;
  returnStatus: string;
  refundStatus: string;
  createdAt?: unknown;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function timestampValue(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (
      value as { toMillis?: unknown }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
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

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDate(value: unknown): string {
  const time = timestampValue(value);

  if (!time) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(time));
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): Order {
  return {
    id,

    total:
      numberValue(data.total) ||
      numberValue(data.grandTotal),

    subtotal:
      numberValue(data.subtotal),

    shipping:
      numberValue(data.shipping) ||
      numberValue(data.shippingCharge),

    discount:
      numberValue(data.discount),

    status:
      stringValue(data.status) || "pending",

    paymentStatus:
      stringValue(data.paymentStatus) || "pending",

    paymentMethod:
      stringValue(data.paymentMethod) || "unknown",

    createdAt: data.createdAt,
  };
}

function mapReturn(
  id: string,
  data: Record<string, unknown>
): ReturnRecord {
  return {
    id,

    amount:
      numberValue(data.amount),

    refundAmount:
      numberValue(data.refundAmount),

    returnStatus:
      stringValue(data.returnStatus) ||
      stringValue(data.status) ||
      "pending",

    refundStatus:
      stringValue(data.refundStatus) ||
      "pending",

    createdAt: data.createdAt,
  };
}

function getRangeStart(
  range: DateRange
): number {
  if (range === "all") {
    return 0;
  }

  const now = new Date();

  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  const days =
    range === "7days"
      ? 7
      : range === "30days"
      ? 30
      : 90;

  now.setDate(now.getDate() - days);

  return now.getTime();
}

export default function FinanceReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [dateRange, setDateRange] =
    useState<DateRange>("30days");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          window.location.href =
            "/admin/login?redirect=/admin/reports/finance";

          return;
        }

        try {
          await loadFinanceData();
        } catch (err) {
          console.error(
            "Finance report error:",
            err
          );

          setError(
            "Unable to load financial data. Please check Firestore permissions."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function loadFinanceData() {
    setError("");

    const [
      ordersSnapshot,
      returnsSnapshot,
    ] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "returns")),
    ]);

    setOrders(
      ordersSnapshot.docs.map((item) =>
        mapOrder(item.id, item.data())
      )
    );

    setReturns(
      returnsSnapshot.docs.map((item) =>
        mapReturn(item.id, item.data())
      )
    );
  }

  async function refresh() {
    try {
      setRefreshing(true);
      await loadFinanceData();
    } catch (err) {
      console.error(err);

      setError(
        "Unable to refresh financial data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const start = getRangeStart(dateRange);

    return orders.filter((order) => {
      if (dateRange === "all") {
        return true;
      }

      const created =
        timestampValue(order.createdAt);

      return created >= start;
    });
  }, [orders, dateRange]);

  const filteredReturns = useMemo(() => {
    const start = getRangeStart(dateRange);

    return returns.filter((item) => {
      if (dateRange === "all") {
        return true;
      }

      const created =
        timestampValue(item.createdAt);

      return created >= start;
    });
  }, [returns, dateRange]);

  const stats = useMemo(() => {
    /*
     * Cancelled orders are excluded from
     * gross sales because they should not
     * contribute to marketplace revenue.
     */
    const validOrders =
      filteredOrders.filter(
        (order) =>
          order.status !== "cancelled" &&
          order.status !== "failed"
      );

    const grossSales =
      validOrders.reduce(
        (sum, order) =>
          sum + order.total,
        0
      );

    const subtotal =
      validOrders.reduce(
        (sum, order) =>
          sum + order.subtotal,
        0
      );

    const shipping =
      validOrders.reduce(
        (sum, order) =>
          sum + order.shipping,
        0
      );

    const discounts =
      validOrders.reduce(
        (sum, order) =>
          sum + order.discount,
        0
      );

    const refunds =
      filteredReturns.reduce(
        (sum, item) =>
          sum + item.refundAmount,
        0
      );

    const netSales =
      Math.max(
        grossSales - refunds,
        0
      );

    const paidOrders =
      validOrders.filter(
        (order) =>
          order.paymentStatus ===
          "paid" ||
          order.paymentStatus ===
          "success" ||
          order.paymentStatus ===
          "completed"
      ).length;

    const pendingPayments =
      validOrders.filter(
        (order) =>
          order.paymentStatus ===
          "pending"
      ).length;

    const failedPayments =
      validOrders.filter(
        (order) =>
          order.paymentStatus ===
            "failed" ||
          order.paymentStatus ===
            "cancelled"
      ).length;

    const averageOrderValue =
      validOrders.length > 0
        ? grossSales / validOrders.length
        : 0;

    return {
      validOrders,
      grossSales,
      subtotal,
      shipping,
      discounts,
      refunds,
      netSales,
      paidOrders,
      pendingPayments,
      failedPayments,
      averageOrderValue,
    };
  }, [
    filteredOrders,
    filteredReturns,
  ]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        method: string;
        orders: number;
        amount: number;
      }
    >();

    stats.validOrders.forEach(
      (order) => {
        const method =
          order.paymentMethod
            .trim()
            .toLowerCase() ||
          "unknown";

        const existing =
          map.get(method);

        if (existing) {
          existing.orders += 1;
          existing.amount += order.total;
        } else {
          map.set(method, {
            method,
            orders: 1,
            amount: order.total,
          });
        }
      }
    );

    return Array.from(
      map.values()
    ).sort(
      (a, b) =>
        b.amount - a.amount
    );
  }, [stats.validOrders]);

  const refundStats = useMemo(() => {
    const approved =
      filteredReturns.filter(
        (item) =>
          item.refundStatus ===
            "approved" ||
          item.refundStatus ===
            "processed" ||
          item.refundStatus ===
            "completed"
      );

    const pending =
      filteredReturns.filter(
        (item) =>
          item.refundStatus ===
          "pending"
      );

    return {
      total: filteredReturns.length,

      approved:
        approved.length,

      pending:
        pending.length,

      amount:
        filteredReturns.reduce(
          (sum, item) =>
            sum + item.refundAmount,
          0
        ),
    };
  }, [filteredReturns]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading Finance Reports...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
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

              <Link
                href="/admin/reports"
                className="hover:text-black"
              >
                Reports
              </Link>

              <span>/</span>

              <span className="text-black">
                Finance
              </span>
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
              FINANCE & PAYMENTS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Financial Reports
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Revenue, payments, discounts, shipping,
              refunds and net sales based on the
              current ANJIVO order and return data.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={dateRange}
              onChange={(event) =>
                setDateRange(
                  event.target
                    .value as DateRange
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold outline-none"
            >
              <option value="all">
                All Time
              </option>

              <option value="today">
                Today
              </option>

              <option value="7days">
                Last 7 Days
              </option>

              <option value="30days">
                Last 30 Days
              </option>

              <option value="90days">
                Last 90 Days
              </option>
            </select>

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

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* KPI */}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FinanceCard
            title="Gross Sales"
            value={formatCurrency(
              stats.grossSales
            )}
            icon="₹"
          />

          <FinanceCard
            title="Net Sales"
            value={formatCurrency(
              stats.netSales
            )}
            icon="📈"
          />

          <FinanceCard
            title="Refunds"
            value={formatCurrency(
              stats.refunds
            )}
            icon="↩️"
          />

          <FinanceCard
            title="Discounts"
            value={formatCurrency(
              stats.discounts
            )}
            icon="🎟️"
          />

          <FinanceCard
            title="Shipping"
            value={formatCurrency(
              stats.shipping
            )}
            icon="🚚"
          />

          <FinanceCard
            title="AOV"
            value={formatCurrency(
              stats.averageOrderValue
            )}
            icon="🛒"
          />
        </section>

        {/* ORDER / PAYMENT STATUS */}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SmallCard
            title="Valid Orders"
            value={stats.validOrders.length}
          />

          <SmallCard
            title="Paid Orders"
            value={stats.paidOrders}
          />

          <SmallCard
            title="Pending Payments"
            value={stats.pendingPayments}
          />

          <SmallCard
            title="Failed Payments"
            value={stats.failedPayments}
          />
        </section>

        {/* MAIN GRID */}

        <section className="mt-8 grid gap-5 lg:grid-cols-2">

          {/* PAYMENT METHODS */}

          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                PAYMENT MIX
              </p>

              <h2 className="mt-1 text-xl font-black">
                Payment Methods
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Order value grouped by payment method.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {paymentBreakdown.length === 0 ? (
                <EmptyState text="No payment records found for this period." />
              ) : (
                paymentBreakdown.map(
                  (item) => {
                    const percentage =
                      stats.grossSales > 0
                        ? Math.round(
                            (item.amount /
                              stats.grossSales) *
                              100
                          )
                        : 0;

                    return (
                      <div
                        key={item.method}
                        className="rounded-2xl border border-gray-100 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black capitalize">
                              {item.method}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-500">
                              {item.orders} orders
                            </p>
                          </div>

                          <p className="text-sm font-black">
                            {formatCurrency(
                              item.amount
                            )}
                          </p>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-black"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-[10px] font-bold text-gray-400">
                          {percentage}% of gross sales
                        </p>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>

          {/* REFUNDS */}

          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                REFUNDS
              </p>

              <h2 className="mt-1 text-xl font-black">
                Refund Overview
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Current return and refund activity.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <SummaryBox
                label="Total Returns"
                value={refundStats.total}
              />

              <SummaryBox
                label="Refund Amount"
                value={formatCurrency(
                  refundStats.amount
                )}
              />

              <SummaryBox
                label="Approved / Processed"
                value={refundStats.approved}
              />

              <SummaryBox
                label="Pending"
                value={refundStats.pending}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black text-amber-900">
                Finance note
              </p>

              <p className="mt-1 text-[10px] leading-5 text-amber-800">
                Refunds are deducted from gross sales
                to calculate the displayed net sales.
                Actual accounting treatment may require
                separate tax, gateway and settlement
                reconciliation.
              </p>
            </div>
          </div>
        </section>

        {/* ORDER FINANCE TABLE */}

        <section className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                ORDER FINANCE
              </p>

              <h2 className="mt-1 text-xl font-black">
                Recent Financial Activity
              </h2>
            </div>

            <Link
              href="/admin/transactions"
              className="text-xs font-black hover:underline"
            >
              Open Transactions →
            </Link>
          </div>

          <div className="overflow-x-auto">
            {filteredOrders.length === 0 ? (
              <div className="p-10">
                <EmptyState text="No orders found for this period." />
              </div>
            ) : (
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-black uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-4">
                      Order
                    </th>

                    <th className="px-5 py-4">
                      Date
                    </th>

                    <th className="px-5 py-4">
                      Payment
                    </th>

                    <th className="px-5 py-4">
                      Order Status
                    </th>

                    <th className="px-5 py-4 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredOrders
                    .slice()
                    .sort(
                      (a, b) =>
                        timestampValue(
                          b.createdAt
                        ) -
                        timestampValue(
                          a.createdAt
                        )
                    )
                    .slice(0, 50)
                    .map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-xs font-black hover:underline"
                          >
                            #{order.id.slice(
                              0,
                              10
                            )}
                          </Link>
                        </td>

                        <td className="px-5 py-4 text-xs text-gray-500">
                          {formatDate(
                            order.createdAt
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-xs font-bold capitalize">
                            {order.paymentMethod ||
                              "Unknown"}
                          </p>

                          <p className="mt-1 text-[10px] text-gray-400">
                            {order.paymentStatus}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black capitalize">
                            {order.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-black">
                          {formatCurrency(
                            order.total
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* LINKS */}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/admin/transactions"
            icon="💳"
            title="Transactions"
            description="View payment and transaction records."
          />

          <QuickLink
            href="/admin/payouts"
            icon="🏦"
            title="Seller Payouts"
            description="Review seller payout records."
          />

          <QuickLink
            href="/admin/settlements"
            icon="🧾"
            title="Settlements"
            description="Review seller settlement data."
          />

          <QuickLink
            href="/admin/reports"
            icon="📊"
            title="All Reports"
            description="Return to the main reporting center."
          />
        </section>

        <div className="py-10 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            ANJIVO FINANCIAL REPORTING
          </p>

          <p className="mt-2 text-xs text-gray-400">
            Operational finance view based on current Firestore data
          </p>
        </div>
      </main>
    </div>
  );
}

function FinanceCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-lg font-black">
        {icon}
      </div>

      <p className="mt-5 text-xs font-bold text-gray-400">
        {title}
      </p>

      <p className="mt-1 text-2xl font-black tracking-tight">
        {value}
      </p>
    </div>
  );
}

function SmallCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {title}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-[10px] font-bold text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-black">
        {typeof value === "number"
          ? value.toLocaleString("en-IN")
          : value}
      </p>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
      <p className="text-sm font-bold text-gray-700">
        {text}
      </p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-black hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-lg">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-black">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-gray-500">
        {description}
      </p>

      <p className="mt-4 text-[10px] font-black uppercase tracking-wide">
        Open →
      </p>
    </Link>
  );
}
