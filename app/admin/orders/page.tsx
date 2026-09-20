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

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cod";

type OrderItem = {
  productId?: string;
  id?: string;
  name?: string;
  sellerId?: string;
  sellerName?: string;
  quantity?: number;
  price?: number;
  selectedPrice?: number;
  pricingType?: "retail" | "wholesale";
  subtotal?: number;
};

type Order = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  items: OrderItem[];

  subtotal: number;
  shipping: number;
  discount: number;
  total: number;

  status: OrderStatus;
  paymentStatus: PaymentStatus;

  paymentMethod: string;

  sellerIds: string[];
  sellerCount: number;

  shippingAddress: string;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type OrderFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

function stringValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function numberValue(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function timestampValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    return Number(
      (value as { seconds?: unknown }).seconds ?? 0
    );
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function normalizeStatus(
  value: unknown
): OrderStatus {
  const status = stringValue(value);

  const allowed: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
  ];

  return allowed.includes(
    status as OrderStatus
  )
    ? (status as OrderStatus)
    : "pending";
}

function normalizePaymentStatus(
  value: unknown
): PaymentStatus {
  const status = stringValue(value);

  const allowed: PaymentStatus[] = [
    "pending",
    "paid",
    "failed",
    "refunded",
    "cod",
  ];

  return allowed.includes(
    status as PaymentStatus
  )
    ? (status as PaymentStatus)
    : "pending";
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): Order {
  const rawItems = Array.isArray(
    data.items
  )
    ? data.items
    : [];

  const items: OrderItem[] =
    rawItems.map((raw) => {
      const item =
        raw as Record<string, unknown>;

      return {
        productId:
          stringValue(
            item.productId
          ) || undefined,

        id:
          stringValue(
            item.id
          ) || undefined,

        name:
          stringValue(
            item.name
          ) || "Product",

        sellerId:
          stringValue(
            item.sellerId
          ) || undefined,

        sellerName:
          stringValue(
            item.sellerName
          ) || undefined,

        quantity:
          numberValue(
            item.quantity
          ),

        price:
          numberValue(
            item.price
          ),

        selectedPrice:
          numberValue(
            item.selectedPrice
          ),

        pricingType:
          item.pricingType ===
          "wholesale"
            ? "wholesale"
            : "retail",

        subtotal:
          numberValue(
            item.subtotal
          ),
      };
    });

  const sellerIds = Array.from(
    new Set(
      items
        .map(
          (item) =>
            item.sellerId
        )
        .filter(Boolean)
    )
  ) as string[];

  return {
    id,

    userId:
      stringValue(
        data.userId
      ),

    customerName:
      stringValue(
        data.customerName ||
          data.name
      ),

    customerEmail:
      stringValue(
        data.customerEmail ||
          data.email
      ),

    customerPhone:
      stringValue(
        data.customerPhone ||
          data.phone
      ),

    items,

    subtotal:
      numberValue(
        data.subtotal
      ),

    shipping:
      numberValue(
        data.shipping
      ),

    discount:
      numberValue(
        data.discount
      ),

    total:
      numberValue(
        data.total ||
          data.grandTotal
      ),

    status:
      normalizeStatus(
        data.status
      ),

    paymentStatus:
      normalizePaymentStatus(
        data.paymentStatus
      ),

    paymentMethod:
      stringValue(
        data.paymentMethod
      ),

    sellerIds,

    sellerCount:
      sellerIds.length,

    shippingAddress:
      stringValue(
        data.shippingAddress ||
          data.address
      ),

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

export default function AdminOrdersPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [filter, setFilter] =
    useState<OrderFilter>("all");

  const [search, setSearch] =
    useState("");

  const [processing, setProcessing] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/orders";

            return;
          }

          try {
            const userSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !userSnapshot.exists()
            ) {
              window.location.href =
                "/";

              return;
            }

            if (
              userSnapshot.data()
                .role !== "ADMIN"
            ) {
              window.location.href =
                "/account";

              return;
            }

            setAuthorized(true);

            await loadOrders();
          } catch (err) {
            console.error(err);

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

  async function loadOrders() {
    try {
      setError("");

      const snapshot =
        await getDocs(
          collection(
            db,
            "orders"
          )
        );

      const list =
        snapshot.docs.map(
          (item) =>
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
    } catch (err) {
      console.error(
        "Load orders error:",
        err
      );

      setError(
        "Orders load nahi ho paaye."
      );
    }
  }

  async function updateOrderStatus(
    order: Order,
    status: OrderStatus
  ) {
    if (
      order.status ===
      status
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Order #${order.id.slice(
          0,
          10
        )} ko "${status}" status dena hai?`
      );

    if (!confirmed) return;

    try {
      setProcessing(order.id);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        {
          status,
          updatedAt:
            serverTimestamp(),
        }
      );

      setOrders(
        (current) =>
          current.map(
            (item) =>
              item.id === order.id
                ? {
                    ...item,
                    status,
                  }
                : item
          )
      );

      setSelectedOrder(
        (current) =>
          current &&
          current.id === order.id
            ? {
                ...current,
                status,
              }
            : current
      );

      setSuccess(
        `Order status updated to ${status}.`
      );
    } catch (err) {
      console.error(err);

      setError(
        "Order status update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function updatePaymentStatus(
    order: Order,
    paymentStatus: PaymentStatus
  ) {
    if (
      order.paymentStatus ===
      paymentStatus
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Payment status "${paymentStatus}" set karna hai?`
      );

    if (!confirmed) return;

    try {
      setProcessing(order.id);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        {
          paymentStatus,
          updatedAt:
            serverTimestamp(),
        }
      );

      setOrders(
        (current) =>
          current.map(
            (item) =>
              item.id === order.id
                ? {
                    ...item,
                    paymentStatus,
                  }
                : item
          )
      );

      setSelectedOrder(
        (current) =>
          current &&
          current.id === order.id
            ? {
                ...current,
                paymentStatus,
              }
            : current
      );

      setSuccess(
        "Payment status updated."
      );
    } catch (err) {
      console.error(err);

      setError(
        "Payment status update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  async function cancelOrder(
    order: Order
  ) {
    if (
      order.status ===
      "delivered" ||
      order.status ===
      "cancelled"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Order #${order.id.slice(
          0,
          10
        )} cancel karna hai?`
      );

    if (!confirmed) return;

    await updateOrderStatus(
      order,
      "cancelled"
    );
  }

  const filteredOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return orders.filter(
        (order) => {
          const matchesStatus =
            filter === "all" ||
            order.status ===
              filter;

          const searchableText = [
            order.id,
            order.userId,
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            order.paymentMethod,
            ...order.items.map(
              (item) =>
                item.name
            ),
            ...order.items.map(
              (item) =>
                item.sellerName
            ),
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
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      orders,
      filter,
      search,
    ]);

  const counts =
    useMemo(
      () => ({
        all:
          orders.length,

        pending:
          orders.filter(
            (order) =>
              order.status ===
              "pending"
          ).length,

        confirmed:
          orders.filter(
            (order) =>
              order.status ===
              "confirmed"
          ).length,

        processing:
          orders.filter(
            (order) =>
              order.status ===
              "processing"
          ).length,

        shipped:
          orders.filter(
            (order) =>
              order.status ===
              "shipped"
          ).length,

        delivered:
          orders.filter(
            (order) =>
              order.status ===
              "delivered"
          ).length,

        cancelled:
          orders.filter(
            (order) =>
              order.status ===
              "cancelled"
          ).length,

        returned:
          orders.filter(
            (order) =>
              order.status ===
              "returned"
          ).length,
      }),
      [orders]
    );

  const totalOrderValue =
    orders.reduce(
      (sum, order) =>
        sum + order.total,
      0
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading Order Management...
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
              href="/admin/customers"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Customers
            </Link>

            <button
              type="button"
              onClick={() =>
                loadOrders()
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
              ADMIN / ORDERS
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
              Order Management
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Retail, wholesale aur
              multi-seller orders manage karein.
            </p>

          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">

            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Total Order Value
            </p>

            <p className="mt-1 text-xl font-black">
              ₹
              {totalOrderValue.toLocaleString(
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

        {/* STATUS CARDS */}

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">

          <OrderCount
            label="All"
            count={counts.all}
            active={
              filter === "all"
            }
            onClick={() =>
              setFilter("all")
            }
          />

          <OrderCount
            label="Pending"
            count={counts.pending}
            active={
              filter === "pending"
            }
            onClick={() =>
              setFilter("pending")
            }
          />

          <OrderCount
            label="Confirmed"
            count={counts.confirmed}
            active={
              filter === "confirmed"
            }
            onClick={() =>
              setFilter("confirmed")
            }
          />

          <OrderCount
            label="Processing"
            count={counts.processing}
            active={
              filter === "processing"
            }
            onClick={() =>
              setFilter(
                "processing"
              )
            }
          />

          <OrderCount
            label="Shipped"
            count={counts.shipped}
            active={
              filter === "shipped"
            }
            onClick={() =>
              setFilter("shipped")
            }
          />

          <OrderCount
            label="Delivered"
            count={counts.delivered}
            active={
              filter === "delivered"
            }
            onClick={() =>
              setFilter("delivered")
            }
          />

          <OrderCount
            label="Cancelled"
            count={counts.cancelled}
            active={
              filter === "cancelled"
            }
            onClick={() =>
              setFilter(
                "cancelled"
              )
            }
          />

          <OrderCount
            label="Returned"
            count={counts.returned}
            active={
              filter === "returned"
            }
            onClick={() =>
              setFilter("returned")
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
            placeholder="Search order ID, customer, phone, product or seller..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
          />

        </div>

        {/* ORDERS */}

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          {filteredOrders.length ===
          0 ? (
            <div className="p-14 text-center">

              <div className="text-5xl">
                📦
              </div>

              <h2 className="mt-4 text-lg font-black">
                No orders found
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Abhi is filter ke according
                koi order nahi hai.
              </p>

            </div>
          ) : (
            <div className="divide-y divide-gray-100">

              {filteredOrders.map(
                (order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    processing={
                      processing ===
                      order.id
                    }
                    onView={() =>
                      setSelectedOrder(
                        order
                      )
                    }
                    onCancel={() =>
                      cancelOrder(
                        order
                      )
                    }
                    onStatusChange={(
                      status
                    ) =>
                      updateOrderStatus(
                        order,
                        status
                      )
                    }
                  />
                )
              )}

            </div>
          )}

        </div>

      </div>

      {/* ORDER DETAIL MODAL */}

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          processing={
            processing ===
            selectedOrder.id
          }
          onClose={() =>
            setSelectedOrder(null)
          }
          onStatusChange={(
            status
          ) =>
            updateOrderStatus(
              selectedOrder,
              status
            )
          }
          onPaymentChange={(
            status
          ) =>
            updatePaymentStatus(
              selectedOrder,
              status
            )
          }
        />
      )}

    </main>
  );
}

/* =========================================================
   ORDER COUNT
========================================================= */

function OrderCount({
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
   ORDER ROW
========================================================= */

function OrderRow({
  order,
  processing,
  onView,
  onCancel,
  onStatusChange,
}: {
  order: Order;
  processing: boolean;
  onView: () => void;
  onCancel: () => void;
  onStatusChange: (
    status: OrderStatus
  ) => void;
}) {
  return (
    <div className="p-5 sm:p-6">

      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <h2 className="text-base font-black">
              #{order.id.slice(0, 12)}
            </h2>

            <OrderStatusBadge
              status={order.status}
            />

            <PaymentBadge
              status={
                order.paymentStatus
              }
            />

          </div>

          <div className="mt-2 flex flex-wrap gap-2">

            <InfoBadge>
              👤{" "}
              {order.customerName ||
                "Guest"}
            </InfoBadge>

            {order.customerPhone && (
              <InfoBadge>
                📱{" "}
                {order.customerPhone}
              </InfoBadge>
            )}

            <InfoBadge>
              📦{" "}
              {order.items.length} items
            </InfoBadge>

            <InfoBadge>
              🏪{" "}
              {order.sellerCount} seller
              {order.sellerCount ===
              1
                ? ""
                : "s"}
            </InfoBadge>

            <InfoBadge>
              {order.items.some(
                (item) =>
                  item.pricingType ===
                  "wholesale"
              )
                ? "WHOLESALE"
                : "RETAIL"}
            </InfoBadge>

          </div>

          <p className="mt-3 text-xs text-gray-500">
            {order.customerEmail ||
              "No email"}
          </p>

        </div>

        <div className="flex flex-col gap-3 xl:items-end">

          <p className="text-xl font-black">
            ₹
            {order.total.toLocaleString(
              "en-IN"
            )}
          </p>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={onView}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black hover:border-black"
            >
              View Order
            </button>

            <select
              value={order.status}
              disabled={processing}
              onChange={(event) =>
                onStatusChange(
                  event.target
                    .value as OrderStatus
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-black outline-none"
            >
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

              <option value="returned">
                Returned
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>

            {order.status !==
              "cancelled" &&
              order.status !==
                "delivered" && (
                <button
                  type="button"
                  disabled={
                    processing
                  }
                  onClick={
                    onCancel
                  }
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                >
                  Cancel
                </button>
              )}

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   ORDER MODAL
========================================================= */

function OrderModal({
  order,
  processing,
  onClose,
  onStatusChange,
  onPaymentChange,
}: {
  order: Order;
  processing: boolean;
  onClose: () => void;
  onStatusChange: (
    status: OrderStatus
  ) => void;
  onPaymentChange: (
    status: PaymentStatus
  ) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">

      <div className="mx-auto my-8 max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">

        {/* MODAL HEADER */}

        <div className="flex items-center justify-between border-b p-5 sm:p-6">

          <div>

            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              ORDER DETAILS
            </p>

            <h2 className="mt-1 text-xl font-black">
              #{order.id}
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

        <div className="max-h-[75vh] overflow-y-auto p-5 sm:p-6">

          {/* CUSTOMER */}

          <div className="grid gap-4 md:grid-cols-3">

            <DetailBox
              label="Customer"
              value={
                order.customerName ||
                "Guest"
              }
            />

            <DetailBox
              label="Mobile"
              value={
                order.customerPhone ||
                "—"
              }
            />

            <DetailBox
              label="Email"
              value={
                order.customerEmail ||
                "—"
              }
            />

          </div>

          {/* ORDER CONTROLS */}

          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <div className="rounded-2xl border border-gray-200 p-4">

              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Order Status
              </p>

              <select
                value={
                  order.status
                }
                disabled={
                  processing
                }
                onChange={(
                  event
                ) =>
                  onStatusChange(
                    event.target
                      .value as OrderStatus
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black outline-none"
              >
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

                <option value="returned">
                  Returned
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>

            </div>

            <div className="rounded-2xl border border-gray-200 p-4">

              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Payment Status
              </p>

              <select
                value={
                  order.paymentStatus
                }
                disabled={
                  processing
                }
                onChange={(
                  event
                ) =>
                  onPaymentChange(
                    event.target
                      .value as PaymentStatus
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black outline-none"
              >
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

                <option value="cod">
                  COD
                </option>
              </select>

            </div>

          </div>

          {/* ITEMS */}

          <div className="mt-6">

            <h3 className="text-sm font-black">
              Order Items
            </h3>

            <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200">

              {order.items.map(
                (item, index) => (
                  <div
                    key={`${item.productId || item.id || "item"}-${index}`}
                    className="border-b border-gray-100 p-4 last:border-b-0"
                  >

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <p className="text-sm font-black">
                          {item.name ||
                            "Product"}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-2">

                          <span className="text-[10px] text-gray-500">
                            Qty:{" "}
                            {item.quantity ||
                              0}
                          </span>

                          <span className="text-[10px] text-gray-500">
                            Seller:{" "}
                            {item.sellerName ||
                              item.sellerId ||
                              "—"}
                          </span>

                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black">
                            {item.pricingType ===
                            "wholesale"
                              ? "WHOLESALE"
                              : "RETAIL"}
                          </span>

                        </div>

                      </div>

                      <p className="text-sm font-black">
                        ₹
                        {(
                          item.subtotal ||
                          (
                            item.selectedPrice ||
                            item.price ||
                            0
                          ) *
                            (item.quantity ||
                              0)
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </p>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

          {/* SELLERS */}

          <div className="mt-6">

            <h3 className="text-sm font-black">
              Sellers In This Order
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">

              {Array.from(
                new Set(
                  order.items
                    .map(
                      (item) =>
                        item.sellerName ||
                        item.sellerId
                    )
                    .filter(Boolean)
                )
              ).map(
                (seller) => (
                  <span
                    key={
                      seller as string
                    }
                    className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700"
                  >
                    🏪{" "}
                    {seller as string}
                  </span>
                )
              )}

            </div>

          </div>

          {/* ADDRESS */}

          <div className="mt-6 rounded-2xl border border-gray-200 p-4">

            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              Shipping Address
            </p>

            <p className="mt-2 text-sm font-semibold text-gray-700">
              {order.shippingAddress ||
                "Address not available"}
            </p>

          </div>

          {/* SUMMARY */}

          <div className="mt-6 rounded-2xl bg-gray-50 p-5">

            <div className="flex justify-between py-1 text-sm">
              <span>Subtotal</span>
              <strong>
                ₹
                {order.subtotal.toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            <div className="flex justify-between py-1 text-sm">
              <span>Shipping</span>
              <strong>
                ₹
                {order.shipping.toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            <div className="flex justify-between py-1 text-sm">
              <span>Discount</span>
              <strong>
                - ₹
                {order.discount.toLocaleString(
                  "en-IN"
                )}
              </strong>
            </div>

            <div className="mt-3 flex justify-between border-t pt-3 text-lg font-black">
              <span>Total</span>
              <span>
                ₹
                {order.total.toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   BADGES
========================================================= */

function OrderStatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const styles: Record<
    OrderStatus,
    string
  > = {
    pending:
      "bg-yellow-100 text-yellow-700",

    confirmed:
      "bg-blue-100 text-blue-700",

    processing:
      "bg-purple-100 text-purple-700",

    shipped:
      "bg-indigo-100 text-indigo-700",

    delivered:
      "bg-green-100 text-green-700",

    cancelled:
      "bg-red-100 text-red-700",

    returned:
      "bg-orange-100 text-orange-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${styles[status]}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function PaymentBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[9px] font-black ${
        status === "paid"
          ? "bg-green-100 text-green-700"
          : status === "failed"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      PAY: {status.toUpperCase()}
    </span>
  );
}

function InfoBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[10px] font-bold text-gray-600">
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
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-bold text-gray-700">
        {value}
      </p>
    </div>
  );
}
