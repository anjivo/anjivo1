"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth } from "@/lib/firebase";

import {
  subscribeToOrderById,
  type Order,
} from "@/lib/orders";

/* =========================================================
   STATUS LABEL
========================================================= */

function statusLabel(
  status: Order["status"]
): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";

    case "processing":
      return "Processing";

    case "shipped":
      return "Shipped";

    case "out_for_delivery":
      return "Out for Delivery";

    case "delivered":
      return "Delivered";

    case "cancelled":
      return "Cancelled";

    case "returned":
      return "Returned";

    case "refunded":
      return "Refunded";

    default:
      return "Pending";
  }
}

/* =========================================================
   STATUS NORMALIZATION + TRACKING HELPERS
========================================================= */

type TrackingStatus =
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

function normalizeStatus(value: unknown): TrackingStatus {
  const raw = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");

  const aliases: Record<string, TrackingStatus> = {
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

  if (raw in aliases) return aliases[raw];
  const allowed: TrackingStatus[] = [
    "pending", "confirmed", "processing", "packed", "shipped",
    "out_for_delivery", "delivered", "cancelled", "returned", "refunded",
  ];

  return allowed.includes(raw as TrackingStatus)
    ? (raw as TrackingStatus)
    : "pending";
}

function trackingSteps() {
  return [
    { key: "confirmed", title: "Order confirmed", description: "Your order has been confirmed." },
    { key: "processing", title: "Processing", description: "Your items are being prepared." },
    { key: "packed", title: "Packed", description: "Your order has been packed for dispatch." },
    { key: "shipped", title: "Shipped", description: "Your order has been handed over for delivery." },
    { key: "out_for_delivery", title: "Out for delivery", description: "Your order is on the way to your address." },
    { key: "delivered", title: "Delivered", description: "Your order has been delivered." },
  ] as const;
}

/* =========================================================
   STATUS CLASS
========================================================= */

function unitLabel(item: Order["items"][number]): string {
  if (item.wholesaleUnit === "SET" || item.isSet) {
    return "Set";
  }

  return "Piece";
}

function actualPieces(item: Order["items"][number]): number {
  const piecesPerSet = Number(item.piecesPerSet || 0);

  if (
    item.pricingType === "wholesale" &&
    (item.wholesaleUnit === "SET" || item.isSet) &&
    piecesPerSet > 0
  ) {
    return item.quantity * piecesPerSet;
  }

  return item.quantity;
}

function statusClass(
  status: Order["status"]
): string {
  switch (status) {
    case "delivered":
      return "bg-green-100 text-green-700";

    case "cancelled":
      return "bg-red-100 text-red-700";

    case "returned":
    case "refunded":
      return "bg-purple-100 text-purple-700";

    case "shipped":
    case "out_for_delivery":
      return "bg-blue-100 text-blue-700";

    case "confirmed":
    case "processing":
      return "bg-yellow-100 text-yellow-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

/* =========================================================
   PAGE
========================================================= */

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const orderId =
    typeof params.orderId === "string"
      ? params.orderId
      : "";

  const [order, setOrder] =
    useState<Order | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [returnProductId, setReturnProductId] = useState("");
  const [returnReason, setReturnReason] = useState("damaged");
  const [returnDescription, setReturnDescription] = useState("");
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnMessage, setReturnMessage] = useState("");
  const [returnError, setReturnError] = useState("");
  const [existingReturns, setExistingReturns] = useState<Record<string, {
    id: string;
    returnStatus: string;
    refundStatus: string;
  }>>({});

  /* =======================================================
     AUTH + LIVE ORDER SUBSCRIPTION
  ======================================================= */

  useEffect(() => {
    if (!orderId) {
      setError("Invalid order ID.");
      setLoading(false);
      return;
    }

    let unsubscribeOrder: (() => void) | undefined;
    let isActive = true;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Stop any previous user's order listener if auth changes.
      unsubscribeOrder?.();
      unsubscribeOrder = undefined;

      if (!user) {
        router.replace(`/login?redirect=/account/orders/${orderId}`);
        return;
      }

      setLoading(true);
      setError("");

      unsubscribeOrder = subscribeToOrderById(
        orderId,
        user.uid,
        (result) => {
          if (!isActive) return;

          if (!result) {
            setOrder(null);
            setError("Order not found.");
          } else {
            setOrder(result);
            setError("");
            if (normalizeStatus(result.status) === "delivered") {
              const currentUser = auth.currentUser;
              if (currentUser) {
                void currentUser.getIdToken().then((token) => loadExistingReturns(result.id, token));
              }
            }
          }

          setLoading(false);
        },
        (err) => {
          if (!isActive) return;
          console.error("Live order subscription error:", err);
          setError("Unable to load order. Please check your connection and try again.");
          setLoading(false);
        }
      );
    });

    return () => {
      isActive = false;
      unsubscribeOrder?.();
      unsubscribeAuth();
    };
  }, [orderId, router]);

  async function loadExistingReturns(currentOrderId: string, token: string) {
    try {
      const response = await fetch(
        `/api/returns?orderId=${encodeURIComponent(currentOrderId)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success || !Array.isArray(payload.returns)) return;

      const byProduct: Record<string, { id: string; returnStatus: string; refundStatus: string }> = {};
      for (const item of payload.returns) {
        if (item && typeof item.productId === "string") {
          byProduct[item.productId] = {
            id: String(item.id ?? ""),
            returnStatus: String(item.returnStatus ?? "requested"),
            refundStatus: String(item.refundStatus ?? "pending"),
          };
        }
      }
      setExistingReturns(byProduct);
    } catch (err) {
      console.error("Load existing returns error:", err);
    }
  }

  async function submitReturnRequest(
    item: Order["items"][number],
  ) {
    const user = auth.currentUser;
    if (!user || !order) {
      setReturnError("Please sign in again to request a return.");
      return;
    }

    if (!returnReason.trim()) {
      setReturnError("Please select a return reason.");
      return;
    }

    if (returnQuantity < 1 || returnQuantity > item.quantity) {
      setReturnError("Please choose a valid return quantity.");
      return;
    }

    try {
      setReturnSubmitting(true);
      setReturnError("");
      setReturnMessage("");

      const token = await user.getIdToken();
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          productId: item.productId,
          quantity: returnQuantity,
          reason: returnReason,
          description: returnDescription.trim(),
          images: [],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Return request could not be submitted.");
      }

      setExistingReturns((current) => ({
        ...current,
        [item.productId]: {
          id: String(payload.returnRequest?.id ?? ""),
          returnStatus: "requested",
          refundStatus: "pending",
        },
      }));
      setReturnMessage("Return request submitted successfully.");
      setReturnProductId("");
      setReturnDescription("");
      setReturnQuantity(1);
      await loadExistingReturns(order.id, token);
    } catch (err) {
      setReturnError(
        err instanceof Error ? err.message : "Return request failed. Please try again.",
      );
    } finally {
      setReturnSubmitting(false);
    }
  }

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-bold text-gray-600">
              Loading order...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =======================================================
     ERROR / NOT FOUND
  ======================================================= */

  if (!order || error) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-5xl">
              📦
            </div>

            <h1 className="mt-4 text-xl font-black">
              {error ||
                "Order not found"}
            </h1>

            <Link
              href="/account/orders"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
            >
              My Orders
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =======================================================
     ADDRESS
  ======================================================= */

  const address =
    order.shippingAddress;

  // Read optional shipment fields if they are present in the saved order document.
  // These are displayed only when your order data actually contains them.
  const orderData = order as Order & {
    fulfillmentStatus?: string;
    courierName?: string;
    courier?: string;
    trackingNumber?: string;
    awbNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string | { toDate?: () => Date } | Date;
    shippedAt?: string | { toDate?: () => Date } | Date;
    deliveredAt?: string | { toDate?: () => Date } | Date;
    sellerFulfillment?: Record<string, {
      status?: string;
      fulfillmentStatus?: string;
      courierName?: string;
      courier?: string;
      trackingNumber?: string;
      awbNumber?: string;
      trackingUrl?: string;
      estimatedDelivery?: string | { toDate?: () => Date } | Date;
      shippedAt?: string | { toDate?: () => Date } | Date;
      deliveredAt?: string | { toDate?: () => Date } | Date;
      updatedAt?: unknown;
    }>;
  };

  const currentStatus = normalizeStatus(
    orderData.fulfillmentStatus || order.status
  );

  const trackingStatuses = trackingSteps();
  const currentStepIndex = trackingStatuses.findIndex(
    (step) => step.key === currentStatus
  );

  const isTerminalStatus = ["cancelled", "returned", "refunded"].includes(currentStatus);
  const trackingProgress = currentStatus === "delivered"
    ? 100
    : isTerminalStatus
      ? 0
      : currentStepIndex < 0
        ? 0
        : Math.round(((currentStepIndex + 1) / trackingStatuses.length) * 100);

  const courierName = orderData.courierName || orderData.courier || "";
  const trackingNumber = orderData.awbNumber || orderData.trackingNumber || "";
  const trackingUrl = orderData.trackingUrl || "";

  function formatTrackingDate(value: unknown): string {
    if (!value) return "";
    try {
      let date: Date | null = null;
      if (value instanceof Date) date = value;
      else if (typeof value === "string" || typeof value === "number") date = new Date(value);
      else if (typeof value === "object" && value !== null && "toDate" in value &&
        typeof (value as { toDate?: unknown }).toDate === "function") {
        date = (value as { toDate: () => Date }).toDate();
      }
      return date && !Number.isNaN(date.getTime())
        ? date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : "";
    } catch {
      return "";
    }
  }

  const shippedAtText = formatTrackingDate(orderData.shippedAt);
  const deliveredAtText = formatTrackingDate(orderData.deliveredAt);
  const estimatedDeliveryText = formatTrackingDate(orderData.estimatedDelivery);

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">

        {/* =================================================
            BACK
        ================================================= */}

        <Link
          href="/account/orders"
          className="text-xs font-bold text-gray-500 transition hover:text-black"
        >
          ← Back to My Orders
        </Link>

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Order Details
            </p>

            <h1 className="mt-2 text-2xl font-black">
              #{order.id}
            </h1>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-xs font-bold ${statusClass(
              order.status
            )}`}
          >
            {statusLabel(
              order.status
            )}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded-full bg-white px-3 py-2 font-semibold shadow-sm ring-1 ring-gray-200">
            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full bg-white px-3 py-2 font-semibold shadow-sm ring-1 ring-gray-200">
            {order.sellerIds.length} seller{order.sellerIds.length !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full bg-white px-3 py-2 font-semibold shadow-sm ring-1 ring-gray-200">
            {order.paymentMethod || "COD"}
          </span>
        </div>

        {/* =================================================
            MAIN GRID
        ================================================= */}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">

          {/* =================================================
              ORDER ITEMS
          ================================================= */}

          <section className="rounded-3xl border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-black">
              Order Items
            </h2>

            <div className="mt-5 space-y-3">
              {order.items.map(
                (item, index) => (
                  <div
                    key={`${item.productId}-${item.pricingType}-${index}`}
                    className="flex gap-3 rounded-2xl border border-gray-100 p-3"
                  >

                    {/* IMAGE */}

                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
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
                        <div className="flex h-full items-center justify-center text-2xl">
                          📦
                        </div>
                      )}
                    </div>

                    {/* PRODUCT INFO */}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-900">
                        {item.name}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                          {item.pricingType === "wholesale"
                            ? "Wholesale"
                            : "Retail"}
                        </span>

                        {item.pricingType === "wholesale" &&
                          (item.wholesaleUnit === "SET" ||
                            item.isSet) && (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              Set / Pack
                            </span>
                          )}
                      </div>

                      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
                        <span className="text-gray-500">
                          Qty: <strong className="text-gray-900">
                            {item.quantity} {unitLabel(item)}
                          </strong>
                        </span>

                        <span className="font-black text-gray-900">
                          ₹
                          {item.subtotal.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <p className="mt-1 text-[10px] text-gray-400">
                        ₹
                        {item.selectedPrice.toLocaleString("en-IN")}{" "}
                        / {unitLabel(item).toLowerCase()}
                      </p>

                      {item.pricingType === "wholesale" &&
                        (item.wholesaleUnit === "SET" || item.isSet) && (
                          <div className="mt-2 rounded-xl bg-amber-50 p-2 text-[10px] text-amber-800">
                            {item.setName && (
                              <p className="font-bold">
                                {item.setName}
                              </p>
                            )}

                            <p className={item.setName ? "mt-1" : ""}>
                              {item.piecesPerSet
                                ? `${item.quantity} set${item.quantity > 1 ? "s" : ""} × ${item.piecesPerSet} pieces = ${actualPieces(item)} pieces`
                                : `${actualPieces(item)} pieces`}
                            </p>

                            {item.setBreakAllowed === false && (
                              <p className="mt-1 font-semibold">
                                🔒 Set cannot be broken
                              </p>
                            )}

                            {Array.isArray(item.setComposition) &&
                              item.setComposition.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {item.setComposition.map(
                                    (composition, compositionIndex) => (
                                      <p key={compositionIndex}>
                                        {composition.value} × {composition.quantity}
                                      </p>
                                    )
                                  )}
                                </div>
                              )}
                          </div>
                        )}

                      {currentStatus === "delivered" && (
                        <div className="mt-4 border-t border-gray-100 pt-3">
                          {existingReturns[item.productId] ? (
                            <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                              Return request: <strong>{existingReturns[item.productId].returnStatus.replace(/_/g, " ")}</strong>
                              {existingReturns[item.productId].refundStatus && (
                                <span> · Refund: {existingReturns[item.productId].refundStatus.replace(/_/g, " ")}</span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReturnProductId((current) => current === item.productId ? "" : item.productId);
                                setReturnQuantity(1);
                                setReturnError("");
                                setReturnMessage("");
                              }}
                              className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold text-gray-800 hover:border-black"
                            >
                              {returnProductId === item.productId ? "Close Return Form" : "Request Return"}
                            </button>
                          )}

                          {returnProductId === item.productId && !existingReturns[item.productId] && (
                            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <h3 className="text-sm font-black">Request return for {item.name}</h3>
                              <label className="mt-3 block text-xs font-bold text-gray-700">
                                Reason
                                <select
                                  value={returnReason}
                                  onChange={(event) => setReturnReason(event.target.value)}
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                                >
                                  <option value="damaged">Product damaged</option>
                                  <option value="wrong_item">Wrong item received</option>
                                  <option value="missing_item">Item/parts missing</option>
                                  <option value="quality_issue">Quality issue</option>
                                  <option value="size_issue">Size/fit issue</option>
                                  <option value="not_as_described">Not as described</option>
                                  <option value="other">Other</option>
                                </select>
                              </label>
                              <label className="mt-3 block text-xs font-bold text-gray-700">
                                Quantity to return
                                <select
                                  value={returnQuantity}
                                  onChange={(event) => setReturnQuantity(Number(event.target.value))}
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                                >
                                  {Array.from({ length: Math.max(1, item.quantity) }, (_, index) => index + 1).map((quantity) => (
                                    <option key={quantity} value={quantity}>{quantity}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="mt-3 block text-xs font-bold text-gray-700">
                                Additional details (optional)
                                <textarea
                                  value={returnDescription}
                                  onChange={(event) => setReturnDescription(event.target.value)}
                                  maxLength={1000}
                                  rows={3}
                                  placeholder="Explain the issue..."
                                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                                />
                              </label>
                              {returnError && <p className="mt-3 text-xs font-semibold text-red-700">{returnError}</p>}
                              {returnMessage && <p className="mt-3 text-xs font-semibold text-green-700">{returnMessage}</p>}
                              <button
                                type="button"
                                disabled={returnSubmitting}
                                onClick={() => void submitReturnRequest(item)}
                                className="mt-3 rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                              >
                                {returnSubmitting ? "Submitting..." : "Submit Return Request"}
                              </button>
                              <p className="mt-2 text-[10px] leading-5 text-gray-500">
                                Return request is available after delivery. Refund is not issued automatically when you submit this request.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* =================================================
              RIGHT SIDE
          ================================================= */}

          <div className="space-y-5">

            {/* =================================================
                STATUS
            ================================================= */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-black">
                Order Status
              </h2>

              <div className="mt-5">
                <div className="flex items-center gap-3">

                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
                      currentStatus ===
                      "cancelled"
                        ? "bg-red-500"
                        : currentStatus ===
                            "delivered"
                          ? "bg-green-500"
                          : "bg-black"
                    }`}
                  >
                    {currentStatus ===
                    "cancelled"
                      ? "×"
                      : currentStatus ===
                          "delivered"
                        ? "✓"
                        : "•"}
                  </div>

                  <div>
                    <p className="text-sm font-black">
                      {statusLabel(
                        order.status
                      )}
                    </p>

                    <p className="text-[10px] text-gray-400">
                      Your order status
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
                  Payment:{" "}
                  <strong className="text-gray-900">
                    {
                      order.paymentMethod
                    }
                  </strong>

                  <br />

                  Payment status:{" "}
                  <strong className="text-gray-900">
                    {
                      order.paymentStatus
                    }
                  </strong>
                </div>
              </div>
            </section>

            {/* =================================================
                SHIPMENT TRACKING
            ================================================= */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-black">Shipment Tracking</h2>
              <p className="mt-1 text-xs text-gray-500">
                Track the progress of your order from confirmation to delivery.
              </p>

              {(() => {
                const sellerFulfillment = orderData.sellerFulfillment || {};
                const sellerIds = Array.isArray(order.sellerIds) ? order.sellerIds : [];
                const hasSellerFulfillment = sellerIds.some((sellerId) =>
                  Boolean(sellerFulfillment[String(sellerId)])
                );

                // For multi-seller orders, display each seller's independently saved shipment.
                // For legacy/single-seller orders, retain the top-level tracking fields as fallback.
                const shipments = hasSellerFulfillment
                  ? sellerIds.map((sellerId, index) => {
                      const sellerIdString = String(sellerId);
                      const shipment = sellerFulfillment[sellerIdString] || {};
                      const status = normalizeStatus(
                        shipment.fulfillmentStatus || shipment.status || "pending"
                      );
                      return {
                        key: sellerIdString || `seller-${index}`,
                        label: `Seller ${index + 1}`,
                        status,
                        courierName: shipment.courierName || shipment.courier || "",
                        trackingNumber: shipment.awbNumber || shipment.trackingNumber || "",
                        trackingUrl: shipment.trackingUrl || "",
                        shippedAt: formatTrackingDate(shipment.shippedAt),
                        deliveredAt: formatTrackingDate(shipment.deliveredAt),
                        estimatedDelivery: formatTrackingDate(shipment.estimatedDelivery),
                      };
                    })
                  : [{
                      key: "order",
                      label: "Order shipment",
                      status: currentStatus,
                      courierName,
                      trackingNumber,
                      trackingUrl,
                      shippedAt: shippedAtText,
                      deliveredAt: deliveredAtText,
                      estimatedDelivery: estimatedDeliveryText,
                    }];

                return (
                  <div className="mt-4 space-y-4">
                    {shipments.map((shipment) => {
                      const terminal = ["cancelled", "returned", "refunded"].includes(shipment.status);
                      const stepIndex = trackingStatuses.findIndex((step) => step.key === shipment.status);
                      const progress = shipment.status === "delivered"
                        ? 100
                        : terminal || stepIndex < 0
                          ? 0
                          : Math.round(((stepIndex + 1) / trackingStatuses.length) * 100);

                      return (
                        <div key={shipment.key} className="rounded-2xl border border-gray-100 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-black text-gray-900">{shipment.label}</p>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold capitalize text-gray-700">
                              {shipment.status.replace(/_/g, " ")}
                            </span>
                          </div>

                          {terminal ? (
                            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs font-semibold text-gray-700">
                              Shipment {shipment.status.replace(/_/g, " ")}.
                            </div>
                          ) : (
                            <>
                              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
                              </div>
                              <div className="mt-4 space-y-3">
                                {trackingStatuses.map((step, index) => {
                                  const completed = shipment.status === "delivered" || index < stepIndex;
                                  const active = index === stepIndex && shipment.status !== "delivered";
                                  return (
                                    <div key={step.key} className="flex gap-3">
                                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                        completed ? "bg-green-600 text-white" : active ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                                      }`}>
                                        {completed ? "✓" : index + 1}
                                      </div>
                                      <div>
                                        <p className={`text-xs font-bold ${completed || active ? "text-gray-900" : "text-gray-400"}`}>
                                          {step.title}
                                        </p>
                                        {step.key === "shipped" && shipment.shippedAt && (
                                          <p className="mt-1 text-[10px] text-green-700">{shipment.shippedAt}</p>
                                        )}
                                        {step.key === "delivered" && shipment.deliveredAt && (
                                          <p className="mt-1 text-[10px] text-green-700">{shipment.deliveredAt}</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          {shipment.estimatedDelivery && (
                            <div className="mt-3 rounded-xl bg-green-50 p-3 text-xs text-green-800">
                              Estimated delivery: <strong>{shipment.estimatedDelivery}</strong>
                            </div>
                          )}

                          {(shipment.courierName || shipment.trackingNumber || shipment.trackingUrl) ? (
                            <div className="mt-3 rounded-xl bg-gray-50 p-3">
                              <p className="text-xs font-black text-gray-800">Courier details</p>
                              {shipment.courierName && (
                                <p className="mt-2 text-xs text-gray-600">
                                  Courier: <strong className="text-gray-900">{shipment.courierName}</strong>
                                </p>
                              )}
                              {shipment.trackingNumber && (
                                <p className="mt-1 break-all text-xs text-gray-600">
                                  AWB / Tracking ID: <strong className="text-gray-900">{shipment.trackingNumber}</strong>
                                </p>
                              )}
                              {shipment.trackingUrl && (
                                <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer"
                                  className="mt-3 inline-flex rounded-lg bg-black px-4 py-2 text-xs font-bold text-white hover:bg-gray-800">
                                  Track with courier
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 rounded-xl bg-gray-50 p-3 text-[11px] leading-5 text-gray-500">
                              Courier and tracking details will appear once this seller adds shipment information.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>

            {/* =================================================
                ADDRESS
            ================================================= */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-black">
                Delivery Address
              </h2>

              <div className="mt-4 text-sm leading-6 text-gray-600">
                <p className="font-black text-gray-900">
                  {
                    address.fullName
                  }
                </p>

                <p>
                  {
                    address.phone
                  }
                </p>

                <p className="mt-2">
                  {
                    address.addressLine1
                  }
                </p>

                {address.addressLine2 && (
                  <p>
                    {
                      address.addressLine2
                    }
                  </p>
                )}

                <p>
                  {
                    address.city
                  }
                  ,{" "}
                  {
                    address.state
                  }{" "}
                  -{" "}
                  {
                    address.pincode
                  }
                </p>
              </div>
            </section>

            {/* =================================================
                PRICE DETAILS
            ================================================= */}

            <section className="rounded-3xl border border-gray-200 bg-white p-5">
              <h2 className="text-lg font-black">
                Price Details
              </h2>

              <div className="mt-4 space-y-3 text-sm">

                {/* SUBTOTAL */}

                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Subtotal
                  </span>

                  <span className="font-semibold">
                    ₹
                    {order.subtotal.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                {/* DELIVERY */}

                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Delivery
                  </span>

                  <span className="font-bold">
                    {order.shippingCharge ===
                    0
                      ? "FREE"
                      : `₹${order.shippingCharge.toLocaleString(
                          "en-IN"
                        )}`}
                  </span>
                </div>

                {/* DISCOUNT */}

                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Discount
                  </span>

                  <span className="font-semibold">
                    -₹
                    {order.discount.toLocaleString(
                      "en-IN"
                    )}
                  </span>
                </div>

                {/* TOTAL */}

                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between">
                    <span className="font-black">
                      Total
                    </span>

                    <span className="text-xl font-black">
                      ₹
                      {order.totalAmount.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  </div>
                </div>

              </div>
            </section>

          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link
            href="/account/orders"
            className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            ← My Orders
          </Link>

          <Link
            href="/products"
            className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-center text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            Continue Shopping
          </Link>

          <Link
            href={`/order-success/${order.id}`}
            className="rounded-2xl bg-black px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-gray-800"
          >
            Order Summary
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
