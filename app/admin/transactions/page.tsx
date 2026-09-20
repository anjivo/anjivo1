"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type TransactionStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "cancelled"
  | string;

type PaymentMethod =
  | "razorpay"
  | "cod"
  | "upi"
  | "card"
  | "netbanking"
  | "wallet"
  | string;

type TransactionType =
  | "payment"
  | "refund"
  | "adjustment"
  | string;

type Transaction = {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  refundAmount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  transactionType: TransactionType;
  gateway: string;
  gatewayTransactionId: string;
  gatewayOrderId: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type Order = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string;
  createdAt?: unknown;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function timestampValue(
  value: unknown
): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
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
    const time =
      new Date(value).getTime();

    return Number.isFinite(time)
      ? time
      : 0;
  }

  return 0;
}

function formatDate(
  value: unknown
): string {
  const millis =
    timestampValue(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(millis));
}

function formatCurrency(
  value: number
): string {
  return `₹${Math.round(
    value
  ).toLocaleString("en-IN")}`;
}

function mapTransaction(
  id: string,
  data: Record<string, unknown>
): Transaction {
  return {
    id,

    orderId:
      stringValue(data.orderId),

    customerId:
      stringValue(
        data.customerId
      ) ||
      stringValue(data.userId),

    customerName:
      stringValue(
        data.customerName
      ) ||
      stringValue(data.name),

    customerEmail:
      stringValue(
        data.customerEmail
      ) ||
      stringValue(data.email),

    customerPhone:
      stringValue(
        data.customerPhone
      ) ||
      stringValue(data.phone),

    sellerId:
      stringValue(data.sellerId),

    sellerName:
      stringValue(
        data.sellerName
      ),

    amount:
      numberValue(data.amount) ||
      numberValue(data.total),

    refundAmount:
      numberValue(
        data.refundAmount
      ),

    currency:
      stringValue(
        data.currency
      ) || "INR",

    status:
      stringValue(data.status) ||
      "pending",

    paymentMethod:
      stringValue(
        data.paymentMethod
      ) || "unknown",

    transactionType:
      stringValue(
        data.transactionType
      ) || "payment",

    gateway:
      stringValue(
        data.gateway
      ) || "—",

    gatewayTransactionId:
      stringValue(
        data.gatewayTransactionId
      ) ||
      stringValue(
        data.transactionId
      ),

    gatewayOrderId:
      stringValue(
        data.gatewayOrderId
      ),

    notes:
      stringValue(data.notes),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): Order {
  return {
    id,

    userId:
      stringValue(data.userId) ||
      stringValue(
        data.customerId
      ),

    customerName:
      stringValue(
        data.customerName
      ) ||
      stringValue(data.name),

    customerEmail:
      stringValue(
        data.customerEmail
      ) ||
      stringValue(data.email),

    customerPhone:
      stringValue(
        data.customerPhone
      ) ||
      stringValue(data.phone),

    total:
      numberValue(data.total) ||
      numberValue(
        data.grandTotal
      ),

    paymentStatus:
      stringValue(
        data.paymentStatus
      ) || "pending",

    paymentMethod:
      stringValue(
        data.paymentMethod
      ),

    transactionId:
      stringValue(
        data.transactionId
      ),

    createdAt:
      data.createdAt,
  };
}

export default function AdminTransactionsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [methodFilter, setMethodFilter] =
    useState("all");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [dateFilter, setDateFilter] =
    useState("all");

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(
      null
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/transactions";
            return;
          }

          try {
            const adminSnap =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !adminSnap.exists() ||
              adminSnap.data().role !==
                "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadData();
          } catch (error) {
            console.error(
              "Transaction authorization error:",
              error
            );

            window.location.href =
              "/";
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, []);

  async function loadData() {
    try {
      const [
        transactionSnapshot,
        orderSnapshot,
      ] = await Promise.all([
        getDocs(
          collection(
            db,
            "transactions"
          )
        ),

        getDocs(
          collection(
            db,
            "orders"
          )
        ),
      ]);

      const transactionList =
        transactionSnapshot.docs.map(
          (item) =>
            mapTransaction(
              item.id,
              item.data()
            )
        );

      const orderList =
        orderSnapshot.docs.map(
          (item) =>
            mapOrder(
              item.id,
              item.data()
            )
        );

      transactionList.sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      );

      orderList.sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      );

      setTransactions(
        transactionList
      );

      setOrders(orderList);
    } catch (error) {
      console.error(
        "Load transactions error:",
        error
      );

      alert(
        "Transactions load nahi ho paaye. Firestore rules ya collection check karein."
      );
    }
  }

  const filteredTransactions =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      const now =
        Date.now();

      return transactions.filter(
        (transaction) => {
          const searchMatch =
            !query ||
            transaction.id
              .toLowerCase()
              .includes(query) ||
            transaction.orderId
              .toLowerCase()
              .includes(query) ||
            transaction.customerName
              .toLowerCase()
              .includes(query) ||
            transaction.customerEmail
              .toLowerCase()
              .includes(query) ||
            transaction.customerPhone
              .toLowerCase()
              .includes(query) ||
            transaction.sellerName
              .toLowerCase()
              .includes(query) ||
            transaction.gatewayTransactionId
              .toLowerCase()
              .includes(query) ||
            transaction.gatewayOrderId
              .toLowerCase()
              .includes(query);

          const statusMatch =
            statusFilter ===
              "all" ||
            transaction.status ===
              statusFilter;

          const methodMatch =
            methodFilter ===
              "all" ||
            transaction.paymentMethod ===
              methodFilter;

          const typeMatch =
            typeFilter ===
              "all" ||
            transaction.transactionType ===
              typeFilter;

          const transactionTime =
            timestampValue(
              transaction.createdAt
            );

          let dateMatch = true;

          if (
            dateFilter ===
            "today"
          ) {
            const today =
              new Date();

            const start =
              new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
              ).getTime();

            dateMatch =
              transactionTime >=
              start;
          }

          if (
            dateFilter ===
            "7days"
          ) {
            dateMatch =
              transactionTime >=
              now -
                7 *
                  24 *
                  60 *
                  60 *
                  1000;
          }

          if (
            dateFilter ===
            "30days"
          ) {
            dateMatch =
              transactionTime >=
              now -
                30 *
                  24 *
                  60 *
                  60 *
                  1000;
          }

          return (
            searchMatch &&
            statusMatch &&
            methodMatch &&
            typeMatch &&
            dateMatch
          );
        }
      );
    }, [
      transactions,
      search,
      statusFilter,
      methodFilter,
      typeFilter,
      dateFilter,
    ]);

  const stats = useMemo(() => {
    const successfulPayments =
      filteredTransactions.filter(
        (item) =>
          item.status ===
            "paid" &&
          item.transactionType ===
            "payment"
      );

    const refunds =
      filteredTransactions.filter(
        (item) =>
          item.status ===
            "refunded" ||
          item.transactionType ===
            "refund"
      );

    const pending =
      filteredTransactions.filter(
        (item) =>
          item.status ===
          "pending"
      );

    const failed =
      filteredTransactions.filter(
        (item) =>
          item.status ===
          "failed"
      );

    const collected =
      successfulPayments.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    const refunded =
      refunds.reduce(
        (sum, item) =>
          sum +
          (item.refundAmount ||
            item.amount),
        0
      );

    const pendingAmount =
      pending.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    const failedAmount =
      failed.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    return {
      total:
        filteredTransactions.length,

      collected,

      refunded,

      pendingAmount,

      failedAmount,

      pendingCount:
        pending.length,

      failedCount:
        failed.length,

      paymentCount:
        successfulPayments.length,

      refundCount:
        refunds.length,
    };
  }, [
    filteredTransactions,
  ]);

  const paymentMethods =
    useMemo(() => {
      const values =
        new Set<string>();

      transactions.forEach(
        (item) => {
          if (
            item.paymentMethod &&
            item.paymentMethod !==
              "unknown"
          ) {
            values.add(
              item.paymentMethod
            );
          }
        }
      );

      return Array.from(values)
        .sort();
    }, [transactions]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading transactions...
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
                Transactions
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/orders"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Orders
            </Link>

            <Link
              href="/admin/settlements"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:block"
            >
              Settlements
            </Link>

            <button
              onClick={loadData}
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
            Finance & Payments
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Payment Transactions
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Customer payments, refunds, failed payments aur
            gateway transaction records ko centrally monitor karein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label="Transactions"
            value={stats.total}
            icon="💳"
          />

          <StatCard
            label="Collected"
            value={formatCurrency(
              stats.collected
            )}
            icon="₹"
          />

          <StatCard
            label="Refunded"
            value={formatCurrency(
              stats.refunded
            )}
            icon="↩"
          />

          <StatCard
            label="Pending"
            value={formatCurrency(
              stats.pendingAmount
            )}
            icon="⏳"
          />

          <StatCard
            label="Failed"
            value={formatCurrency(
              stats.failedAmount
            )}
            icon="!"
          />

          <StatCard
            label="Successful"
            value={stats.paymentCount}
            icon="✓"
          />

          <StatCard
            label="Pending Count"
            value={stats.pendingCount}
            icon="⌛"
          />

          <StatCard
            label="Refund Count"
            value={stats.refundCount}
            icon="↻"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_170px_170px_170px_150px_auto]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔎
                </span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search transaction, order, customer, seller, gateway ID..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Status
                </option>

                <option value="pending">
                  Pending
                </option>

                <option value="paid">
                  Paid
                </option>

                <option value="failed">
                  Failed
                </option>

                <option value="refunded">
                  Refunded
                </option>

                <option value="partially_refunded">
                  Partial Refund
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>

              <select
                value={methodFilter}
                onChange={(event) =>
                  setMethodFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Methods
                </option>

                {paymentMethods.map(
                  (method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {method
                        .replaceAll(
                          "_",
                          " "
                        )
                        .replace(
                          /\b\w/g,
                          (char) =>
                            char.toUpperCase()
                        )}
                    </option>
                  )
                )}
              </select>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Types
                </option>

                <option value="payment">
                  Payment
                </option>

                <option value="refund">
                  Refund
                </option>

                <option value="adjustment">
                  Adjustment
                </option>
              </select>

              <select
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Dates
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
              </select>

              <button
                onClick={loadData}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻
              </button>
            </div>
          </div>

          {filteredTransactions.length ===
          0 ? (
            <EmptyState
              title="No transactions found"
              description={
                transactions.length ===
                0
                  ? "Abhi transactions collection mein koi payment record nahi mila."
                  : "Current filters ke according koi transaction nahi mila."
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransactions.map(
                (transaction) => (
                  <TransactionRow
                    key={
                      transaction.id
                    }
                    transaction={
                      transaction
                    }
                    onOpen={() =>
                      setSelectedTransaction(
                        transaction
                      )
                    }
                  />
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-bold text-amber-900">
            Payment Security
          </h3>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            Payment status ko production mein client-side
            request se trusted nahi maana jana chahiye. Razorpay
            ya kisi gateway ka signature/webhook backend par
            verify karke hi transaction ko paid/refunded mark
            karna chahiye.
          </p>
        </section>
      </div>

      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={
            selectedTransaction
          }
          onClose={() =>
            setSelectedTransaction(
              null
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
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {typeof value ===
            "number"
              ? value.toLocaleString(
                  "en-IN"
                )
              : value}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function TransactionRow({
  transaction,
  onOpen,
}: {
  transaction: Transaction;
  onOpen: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-500">
              #{transaction.id}
            </span>

            <TransactionStatusBadge
              status={
                transaction.status
              }
            />

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {transaction.transactionType
                .replaceAll(
                  "_",
                  " "
                )
                .replace(
                  /\b\w/g,
                  (char) =>
                    char.toUpperCase()
                )}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-slate-900">
              {transaction.customerName ||
                "Customer"}
            </span>

            {transaction.orderId && (
              <span className="font-mono text-xs text-slate-500">
                Order: #
                {
                  transaction.orderId
                }
              </span>
            )}

            {transaction.sellerName && (
              <span className="text-xs text-slate-500">
                Seller:{" "}
                {
                  transaction.sellerName
                }
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>
              💳{" "}
              {transaction.paymentMethod
                .replaceAll(
                  "_",
                  " "
                )
                .replace(
                  /\b\w/g,
                  (char) =>
                    char.toUpperCase()
                )}
            </span>

            <span>
              Gateway:{" "}
              {transaction.gateway}
            </span>

            <span>
              {formatDate(
                transaction.createdAt
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-5 xl:justify-end">
          <div className="text-right">
            <p className="text-xs text-slate-400">
              Amount
            </p>

            <p className="text-lg font-bold text-slate-900">
              {formatCurrency(
                transaction.amount
              )}
            </p>
          </div>

          <button
            onClick={onOpen}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}

function TransactionStatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-amber-100 text-amber-700",

    paid:
      "bg-emerald-100 text-emerald-700",

    failed:
      "bg-red-100 text-red-700",

    refunded:
      "bg-purple-100 text-purple-700",

    partially_refunded:
      "bg-indigo-100 text-indigo-700",

    cancelled:
      "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        styles[status] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      {status
        .replaceAll(
          "_",
          " "
        )
        .replace(
          /\b\w/g,
          (char) =>
            char.toUpperCase()
        )}
    </span>
  );
}

function TransactionDetailsModal({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Payment Transaction
            </p>

            <h2 className="mt-1 font-mono text-xl font-bold text-slate-900">
              #{transaction.id}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <TransactionStatusBadge
                status={
                  transaction.status
                }
              />

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {transaction.transactionType
                  .replaceAll(
                    "_",
                    " "
                  )
                  .replace(
                    /\b\w/g,
                    (char) =>
                      char.toUpperCase()
                  )}
              </span>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-sm text-slate-300">
                Transaction Amount
              </p>

              <p className="mt-1 text-3xl font-bold">
                {formatCurrency(
                  transaction.amount
                )}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Currency:{" "}
                {
                  transaction.currency
                }
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailCard
                label="Order ID"
                value={
                  transaction.orderId ||
                  "—"
                }
              />

              <DetailCard
                label="Customer"
                value={
                  transaction.customerName ||
                  "—"
                }
              />

              <DetailCard
                label="Customer Email"
                value={
                  transaction.customerEmail ||
                  "—"
                }
              />

              <DetailCard
                label="Customer Phone"
                value={
                  transaction.customerPhone ||
                  "—"
                }
              />

              <DetailCard
                label="Seller"
                value={
                  transaction.sellerName ||
                  "Multiple / —"
                }
              />

              <DetailCard
                label="Payment Method"
                value={
                  transaction.paymentMethod
                }
              />

              <DetailCard
                label="Gateway"
                value={
                  transaction.gateway
                }
              />

              <DetailCard
                label="Gateway Order ID"
                value={
                  transaction.gatewayOrderId ||
                  "—"
                }
              />

              <DetailCard
                label="Gateway Transaction ID"
                value={
                  transaction.gatewayTransactionId ||
                  "—"
                }
              />

              <DetailCard
                label="Refund Amount"
                value={formatCurrency(
                  transaction.refundAmount
                )}
              />

              <DetailCard
                label="Created"
                value={formatDate(
                  transaction.createdAt
                )}
              />

              <DetailCard
                label="Updated"
                value={formatDate(
                  transaction.updatedAt
                )}
              />
            </div>

            {transaction.notes && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Notes
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {transaction.notes}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">
                Gateway Verification
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800">
                Production mein payment ko successful
                mark karne ke liye gateway signature/webhook
                server-side verify hona chahiye. Sirf client
                se bheja gaya transaction ID trusted nahi hona
                chahiye.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
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
        💳
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
