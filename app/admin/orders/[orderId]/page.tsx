"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ShippingLabelButton from "@/components/ShippingLabelButton";

import { auth, db } from "@/lib/firebase";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
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
  subtotal?: number;
  mrp?: number;
  pricingType: "retail" | "wholesale";
  sellerId: string;
  sellerName?: string;
  image?: string;
  sku?: string;
  size?: string;
  color?: string;
  variant?: string;
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
  customerType: "registered" | "guest";
  customerName?: string;
  customerEmail?: string;
  orderSource?: string;
  createdBy?: string;
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
  "packed",
  "shipped",
  "out_for_delivery",
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

function toSafeNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function getItemLineTotal(item: OrderItem): number {
  if (typeof item.subtotal === "number" && Number.isFinite(item.subtotal)) {
    return Math.max(0, item.subtotal);
  }
  return toSafeNumber(item.selectedPrice) * toSafeNumber(item.quantity);
}

function mapOrderDocument(id: string, data: Record<string, unknown>): Order {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: OrderItem[] = rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    const quantity = toSafeNumber(item.quantity);
    const selectedPrice = toSafeNumber(
      item.unitPrice ?? item.selectedPrice ?? item.price ?? item.sellingPrice
    );
    const rawSubtotal =
      item.subtotal ?? item.totalPrice ?? item.lineTotal ?? item.amount;
    const parsedSubtotal =
      rawSubtotal === undefined || rawSubtotal === null || rawSubtotal === ""
        ? undefined
        : toSafeNumber(rawSubtotal);

    return {
      productId: String(item.productId ?? item.id ?? ""),
      name: String(item.productName ?? item.name ?? item.title ?? "Product"),
      quantity,
      selectedPrice,
      subtotal: parsedSubtotal,
      mrp: item.mrp == null ? undefined : toSafeNumber(item.mrp),
      pricingType:
        String(item.pricingType ?? item.priceType ?? "").toLowerCase() === "wholesale"
          ? "wholesale"
          : "retail",
      sellerId: String(item.sellerId ?? ""),
      sellerName: item.sellerName != null ? String(item.sellerName) : undefined,
      image: item.image != null ? String(item.image) : item.imageUrl != null ? String(item.imageUrl) : undefined,
      sku: item.variantSku != null
        ? String(item.variantSku)
        : item.sku != null
          ? String(item.sku)
          : undefined,
      size: item.selectedSize != null
        ? String(item.selectedSize)
        : item.size != null
          ? String(item.size)
          : undefined,
      color: item.selectedColor != null
        ? String(item.selectedColor)
        : item.color != null
          ? String(item.color)
          : undefined,
      variant: item.variantName != null
        ? String(item.variantName)
        : item.variant != null
          ? String(item.variant)
          : item.selectedVariantValue != null
            ? String(item.selectedVariantValue)
            : undefined,
    };
  });

  const shippingAddress =
    typeof data.shippingAddress === "object" && data.shippingAddress !== null
      ? (data.shippingAddress as ShippingAddress)
      : {};
  const rawPaymentStatus = String(data.paymentStatus ?? "pending").toLowerCase();
  const paymentStatus: PaymentStatus = paymentStatuses.includes(rawPaymentStatus as PaymentStatus)
    ? (rawPaymentStatus as PaymentStatus)
    : "pending";

  const rawStatus = String(
    data.fulfillmentStatus ?? data.orderStatus ?? data.status ?? "pending"
  ).toLowerCase().replace(/[ -]+/g, "_");
  const statusAliases: Record<string, OrderStatus> = {
    placed: "pending",
    order_placed: "pending",
    ready_to_ship: "packed",
    dispatched: "shipped",
    in_transit: "shipped",
    out_for_delivery: "out_for_delivery",
    outfordelivery: "out_for_delivery",
  };
  const normalizedStatus = statusAliases[rawStatus] ?? rawStatus;
  const status: OrderStatus = statuses.includes(normalizedStatus as OrderStatus)
    ? (normalizedStatus as OrderStatus)
    : "pending";

  const itemsSubtotal = items.reduce((sum, item) => sum + getItemLineTotal(item), 0);
  const subtotal = toSafeNumber(data.subtotal ?? data.itemsSubtotal, itemsSubtotal);
  const shippingCharge = toSafeNumber(data.shippingCharge ?? data.shipping);
  const discount = toSafeNumber(data.discount);
  const totalAmount = toSafeNumber(
    data.totalAmount ?? data.total ?? data.grandTotal,
    Math.max(0, subtotal + shippingCharge - discount)
  );

  const userId = String(data.userId ?? data.customerId ?? "").trim();
  const rawCustomerType = String(data.customerType ?? "").toLowerCase();
  const customerType: "registered" | "guest" =
    rawCustomerType === "guest" || !userId ? "guest" : "registered";

  return {
    id,
    userId,
    customerType,
    customerName: typeof data.customerName === "string" ? data.customerName : undefined,
    customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : undefined,
    orderSource: typeof data.orderSource === "string" ? data.orderSource : undefined,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
    sellerIds: Array.isArray(data.sellerIds) ? data.sellerIds.map(String) : [],
    items,
    shippingAddress,
    paymentMethod: String(data.paymentMethod ?? "").toUpperCase() === "ONLINE" ? "ONLINE" : "COD",
    paymentStatus,
    subtotal,
    shippingCharge,
    discount,
    totalAmount,
    status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

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
    let authGeneration = 0;
    let unsubscribeOrder: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const generation = ++authGeneration;
      unsubscribeOrder?.();
      unsubscribeOrder = null;
      setAuthorized(false);
      setOrder(null);
      setCustomer(null);
      setError("");
      setLoading(true);

      if (!user) {
        setLoading(false);
        router.replace(`/login?redirect=/admin/orders/${orderId}`);
        return;
      }

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        if (generation !== authGeneration) return;

        if (
          !userSnapshot.exists() ||
          !["ADMIN", "SUPERADMIN"].includes(
            String(userSnapshot.data().role ?? "").toUpperCase()
          )
        ) {
          setError("Admin access required.");
          setLoading(false);
          return;
        }

        setAuthorized(true);

        if (!orderId) {
          setError("Order ID is missing.");
          setLoading(false);
          return;
        }

        unsubscribeOrder = subscribeToOrder(orderId, generation, () => authGeneration);
      } catch (err) {
        if (generation !== authGeneration) return;
        console.error("Admin order details error:", err);
        setError("Unable to load order.");
        setLoading(false);
      }
    });

    return () => {
      authGeneration += 1;
      unsubscribeAuth();
      unsubscribeOrder?.();
    };
  }, [router, orderId]);

  function subscribeToOrder(
    id: string,
    generation: number,
    getCurrentGeneration: () => number
  ) {
    return onSnapshot(
      doc(db, "orders", id),
      async (snapshot) => {
        if (generation !== getCurrentGeneration()) return;

        if (!snapshot.exists()) {
          setOrder(null);
          setCustomer(null);
          setError("Order not found.");
          setLoading(false);
          return;
        }

        try {
          const loadedOrder = mapOrderDocument(snapshot.id, snapshot.data());
          if (generation !== getCurrentGeneration()) return;
          setOrder(loadedOrder);
          setError("");
          setLoading(false);

          if (loadedOrder.userId) {
            await loadCustomer(loadedOrder.userId, generation, getCurrentGeneration);
          } else {
            setCustomer(null);
          }
        } catch (err) {
          if (generation !== getCurrentGeneration()) return;
          console.error("Order mapping error:", err);
          setError("Unable to load order.");
          setLoading(false);
        }
      },
      (err) => {
        if (generation !== getCurrentGeneration()) return;
        console.error("Order subscription error:", err);
        setError("Unable to load live order details. Please check your admin access.");
        setLoading(false);
      }
    );
  }


  async function loadCustomer(
    userId: string,
    generation: number,
    getCurrentGeneration: () => number
  ) {
    try {
      const customerRef = doc(
        db,
        "users",
        userId
      );

      const snapshot =
        await getDoc(customerRef);

      if (generation !== getCurrentGeneration()) return;

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
          orderStatus:
            status === "pending"
              ? "PLACED"
              : status.toUpperCase(),
          fulfillmentStatus: status.toUpperCase(),
          updatedAt: serverTimestamp(),
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
          paymentStatus: paymentStatus.toUpperCase(),
          updatedAt: serverTimestamp(),
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

        const itemTotal = getItemLineTotal(item);

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

        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #anjivo-packing-slip,
            #anjivo-packing-slip * {
              visibility: visible !important;
            }
            #anjivo-packing-slip {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              padding: 24px !important;
              background: white !important;
              color: black !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>

        <section id="anjivo-packing-slip" className="hidden print:block">
          <div className="border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black">ANJIVO — PACKING SLIP</h1>
            <p className="mt-2 text-sm">Order ID: {order.id}</p>
            <p className="text-sm">Order Date: {order.createdAt && typeof order.createdAt === "object" && "toDate" in order.createdAt && typeof (order.createdAt as { toDate?: unknown }).toDate === "function" ? (order.createdAt as { toDate: () => Date }).toDate().toLocaleString("en-IN") : order.createdAt instanceof Date ? order.createdAt.toLocaleString("en-IN") : "See order dashboard"}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 py-5">
            <div>
              <h2 className="font-bold">Ship To</h2>
              <p className="mt-2 text-sm">{order.shippingAddress.fullName || order.customerName || customer?.name || "Customer"}</p>
              <p className="text-sm">{order.shippingAddress.phone || customer?.phone || "—"}</p>
              <p className="text-sm">{order.shippingAddress.addressLine1 || ""}{order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ""}</p>
              <p className="text-sm">{[order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.pincode].filter(Boolean).join(", ")}</p>
            </div>
            <div>
              <h2 className="font-bold">Payment</h2>
              <p className="mt-2 text-sm">Method: {order.paymentMethod}</p>
              <p className="text-sm">Status: {formatStatus(order.paymentStatus)}</p>
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y-2 border-black text-left">
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 px-2">Qty</th>
                <th className="py-2 px-2 text-right">Unit Price</th>
                <th className="py-2 pl-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={`${item.productId}-${index}`} className="border-b border-gray-300">
                  <td className="py-2 pr-2">
                    <div>{item.name}</div>
                    <div className="mt-1 text-xs font-semibold text-gray-600">{item.pricingType === "wholesale" ? "Wholesale price" : "Retail price"}</div>
                    {(item.size || item.color || item.variant || item.sku) && (
                      <div className="mt-1 text-xs text-gray-600">
                        {[item.size ? `Size: ${item.size}` : "", item.color ? `Color: ${item.color}` : "", item.variant, item.sku ? `SKU: ${item.sku}` : ""].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2">{item.quantity}</td>
                  <td className="py-2 px-2 text-right">₹{item.selectedPrice.toLocaleString("en-IN")}</td>
                  <td className="py-2 pl-2 text-right">₹{getItemLineTotal(item).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-5 max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>₹{order.shippingCharge.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-₹{order.discount.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between border-t border-black pt-2 text-base font-black"><span>Total</span><span>₹{order.totalAmount.toLocaleString("en-IN")}</span></div>
          </div>
          <p className="mt-10 border-t border-gray-300 pt-3 text-xs">Warehouse copy — please verify all items and quantities before dispatch.</p>
        </section>

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

          <div className="flex flex-wrap gap-2 print:hidden">
            <ShippingLabelButton
              orderId={order.id}
              shippingAddress={order.shippingAddress}
              items={order.items}
              paymentMethod={order.paymentMethod}
              paymentStatus={order.paymentStatus}
              totalAmount={order.totalAmount}
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-black px-4 py-2.5 text-xs font-black text-white hover:bg-gray-800"
            >
              🖨️ Print Packing Slip
            </button>
          </div>

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
                    {order.customerType === "guest"
                      ? "Guest buyer details entered by admin; no customer account is linked."
                      : "Registered buyer information"}
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
                    order.customerName ||
                    order.shippingAddress.fullName ||
                    "Not available"
                  }
                />

                <InfoBox
                  label="Email"
                  value={
                    customer?.email ||
                    order.customerEmail ||
                    "Not provided"
                  }
                />

                <InfoBox
                  label="Phone"
                  value={
                    customer?.phone ||
                    order.shippingAddress.phone ||
                    "Not provided"
                  }
                />

                <InfoBox
                  label="Customer Type"
                  value={
                    order.customerType === "guest"
                      ? "Guest Customer (Admin-created)"
                      : customer?.role === "WHOLESALE_CUSTOMER"
                        ? "Wholesale Customer"
                        : "Registered Customer"
                  }
                />

                <InfoBox
                  label="Order Source"
                  value={order.orderSource || "website"}
                />

                <InfoBox
                  label="Created By"
                  value={order.createdBy || (order.customerType === "guest" ? "admin" : "customer")}
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
                                  {(item.size || item.color || item.variant || item.sku) && (
                                    <p className="mt-1 text-[10px] text-gray-500">
                                      {[item.size ? `Size: ${item.size}` : "", item.color ? `Color: ${item.color}` : "", item.variant, item.sku ? `SKU: ${item.sku}` : ""].filter(Boolean).join(" · ")}
                                    </p>
                                  )}

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
                    const lineTotal = getItemLineTotal(item);

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

                          {(item.size || item.color || item.variant || item.sku) && (
                            <p className="mt-1 text-xs text-gray-500">
                              {[item.size ? `Size: ${item.size}` : "", item.color ? `Color: ${item.color}` : "", item.variant, item.sku ? `SKU: ${item.sku}` : ""].filter(Boolean).join(" · ")}
                            </p>
                          )}

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
    packed:
      "bg-fuchsia-100 text-fuchsia-700",
    out_for_delivery:
      "bg-orange-100 text-orange-700",
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
