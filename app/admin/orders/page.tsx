"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

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
  | "refunded"
  | "cod";

type OrderItem = {
  productId?: string;
  id?: string;
  name?: string;
  productName?: string;
  image?: string;
  sku?: string;
  variantSku?: string;
  size?: string;
  selectedSize?: string;
  color?: string;
  selectedColor?: string;
  variant?: string;
  variantName?: string;
  mrp?: number;
  unitPrice?: number;
  sellerId?: string;
  sellerName?: string;
  quantity?: number;
  price?: number;
  selectedPrice?: number;
  pricingType?: "retail" | "wholesale";
  subtotal?: number;
};

type ShippingAddressData = {
  fullName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type Order = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerType?: string;
  orderSource?: string;

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
  shippingAddressData: ShippingAddressData;

  createdAt?: unknown;
  updatedAt?: unknown;
};

type OrderFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

function stringValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function numberValue(value: unknown, fallback = 0): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function timestampValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value
  ) {
    return Number((value as { seconds?: unknown }).seconds ?? 0) * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeStatus(value: unknown): OrderStatus {
  const raw = stringValue(value)
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");

  const aliases: Record<string, OrderStatus> = {
    placed: "pending",
    order_placed: "pending",
    pending: "pending",
    accepted: "confirmed",
    approved: "confirmed",
    confirmed: "confirmed",
    processing: "processing",
    ready_to_ship: "packed",
    packed: "packed",
    dispatched: "shipped",
    in_transit: "shipped",
    on_the_way: "shipped",
    shipped: "shipped",
    outfordelivery: "out_for_delivery",
    out_for_delivery: "out_for_delivery",
    complete: "delivered",
    completed: "delivered",
    delivered: "delivered",
    cancelled: "cancelled",
    canceled: "cancelled",
    returned: "returned",
  };

  return aliases[raw] ?? "pending";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = stringValue(value).trim().toLowerCase();

  const aliases: Record<string, PaymentStatus> = {
    pending: "pending",
    paid: "paid",
    success: "paid",
    successful: "paid",
    failed: "failed",
    refunded: "refunded",
    cod: "cod",
  };

  return aliases[status] ?? "pending";
}

function formatShippingAddress(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const address = value as Record<string, unknown>;
  return [
    address.fullName,
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode,
  ]
    .map((part) => stringValue(part).trim())
    .filter(Boolean)
    .join(", ");
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): Order {
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const items: OrderItem[] = rawItems.map((raw) => {
    const item =
      raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : {};

    const quantity = numberValue(item.quantity);
    const unitPrice = numberValue(
      item.unitPrice ??
        item.selectedPrice ??
        item.selectedUnitPrice ??
        item.price
    );
    const itemSubtotal = numberValue(
      item.subtotal ?? item.totalPrice ?? item.lineTotal,
      unitPrice * quantity
    );
    const selectedSize = stringValue(
      item.selectedSize ?? item.size
    );
    const selectedColor = stringValue(
      item.selectedColor ?? item.color
    );
    const variantName = stringValue(
      item.variantName ?? item.variant
    );
    const variantSku = stringValue(
      item.variantSku ?? item.sku
    );
    const pricingTypeValue = stringValue(
      item.pricingType ?? item.priceType
    ).trim().toLowerCase();

    return {
      productId: stringValue(item.productId) || undefined,
      id: stringValue(item.id ?? item.productId) || undefined,
      name:
        stringValue(item.productName ?? item.name) || "Product",
      productName:
        stringValue(item.productName ?? item.name) || "Product",
      image: stringValue(item.image ?? item.imageUrl) || undefined,
      sku: variantSku || undefined,
      variantSku: variantSku || undefined,
      size: selectedSize || undefined,
      selectedSize: selectedSize || undefined,
      color: selectedColor || undefined,
      selectedColor: selectedColor || undefined,
      variant: variantName || undefined,
      variantName: variantName || undefined,
      mrp: numberValue(item.mrp),
      sellerId: stringValue(item.sellerId) || undefined,
      sellerName: stringValue(item.sellerName) || undefined,
      quantity,
      price: unitPrice,
      selectedPrice: unitPrice,
      unitPrice,
      pricingType:
        pricingTypeValue === "wholesale" ? "wholesale" : "retail",
      subtotal: itemSubtotal,
    };
  });

  const itemSellerIds = items
    .map((item) => item.sellerId)
    .filter((sellerId): sellerId is string => Boolean(sellerId));

  const rawSellerIds = Array.isArray(data.sellerIds)
    ? data.sellerIds
        .map((sellerId) => stringValue(sellerId))
        .filter(Boolean)
    : [];

  const sellerIds = Array.from(
    new Set(rawSellerIds.length > 0 ? rawSellerIds : itemSellerIds)
  );

  const shippingAddress = formatShippingAddress(
    data.shippingAddress ?? data.address
  );

  const addressObject =
    data.shippingAddress &&
    typeof data.shippingAddress === "object"
      ? (data.shippingAddress as Record<string, unknown>)
      : data.address && typeof data.address === "object"
        ? (data.address as Record<string, unknown>)
        : {};

  const shippingAddressData: ShippingAddressData = {
    fullName: stringValue(addressObject.fullName ?? data.customerName ?? data.name),
    addressLine1: stringValue(addressObject.addressLine1),
    addressLine2: stringValue(addressObject.addressLine2),
    city: stringValue(addressObject.city),
    state: stringValue(addressObject.state),
    pincode: stringValue(addressObject.pincode),
  };

  // If the database stores a plain address string, keep it as address line 1.
  if (typeof (data.shippingAddress ?? data.address) === "string") {
    const plainAddress = stringValue(data.shippingAddress ?? data.address)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
      .replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, "")
      .replace(/\s*,\s*,/g, ",")
      .replace(/^\s*,|,\s*$/g, "")
      .trim();
    shippingAddressData.addressLine1 = plainAddress;
  }

  const itemsSubtotal = items.reduce(
    (sum, item) => sum + numberValue(item.subtotal),
    0
  );
  const rawSubtotal = Number(data.subtotal);
  const subtotal = Number.isFinite(rawSubtotal)
    ? rawSubtotal
    : itemsSubtotal;
  const shipping = numberValue(data.shippingCharge ?? data.shipping);
  const discount = numberValue(data.discount);
  const rawTotal = Number(
    data.total ?? data.totalAmount ?? data.grandTotal
  );
  const total = Number.isFinite(rawTotal)
    ? rawTotal
    : Math.max(0, subtotal + shipping - discount);

  return {
    id,
    userId: stringValue(data.userId ?? data.customerId),
    customerName:
      stringValue(data.customerName ?? data.name) ||
      stringValue(addressObject.fullName) ||
      "Guest",
    customerEmail: stringValue(data.customerEmail ?? data.email),
    customerPhone:
      stringValue(data.customerPhone ?? data.phone) ||
      stringValue(addressObject.phone),
    customerType: stringValue(data.customerType),
    orderSource: stringValue(data.orderSource),
    items,
    subtotal,
    shipping,
    discount,
    total,
    status: normalizeStatus(
      data.fulfillmentStatus ?? data.orderStatus ?? data.status
    ),
    paymentStatus: normalizePaymentStatus(data.paymentStatus),
    paymentMethod: stringValue(data.paymentMethod),
    sellerIds,
    sellerCount:
      Number.isFinite(Number(data.sellerCount)) &&
      Number(data.sellerCount) >= 0
        ? Number(data.sellerCount)
        : sellerIds.length,
    shippingAddress,
    shippingAddressData,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}


function escapePrintHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBulkShippingLabel(order: Order, index: number): string {
  const address = order.shippingAddressData ?? {};
  const isCod =
    ["COD", "CASH ON DELIVERY", "CASH_ON_DELIVERY"].includes(
      order.paymentMethod.trim().toUpperCase()
    ) || order.paymentStatus === "cod";

  const addressLines = [
    address.addressLine1,
    address.addressLine2,
    [address.city, address.state].filter(Boolean).join(", "),
    address.pincode ? `PIN: ${address.pincode}` : "",
  ]
    .filter(Boolean)
    .map((line) => `<div>${escapePrintHtml(line)}</div>`)
    .join("");

  const rows = (order.items ?? [])
    .map((item) => {
      const name = escapePrintHtml(item.name || item.productName || "Product");
      const variant = [
        item.selectedSize || item.size,
        item.selectedColor || item.color,
        item.variantName || item.variant,
      ]
        .filter(Boolean)
        .join(" / ");

      const quantity = Math.max(0, numberValue(item.quantity));

      return `
        <tr>
          <td class="product">
            <strong>${name}</strong>
            ${variant ? `<small>${escapePrintHtml(variant)}</small>` : ""}
          </td>
          <td class="qty">${quantity}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <article class="label ${index > 0 ? "next-page" : ""}">
      <header class="header">
        <div class="brand-block">
          <img src="/logo/anjivo-logo.png" alt="ANJIVO" class="logo">
          <div class="website">anjivo.online</div>
        </div>
        <div class="order-type">${isCod ? "COD" : "PREPAID"}</div>
      </header>

      <section class="section">
        <div class="heading">Ship To</div>
        <div class="customer-name">${escapePrintHtml(address.fullName || order.customerName || "Customer")}</div>
        <div class="address">
          ${addressLines || "<div>Address not available</div>"}
        </div>
      </section>

      <section class="section">
        <div class="heading">Package Contents</div>
        <table>
          <tbody>
            ${rows || '<tr><td colspan="2">Product details not available</td></tr>'}
          </tbody>
        </table>
      </section>

      <footer class="footer">anjivo.online</footer>
    </article>
  `;
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

  const [selectedOrderIds, setSelectedOrderIds] =
    useState<string[]>([]);

  useEffect(() => {
    let authGeneration = 0;
    let unsubscribeOrders: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const currentGeneration = ++authGeneration;

      // Detach any previous account's listener before checking the new user.
      unsubscribeOrders?.();
      unsubscribeOrders = undefined;

      setAuthorized(false);
      setOrders([]);
      setSelectedOrder(null);
      setSelectedOrderIds([]);
      setLoading(true);
      setError("");

      if (!user) {
        window.location.href = "/login?redirect=/admin/orders";
        return;
      }

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));

        // Ignore an authorization result if the signed-in account changed meanwhile.
        if (currentGeneration !== authGeneration) return;

        if (!userSnapshot.exists()) {
          window.location.href = "/";
          return;
        }

        const role = stringValue(userSnapshot.data().role)
          .trim()
          .toUpperCase();

        if (!["ADMIN", "SUPERADMIN"].includes(role)) {
          window.location.href = "/account";
          return;
        }

        setAuthorized(true);

        unsubscribeOrders = onSnapshot(
          collection(db, "orders"),
          (snapshot) => {
            if (currentGeneration !== authGeneration) return;

            const list = snapshot.docs.map((item) =>
              mapOrder(item.id, item.data())
            );

            list.sort(
              (a, b) =>
                timestampValue(b.createdAt) -
                timestampValue(a.createdAt)
            );

            setOrders(list);
            setError("");
            setLoading(false);
          },
          (err) => {
            if (currentGeneration !== authGeneration) return;

            console.error("Realtime orders listener error:", err);
            setError("Orders realtime load nahi ho paaye.");
            setLoading(false);
          }
        );
      } catch (err) {
        if (currentGeneration !== authGeneration) return;

        console.error("Admin authorization error:", err);
        setError("Admin access verify nahi ho saka.");
        setLoading(false);
      }
    });

    return () => {
      authGeneration += 1;
      unsubscribeAuth();
      unsubscribeOrders?.();
    };
  }, []);

  // Keep an already-open details modal synchronized with realtime order updates.
  useEffect(() => {
    setSelectedOrder((current) => {
      if (!current) return current;
      return orders.find((order) => order.id === current.id) ?? current;
    });
  }, [orders]);

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
          orderStatus:
            status === "pending"
              ? "PLACED"
              : status === "confirmed"
                ? "CONFIRMED"
                : status === "processing" || status === "packed"
                  ? "PROCESSING"
                  : status === "shipped" || status === "out_for_delivery"
                    ? "SHIPPED"
                    : status.toUpperCase(),
          fulfillmentStatus: status.toUpperCase(),
          updatedAt: serverTimestamp(),
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
          paymentStatus: paymentStatus.toUpperCase(),
          updatedAt: serverTimestamp(),
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
            order.shippingAddress,
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

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.includes(order.id)),
    [orders, selectedOrderIds]
  );

  const allVisibleSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((order) => selectedOrderIds.includes(order.id));

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredOrders.map((order) => order.id);

    setSelectedOrderIds((current) => {
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function printSelectedShippingLabels() {
    if (selectedOrders.length === 0) {
      window.alert("Pehle kam se kam ek order select karein.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=600,height=800");

    if (!printWindow) {
      window.alert(
        "Bulk labels print karne ke liye browser mein pop-ups allow karein."
      );
      return;
    }

    const labels = selectedOrders
      .map((order, index) => buildBulkShippingLabel(order, index))
      .join("");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${window.location.origin}/">
<title>ANJIVO Bulk Shipping Labels</title>
<style>
  @page { size: 4in 6in; margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label {
    width: 4in;
    height: 6in;
    padding: .22in;
    overflow: hidden;
    background: #fff;
    border: 1px solid #111;
    page-break-after: always;
    break-after: page;
  }
  .label:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .logo {
    display: block;
    width: 145px;
    max-height: 48px;
    object-fit: contain;
    object-position: left center;
  }
  .website {
    margin-top: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .order-type {
    flex: 0 0 auto;
    border: 2px solid #111;
    padding: 7px 10px;
    font-size: 15px;
    font-weight: 900;
  }
  .section {
    margin-top: 13px;
    padding-top: 10px;
    border-top: 2px solid #111;
  }
  .heading {
    margin-bottom: 7px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .customer-name {
    margin-bottom: 7px;
    font-size: 19px;
    line-height: 1.15;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .address {
    font-size: 12px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 11px;
  }
  td {
    padding: 7px 3px;
    border-bottom: 1px solid #aaa;
    vertical-align: top;
  }
  .product { overflow-wrap: anywhere; }
  .product strong {
    display: block;
    font-size: 11px;
    line-height: 1.3;
  }
  .product small {
    display: block;
    margin-top: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .qty {
    width: 42px;
    text-align: right;
    font-size: 12px;
    font-weight: 900;
  }
  .footer {
    display: flex;
    justify-content: center;
    margin-top: 16px;
    padding-top: 9px;
    border-top: 1px dashed #555;
    font-size: 10px;
    font-weight: 800;
  }
  @media screen {
    body { padding: 12px; background: #eee; }
    .label {
      margin: 0 auto 12px;
      box-shadow: 0 2px 10px #bbb;
    }
  }
</style>
</head>
<body>
${labels}
<script>
  window.onload = () => {
    const images = Array.from(document.images);
    Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
    })).then(() => setTimeout(() => window.print(), 300));
  };
</script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

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

        packed:
          orders.filter(
            (order) =>
              order.status === "packed"
          ).length,

        shipped:
          orders.filter(
            (order) =>
              order.status ===
              "shipped"
          ).length,

        out_for_delivery:
          orders.filter(
            (order) =>
              order.status === "out_for_delivery"
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

            <span className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-bold text-green-700">
              ● Live order sync
            </span>

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

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/orders/create"
              className="rounded-xl bg-black px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-gray-800"
            >
              + Create Manual Order
            </Link>

            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                Total Order Value
              </p>
              <p className="mt-1 text-xl font-black">
                ₹{totalOrderValue.toLocaleString("en-IN")}
              </p>
            </div>
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

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">

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
            label="Packed"
            count={counts.packed}
            active={filter === "packed"}
            onClick={() => setFilter("packed")}
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
            label="Out for delivery"
            count={counts.out_for_delivery}
            active={filter === "out_for_delivery"}
            onClick={() => setFilter("out_for_delivery")}
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

        {/* BULK SHIPPING LABEL TOOLBAR */}

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                disabled={filteredOrders.length === 0}
                className="h-4 w-4 rounded border-gray-300 accent-black"
              />
              Select all visible ({filteredOrders.length})
            </label>

            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-700">
              {selectedOrders.length} selected
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              disabled={selectedOrderIds.length === 0}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={printSelectedShippingLabels}
              disabled={selectedOrders.length === 0}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🏷️ Generate Shipping Labels ({selectedOrders.length})
            </button>
          </div>
        </div>

        {/* ORDERS */}

        <div className="mt-4 overflow-hidden rounded-3xl border border-gray-200 bg-white">

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
                    selected={selectedOrderIds.includes(order.id)}
                    onToggleSelect={() => toggleOrderSelection(order.id)}
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
  selected,
  onToggleSelect,
  processing,
  onView,
  onCancel,
  onStatusChange,
}: {
  order: Order;
  selected: boolean;
  onToggleSelect: () => void;
  processing: boolean;
  onView: () => void;
  onCancel: () => void;
  onStatusChange: (
    status: OrderStatus
  ) => void;
}) {
  return (
    <div className={`p-5 sm:p-6 ${selected ? "bg-indigo-50/50" : ""}`}>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select order ${order.id}`}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-indigo-600"
          />
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
              {order.customerName || "Guest"}
            </InfoBadge>

            {(order.customerType === "GUEST" || order.orderSource === "ADMIN") && (
              <InfoBadge>GUEST · ADMIN CREATED</InfoBadge>
            )}

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

            <Link
              href={`/admin/orders/${encodeURIComponent(order.id)}`}
              className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700"
              aria-label={`Generate shipping label for order ${order.id}`}
            >
              🏷️ Generate Label
            </Link>

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

              <option value="packed">
                Packed
              </option>

              <option value="shipped">
                Shipped
              </option>

              <option value="out_for_delivery">
                Out for delivery
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

                <option value="packed">
                  Packed
                </option>

                <option value="shipped">
                  Shipped
                </option>

                <option value="out_for_delivery">
                  Out for delivery
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

                          {(item.selectedSize ||
                            item.selectedColor ||
                            item.variantName) && (
                            <span className="text-[10px] text-gray-500">
                              Variant:{" "}
                              {[
                                item.selectedSize,
                                item.selectedColor,
                                item.variantName,
                              ]
                                .filter(Boolean)
                                .join(" / ")}
                            </span>
                          )}

                          {(item.variantSku || item.sku) && (
                            <span className="text-[10px] text-gray-500">
                              SKU: {item.variantSku || item.sku}
                            </span>
                          )}

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
                          numberValue(
                            item.subtotal,
                            numberValue(item.unitPrice ?? item.selectedPrice ?? item.price) *
                              numberValue(item.quantity)
                          )
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

    packed:
      "bg-cyan-100 text-cyan-700",

    shipped:
      "bg-indigo-100 text-indigo-700",

    out_for_delivery:
      "bg-sky-100 text-sky-700",

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
