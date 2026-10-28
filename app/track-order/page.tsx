
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  subscribeToOrderById,
  type Order,
  type OrderStatus,
} from "@/lib/orders";

const STATUS_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "pending", label: "Order Placed" },
  { status: "confirmed", label: "Order Confirmed" },
  { status: "processing", label: "Processing" },
  { status: "packed", label: "Packed" },
  { status: "shipped", label: "Shipped" },
  { status: "out_for_delivery", label: "Out for Delivery" },
  { status: "delivered", label: "Delivered" },
];

function formatDate(value: unknown): string {
  if (!value) return "Not available";

  let date: Date;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    date = value.toDate();
  } else {
    date = new Date(value as string | number);
  }

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function TrackOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orderIdInput, setOrderIdInput] = useState(
    searchParams.get("orderId") || ""
  );
  const [activeOrderId, setActiveOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [userId, setUserId] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listenerError, setListenerError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || "");
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeOrderId || !userId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);
    setError("");
    setListenerError("");
    setOrder(null);

    const unsubscribe = subscribeToOrderById(
      activeOrderId,
      userId,
      (nextOrder) => {
        if (!isCurrent) return;

        setOrder(nextOrder);
        setLoading(false);

        if (!nextOrder) {
          setError(
            "Order nahi mila, ya yeh order aapke account ka nahi hai."
          );
        } else {
          setError("");
        }
      },
      (err) => {
        if (!isCurrent) return;

        setLoading(false);
        setListenerError(
          err.message ||
            "Order load nahi ho paya. Apna account verification check karein."
        );
      }
    );

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [activeOrderId, userId]);

  function handleTrackOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const id = orderIdInput.trim();

    if (!id) {
      setError("Please apna Order ID enter karein.");
      return;
    }

    if (!auth.currentUser) {
      router.push("/login");
      return;
    }

    setError("");
    setListenerError("");
    setOrder(null);
    setActiveOrderId(id);
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-center text-gray-600">Loading account...</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Track Your Order
          </h1>
          <p className="mt-3 text-gray-600">
            Order track karne ke liye pehle login karein.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-6 rounded-lg bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800"
          >
            Login to Continue
          </button>
        </section>
      </main>
    );
  }

  const currentStatus = order?.status;
  const terminalStatus =
    currentStatus === "cancelled" ||
    currentStatus === "returned" ||
    currentStatus === "refunded";

  const currentStepIndex = STATUS_STEPS.findIndex(
    (step) => step.status === currentStatus
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Track Your Order
        </h1>
        <p className="mt-2 text-gray-600">
          Apne order ka current status aur shipment details dekhein.
        </p>
      </header>

      <form
        onSubmit={handleTrackOrder}
        className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row"
      >
        <label className="sr-only" htmlFor="orderId">
          Order ID
        </label>
        <input
          id="orderId"
          type="text"
          value={orderIdInput}
          onChange={(event) => setOrderIdInput(event.target.value)}
          placeholder="Enter your Order ID"
          autoComplete="off"
          required
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking..." : "Track Order"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {listenerError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {listenerError}
        </div>
      )}

      {loading && (
        <p className="mt-8 text-center text-gray-600">
          Order details load ho rahi hain...
        </p>
      )}

      {order && (
        <section className="mt-8 space-y-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <p className="text-sm text-gray-500">Order ID</p>
                <p className="mt-1 break-all font-semibold text-gray-900">
                  {order.id}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current Status</p>
                <p className="mt-1 font-bold text-gray-900">
                  {formatStatus(order.fulfillmentStatus || order.status)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="mt-1 font-medium">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="mt-1 font-medium">
                  {order.paymentMethod || "Not available"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Status</p>
                <p className="mt-1 font-medium">
                  {formatStatus(order.paymentStatus || "pending")}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Total</p>
                <p className="mt-1 font-bold">
                  ₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Shipment Progress
            </h2>

            {terminalStatus ? (
              <p className="mt-4 rounded-lg bg-gray-50 p-4 font-medium text-gray-800">
                This order is {formatStatus(currentStatus || "cancelled")}.
              </p>
            ) : (
              <ol className="mt-6 space-y-5">
                {STATUS_STEPS.map((step, index) => {
                  const completed =
                    currentStepIndex >= 0 && index <= currentStepIndex;
                  const current = index === currentStepIndex;

                  return (
                    <li key={step.status} className="flex gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          completed
                            ? "bg-green-600 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {completed ? "✓" : index + 1}
                      </span>
                      <div>
                        <p
                          className={`font-medium ${
                            current ? "text-green-700" : "text-gray-800"
                          }`}
                        >
                          {step.label}
                          {current ? " — Current" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <p className="mt-5 text-xs text-gray-500">
              Status changes appear when the order record is updated.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Delivery Details
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="text-gray-500">Courier: </span>
                <span className="font-medium">
                  {order.courierName || order.courier || "Not assigned yet"}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Tracking / AWB number: </span>
                <span className="break-all font-medium">
                  {order.trackingNumber ||
                    order.awbNumber ||
                    "Not available yet"}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Estimated delivery: </span>
                <span className="font-medium">
                  {formatDate(order.estimatedDelivery)}
                </span>
              </p>

              {order.trackingUrl &&
                /^https:\/\//i.test(order.trackingUrl) && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg bg-black px-4 py-2 font-semibold text-white hover:bg-gray-800"
                  >
                    Track with Courier
                  </a>
                )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Items in This Order
            </h2>
            <div className="mt-4 divide-y">
              {order.items.map((item, index) => (
                <div
                  key={`${item.productId}-${index}`}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium text-gray-900">
                      {item.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Qty: {item.quantity} ·{" "}
                      {item.pricingType === "wholesale"
                        ? "Wholesale"
                        : "Retail"}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">
                    ₹{Number(item.subtotal || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Shipping Address
            </h2>
            <p className="mt-3 font-medium">{order.shippingAddress.fullName}</p>
            <p className="mt-1 text-sm text-gray-600">
              {order.shippingAddress.addressLine1}
              {order.shippingAddress.addressLine2
                ? `, ${order.shippingAddress.addressLine2}`
                : ""}
              , {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
              {order.shippingAddress.pincode}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
