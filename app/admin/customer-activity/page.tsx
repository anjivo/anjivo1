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

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned"
  | string;

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | string;

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
};

type OrderItem = {
  id?: string;
  productId?: string;
  productName?: string;
  name?: string;
  image?: string;
  sellerId?: string;
  sellerName?: string;
  quantity?: number;
  price?: number;
  selectedPrice?: number;
  total?: number;
  pricingType?: "retail" | "wholesale" | string;
};

type CustomerOrder = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  itemCount: number;
  sellerCount: number;
  items: OrderItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
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
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
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

function formatDate(value: unknown): string {
  const millis = timestampValue(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(millis));
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): CustomerOrder {
  const rawItems = Array.isArray(data.items)
    ? data.items
    : [];

  const items: OrderItem[] = rawItems.map((raw) => {
    const item =
      typeof raw === "object" &&
      raw !== null
        ? (raw as Record<string, unknown>)
        : {};

    return {
      id: stringValue(item.id),
      productId:
        stringValue(item.productId) ||
        stringValue(item.id),
      productName:
        stringValue(item.productName) ||
        stringValue(item.name) ||
        "Product",
      name: stringValue(item.name),
      image: stringValue(item.image),
      sellerId: stringValue(item.sellerId),
      sellerName: stringValue(item.sellerName),
      quantity: numberValue(item.quantity),
      price:
        numberValue(item.price) ||
        numberValue(item.selectedPrice),
      selectedPrice: numberValue(
        item.selectedPrice
      ),
      total: numberValue(item.total),
      pricingType:
        stringValue(item.pricingType) ||
        "retail",
    };
  });

  const sellerIds = new Set(
    items
      .map((item) => item.sellerId)
      .filter(Boolean)
  );

  const calculatedItemCount = items.reduce(
    (sum, item) =>
      sum + Math.max(1, item.quantity || 0),
    0
  );

  return {
    id,

    userId:
      stringValue(data.userId) ||
      stringValue(data.customerId),

    customerName:
      stringValue(data.customerName) ||
      stringValue(data.name),

    customerEmail:
      stringValue(data.customerEmail) ||
      stringValue(data.email),

    customerPhone:
      stringValue(data.customerPhone) ||
      stringValue(data.phone),

    status:
      stringValue(data.status) ||
      "pending",

    paymentStatus:
      stringValue(data.paymentStatus) ||
      "pending",

    total:
      numberValue(data.total) ||
      numberValue(data.grandTotal),

    subtotal: numberValue(
      data.subtotal
    ),

    shipping:
      numberValue(data.shipping) ||
      numberValue(data.shippingCharge),

    discount: numberValue(
      data.discount
    ),

    itemCount:
      calculatedItemCount ||
      numberValue(data.itemCount),

    sellerCount: sellerIds.size,

    items,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export default function CustomerActivityPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [orders, setOrders] =
    useState<CustomerOrder[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [paymentFilter, setPaymentFilter] =
    useState("all");

  const [pricingFilter, setPricingFilter] =
    useState("all");

  const [selectedOrder, setSelectedOrder] =
    useState<CustomerOrder | null>(null);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/customer-activity";
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

            await Promise.all([
              loadOrders(),
              loadCustomers(),
            ]);
          } catch (error) {
            console.error(
              "Customer activity authorization error:",
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

  async function loadCustomers() {
    try {
      const snapshot =
        await getDocs(
          collection(db, "users")
        );

      const list: Customer[] = [];

      snapshot.docs.forEach((item) => {
        const data = item.data();

        if (
          data.role !==
            "RETAIL_CUSTOMER" &&
          data.role !==
            "WHOLESALE_CUSTOMER"
        ) {
          return;
        }

        list.push({
          id: item.id,

          name:
            stringValue(data.name) ||
            stringValue(data.displayName) ||
            "Unnamed Customer",

          email: stringValue(
            data.email
          ),

          phone:
            stringValue(data.phone) ||
            stringValue(data.mobile),

          role: stringValue(
            data.role
          ),
        });
      });

      list.sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "en-IN"
        )
      );

      setCustomers(list);
    } catch (error) {
      console.error(
        "Load customers error:",
        error
      );
    }
  }

  async function loadOrders() {
    try {
      const snapshot =
        await getDocs(
          collection(db, "orders")
        );

      const list =
        snapshot.docs.map((item) =>
          mapOrder(
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

      setOrders(list);
    } catch (error) {
      console.error(
        "Load orders error:",
        error
      );

      alert(
        "Orders load nahi ho paaye. Firestore rules check karein."
      );
    }
  }

  const filteredOrders =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return orders.filter(
        (order) => {
          const customerMatch =
            selectedCustomerId ===
              "all" ||
            order.userId ===
              selectedCustomerId;

          const statusMatch =
            statusFilter === "all" ||
            order.status ===
              statusFilter;

          const paymentMatch =
            paymentFilter === "all" ||
            order.paymentStatus ===
              paymentFilter;

          const hasWholesale =
            order.items.some(
              (item) =>
                item.pricingType ===
                "wholesale"
            );

          const hasRetail =
            order.items.some(
              (item) =>
                item.pricingType !==
                "wholesale"
            );

          const pricingMatch =
            pricingFilter === "all" ||
            (pricingFilter ===
              "wholesale" &&
              hasWholesale) ||
            (pricingFilter ===
              "retail" &&
              hasRetail);

          const searchMatch =
            !query ||
            order.id
              .toLowerCase()
              .includes(query) ||
            order.userId
              .toLowerCase()
              .includes(query) ||
            order.customerName
              .toLowerCase()
              .includes(query) ||
            order.customerEmail
              .toLowerCase()
              .includes(query) ||
            order.customerPhone
              .toLowerCase()
              .includes(query) ||
            order.items.some(
              (item) =>
                (
                  item.productName ||
                  ""
                )
                  .toLowerCase()
                  .includes(query) ||
                (
                  item.sellerName ||
                  ""
                )
                  .toLowerCase()
                  .includes(query)
            );

          return (
            customerMatch &&
            statusMatch &&
            paymentMatch &&
            pricingMatch &&
            searchMatch
          );
        }
      );
    }, [
      orders,
      search,
      selectedCustomerId,
      statusFilter,
      paymentFilter,
      pricingFilter,
    ]);

  const stats = useMemo(() => {
    const totalOrders =
      filteredOrders.length;

    const totalRevenue =
      filteredOrders.reduce(
        (sum, order) =>
          sum + order.total,
        0
      );

    const delivered =
      filteredOrders.filter(
        (order) =>
          order.status ===
          "delivered"
      ).length;

    const pending =
      filteredOrders.filter(
        (order) =>
          order.status ===
            "pending" ||
          order.status ===
            "confirmed" ||
          order.status ===
            "processing"
      ).length;

    const cancelled =
      filteredOrders.filter(
        (order) =>
          order.status ===
          "cancelled"
      ).length;

    const wholesaleOrders =
      filteredOrders.filter(
        (order) =>
          order.items.some(
            (item) =>
              item.pricingType ===
              "wholesale"
          )
      ).length;

    const retailOrders =
      filteredOrders.filter(
        (order) =>
          order.items.some(
            (item) =>
              item.pricingType !==
              "wholesale"
          )
      ).length;

    const averageOrderValue =
      totalOrders > 0
        ? totalRevenue /
          totalOrders
        : 0;

    return {
      totalOrders,
      totalRevenue,
      delivered,
      pending,
      cancelled,
      wholesaleOrders,
      retailOrders,
      averageOrderValue,
    };
  }, [filteredOrders]);

  const selectedCustomer =
    customers.find(
      (customer) =>
        customer.id ===
        selectedCustomerId
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading customer activity...
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
                Customer Activity
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/customers"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Customers
            </Link>

            <button
              onClick={() => {
                loadOrders();
                loadCustomers();
              }}
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
            Customer Commerce
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Customer Orders & Activity
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Customer ke orders, spending, order status,
            retail/wholesale activity aur seller-wise
            order information ko centrally monitor karein.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label="Orders"
            value={stats.totalOrders.toLocaleString(
              "en-IN"
            )}
            icon="🧾"
          />

          <StatCard
            label="Revenue"
            value={formatCurrency(
              stats.totalRevenue
            )}
            icon="₹"
          />

          <StatCard
            label="Avg Order"
            value={formatCurrency(
              Math.round(
                stats.averageOrderValue
              )
            )}
            icon="📊"
          />

          <StatCard
            label="Delivered"
            value={stats.delivered.toLocaleString(
              "en-IN"
            )}
            icon="✓"
          />

          <StatCard
            label="Pending"
            value={stats.pending.toLocaleString(
              "en-IN"
            )}
            icon="⏳"
          />

          <StatCard
            label="Cancelled"
            value={stats.cancelled.toLocaleString(
              "en-IN"
            )}
            icon="✕"
          />

          <StatCard
            label="Retail"
            value={stats.retailOrders.toLocaleString(
              "en-IN"
            )}
            icon="🛒"
          />

          <StatCard
            label="Wholesale"
            value={stats.wholesaleOrders.toLocaleString(
              "en-IN"
            )}
            icon="📦"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_230px_170px_170px_170px]">
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
                  placeholder="Search order, customer, mobile, product, seller..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={
                  selectedCustomerId
                }
                onChange={(event) =>
                  setSelectedCustomerId(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Customers
                </option>

                {customers.map(
                  (customer) => (
                    <option
                      key={customer.id}
                      value={
                        customer.id
                      }
                    >
                      {customer.name}
                    </option>
                  )
                )}
              </select>

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
                <option value="confirmed">
                  Confirmed
                </option>
                <option value="processing">
                  Processing
                </option>
                <option value="shipped">
                  Shipped
                </option>
                <option value="delivered">
                  Delivered
                </option>
                <option value="cancelled">
                  Cancelled
                </option>
                <option value="returned">
                  Returned
                </option>
              </select>

              <select
                value={
                  paymentFilter
                }
                onChange={(event) =>
                  setPaymentFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Payments
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
              </select>

              <select
                value={
                  pricingFilter
                }
                onChange={(event) =>
                  setPricingFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  Retail + Wholesale
                </option>
                <option value="retail">
                  Retail
                </option>
                <option value="wholesale">
                  Wholesale
                </option>
              </select>
            </div>
          </div>

          {selectedCustomer && (
            <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    Selected Customer
                  </p>

                  <p className="mt-1 text-sm font-bold text-indigo-950">
                    {selectedCustomer.name}
                  </p>

                  <p className="text-xs text-indigo-700">
                    {selectedCustomer.email ||
                      selectedCustomer.phone ||
                      "Contact not available"}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setSelectedCustomerId(
                      "all"
                    )
                  }
                  className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm"
                >
                  Clear Customer
                </button>
              </div>
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🧾
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">
                No orders found
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Current customer ya filters ke according
                koi order nahi mila.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOrders.map(
                (order) => (
                  <OrderRow
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

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() =>
            setSelectedOrder(null)
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
  value: string;
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
            {value}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  onOpen,
}: {
  order: CustomerOrder;
  onOpen: () => void;
}) {
  const wholesale =
    order.items.some(
      (item) =>
        item.pricingType ===
        "wholesale"
    );

  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-900">
              #{order.id}
            </span>

            <StatusBadge
              status={order.status}
            />

            <PaymentBadge
              status={
                order.paymentStatus
              }
            />

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {wholesale
                ? "Wholesale"
                : "Retail"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
            <span>
              👤{" "}
              {order.customerName ||
                "Customer"}
            </span>

            <span>
              📱{" "}
              {order.customerPhone ||
                "No mobile"}
            </span>

            <span>
              📦 {order.itemCount} items
            </span>

            <span>
              🏪 {order.sellerCount} seller
              {order.sellerCount !== 1
                ? "s"
                : ""}
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            {formatDate(
              order.createdAt
            )}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 xl:justify-end">
          <div className="text-right">
            <p className="text-xs text-slate-400">
              Order Value
            </p>

            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatCurrency(
                order.total
              )}
            </p>
          </div>

          <button
            onClick={onOpen}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Order
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
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
    confirmed:
      "bg-blue-100 text-blue-700",
    processing:
      "bg-indigo-100 text-indigo-700",
    shipped:
      "bg-purple-100 text-purple-700",
    delivered:
      "bg-emerald-100 text-emerald-700",
    cancelled:
      "bg-red-100 text-red-700",
    returned:
      "bg-orange-100 text-orange-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        styles[status] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      {status
        .replaceAll("_", " ")
        .replace(
          /\b\w/g,
          (char) =>
            char.toUpperCase()
        )}
    </span>
  );
}

function PaymentBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    paid:
      "bg-emerald-100 text-emerald-700",
    pending:
      "bg-amber-100 text-amber-700",
    failed:
      "bg-red-100 text-red-700",
    refunded:
      "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        styles[status] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      Payment:{" "}
      {status
        .replaceAll("_", " ")
        .replace(
          /\b\w/g,
          (char) =>
            char.toUpperCase()
        )}
    </span>
  );
}

function OrderDetailsModal({
  order,
  onClose,
}: {
  order: CustomerOrder;
  onClose: () => void;
}) {
  const wholesale =
    order.items.some(
      (item) =>
        item.pricingType ===
        "wholesale"
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Customer Order
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-xl font-bold text-slate-900">
                #{order.id}
              </h2>

              <StatusBadge
                status={order.status}
              />
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailCard
                label="Customer"
                value={
                  order.customerName ||
                  "—"
                }
              />

              <DetailCard
                label="Email"
                value={
                  order.customerEmail ||
                  "—"
                }
              />

              <DetailCard
                label="Mobile"
                value={
                  order.customerPhone ||
                  "—"
                }
              />

              <DetailCard
                label="Order Date"
                value={formatDate(
                  order.createdAt
                )}
              />

              <DetailCard
                label="Order Type"
                value={
                  wholesale
                    ? "Wholesale"
                    : "Retail"
                }
              />

              <DetailCard
                label="Payment"
                value={
                  order.paymentStatus
                }
              />

              <DetailCard
                label="Seller Count"
                value={String(
                  order.sellerCount
                )}
              />

              <DetailCard
                label="Item Count"
                value={String(
                  order.itemCount
                )}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">
                  Order Items
                </h3>

                <span className="text-xs text-slate-500">
                  {order.items.length} product
                  {order.items.length !==
                  1
                    ? "s"
                    : ""}
                </span>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {order.items.map(
                    (item, index) => {
                      const unitPrice =
                        item.selectedPrice ||
                        item.price ||
                        0;

                      const lineTotal =
                        item.total ||
                        unitPrice *
                          Math.max(
                            1,
                            item.quantity ||
                              0
                          );

                      return (
                        <div
                          key={`${item.productId || item.id || "item"}-${index}`}
                          className="p-4"
                        >
                          <div className="flex gap-3">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              {item.image ? (
                                <img
                                  src={
                                    item.image
                                  }
                                  alt={
                                    item.productName ||
                                    "Product"
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-lg">
                                  📦
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {item.productName ||
                                      "Product"}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Seller:{" "}
                                    {item.sellerName ||
                                      item.sellerId ||
                                      "—"}
                                  </p>
                                </div>

                                <p className="font-bold text-slate-900">
                                  {formatCurrency(
                                    lineTotal
                                  )}
                                </p>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                                  Qty:{" "}
                                  {item.quantity ||
                                    0}
                                </span>

                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                                  Unit:{" "}
                                  {formatCurrency(
                                    unitPrice
                                  )}
                                </span>

                                <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
                                  {item.pricingType ===
                                  "wholesale"
                                    ? "Wholesale Price"
                                    : "Retail Price"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            <div className="ml-auto max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4">
              <SummaryRow
                label="Subtotal"
                value={formatCurrency(
                  order.subtotal
                )}
              />

              <SummaryRow
                label="Shipping"
                value={formatCurrency(
                  order.shipping
                )}
              />

              <SummaryRow
                label="Discount"
                value={`-${formatCurrency(
                  order.discount
                )}`}
              />

              <div className="my-3 border-t border-slate-200" />

              <SummaryRow
                label="Grand Total"
                value={formatCurrency(
                  order.total
                )}
                strong
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Customer UID
              </p>

              <p className="mt-1 break-all font-mono text-xs text-slate-700">
                {order.userId ||
                  "Not available"}
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

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        strong
          ? "text-base font-bold text-slate-900"
          : "text-sm text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
