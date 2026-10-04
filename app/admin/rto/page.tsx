"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

/* =========================================================
   TYPES
========================================================= */

type RtoViewStatus =
  | "rto"
  | "ndr_candidate"
  | "in_transit"
  | "delivered"
  | "other";

type ShippingAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
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
};

type OrderRecord = {
  id: string;

  userId?: string;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  sellerIds?: string[];

  items?: OrderItem[];

  shippingAddress?: ShippingAddress;

  paymentMethod?: string;
  paymentStatus?: string;

  subtotal?: number;
  shippingCharge?: number;
  discount?: number;
  totalAmount?: number;

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

  sellerFulfillment?: Record<
    string,
    SellerFulfillment
  >;

  createdAt?: unknown;
  updatedAt?: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function numberValue(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function normalizeStatus(value: unknown): string {
  return stringValue(value)
    .toLowerCase()
    .replace(/[ -]+/g, "_");
}

function getTimestampValue(
  value: unknown
): number {
  if (!value) {
    return 0;
  }

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

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  return 0;
}

function formatDate(
  value: unknown
): string {
  const timestamp = getTimestampValue(value);

  if (!timestamp) {
    return "—";
  }

  return new Date(timestamp).toLocaleString(
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

function formatCurrency(
  value: unknown
): string {
  return numberValue(value).toLocaleString(
    "en-IN"
  );
}

/* =========================================================
   VIEW STATUS
========================================================= */

function getViewStatus(
  order: OrderRecord
): RtoViewStatus {
  const status = normalizeStatus(
    order.fulfillmentStatus ||
      order.status
  );

  /*
   * Current ANJIVO seller workflow allows:
   * shipped -> returned
   * out_for_delivery -> returned
   *
   * Therefore "returned" is the strongest
   * currently available RTO/return signal.
   */
  if (status === "returned") {
    return "rto";
  }

  /*
   * There is currently no dedicated NDR field.
   * We therefore do NOT call every out_for_delivery
   * order a confirmed NDR.
   *
   * This is only a monitoring candidate.
   */
  if (status === "out_for_delivery") {
    return "ndr_candidate";
  }

  if (
    status === "shipped" ||
    status === "packed" ||
    status === "processing"
  ) {
    return "in_transit";
  }

  if (status === "delivered") {
    return "delivered";
  }

  return "other";
}

/* =========================================================
   STATUS LABELS
========================================================= */

function statusLabel(
  status: RtoViewStatus
): string {
  switch (status) {
    case "rto":
      return "RTO / Returned";

    case "ndr_candidate":
      return "Delivery Attempt";

    case "in_transit":
      return "In Transit";

    case "delivered":
      return "Delivered";

    default:
      return "Other";
  }
}

function statusClass(
  status: RtoViewStatus
): string {
  switch (status) {
    case "rto":
      return "bg-red-100 text-red-700";

    case "ndr_candidate":
      return "bg-orange-100 text-orange-700";

    case "in_transit":
      return "bg-blue-100 text-blue-700";

    case "delivered":
      return "bg-green-100 text-green-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function RtoAdminPage() {
  const [orders, setOrders] =
    useState<OrderRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<"all" | RtoViewStatus>("all");

  const [selectedOrder, setSelectedOrder] =
    useState<OrderRecord | null>(null);

  /* =======================================================
     AUTH + LOAD
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/rto";

            return;
          }

          try {
            setLoading(true);
            setError("");

            const userSnapshot =
              await getDocs(
                collection(db, "users")
              );

            let currentUserRole = "";

            userSnapshot.forEach(
              (userDoc) => {
                if (userDoc.id === user.uid) {
                  const data =
                    userDoc.data();

                  currentUserRole =
                    stringValue(
                      data.role
                    ).toUpperCase();
                }
              }
            );

            if (
              currentUserRole !==
              "ADMIN"
            ) {
              window.location.href =
                "/account";

              return;
            }

            setAuthorized(true);

            const snapshot =
              await getDocs(
                collection(db, "orders")
              );

            const loadedOrders =
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
                      data.shippingAddress
                        ?.fullName ||
                      "",

                    customerEmail:
                      data.customerEmail ||
                      "",

                    customerPhone:
                      data.customerPhone ||
                      data.shippingAddress
                        ?.phone ||
                      "",

                    sellerIds:
                      Array.isArray(
                        data.sellerIds
                      )
                        ? data.sellerIds
                        : [],

                    items:
                      Array.isArray(
                        data.items
                      )
                        ? data.items
                        : [],

                    shippingAddress:
                      data.shippingAddress ||
                      {},

                    paymentMethod:
                      data.paymentMethod ||
                      "",

                    paymentStatus:
                      data.paymentStatus ||
                      "",

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
                      data.orderStatus ||
                      "",

                    fulfillmentStatus:
                      data.fulfillmentStatus ||
                      "",

                    courierName:
                      data.courierName ||
                      "",

                    courier:
                      data.courier ||
                      "",

                    trackingNumber:
                      data.trackingNumber ||
                      "",

                    awbNumber:
                      data.awbNumber ||
                      "",

                    trackingUrl:
                      data.trackingUrl ||
                      "",

                    estimatedDelivery:
                      data.estimatedDelivery,

                    shippedAt:
                      data.shippedAt,

                    deliveredAt:
                      data.deliveredAt,

                    sellerFulfillment:
                      data.sellerFulfillment,

                    createdAt:
                      data.createdAt,

                    updatedAt:
                      data.updatedAt,
                  } as OrderRecord;
                }
              );

            loadedOrders.sort(
              (a, b) =>
                getTimestampValue(
                  b.updatedAt ||
                    b.createdAt
                ) -
                getTimestampValue(
                  a.updatedAt ||
                    a.createdAt
                )
            );

            setOrders(
              loadedOrders
            );
          } catch (err) {
            console.error(err);

            setError(
              "RTO data load nahi ho saka."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  /* =======================================================
     CLASSIFIED ORDERS
  ======================================================= */

  const classifiedOrders =
    useMemo(() => {
      return orders.map(
        (order) => ({
          order,
          viewStatus:
            getViewStatus(order),
        })
      );
    }, [orders]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    const rto =
      classifiedOrders.filter(
        (item) =>
          item.viewStatus === "rto"
      );

    const ndrCandidates =
      classifiedOrders.filter(
        (item) =>
          item.viewStatus ===
          "ndr_candidate"
      );

    const inTransit =
      classifiedOrders.filter(
        (item) =>
          item.viewStatus ===
          "in_transit"
      );

    const delivered =
      classifiedOrders.filter(
        (item) =>
          item.viewStatus ===
          "delivered"
      );

    const rtoValue =
      rto.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.order.totalAmount
          ),
        0
      );

    const ndrValue =
      ndrCandidates.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.order.totalAmount
          ),
        0
      );

    return {
      total: orders.length,
      rto: rto.length,
      ndrCandidates:
        ndrCandidates.length,
      inTransit:
        inTransit.length,
      delivered:
        delivered.length,
      rtoValue,
      ndrValue,
    };
  }, [
    orders,
    classifiedOrders,
  ]);

  /* =======================================================
     FILTER
  ======================================================= */

  const filteredOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return classifiedOrders
        .filter((item) => {
          if (
            filter !== "all" &&
            item.viewStatus !==
              filter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const order =
            item.order;

          const customer =
            `${order.customerName || ""} ${
              order.customerEmail || ""
            } ${
              order.customerPhone || ""
            }`;

          const tracking =
            `${order.trackingNumber || ""} ${
              order.awbNumber || ""
            } ${
              order.courierName || ""
            } ${
              order.courier || ""
            }`;

          const products =
            (order.items || [])
              .map(
                (item) =>
                  item.name || ""
              )
              .join(" ");

          const searchable =
            `${order.id} ${
              customer
            } ${
              tracking
            } ${
              products
            } ${
              order.shippingAddress
                ?.city || ""
            } ${
              order.shippingAddress
                ?.pincode || ""
            }`
              .toLowerCase();

          return searchable.includes(
            query
          );
        })
        .sort(
          (a, b) =>
            getTimestampValue(
              b.order.updatedAt ||
                b.order.createdAt
            ) -
            getTimestampValue(
              a.order.updatedAt ||
                a.order.createdAt
            )
        );
    }, [
      classifiedOrders,
      filter,
      search,
    ]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8]">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

          <p className="mt-4 text-sm font-bold text-gray-500">
            Loading RTO / NDR Management...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  /* =======================================================
     UI
  ======================================================= */

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
              href="/admin/shipping"
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold hover:border-black"
            >
              Shipping
            </Link>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
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

        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ADMIN / RTO & NDR
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
              RTO / NDR Management
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Failed delivery monitoring,
              RTO / returned shipments,
              tracking aur delivery-attempt
              cases manage karein.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
              RTO Value
            </p>

            <p className="mt-1 text-xl font-black">
              ₹
              {formatCurrency(
                stats.rtoValue
              )}
            </p>
          </div>
        </section>

        {/* SCHEMA NOTICE */}

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-800">
            Current shipment schema notice
          </p>

          <p className="mt-1 text-xs leading-5 text-blue-700">
            ANJIVO mein abhi dedicated
            NDR reason, delivery attempt
            count aur RTO status fields
            available nahi hain. Is page par
            <strong> returned </strong>
            orders ko RTO / Returned aur
            <strong> out_for_delivery </strong>
            orders ko Delivery Attempt
            monitoring ke roop mein dikhaya
            ja raha hai. Isliye Delivery
            Attempt ko confirmed NDR nahi maana
            gaya hai.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* STATS */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="RTO / Returned"
            value={stats.rto}
            subtitle={`₹${formatCurrency(
              stats.rtoValue
            )}`}
            active={
              filter === "rto"
            }
            onClick={() =>
              setFilter("rto")
            }
          />

          <StatCard
            title="Delivery Attempts"
            value={
              stats.ndrCandidates
            }
            subtitle={`₹${formatCurrency(
              stats.ndrValue
            )}`}
            active={
              filter ===
              "ndr_candidate"
            }
            onClick={() =>
              setFilter(
                "ndr_candidate"
              )
            }
          />

          <StatCard
            title="In Transit"
            value={
              stats.inTransit
            }
            subtitle="Shipment moving"
            active={
              filter ===
              "in_transit"
            }
            onClick={() =>
              setFilter("in_transit")
            }
          />

          <StatCard
            title="Delivered"
            value={
              stats.delivered
            }
            subtitle="Successfully delivered"
            active={
              filter === "delivered"
            }
            onClick={() =>
              setFilter("delivered")
            }
          />

          <StatCard
            title="All Orders"
            value={stats.total}
            subtitle="Orders collection"
            active={
              filter === "all"
            }
            onClick={() =>
              setFilter("all")
            }
          />
        </section>

        {/* FILTER BAR */}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["rto", "RTO / Returned"],
                [
                  "ndr_candidate",
                  "Delivery Attempt",
                ],
                [
                  "in_transit",
                  "In Transit",
                ],
                [
                  "delivered",
                  "Delivered",
                ],
              ].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(
                        value as
                          | "all"
                          | RtoViewStatus
                      )
                    }
                    className={`rounded-xl px-4 py-2.5 text-xs font-black ${
                      filter === value
                        ? "bg-black text-white"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-black"
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search order, customer, AWB, courier, product..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black lg:max-w-md"
            />
          </div>
        </section>

        {/* LIST */}

        <section className="mt-6">
          {filteredOrders.length ===
          0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <div className="text-4xl">
                📍
              </div>

              <h2 className="mt-4 text-lg font-black">
                No matching shipment cases
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Current filters ke according
                koi order nahi mila.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="hidden grid-cols-[1.3fr_1.3fr_1.2fr_1fr_1fr_auto] gap-4 border-b bg-gray-50 px-5 py-3 text-[10px] font-black uppercase tracking-wide text-gray-400 lg:grid">
                <div>Order</div>
                <div>Customer</div>
                <div>Shipment</div>
                <div>Status</div>
                <div>Value</div>
                <div></div>
              </div>

              <div className="divide-y divide-gray-100">
                {filteredOrders.map(
                  ({
                    order,
                    viewStatus,
                  }) => (
                    <RtoRow
                      key={order.id}
                      order={order}
                      viewStatus={
                        viewStatus
                      }
                      onOpen={() =>
                        setSelectedOrder(
                          order
                        )
                      }
                    />
                  )
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* DETAIL MODAL */}

      {selectedOrder && (
        <RtoModal
          order={selectedOrder}
          viewStatus={getViewStatus(
            selectedOrder
          )}
          onClose={() =>
            setSelectedOrder(null)
          }
        />
      )}
    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  subtitle,
  active,
  onClick,
}: {
  title: string;
  value: number;
  subtitle: string;
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
        {value}
      </p>

      <p className="mt-1 text-xs font-bold text-gray-500">
        {subtitle}
      </p>
    </button>
  );
}

/* =========================================================
   ROW
========================================================= */

function RtoRow({
  order,
  viewStatus,
  onOpen,
}: {
  order: OrderRecord;
  viewStatus: RtoViewStatus;
  onOpen: () => void;
}) {
  const address =
    order.shippingAddress || {};

  const shipment =
    order.sellerFulfillment
      ? Object.values(
          order.sellerFulfillment
        )[0]
      : undefined;

  const courier =
    order.courierName ||
    order.courier ||
    shipment?.courierName ||
    shipment?.courier ||
    "—";

  const awb =
    order.awbNumber ||
    order.trackingNumber ||
    shipment?.awbNumber ||
    shipment?.trackingNumber ||
    "—";

  const status =
    normalizeStatus(
      order.fulfillmentStatus ||
        order.status
    );

  return (
    <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1.3fr_1.3fr_1.2fr_1fr_1fr_auto] lg:items-center">
      {/* ORDER */}

      <div>
        <p className="text-sm font-black text-gray-900">
          #{order.id}
        </p>

        <p className="mt-1 text-[11px] text-gray-400">
          {formatDate(
            order.updatedAt ||
              order.createdAt
          )}
        </p>
      </div>

      {/* CUSTOMER */}

      <div>
        <p className="text-sm font-bold text-gray-800">
          {order.customerName ||
            "Customer"}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {order.customerPhone ||
            order.customerEmail ||
            "No contact"}
        </p>

        <p className="mt-1 text-[11px] text-gray-400">
          {address.city || "—"}
          {address.pincode
            ? ` • ${address.pincode}`
            : ""}
        </p>
      </div>

      {/* SHIPMENT */}

      <div>
        <p className="text-xs font-black text-gray-800">
          {courier}
        </p>

        <p className="mt-1 break-all text-[11px] text-gray-500">
          {awb}
        </p>
      </div>

      {/* STATUS */}

      <div>
        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black ${statusClass(
            viewStatus
          )}`}
        >
          {statusLabel(
            viewStatus
          )}
        </span>

        <p className="mt-2 text-[10px] font-bold text-gray-400">
          {status || "pending"}
        </p>
      </div>

      {/* VALUE */}

      <div>
        <p className="text-sm font-black">
          ₹
          {formatCurrency(
            order.totalAmount
          )}
        </p>

        <p className="mt-1 text-[10px] uppercase font-bold text-gray-400">
          {order.paymentMethod ||
            "Payment —"}
        </p>
      </div>

      {/* ACTION */}

      <button
        type="button"
        onClick={onOpen}
        className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black hover:border-black"
      >
        View
      </button>
    </div>
  );
}

/* =========================================================
   MODAL
========================================================= */

function RtoModal({
  order,
  viewStatus,
  onClose,
}: {
  order: OrderRecord;
  viewStatus: RtoViewStatus;
  onClose: () => void;
}) {
  const address =
    order.shippingAddress || {};

  const sellerEntries =
    Object.entries(
      order.sellerFulfillment ||
        {}
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {/* MODAL HEADER */}

        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              Shipment Case
            </p>

            <h2 className="mt-1 text-2xl font-black">
              #{order.id}
            </h2>

            <div className="mt-3">
              <span
                className={`rounded-full px-3 py-1.5 text-[10px] font-black ${statusClass(
                  viewStatus
                )}`}
              >
                {statusLabel(
                  viewStatus
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black hover:border-black"
          >
            ✕ Close
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* NOTICE */}

          {viewStatus ===
            "ndr_candidate" && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-black text-orange-800">
                Delivery Attempt Monitoring
              </p>

              <p className="mt-1 text-xs leading-5 text-orange-700">
                Current schema mein NDR reason
                ya failed-attempt count nahi hai.
                Isliye is order ko confirmed NDR
                nahi maana ja raha hai.
              </p>
            </div>
          )}

          {viewStatus === "rto" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-black text-red-800">
                RTO / Returned Shipment
              </p>

              <p className="mt-1 text-xs leading-5 text-red-700">
                Order ka current fulfillment
                status <strong>returned</strong>
                hai.
              </p>
            </div>
          )}

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
                  order.userId || "—"
                }
              />
            </div>
          </div>

          {/* ADDRESS */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Delivery Address
            </h3>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              {address.fullName}
              <br />

              {address.addressLine1}

              {address.addressLine2
                ? `, ${address.addressLine2}`
                : ""}

              <br />

              {address.city}
              {address.state
                ? `, ${address.state}`
                : ""}

              {address.pincode
                ? ` - ${address.pincode}`
                : ""}

              {address.phone
                ? ` • ${address.phone}`
                : ""}
            </p>
          </div>

          {/* SHIPMENT */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Shipment Details
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info
                label="Fulfillment Status"
                value={
                  order.fulfillmentStatus ||
                  order.status ||
                  "—"
                }
              />

              <Info
                label="Courier"
                value={
                  order.courierName ||
                  order.courier ||
                  "—"
                }
              />

              <Info
                label="AWB / Tracking"
                value={
                  order.awbNumber ||
                  order.trackingNumber ||
                  "—"
                }
              />

              <Info
                label="Shipped At"
                value={formatDate(
                  order.shippedAt
                )}
              />

              <Info
                label="Delivered At"
                value={formatDate(
                  order.deliveredAt
                )}
              />

              <Info
                label="Estimated Delivery"
                value={formatDate(
                  order.estimatedDelivery
                )}
              />
            </div>

            {order.trackingUrl && (
              <a
                href={
                  order.trackingUrl
                }
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex rounded-xl bg-black px-4 py-3 text-xs font-black text-white"
              >
                Open Tracking ↗
              </a>
            )}
          </div>

          {/* SELLER SHIPMENTS */}

          {sellerEntries.length > 0 && (
            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-black">
                Seller-wise Shipments
              </h3>

              <div className="mt-4 space-y-3">
                {sellerEntries.map(
                  ([
                    sellerId,
                    shipment,
                  ]) => (
                    <div
                      key={sellerId}
                      className="rounded-xl bg-gray-50 p-4"
                    >
                      <p className="text-xs font-black">
                        Seller:{" "}
                        {sellerId}
                      </p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Info
                          label="Status"
                          value={
                            shipment
                              .fulfillmentStatus ||
                            shipment.status ||
                            "—"
                          }
                        />

                        <Info
                          label="Courier"
                          value={
                            shipment.courierName ||
                            shipment.courier ||
                            "—"
                          }
                        />

                        <Info
                          label="AWB"
                          value={
                            shipment.awbNumber ||
                            shipment.trackingNumber ||
                            "—"
                          }
                        />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* PRODUCTS */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Ordered Products
            </h3>

            <div className="mt-4 space-y-3">
              {(order.items || []).map(
                (item, index) => (
                  <div
                    key={
                      item.productId ||
                      index
                    }
                    className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4"
                  >
                    <div>
                      <p className="text-sm font-black">
                        {item.name ||
                          "Product"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Product ID:{" "}
                        {item.productId ||
                          "—"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Qty:{" "}
                        {numberValue(
                          item.quantity
                        )}
                      </p>
                    </div>

                    <p className="text-sm font-black">
                      ₹
                      {formatCurrency(
                        item.subtotal ??
                          numberValue(
                            item.selectedPrice
                          ) *
                            numberValue(
                              item.quantity
                            )
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* PAYMENT */}

          <div className="rounded-2xl border border-gray-200 p-5">
            <h3 className="text-sm font-black">
              Order / Payment
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info
                label="Payment Method"
                value={
                  order.paymentMethod ||
                  "—"
                }
              />

              <Info
                label="Payment Status"
                value={
                  order.paymentStatus ||
                  "—"
                }
              />

              <Info
                label="Order Total"
                value={`₹${formatCurrency(
                  order.totalAmount
                )}`}
              />

              <Info
                label="Order Date"
                value={formatDate(
                  order.createdAt
                )}
              />
            </div>
          </div>
        </div>
      </div>
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
