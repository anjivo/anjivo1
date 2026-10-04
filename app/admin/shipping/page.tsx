"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

/* =========================================================
   TYPES
========================================================= */

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cod";

type ShippingAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
};

type SellerFulfillment = {
  status?: string;
  fulfillmentStatus?: string;
  courierName?: string;
  courier?: string;
  trackingNumber?: string;
  awbNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: unknown;
  shippedAt?: unknown;
  deliveredAt?: unknown;
  updatedAt?: unknown;
};

type OrderItem = {
  productId?: string;
  sellerId?: string;
  sellerName?: string;
  name?: string;
  quantity?: number;
  selectedPrice?: number;
  subtotal?: number;
  pricingType?: "retail" | "wholesale";
};

type Order = {
  id: string;
  userId: string;

  customerName?: string;
  customerEmail?: string;

  sellerIds: string[];
  items: OrderItem[];

  shippingAddress: ShippingAddress;

  paymentMethod: string;
  paymentStatus: string;

  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;

  status: OrderStatus;

  fulfillmentStatus?: string;

  courierName?: string;
  courier?: string;
  trackingNumber?: string;
  awbNumber?: string;
  trackingUrl?: string;

  estimatedDelivery?: unknown;
  shippedAt?: unknown;
  deliveredAt?: unknown;

  sellerFulfillment?: Record<string, SellerFulfillment>;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type FilterStatus =
  | "all"
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "refunded";

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(value: unknown): OrderStatus {
  const raw = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");

  const aliases: Record<string, OrderStatus> = {
    placed: "pending",
    order_placed: "pending",
    accepted: "confirmed",
    approved: "confirmed",
    ready_to_ship: "packed",
    dispatched: "shipped",
    in_transit: "shipped",
    on_the_way: "shipped",
    outfordelivery: "out_for_delivery",
    complete: "delivered",
    completed: "delivered",
  };

  if (aliases[raw]) {
    return aliases[raw];
  }

  const allowed: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "returned",
    "refunded",
  ];

  return allowed.includes(raw as OrderStatus)
    ? (raw as OrderStatus)
    : "pending";
}

function getTimestampValue(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();

    return Number.isNaN(time) ? 0 : time;
  }

  return 0;
}

function formatDate(value: unknown): string {
  const time = getTimestampValue(value);

  if (!time) {
    return "—";
  }

  return new Date(time).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClasses(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";

    case "confirmed":
      return "bg-blue-100 text-blue-800";

    case "processing":
      return "bg-indigo-100 text-indigo-800";

    case "packed":
      return "bg-purple-100 text-purple-800";

    case "shipped":
      return "bg-cyan-100 text-cyan-800";

    case "out_for_delivery":
      return "bg-orange-100 text-orange-800";

    case "delivered":
      return "bg-green-100 text-green-800";

    case "cancelled":
      return "bg-red-100 text-red-800";

    case "returned":
      return "bg-pink-100 text-pink-800";

    case "refunded":
      return "bg-gray-200 text-gray-800";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getPaymentClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-green-100 text-green-800";

    case "cod":
      return "bg-blue-100 text-blue-800";

    case "failed":
      return "bg-red-100 text-red-800";

    case "refunded":
      return "bg-purple-100 text-purple-800";

    default:
      return "bg-yellow-100 text-yellow-800";
  }
}

function mapOrder(id: string, data: any): Order {
  const items: OrderItem[] = Array.isArray(data.items)
    ? data.items.map((item: any) => ({
        productId: item.productId || "",
        sellerId: item.sellerId || "",
        sellerName: item.sellerName || "",
        name: item.name || "Product",
        quantity: Number(item.quantity || 0),
        selectedPrice: Number(item.selectedPrice || 0),
        subtotal: Number(item.subtotal || 0),
        pricingType:
          item.pricingType === "wholesale" ? "wholesale" : "retail",
      }))
    : [];

  let sellerFulfillment:
    | Record<string, SellerFulfillment>
    | undefined;

  if (
    data.sellerFulfillment &&
    typeof data.sellerFulfillment === "object" &&
    !Array.isArray(data.sellerFulfillment)
  ) {
    sellerFulfillment = Object.fromEntries(
      Object.entries(data.sellerFulfillment).map(
        ([sellerId, raw]: [string, any]) => [
          sellerId,
          {
            status: raw?.status || "",
            fulfillmentStatus: raw?.fulfillmentStatus || "",
            courierName: raw?.courierName || "",
            courier: raw?.courier || "",
            trackingNumber: raw?.trackingNumber || "",
            awbNumber: raw?.awbNumber || "",
            trackingUrl: raw?.trackingUrl || "",
            estimatedDelivery: raw?.estimatedDelivery,
            shippedAt: raw?.shippedAt,
            deliveredAt: raw?.deliveredAt,
            updatedAt: raw?.updatedAt,
          },
        ],
      ),
    );
  }

  return {
    id,

    userId: data.userId || "",

    customerName: data.customerName || "",
    customerEmail: data.customerEmail || "",

    sellerIds: Array.isArray(data.sellerIds)
      ? data.sellerIds
      : [],

    items,

    shippingAddress: {
      fullName: data.shippingAddress?.fullName || "",
      phone: data.shippingAddress?.phone || "",
      addressLine1: data.shippingAddress?.addressLine1 || "",
      addressLine2: data.shippingAddress?.addressLine2 || "",
      city: data.shippingAddress?.city || "",
      state: data.shippingAddress?.state || "",
      pincode: data.shippingAddress?.pincode || "",
    },

    paymentMethod: data.paymentMethod || "COD",
    paymentStatus: data.paymentStatus || "pending",

    subtotal: Number(data.subtotal || 0),
    shippingCharge: Number(
      data.shippingCharge ?? data.shipping ?? 0,
    ),
    discount: Number(data.discount || 0),
    totalAmount: Number(
      data.totalAmount ?? data.total ?? 0,
    ),

    status: normalizeStatus(
      data.fulfillmentStatus ||
        data.orderStatus ||
        data.status ||
        "pending",
    ),

    fulfillmentStatus: data.fulfillmentStatus || "",

    courierName: data.courierName || "",
    courier: data.courier || "",
    trackingNumber: data.trackingNumber || "",
    awbNumber: data.awbNumber || "",
    trackingUrl: data.trackingUrl || "",

    estimatedDelivery: data.estimatedDelivery,
    shippedAt: data.shippedAt,
    deliveredAt: data.deliveredAt,

    sellerFulfillment,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminShippingPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>("all");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(
    null,
  );

  const [shipmentForm, setShipmentForm] = useState({
    courierName: "",
    courier: "",
    trackingNumber: "",
    awbNumber: "",
    trackingUrl: "",
    estimatedDelivery: "",
  });

  /* =========================================================
     AUTH
  ========================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setAuthorized(false);
          setLoading(false);
          setError("Please login as admin.");
          return;
        }

        try {
          const userSnap = await getDocs(
            collection(db, "users"),
          );

          let isAdmin = false;

          userSnap.forEach((item) => {
            if (
              item.id === user.uid &&
              item.data()?.role === "ADMIN"
            ) {
              isAdmin = true;
            }
          });

          if (!isAdmin) {
            setAuthorized(false);
            setLoading(false);
            setError("You are not authorized to access this page.");
            return;
          }

          setAuthorized(true);
          await loadOrders();
        } catch (err) {
          console.error(err);
          setError("Unable to verify admin access.");
          setLoading(false);
        }
      },
    );

    return () => unsubscribe();
  }, []);

  /* =========================================================
     LOAD ORDERS
  ========================================================= */

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const snapshot = await getDocs(
        collection(db, "orders"),
      );

      const loaded = snapshot.docs
        .map((orderDoc) =>
          mapOrder(orderDoc.id, orderDoc.data()),
        )
        .sort(
          (a, b) =>
            getTimestampValue(b.createdAt) -
            getTimestampValue(a.createdAt),
        );

      setOrders(loaded);
    } catch (err) {
      console.error(err);
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     UPDATE SHIPMENT
  ========================================================= */

  async function updateShipment(
    order: Order,
    nextStatus?: OrderStatus,
  ) {
    try {
      setUpdatingId(order.id);
      setError("");
      setSuccess("");

      const status =
        nextStatus || order.status;

      const payload: Record<string, unknown> = {
        fulfillmentStatus: status,
        status,
        updatedAt: serverTimestamp(),
      };

      if (shipmentForm.courierName.trim()) {
        payload.courierName =
          shipmentForm.courierName.trim();
      }

      if (shipmentForm.courier.trim()) {
        payload.courier =
          shipmentForm.courier.trim();
      }

      if (shipmentForm.trackingNumber.trim()) {
        payload.trackingNumber =
          shipmentForm.trackingNumber.trim();
      }

      if (shipmentForm.awbNumber.trim()) {
        payload.awbNumber =
          shipmentForm.awbNumber.trim();
      }

      if (shipmentForm.trackingUrl.trim()) {
        payload.trackingUrl =
          shipmentForm.trackingUrl.trim();
      }

      if (shipmentForm.estimatedDelivery.trim()) {
        payload.estimatedDelivery =
          shipmentForm.estimatedDelivery.trim();
      }

      if (status === "shipped") {
        payload.shippedAt =
          serverTimestamp();
      }

      if (status === "delivered") {
        payload.deliveredAt =
          serverTimestamp();
      }

      await updateDoc(
        doc(db, "orders", order.id),
        payload,
      );

      setOrders((previous) =>
        previous.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status,
                fulfillmentStatus: status,
                courierName:
                  shipmentForm.courierName.trim() ||
                  item.courierName,
                courier:
                  shipmentForm.courier.trim() ||
                  item.courier,
                trackingNumber:
                  shipmentForm.trackingNumber.trim() ||
                  item.trackingNumber,
                awbNumber:
                  shipmentForm.awbNumber.trim() ||
                  item.awbNumber,
                trackingUrl:
                  shipmentForm.trackingUrl.trim() ||
                  item.trackingUrl,
                estimatedDelivery:
                  shipmentForm.estimatedDelivery.trim() ||
                  item.estimatedDelivery,
              }
            : item,
        ),
      );

      setSelectedOrder((previous) =>
        previous?.id === order.id
          ? {
              ...previous,
              status,
              fulfillmentStatus: status,
              courierName:
                shipmentForm.courierName.trim() ||
                previous.courierName,
              courier:
                shipmentForm.courier.trim() ||
                previous.courier,
              trackingNumber:
                shipmentForm.trackingNumber.trim() ||
                previous.trackingNumber,
              awbNumber:
                shipmentForm.awbNumber.trim() ||
                previous.awbNumber,
              trackingUrl:
                shipmentForm.trackingUrl.trim() ||
                previous.trackingUrl,
              estimatedDelivery:
                shipmentForm.estimatedDelivery.trim() ||
                previous.estimatedDelivery,
            }
          : previous,
      );

      setSuccess(
        `Order ${order.id} updated successfully.`,
      );

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to update shipment. Please try again.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  /* =========================================================
     OPEN ORDER
  ========================================================= */

  function openShipment(order: Order) {
    setSelectedOrder(order);

    setShipmentForm({
      courierName: order.courierName || "",
      courier: order.courier || "",
      trackingNumber: order.trackingNumber || "",
      awbNumber: order.awbNumber || "",
      trackingUrl: order.trackingUrl || "",
      estimatedDelivery:
        typeof order.estimatedDelivery === "string"
          ? order.estimatedDelivery
          : "",
    });

    setError("");
    setSuccess("");
  }

  /* =========================================================
     FILTERED ORDERS
  ========================================================= */

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" ||
        order.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        order.id,
        order.customerName,
        order.customerEmail,
        order.shippingAddress?.phone,
        order.shippingAddress?.city,
        order.shippingAddress?.state,
        order.shippingAddress?.pincode,
        order.courierName,
        order.courier,
        order.trackingNumber,
        order.awbNumber,
        ...order.sellerIds,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [orders, search, statusFilter]);

  /* =========================================================
     STATS
  ========================================================= */

  const stats = useMemo(() => {
    const total = orders.length;

    const pending = orders.filter(
      (order) => order.status === "pending",
    ).length;

    const processing = orders.filter((order) =>
      ["confirmed", "processing", "packed"].includes(
        order.status,
      ),
    ).length;

    const shipped = orders.filter((order) =>
      ["shipped", "out_for_delivery"].includes(
        order.status,
      ),
    ).length;

    const delivered = orders.filter(
      (order) => order.status === "delivered",
    ).length;

    const cancelledReturned = orders.filter((order) =>
      ["cancelled", "returned", "refunded"].includes(
        order.status,
      ),
    ).length;

    const shippingRevenue = orders.reduce(
      (sum, order) =>
        sum + Number(order.shippingCharge || 0),
      0,
    );

    return {
      total,
      pending,
      processing,
      shipped,
      delivered,
      cancelledReturned,
      shippingRevenue,
    };
  }, [orders]);

  /* =========================================================
     LOADING / AUTH
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
          <p className="text-sm text-gray-600">
            Loading shipping dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
            🔒
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            Access Denied
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            {error || "Admin access is required."}
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Admin / Shipping
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              Shipping Management
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Manage packing, dispatch, courier and shipment
              tracking.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrders}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
          >
            ↻ Refresh
          </button>
        </div>

        {/* ALERTS */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* STATS */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

          <StatCard
            title="Total Orders"
            value={stats.total}
            icon="📦"
          />

          <StatCard
            title="Pending"
            value={stats.pending}
            icon="⏳"
          />

          <StatCard
            title="Processing"
            value={stats.processing}
            icon="🧾"
          />

          <StatCard
            title="Shipped"
            value={stats.shipped}
            icon="🚚"
          />

          <StatCard
            title="Delivered"
            value={stats.delivered}
            icon="✅"
          />

          <StatCard
            title="Returns / Cancelled"
            value={stats.cancelledReturned}
            icon="↩️"
          />

          <StatCard
            title="Shipping Charges"
            value={formatMoney(stats.shippingRevenue)}
            icon="₹"
          />

        </div>

        {/* FILTERS */}

        <div className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div className="relative w-full xl:max-w-xl">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                🔎
              </span>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search Order ID, customer, phone, AWB, tracking, courier..."
                className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["pending", "Pending"],
                  ["confirmed", "Confirmed"],
                  ["processing", "Processing"],
                  ["packed", "Packed"],
                  ["shipped", "Shipped"],
                  ["out_for_delivery", "Out for Delivery"],
                  ["delivered", "Delivered"],
                  ["returned", "Returned"],
                  ["cancelled", "Cancelled"],
                ] as [FilterStatus, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setStatusFilter(value)
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    statusFilter === value
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-gray-900">
                  Shipments
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Showing {filteredOrders.length} of{" "}
                  {orders.length} orders
                </p>
              </div>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 text-4xl">
                📦
              </div>

              <h3 className="font-semibold text-gray-900">
                No shipments found
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Try changing the search or status filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1250px] w-full text-left">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4">
                      Order
                    </th>

                    <th className="px-5 py-4">
                      Customer
                    </th>

                    <th className="px-5 py-4">
                      Items
                    </th>

                    <th className="px-5 py-4">
                      Shipping
                    </th>

                    <th className="px-5 py-4">
                      Courier / AWB
                    </th>

                    <th className="px-5 py-4">
                      Payment
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="transition hover:bg-gray-50"
                    >
                      {/* ORDER */}

                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-gray-900">
                          #{order.id.slice(-10)}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {formatDate(order.createdAt)}
                        </div>
                      </td>

                      {/* CUSTOMER */}

                      <td className="px-5 py-4 align-top">
                        <div className="font-medium text-gray-900">
                          {order.customerName ||
                            order.shippingAddress.fullName ||
                            "Customer"}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {order.shippingAddress.phone ||
                            "No phone"}
                        </div>

                        <div className="mt-1 max-w-[220px] truncate text-xs text-gray-500">
                          {order.shippingAddress.city},{" "}
                          {order.shippingAddress.state}{" "}
                          {order.shippingAddress.pincode}
                        </div>
                      </td>

                      {/* ITEMS */}

                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-gray-900">
                          {order.items.length} item
                          {order.items.length === 1
                            ? ""
                            : "s"}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {order.sellerIds.length} seller
                          {order.sellerIds.length === 1
                            ? ""
                            : "s"}
                        </div>

                        <div className="mt-1 text-xs font-medium text-gray-700">
                          {formatMoney(order.totalAmount)}
                        </div>
                      </td>

                      {/* SHIPPING */}

                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-gray-900">
                          {formatMoney(
                            order.shippingCharge,
                          )}
                        </div>

                        <div className="mt-1 max-w-[230px] truncate text-xs text-gray-500">
                          {order.shippingAddress.addressLine1}
                        </div>

                        {order.shippingAddress.addressLine2 && (
                          <div className="max-w-[230px] truncate text-xs text-gray-500">
                            {order.shippingAddress.addressLine2}
                          </div>
                        )}
                      </td>

                      {/* COURIER */}

                      <td className="px-5 py-4 align-top">
                        <div className="font-medium text-gray-900">
                          {order.courierName ||
                            order.courier ||
                            "Not assigned"}
                        </div>

                        {order.awbNumber && (
                          <div className="mt-1 text-xs text-gray-600">
                            AWB:{" "}
                            <span className="font-medium">
                              {order.awbNumber}
                            </span>
                          </div>
                        )}

                        {order.trackingNumber && (
                          <div className="mt-1 text-xs text-gray-600">
                            Track:{" "}
                            <span className="font-medium">
                              {order.trackingNumber}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* PAYMENT */}

                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentClasses(
                            order.paymentStatus,
                          )}`}
                        >
                          {formatStatus(
                            order.paymentStatus,
                          )}
                        </span>

                        <div className="mt-1 text-xs text-gray-500">
                          {order.paymentMethod}
                        </div>
                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            order.status,
                          )}`}
                        >
                          {formatStatus(
                            order.status,
                          )}
                        </span>
                      </td>

                      {/* ACTION */}

                      <td className="px-5 py-4 text-right align-top">
                        <button
                          type="button"
                          onClick={() =>
                            openShipment(order)
                          }
                          className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          SHIPMENT MODAL
      ===================================================== */}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h2 className="font-bold text-gray-900">
                  Shipment Management
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Order #{selectedOrder.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedOrder(null)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-5">

              {/* ORDER SUMMARY */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoBox
                  label="Customer"
                  value={
                    selectedOrder.customerName ||
                    selectedOrder.shippingAddress
                      .fullName ||
                    "—"
                  }
                />

                <InfoBox
                  label="Phone"
                  value={
                    selectedOrder.shippingAddress
                      .phone || "—"
                  }
                />

                <InfoBox
                  label="Order Total"
                  value={formatMoney(
                    selectedOrder.totalAmount,
                  )}
                />
              </div>

              {/* ADDRESS */}

              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="mb-2 text-sm font-bold text-gray-900">
                  Shipping Address
                </h3>

                <p className="text-sm leading-6 text-gray-700">
                  {selectedOrder.shippingAddress.fullName}
                  <br />

                  {selectedOrder.shippingAddress.addressLine1}

                  {selectedOrder.shippingAddress
                    .addressLine2 && (
                    <>
                      <br />
                      {
                        selectedOrder.shippingAddress
                          .addressLine2
                      }
                    </>
                  )}

                  <br />

                  {selectedOrder.shippingAddress.city},{" "}
                  {selectedOrder.shippingAddress.state} -{" "}
                  {selectedOrder.shippingAddress.pincode}

                  <br />

                  {selectedOrder.shippingAddress.phone}
                </p>
              </div>

              {/* CURRENT STATUS */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">
                  Shipment Status
                </label>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "pending",
                      "confirmed",
                      "processing",
                      "packed",
                      "shipped",
                      "out_for_delivery",
                      "delivered",
                      "cancelled",
                      "returned",
                    ] as OrderStatus[]
                  ).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={
                        updatingId ===
                        selectedOrder.id
                      }
                      onClick={() =>
                        updateShipment(
                          selectedOrder,
                          status,
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        selectedOrder.status ===
                        status
                          ? getStatusClasses(status)
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {formatStatus(status)}
                    </button>
                  ))}
                </div>
              </div>

              {/* SHIPMENT INFORMATION */}

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">
                  Courier & Tracking
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                  <Field
                    label="Courier Name"
                    value={
                      shipmentForm.courierName
                    }
                    onChange={(value) =>
                      setShipmentForm(
                        (previous) => ({
                          ...previous,
                          courierName: value,
                        }),
                      )
                    }
                    placeholder="e.g. Delhivery"
                  />

                  <Field
                    label="Courier / Service"
                    value={
                      shipmentForm.courier
                    }
                    onChange={(value) =>
                      setShipmentForm(
                        (previous) => ({
                          ...previous,
                          courier: value,
                        }),
                      )
                    }
                    placeholder="e.g. Surface / Express"
                  />

                  <Field
                    label="Tracking Number"
                    value={
                      shipmentForm.trackingNumber
                    }
                    onChange={(value) =>
                      setShipmentForm(
                        (previous) => ({
                          ...previous,
                          trackingNumber: value,
                        }),
                      )
                    }
                    placeholder="Enter tracking number"
                  />

                  <Field
                    label="AWB Number"
                    value={
                      shipmentForm.awbNumber
                    }
                    onChange={(value) =>
                      setShipmentForm(
                        (previous) => ({
                          ...previous,
                          awbNumber: value,
                        }),
                      )
                    }
                    placeholder="Enter AWB number"
                  />

                  <Field
                    label="Tracking URL"
                    value={
                      shipmentForm.trackingUrl
                    }
                    onChange={(value) =>
                      setShipmentForm(
                        (previous) => ({
                          ...previous,
                          trackingUrl: value,
                        }),
                      )
                    }
                    placeholder="https://..."
                  />

                  <Field
                    label="Estimated Delivery"
                    value={
                      shipmentForm.estimatedDelivery
                    }
                    onChange={(value) =>
                      setShipmentForm(
                        (previous) => ({
                          ...previous,
                          estimatedDelivery: value,
                        }),
                      )
                    }
                    placeholder="e.g. 10 Oct 2026"
                  />

                </div>
              </div>

              {/* TRACKING LINK */}

              {selectedOrder.trackingUrl && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-blue-800">
                    Existing Tracking URL
                  </p>

                  <a
                    href={selectedOrder.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-sm font-medium text-blue-700 underline"
                  >
                    {selectedOrder.trackingUrl}
                  </a>
                </div>
              )}

              {/* MULTI SELLER */}

              {selectedOrder.sellerIds.length > 1 && (
                <div>
                  <h3 className="mb-3 text-sm font-bold text-gray-900">
                    Seller Fulfillment
                  </h3>

                  <div className="overflow-hidden rounded-xl border">
                    {selectedOrder.sellerIds.map(
                      (sellerId, index) => {
                        const seller =
                          selectedOrder
                            .sellerFulfillment?.[
                            sellerId
                          ];

                        return (
                          <div
                            key={sellerId}
                            className="border-b p-4 last:border-b-0"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  Seller {index + 1}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  {sellerId}
                                </p>
                              </div>

                              <span
                                className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  getStatusClasses(
                                    normalizeStatus(
                                      seller?.fulfillmentStatus ||
                                        seller?.status ||
                                        "pending",
                                    ),
                                  )
                                }`}
                              >
                                {formatStatus(
                                  normalizeStatus(
                                    seller?.fulfillmentStatus ||
                                      seller?.status ||
                                      "pending",
                                  ),
                                )}
                              </span>
                            </div>

                            {seller && (
                              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-3">
                                <div>
                                  <span className="font-semibold">
                                    Courier:
                                  </span>{" "}
                                  {seller.courierName ||
                                    seller.courier ||
                                    "—"}
                                </div>

                                <div>
                                  <span className="font-semibold">
                                    AWB:
                                  </span>{" "}
                                  {seller.awbNumber ||
                                    "—"}
                                </div>

                                <div>
                                  <span className="font-semibold">
                                    Tracking:
                                  </span>{" "}
                                  {seller.trackingNumber ||
                                    "—"}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {/* ITEMS */}

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">
                  Order Items
                </h3>

                <div className="overflow-hidden rounded-xl border">
                  {selectedOrder.items.map(
                    (item, index) => (
                      <div
                        key={`${item.productId || "item"}-${index}`}
                        className="flex items-center justify-between gap-4 border-b p-4 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {item.name ||
                              "Product"}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            Qty:{" "}
                            {item.quantity || 0}
                            {" • "}
                            {item.pricingType ||
                              "retail"}
                          </p>

                          {item.sellerName && (
                            <p className="mt-1 text-xs text-gray-500">
                              Seller:{" "}
                              {item.sellerName}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-sm font-semibold text-gray-900">
                          {formatMoney(
                            Number(
                              item.subtotal || 0,
                            ),
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>

              {/* QUICK ACTIONS */}

              <div className="rounded-xl border bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-bold text-gray-900">
                  Quick Actions
                </h3>

                <div className="flex flex-wrap gap-2">

                  <button
                    type="button"
                    disabled={
                      updatingId ===
                      selectedOrder.id
                    }
                    onClick={() =>
                      updateShipment(
                        selectedOrder,
                        "packed",
                      )
                    }
                    className="rounded-lg bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    Mark Packed
                  </button>

                  <button
                    type="button"
                    disabled={
                      updatingId ===
                      selectedOrder.id
                    }
                    onClick={() =>
                      updateShipment(
                        selectedOrder,
                        "shipped",
                      )
                    }
                    className="rounded-lg bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                  >
                    Mark Shipped
                  </button>

                  <button
                    type="button"
                    disabled={
                      updatingId ===
                      selectedOrder.id
                    }
                    onClick={() =>
                      updateShipment(
                        selectedOrder,
                        "out_for_delivery",
                      )
                    }
                    className="rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    Out for Delivery
                  </button>

                  <button
                    type="button"
                    disabled={
                      updatingId ===
                      selectedOrder.id
                    }
                    onClick={() =>
                      updateShipment(
                        selectedOrder,
                        "delivered",
                      )
                    }
                    className="rounded-lg bg-green-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark Delivered
                  </button>

                </div>
              </div>

            </div>

            {/* MODAL FOOTER */}

            <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <button
                type="button"
                onClick={() =>
                  setSelectedOrder(null)
                }
                className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>

              <button
                type="button"
                disabled={
                  updatingId ===
                  selectedOrder.id
                }
                onClick={() =>
                  updateShipment(
                    selectedOrder,
                    selectedOrder.status,
                  )
                }
                className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingId ===
                selectedOrder.id
                  ? "Saving..."
                  : "Save Shipment Details"}
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500">
            {title}
          </p>

          <p className="mt-2 text-xl font-bold text-gray-900">
            {value}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700">
        {label}
      </label>

      <input
        type="text"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
      />
    </div>
  );
}
