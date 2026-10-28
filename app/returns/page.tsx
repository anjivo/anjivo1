
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getOrderById, type Order } from "@/lib/orders";

type ReturnRequest = {
  id: string;
  orderId: string;
  productId: string;
  returnStatus: string;
  refundStatus: string;
  createdAt: string | null;
};

const REASONS = [
  { value: "damaged", label: "Product damaged" },
  { value: "wrong_item", label: "Wrong item received" },
  { value: "missing_item", label: "Item missing from order" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "size_issue", label: "Size or fit issue" },
  { value: "not_as_described", label: "Product not as described" },
  { value: "other", label: "Other reason" },
];

function labelStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isDelivered(order: Order) {
  const status = [
    order.status,
    order.fulfillmentStatus,
  ].map((value) => String(value || "").toLowerCase().replace(/[ -]+/g, "_"));

  return status.some((value) =>
    ["delivered", "complete", "completed"].includes(value)
  );
}

export default function ReturnsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [orderId, setOrderId] = useState(searchParams.get("orderId") || "");
  const [order, setOrder] = useState<Order | null>(null);
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, { reason: string; quantity: number; description: string }>
  >({});
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || "");
      setAuthLoading(false);
    });
  }, []);

  async function loadOrder(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const cleanOrderId = orderId.trim();

    if (!cleanOrderId) {
      setError("Please enter your Order ID.");
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      router.push("/login?redirect=/returns");
      return;
    }

    setLoadingOrder(true);
    setError("");
    setNotice("");
    setOrder(null);
    setRequests([]);

    try {
      const foundOrder = await getOrderById(cleanOrderId, user.uid);

      if (!foundOrder) {
        throw new Error("Order nahi mila ya yeh aapke account ka nahi hai.");
      }

      setOrder(foundOrder);

      const token = await user.getIdToken();
      const response = await fetch(
        `/api/returns?orderId=${encodeURIComponent(cleanOrderId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Return history load nahi hui.");
      }

      setRequests(Array.isArray(result.returns) ? result.returns : []);

      const initial: Record<
        string,
        { reason: string; quantity: number; description: string }
      > = {};

      for (const item of foundOrder.items) {
        initial[item.productId] = {
          reason: "other",
          quantity: 1,
          description: "",
        };
      }

      setSelectedProducts(initial);
    } catch (err) {
      setOrder(null);
      setError(
        err instanceof Error
          ? err.message
          : "Order load nahi ho paya. Please try again."
      );
    } finally {
      setLoadingOrder(false);
    }
  }

  async function submitReturn(productId: string) {
    const user = auth.currentUser;

    if (!user || !order) {
      setError("Please login karke apna order dobara load karein.");
      return;
    }

    const form = selectedProducts[productId];

    if (!form) {
      setError("Return details select karein.");
      return;
    }

    if (
      !Number.isSafeInteger(form.quantity) ||
      form.quantity < 1
    ) {
      setError("Valid return quantity enter karein.");
      return;
    }

    setSubmittingProduct(productId);
    setError("");
    setNotice("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          productId,
          reason: form.reason,
          quantity: form.quantity,
          description: form.description.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Return request submit nahi hui.");
      }

      setNotice("Return request successfully submit ho gayi.");

      await loadOrder();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Return request submit nahi hui."
      );
    } finally {
      setSubmittingProduct("");
    }
  }

  function updateProductForm(
    productId: string,
    field: "reason" | "quantity" | "description",
    value: string | number
  ) {
    setSelectedProducts((current) => ({
      ...current,
      [productId]: {
        reason: current[productId]?.reason || "other",
        quantity: current[productId]?.quantity || 1,
        description: current[productId]?.description || "",
        [field]: value,
      },
    }));
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-center text-gray-600">Loading account...</p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="rounded-2xl border bg-white p-6 text-center">
          <h1 className="text-2xl font-bold">Returns & Refunds</h1>
          <p className="mt-3 text-gray-600">
            Return request ke liye pehle login karein.
          </p>
          <button
            type="button"
            onClick={() =>
              router.push("/login?redirect=/returns")
            }
            className="mt-5 rounded-lg bg-black px-5 py-3 font-semibold text-white"
          >
            Login to Continue
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Returns & Refunds
          </h1>
          <p className="mt-2 text-gray-600">
            Delivered order select karein aur eligible product ke liye
            return request submit karein.
          </p>
        </header>

        <form
          onSubmit={loadOrder}
          className="flex flex-col gap-3 rounded-2xl border bg-white p-5 sm:flex-row"
        >
          <label htmlFor="orderId" className="sr-only">
            Order ID
          </label>
          <input
            id="orderId"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="Enter your Order ID"
            required
            className="min-w-0 flex-1 rounded-lg border px-4 py-3 outline-none focus:border-black"
          />
          <button
            type="submit"
            disabled={loadingOrder}
            className="rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loadingOrder ? "Loading..." : "Find Order"}
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

        {notice && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {notice}
          </p>
        )}

        {order && (
          <section className="mt-6 space-y-5">
            <div className="rounded-2xl border bg-white p-5">
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="mt-1 break-all font-semibold">{order.id}</p>
              <p className="mt-3 text-sm text-gray-500">Order status</p>
              <p className="mt-1 font-semibold">
                {labelStatus(order.fulfillmentStatus || order.status)}
              </p>

              {!isDelivered(order) && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Return request sirf delivered order ke liye submit ho
                  sakti hai.
                </p>
              )}
            </div>

            <h2 className="text-xl font-bold">Order Items</h2>

            {order.items.map((item, index) => {
              const existingRequest = requests.find(
                (request) => request.productId === item.productId
              );

              const form = selectedProducts[item.productId] || {
                reason: "other",
                quantity: 1,
                description: "",
              };

              const canSubmit =
                isDelivered(order) &&
                !existingRequest &&
                Boolean(item.productId);

              return (
                <article
                  key={`${item.productId}-${index}`}
                  className="rounded-2xl border bg-white p-5"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Purchased quantity: {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold">
                      ₹{Number(item.subtotal || 0).toLocaleString("en-IN")}
                    </p>
                  </div>

                  {existingRequest ? (
                    <div className="mt-4 rounded-lg bg-gray-50 p-4">
                      <p className="font-semibold">
                        Return request: {labelStatus(existingRequest.returnStatus)}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        Refund status: {labelStatus(existingRequest.refundStatus)}
                      </p>
                      <p className="mt-1 break-all text-xs text-gray-500">
                        Request ID: {existingRequest.id}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4 border-t pt-5">
                      <div>
                        <label
                          htmlFor={`reason-${index}`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Return reason
                        </label>
                        <select
                          id={`reason-${index}`}
                          value={form.reason}
                          onChange={(event) =>
                            updateProductForm(
                              item.productId,
                              "reason",
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border px-3 py-3"
                        >
                          {REASONS.map((reason) => (
                            <option key={reason.value} value={reason.value}>
                              {reason.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`quantity-${index}`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Return quantity
                        </label>
                        <input
                          id={`quantity-${index}`}
                          type="number"
                          min={1}
                          max={item.quantity}
                          step={1}
                          value={form.quantity}
                          onChange={(event) =>
                            updateProductForm(
                              item.productId,
                              "quantity",
                              Number(event.target.value)
                            )
                          }
                          className="w-full rounded-lg border px-3 py-3"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`description-${index}`}
                          className="mb-1 block text-sm font-medium"
                        >
                          Additional details (optional)
                        </label>
                        <textarea
                          id={`description-${index}`}
                          maxLength={1000}
                          rows={3}
                          value={form.description}
                          onChange={(event) =>
                            updateProductForm(
                              item.productId,
                              "description",
                              event.target.value
                            )
                          }
                          placeholder="Describe the issue..."
                          className="w-full rounded-lg border px-3 py-3"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={!canSubmit || submittingProduct !== ""}
                        onClick={() => void submitReturn(item.productId)}
                        className="w-full rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {submittingProduct === item.productId
                          ? "Submitting..."
                          : "Request Return"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <p className="mt-8 text-sm text-gray-500">
          Return eligibility and final refund approval are subject to
          ANJIVO&apos;s applicable return policy.
        </p>
      </div>
    </main>
  );
}
