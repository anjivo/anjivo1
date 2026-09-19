"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
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
  | "refunded";

type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  selectedPrice: number;
  pricingType: "retail" | "wholesale";
  sellerId: string;
  sellerName?: string;
  image?: string;
};

type Order = {
  id: string;
  userId: string;
  sellerIds: string[];
  items: OrderItem[];
  shippingAddress: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt?: unknown;
};

const statuses: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      try {
        const userSnapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        if (!userSnapshot.exists()) {
          window.location.href = "/";
          return;
        }

        if (userSnapshot.data().role !== "ADMIN") {
          window.location.href = "/account";
          return;
        }

        setAuthorized(true);
        await loadOrders();
      } catch (error) {
        console.error("Admin orders error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function loadOrders() {
    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(ordersQuery);

    const list: Order[] = snapshot.docs.map((item) => {
      const data = item.data();

      const rawItems = Array.isArray(data.items)
        ? data.items
        : [];

      return {
        id: item.id,
        userId: String(data.userId ?? ""),
        sellerIds: Array.isArray(data.sellerIds)
          ? data.sellerIds.map(String)
          : [],
        items: rawItems.map((rawItem) => {
          const itemData =
            rawItem as Record<string, unknown>;

          return {
            productId: String(
              itemData.productId ?? ""
            ),
            name: String(itemData.name ?? ""),
            quantity: Number(
              itemData.quantity ?? 0
            ),
            selectedPrice: Number(
              itemData.selectedPrice ?? 0
            ),
            pricingType:
              itemData.pricingType === "wholesale"
                ? "wholesale"
                : "retail",
            sellerId: String(
              itemData.sellerId ?? ""
            ),
            sellerName:
              itemData.sellerName !== undefined
                ? String(itemData.sellerName)
                : undefined,
            image:
              itemData.image !== undefined
                ? String(itemData.image)
                : undefined,
          };
        }),
        shippingAddress:
          typeof data.shippingAddress === "object" &&
          data.shippingAddress !== null
            ? data.shippingAddress
            : {},
        paymentMethod:
          data.paymentMethod === "ONLINE"
            ? "ONLINE"
            : "COD",
        paymentStatus:
          data.paymentStatus === "paid" ||
          data.paymentStatus === "failed" ||
          data.paymentStatus === "refunded"
            ? data.paymentStatus
            : "pending",
        subtotal: Number(data.subtotal ?? 0),
        shippingCharge: Number(
          data.shippingCharge ?? 0
        ),
        discount: Number(data.discount ?? 0),
        totalAmount: Number(
          data.totalAmount ?? 0
        ),
        status:
          statuses.includes(data.status)
            ? data.status
            : "pending",
        createdAt: data.createdAt,
      };
    });

    setOrders(list);
  }

  async function updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ) {
    try {
      setProcessing(orderId);

      await updateDoc(doc(db, "orders", orderId), {
        status,
        updatedAt: serverTimestamp(),
      });

      await loadOrders();
    } catch (error) {
      console.error(
        "Order status update error:",
        error
      );

      alert("Order status update failed.");
    } finally {
      setProcessing(null);
    }
  }

  async function updatePaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus
  ) {
    try {
      setProcessing(orderId);

      await updateDoc(doc(db, "orders", orderId), {
        paymentStatus,
        updatedAt: serverTimestamp(),
      });

      await loadOrders();
    } catch (error) {
      console.error(
        "Payment status update error:",
        error
      );

      alert("Payment status update failed.");
    } finally {
      setProcessing(null);
    }
  }

  const filteredOrders =
    filter === "all"
      ? orders
      : orders.filter(
          (order) => order.status === filter
        );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <p className="text-sm text-gray-500">
            Loading orders...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex gap-2">
            <Link
              href="/admin"
              className="rounded-lg border px-4 py-2 text-sm font-medium"
            >
              Admin Dashboard
            </Link>

            <Link
              href="/"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Store
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Heading */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500">
            ADMIN / ORDERS
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Order Management
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Manage customer orders, payment status and
            fulfillment.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </FilterButton>

          {statuses.map((status) => (
            <FilterButton
              key={status}
              active={filter === status}
              onClick={() => setFilter(status)}
            >
              {formatStatus(status)}
            </FilterButton>
          ))}
        </div>

        {/* Orders */}
        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border bg-white p-12 text-center">
            <div className="text-4xl">🛒</div>

            <h2 className="mt-4 text-lg font-bold">
              No orders found
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Orders will appear here after customers
              place them.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                processing={processing === order.id}
                onStatusChange={updateOrderStatus}
                onPaymentChange={updatePaymentStatus}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function OrderCard({
  order,
  processing,
  onStatusChange,
  onPaymentChange,
}: {
  order: Order;
  processing: boolean;
  onStatusChange: (
    orderId: string,
    status: OrderStatus
  ) => void;
  onPaymentChange: (
    orderId: string,
    status: PaymentStatus
  ) => void;
}) {
  const address = order.shippingAddress;

  return (
    <div className="rounded-2xl border bg-white p-5">
      {/* Top */}
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">
            Order ID
          </p>

          <p className="mt-1 break-all font-mono text-sm font-bold">
            {order.id}
          </p>

          <p className="mt-2 text-xs text-gray-500">
            Customer UID: {order.userId}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={order.status} />

          <PaymentBadge
            status={order.paymentStatus}
          />
        </div>
      </div>

      {/* Items */}
      <div className="py-5">
        <h3 className="mb-3 text-sm font-bold">
          Products
        </h3>

        <div className="space-y-3">
          {order.items.map((item, index) => (
            <div
              key={`${item.productId}-${index}`}
              className="flex gap-3 rounded-xl bg-gray-50 p-3"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>📦</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {item.name}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Seller:{" "}
                  {item.sellerName ||
                    item.sellerId}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {item.pricingType === "wholesale"
                    ? "Wholesale"
                    : "Retail"}{" "}
                  · Qty {item.quantity} · ₹
                  {item.selectedPrice} / unit
                </p>
              </div>

              <div className="text-right text-sm font-bold">
                ₹
                {(
                  item.selectedPrice *
                  item.quantity
                ).toLocaleString("en-IN")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer + Amount */}
      <div className="grid gap-5 border-t border-b py-5 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold">
            Delivery Address
          </h3>

          <div className="text-sm text-gray-600">
            <p className="font-semibold text-gray-900">
              {address.fullName || "—"}
            </p>

            <p>
              {address.phone || "—"}
            </p>

            <p className="mt-1">
              {address.addressLine1 || ""}
              {address.addressLine2
                ? `, ${address.addressLine2}`
                : ""}
            </p>

            <p>
              {address.city || ""},{" "}
              {address.state || ""}{" "}
              {address.pincode || ""}
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold">
            Payment & Amount
          </h3>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">
                Method
              </span>

              <span className="font-semibold">
                {order.paymentMethod}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Subtotal
              </span>

              <span>
                ₹
                {order.subtotal.toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Shipping
              </span>

              <span>
                ₹
                {order.shippingCharge.toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Discount
              </span>

              <span>
                -₹
                {order.discount.toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>

            <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
              <span>Total</span>

              <span>
                ₹
                {order.totalAmount.toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500">
            Order Status
          </label>

          <select
            value={order.status}
            disabled={processing}
            onChange={(event) =>
              onStatusChange(
                order.id,
                event.target.value as OrderStatus
              )
            }
            className="rounded-xl border bg-white px-4 py-2.5 text-sm outline-none"
          >
            {statuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500">
            Payment Status
          </label>

          <select
            value={order.paymentStatus}
            disabled={processing}
            onChange={(event) =>
              onPaymentChange(
                order.id,
                event.target.value as PaymentStatus
              )
            }
            className="rounded-xl border bg-white px-4 py-2.5 text-sm outline-none"
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
          </select>
        </div>

        {processing && (
          <p className="text-xs text-gray-500">
            Updating...
          </p>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
        active
          ? "bg-black text-white"
          : "border bg-white text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) => character.toUpperCase()
    );
}

function StatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const styles: Record<OrderStatus, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    processing: "bg-purple-100 text-purple-700",
    shipped: "bg-indigo-100 text-indigo-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    returned: "bg-orange-100 text-orange-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${styles[status]}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function PaymentBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  const styles: Record<PaymentStatus, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    refunded: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${styles[status]}`}
    >
      Payment: {formatStatus(status)}
    </span>
  );
}
