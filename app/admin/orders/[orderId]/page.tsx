"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

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

type ShippingAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type Order = {
  id: string;
  userId: string;
  sellerIds: string[];
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: "COD" | "ONLINE";
  paymentStatus: PaymentStatus;
  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type Customer = {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
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

const paymentStatuses: PaymentStatus[] = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

export default function AdminOrderDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const orderId =
    typeof params.orderId === "string"
      ? params.orderId
      : "";

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [authorized, setAuthorized] =
    useState(false);

  const [order, setOrder] =
    useState<Order | null>(null);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              `/login?redirect=/admin/orders/${orderId}`
            );
            return;
          }

          try {
            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const userSnapshot =
              await getDoc(userRef);

            if (
              !userSnapshot.exists() ||
              userSnapshot.data().role !==
                "ADMIN"
            ) {
              setError(
                "Admin access required."
              );
              setLoading(false);
              return;
            }

            setAuthorized(true);

            if (!orderId) {
              setError(
                "Order ID is missing."
              );
              setLoading(false);
              return;
            }

            await loadOrder(orderId);
          } catch (err) {
            console.error(
              "Admin order details error:",
              err
            );

            setError(
              "Unable to load order."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router, orderId]);

  async function loadOrder(
    id: string
  ) {
    const orderRef = doc(
      db,
      "orders",
      id
    );

    const snapshot =
      await getDoc(orderRef);

    if (!snapshot.exists()) {
      setError("Order not found.");
      return;
    }

    const data = snapshot.data();

    const rawItems = Array.isArray(
      data.items
    )
      ? data.items
      : [];

    const items: OrderItem[] =
      rawItems.map((raw) => {
        const item =
          raw as Record<
            string,
            unknown
          >;

        return {
          productId: String(
            item.productId ?? ""
          ),

          name: String(
            item.name ?? ""
          ),

          quantity: Number(
            item.quantity ?? 0
          ),

          selectedPrice: Number(
            item.selectedPrice ?? 0
          ),

          pricingType:
            item.pricingType ===
            "wholesale"
              ? "wholesale"
              : "retail",

          sellerId: String(
            item.sellerId ?? ""
          ),

          sellerName:
            item.sellerName !==
            undefined
              ? String(
                  item.sellerName
                )
              : undefined,

          image:
            item.image !== undefined
              ? String(item.image)
              : undefined,
        };
      });

    const shippingAddress =
      typeof data.shippingAddress ===
        "object" &&
      data.shippingAddress !== null
        ? (data.shippingAddress as ShippingAddress)
        : {};

    const paymentMethod =
      data.paymentMethod === "ONLINE"
        ? "ONLINE"
        : "COD";

    const paymentStatus =
      paymentStatuses.includes(
        data.paymentStatus
      )
        ? data.paymentStatus
        : "pending";

    const status =
      statuses.includes(data.status)
        ? data.status
        : "pending";

    const loadedOrder: Order = {
      id: snapshot.id,

      userId: String(
        data.userId ?? ""
      ),

      sellerIds:
        Array.isArray(data.sellerIds)
          ? data.sellerIds.map(String)
          : [],

      items,

      shippingAddress,

      paymentMethod,

      paymentStatus,

      subtotal: Number(
        data.subtotal ?? 0
      ),

      shippingCharge: Number(
        data.shippingCharge ?? 0
      ),

      discount: Number(
        data.discount ?? 0
      ),

      totalAmount: Number(
        data.totalAmount ?? 0
      ),

      status,

      createdAt:
        data.createdAt,

      updatedAt:
        data.updatedAt,
    };

    setOrder(loadedOrder);

    if (loadedOrder.userId) {
      await loadCustomer(
        loadedOrder.userId
      );
    }
  }

  async function loadCustomer(
    userId: string
  ) {
    try {
      const customerRef = doc(
        db,
        "users",
        userId
      );

      const snapshot =
        await getDoc(customerRef);

      if (!snapshot.exists()) {
        setCustomer(null);
        return;
      }

      const data = snapshot.data();

      setCustomer({
        uid: userId,
        name:
          typeof data.name ===
          "string"
            ? data.name
            : undefined,
        email:
          typeof data.email ===
          "string"
            ? data.email
            : undefined,
        phone:
          typeof data.phone ===
          "string"
            ? data.phone
            : undefined,
        role:
          typeof data.role ===
          "string"
            ? data.role
            : undefined,
      });
    } catch (err) {
      console.error(
        "Customer loading error:",
        err
      );
    }
  }

  async function updateOrderStatus(
    status: OrderStatus
  ) {
    if (!order) return;

    try {
      setSaving(true);
      setError("");

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

      setOrder({
        ...order,
        status,
      });
    } catch (err) {
      console.error(err);

      setError(
        "Order status update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updatePaymentStatus(
    paymentStatus: PaymentStatus
  ) {
    if (!order) return;

    try {
      setSaving(true);
      setError("");

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

      setOrder({
        ...order,
        paymentStatus,
      });
    } catch (err) {
      console.error(err);

      setError(
        "Payment status update failed."
      );
    } finally {
      setSaving(false);
    }
  }

  const sellerGroups =
    useMemo(() => {
      if (!order) return [];

      const groups =
        new Map<
          string,
          {
            sellerId: string;
            sellerName: string;
            items: OrderItem[];
            total: number;
          }
        >();

      for (const item of order.items) {
        const sellerId =
          item.sellerId ||
          "unknown";

        const existing =
          groups.get(sellerId);

        const itemTotal =
          item.selectedPrice *
          item.quantity;

        if (existing) {
          existing.items.push(item);
          existing.total +=
            itemTotal;
        } else {
          groups.set(sellerId, {
            sellerId,
            sellerName:
              item.sellerName ||
              sellerId,
            items: [item],
            total: itemTotal,
          });
        }
      }

      return Array.from(
        groups.values()
      );
    }, [order]);

  if (loading) {
    return (
      <PageShell>
        <Loading />
      </PageShell>
    );
  }

  if (!authorized) {
    return (
      <PageShell>
        <main className="mx-auto max-w-7xl px-4 py-10">
          <ErrorBox
            message={
              error ||
              "Admin access required."
            }
          />
        </main>
      </PageShell>
    );
  }

  if (!order) {
    return (
      <PageShell>
        <main className="mx-auto max-w-7xl px-4 py-10">
          <ErrorBox
            message={
              error ||
              "Order not found."
            }
          />

          <Link
            href="/admin/orders"
            className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-black text-white"
          >
            ← Back to Orders
          </Link>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* TOP NAV */}

        <div className="flex flex-wrap items-center justify-between gap-3">

          <Link
            href="/admin/orders"
            className="text-xs font-black text-gray-500 hover:text-black"
          >
            ← Back to Orders
          </Link>

          <Link
            href="/admin"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black hover:border-black"
          >
            Admin Dashboard
          </Link>

        </div>

        {/* HEADER */}

        <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                ANJIVO / ORDER
              </p>

              <h1 className="mt-2 break-all text-2xl font-black sm:text-3xl">
                Order #{order.id}
              </h1>

              <p className="mt-2 text-xs text-gray-500">
                Customer order and
                fulfillment management
              </p>

            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge
                status={order.status}
              />

              <PaymentBadge
                status={
                  order.paymentStatus
                }
              />
            </div>

          </div>

        </section>

        {error && (
          <div className="mt-5">
            <ErrorBox
              message={error}
            />
          </div>
        )}

        {/* MAIN GRID */}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">

          {/* LEFT */}

          <div className="space-y-6 lg:col-span-2">

            {/* CUSTOMER */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-lg font-black">
                    Customer
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    Buyer information
                  </p>
                </div>

                {customer && (
                  <Link
                    href={`/admin/customers/${customer.uid}`}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-[10px] font-black hover:border-black"
                  >
                    View Customer
                  </Link>
                )}

              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">

                <InfoBox
                  label="Name"
                  value={
                    customer?.name ||
                    order.shippingAddress
                      .fullName ||
                    "Not available"
                  }
                />

                <InfoBox
                  label="Email"
                  value={
                    customer?.email ||
                    "Not available"
                  }
                />

                <InfoBox
                  label="Phone"
                  value={
                    customer?.phone ||
                    order.shippingAddress
                      .phone ||
                    "Not available"
                  }
                />

                <InfoBox
                  label="Customer Type"
                  value={
                    customer?.role ===
                    "WHOLESALE_CUSTOMER"
                      ? "Wholesale Customer"
                      : "Retail Customer"
                  }
                />

              </div>

            </section>

            {/* SELLER GROUPS */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <div>
                <h2 className="text-lg font-black">
                  Seller Breakdown
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  This order can contain
                  products from multiple
                  sellers.
                </p>
              </div>

              <div className="mt-5 space-y-4">

                {sellerGroups.length ===
                0 ? (
                  <EmptyBox
                    icon="🏪"
                    title="No seller information"
                    text="Seller information is not available for this order."
                  />
                ) : (
                  sellerGroups.map(
                    (seller) => (
                      <div
                        key={
                          seller.sellerId
                        }
                        className="rounded-2xl border border-gray-200 p-4"
                      >

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                          <div>
                            <p className="text-sm font-black">
                              {seller.sellerName}
                            </p>

                            <p className="mt-1 break-all text-[10px] text-gray-400">
                              Seller ID:{" "}
                              {
                                seller.sellerId
                              }
                            </p>
                          </div>

                          <p className="text-sm font-black">
                            ₹
                            {seller.total.toLocaleString(
                              "en-IN"
                            )}
                          </p>

                        </div>

                        <div className="mt-4 space-y-2">

                          {seller.items.map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={`${item.productId}-${index}`}
                                className="flex items-center gap-3 rounded-xl bg-gray-50 p-3"
                              >

                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">

                                  {item.image ? (
                                    <img
                                      src={
                                        item.image
                                      }
                                      alt={
                                        item.name
                                      }
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span>
                                      📦
                                    </span>
                                  )}

                                </div>

                                <div className="min-w-0 flex-1">

                                  <p className="truncate text-xs font-black">
                                    {
                                      item.name
                                    }
                                  </p>

                                  <p className="mt-1 text-[10px] text-gray-500">
                                    {
                                      item.pricingType ===
                                      "wholesale"
                                        ? "Wholesale"
                                        : "Retail"
                                    }{" "}
                                    · Qty{" "}
                                    {
                                      item.quantity
                                    }
                                  </p>

                                </div>

                                <div className="text-right">

                                  <p className="text-xs font-black">
                                    ₹
                                    {item.selectedPrice.toLocaleString(
                                      "en-IN"
                                    )}
                                  </p>

                                  <p className="mt-1 text-[9px] text-gray-400">
                                    per unit
                                  </p>

                                </div>

                              </div>
                            )
                          )}

                        </div>

                      </div>
                    )
                  )
                )}

              </div>

            </section>

            {/* ALL PRODUCTS */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-lg font-black">
                    All Products
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    {order.items.length}{" "}
                    line item(s)
                  </p>
                </div>

              </div>

              <div className="mt-5 space-y-3">

                {order.items.map(
                  (item, index) => {
                    const lineTotal =
                      item.selectedPrice *
                      item.quantity;

                    return (
                      <div
                        key={`${item.productId}-${index}`}
                        className="flex flex-col gap-4 rounded-2xl border border-gray-100 p-4 sm:flex-row sm:items-center"
                      >

                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">

                          {item.image ? (
                            <img
                              src={
                                item.image
                              }
                              alt={
                                item.name
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">
                              📦
                            </span>
                          )}

                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="text-sm font-black">
                            {item.name}
                          </p>

                          <p className="mt-1 break-all text-[10px] text-gray-400">
                            Product ID:{" "}
                            {
                              item.productId
                            }
                          </p>

                          <p className="mt-2 text-xs text-gray-500">
                            Seller:{" "}
                            {item.sellerName ||
                              item.sellerId}
                          </p>

                        </div>

                        <div className="sm:text-right">

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
                              item.pricingType ===
                              "wholesale"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {item.pricingType}
                          </span>

                          <p className="mt-2 text-xs text-gray-500">
                            ₹
                            {item.selectedPrice.toLocaleString(
                              "en-IN"
                            )}{" "}
                            ×{" "}
                            {item.quantity}
                          </p>

                          <p className="mt-1 text-sm font-black">
                            ₹
                            {lineTotal.toLocaleString(
                              "en-IN"
                            )}
                          </p>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            </section>

            {/* DELIVERY */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <h2 className="text-lg font-black">
                Delivery Address
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Shipping information
              </p>

              <div className="mt-5 rounded-2xl bg-gray-50 p-5">

                <p className="text-sm font-black">
                  {order.shippingAddress
                    .fullName ||
                    "—"}
                </p>

                <p className="mt-2 text-xs text-gray-600">
                  {order.shippingAddress
                    .phone ||
                    "—"}
                </p>

                <p className="mt-3 text-xs leading-6 text-gray-600">
                  {
                    order.shippingAddress
                      .addressLine1
                  }

                  {order.shippingAddress
                    .addressLine2
                    ? `, ${order.shippingAddress.addressLine2}`
                    : ""}

                  {order.shippingAddress
                    .city
                    ? `, ${order.shippingAddress.city}`
                    : ""}

                  {order.shippingAddress
                    .state
                    ? `, ${order.shippingAddress.state}`
                    : ""}

                  {order.shippingAddress
                    .pincode
                    ? ` - ${order.shippingAddress.pincode}`
                    : ""}
                </p>

              </div>

            </section>

          </div>

          {/* RIGHT */}

          <div className="space-y-6">

            {/* STATUS CONTROL */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <h2 className="text-lg font-black">
                Order Control
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Update fulfillment status
              </p>

              <label className="mt-6 block text-[10px] font-black uppercase tracking-wide text-gray-400">
                Order Status
              </label>

              <select
                value={order.status}
                disabled={saving}
                onChange={(event) =>
                  updateOrderStatus(
                    event.target
                      .value as OrderStatus
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold outline-none focus:border-black disabled:opacity-50"
              >
                {statuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {formatStatus(
                        status
                      )}
                    </option>
                  )
                )}
              </select>

              <label className="mt-5 block text-[10px] font-black uppercase tracking-wide text-gray-400">
                Payment Status
              </label>

              <select
                value={
                  order.paymentStatus
                }
                disabled={saving}
                onChange={(event) =>
                  updatePaymentStatus(
                    event.target
                      .value as PaymentStatus
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold outline-none focus:border-black disabled:opacity-50"
              >
                {paymentStatuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {formatStatus(
                        status
                      )}
                    </option>
                  )
                )}
              </select>

              {saving && (
                <p className="mt-4 text-[10px] font-bold text-gray-400">
                  Saving changes...
                </p>
              )}

            </section>

            {/* PAYMENT */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <h2 className="text-lg font-black">
                Payment
              </h2>

              <div className="mt-5 space-y-3">

                <Row
                  label="Method"
                  value={
                    order.paymentMethod
                  }
                />

                <Row
                  label="Status"
                  value={formatStatus(
                    order.paymentStatus
                  )}
                />

              </div>

            </section>

            {/* AMOUNT */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <h2 className="text-lg font-black">
                Order Summary
              </h2>

              <div className="mt-5 space-y-3">

                <Row
                  label="Subtotal"
                  value={`₹${order.subtotal.toLocaleString(
                    "en-IN"
                  )}`}
                />

                <Row
                  label="Shipping"
                  value={`₹${order.shippingCharge.toLocaleString(
                    "en-IN"
                  )}`}
                />

                <Row
                  label="Discount"
                  value={`-₹${order.discount.toLocaleString(
                    "en-IN"
                  )}`}
                />

                <div className="border-t pt-4">
                  <Row
                    label="Grand Total"
                    value={`₹${order.totalAmount.toLocaleString(
                      "en-IN"
                    )}`}
                    strong
                  />
                </div>

              </div>

            </section>

            {/* SELLERS */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">

              <h2 className="text-lg font-black">
                Sellers
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                {order.sellerIds.length}{" "}
                seller(s) in this order
              </p>

              <div className="mt-5 space-y-2">

                {sellerGroups.map(
                  (seller) => (
                    <div
                      key={
                        seller.sellerId
                      }
                      className="rounded-xl bg-gray-50 p-3"
                    >
                      <p className="text-xs font-black">
                        {
                          seller.sellerName
                        }
                      </p>

                      <p className="mt-1 break-all text-[9px] text-gray-400">
                        {
                          seller.sellerId
                        }
                      </p>
                    </div>
                  )
                )}

              </div>

            </section>

            {/* QUICK LINKS */}

            <section className="rounded-3xl bg-black p-5 text-white">

              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
                QUICK LINKS
              </p>

              <div className="mt-4 space-y-2">

                <Link
                  href="/admin/orders"
                  className="block rounded-xl bg-white/10 px-4 py-3 text-xs font-black hover:bg-white/20"
                >
                  ← All Orders
                </Link>

                {customer && (
                  <Link
                    href={`/admin/customers/${customer.uid}`}
                    className="block rounded-xl bg-white/10 px-4 py-3 text-xs font-black hover:bg-white/20"
                  >
                    View Customer
                  </Link>
                )}

              </div>

            </section>

          </div>

        </div>

      </main>
    </PageShell>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function PageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      {children}

      <Footer />
    </div>
  );
}

function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
        <div className="text-4xl">
          ⏳
        </div>

        <p className="mt-4 text-sm font-bold text-gray-500">
          Loading order...
        </p>
      </div>
    </main>
  );
}

function ErrorBox({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
      <p className="text-sm font-black text-red-800">
        {message}
      </p>
    </div>
  );
}

function EmptyBox({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
      <div className="text-3xl">
        {icon}
      </div>

      <p className="mt-3 text-sm font-black">
        {title}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {text}
      </p>
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
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-2 break-all text-xs font-bold text-gray-800">
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-500">
        {label}
      </span>

      <span
        className={
          strong
            ? "text-sm font-black"
            : "text-xs font-bold"
        }
      >
        {value}
      </span>
    </div>
  );
}

function formatStatus(
  status: string
) {
  return status
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function StatusBadge({
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
      className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${styles[status]}`}
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
  const styles: Record<
    PaymentStatus,
    string
  > = {
    pending:
      "bg-yellow-100 text-yellow-700",
    paid:
      "bg-green-100 text-green-700",
    failed:
      "bg-red-100 text-red-700",
    refunded:
      "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${styles[status]}`}
    >
      Payment:{" "}
      {formatStatus(status)}
    </span>
  );
}
