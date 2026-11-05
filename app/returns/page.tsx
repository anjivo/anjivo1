
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  returnDeadlineAt?: string | null;
  refundAmount?: number;
  quantity?: number;
};

type ReturnForm = {
  reason: string;
  quantity: number;
  description: string;
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

const RETURN_WINDOW_MS = 72 * 60 * 60 * 1000;

function getDateMillis(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? value.getTime()
      : null;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();

    return Number.isFinite(date.getTime())
      ? date.getTime()
      : null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const millis = new Date(value).getTime();

    return Number.isFinite(millis) ? millis : null;
  }

  return null;
}

function labelStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isDelivered(order: Order) {
  const statuses = [
    (order as any).status,
    (order as any).fulfillmentStatus,
    (order as any).orderStatus,
  ].map((value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[ -]+/g, "_")
  );

  return statuses.some((value) =>
    ["delivered", "complete", "completed"].includes(value)
  );
}

function getDeliveredAt(order: Order): number | null {
  const extendedOrder = order as Order & {
    deliveredAt?: unknown;
    sellerFulfillment?: Record<
      string,
      { deliveredAt?: unknown }
    >;
  };

  const direct = getDateMillis(extendedOrder.deliveredAt);

  if (direct !== null) return direct;

  const sellerDeliveryTimes = Object.values(
    extendedOrder.sellerFulfillment ?? {}
  )
    .map((entry) => getDateMillis(entry.deliveredAt))
    .filter((value): value is number => value !== null);

  return sellerDeliveryTimes.length
    ? Math.max(...sellerDeliveryTimes)
    : null;
}

export default function ReturnsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  const [requests, setRequests] = useState<ReturnRequest[]>([]);

  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, ReturnForm>
  >({});

  const [loadingOrder, setLoadingOrder] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryOrderId = params.get("orderId");

    if (queryOrderId?.trim()) {
      setOrderId(queryOrderId.trim());
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || "");
      setAuthLoading(false);
    });

    return unsubscribe;
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
      const foundOrder = await getOrderById(
        cleanOrderId,
        user.uid
      );

      if (!foundOrder) {
        throw new Error(
          "Order nahi mila ya yeh aapke account ka nahi hai."
        );
      }

      setOrder(foundOrder);

      const token = await user.getIdToken();

      const response = await fetch(
        `/api/returns?orderId=${encodeURIComponent(cleanOrderId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Return history load nahi hui."
        );
      }

      setRequests(
        Array.isArray(result.returns) ? result.returns : []
      );

      const initial: Record<string, ReturnForm> = {};

      for (const item of foundOrder.items || []) {
        if (!item.productId) continue;

        initial[item.productId] = {
          reason: "other",
          quantity: 1,
          description: "",
        };
      }

      setSelectedProducts(initial);
    } catch (err) {
      setOrder(null);
      setRequests([]);

      setError(
        err instanceof Error
          ? err.message
          : "Order load nahi ho paya."
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

    const item = order.items.find(
      (orderItem) => orderItem.productId === productId
    );

    if (!item || form.quantity > item.quantity) {
      setError(
        "Return quantity purchased quantity se zyada nahi ho sakti."
      );
      return;
    }

    if (!isDelivered(order)) {
      setError(
        "Return request sirf delivered order ke liye submit ho sakti hai."
      );
      return;
    }

    const deliveredAt = getDeliveredAt(order);

    if (deliveredAt === null || Date.now() > deliveredAt + RETURN_WINDOW_MS) {
      setError(
        deliveredAt === null
          ? "Delivery timestamp verify nahi ho pa raha. Please ANJIVO support se contact karein."
          : "Return request delivery ke 72 hours ke andar submit karni hogi."
      );
      return;
    }

    const alreadyRequested = requests
      .filter((request) => request.productId === productId)
      .filter((request) =>
        !["rejected", "cancelled"].includes(
          request.returnStatus.toLowerCase()
        )
      )
      .reduce(
        (total, request) => total + Number(request.quantity || 0),
        0
      );

    if (alreadyRequested + form.quantity > item.quantity) {
      setError(
        `Is product ki sirf ${Math.max(
          0,
          item.quantity - alreadyRequested
        )} quantity return ke liye available hai.`
      );
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
        throw new Error(
          result.error || "Return request submit nahi hui."
        );
      }

      setNotice(
        "Return request successfully submit ho gayi."
      );

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
    field: keyof ReturnForm,
    value: string | number
  ) {
    setSelectedProducts((current) => ({
      ...current,
      [productId]: {
        reason: current[productId]?.reason || "other",
        quantity: current[productId]?.quantity ?? 1,
        description: current[productId]?.description || "",
        [field]: value,
      },
    }));
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-center text-gray-600">
          Loading account...
        </p>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <section className="rounded-2xl border bg-white p-6 text-center">
          <h1 className="text-2xl font-bold">
            Returns &amp; Refunds
          </h1>

          <p className="mt-3 text-gray-600">
            Return request ke liye pehle login karein.
          </p>

          <button
            type="button"
            onClick={() => router.push("/login?redirect=/returns")}
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
            Returns &amp; Refunds
          </h1>

          <p className="mt-2 text-gray-600">
            Delivered order select karein aur eligible product ke
            liye return request submit karein.
          </p>

          <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            ANJIVO Return Policy: Delivery ke 72 hours ke andar
            return request submit karna zaroori hai.
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
            autoComplete="off"
            required
            className="min-w-0 flex-1 rounded-lg border px-4 py-3"
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

              <p className="mt-1 break-all font-semibold">
                {order.id}
              </p>

              <p className="mt-3 text-sm text-gray-500">
                Order status
              </p>

              <p className="mt-1 font-semibold">
                {labelStatus(
                  (order as any).fulfillmentStatus ||
                    order.status
                )}
              </p>
            </div>

            <h2 className="text-xl font-bold">
              Order Items
            </h2>

            {(order.items || []).map((item, index) => {
              const productId = item.productId;

              const productRequests = requests.filter(
                (request) => request.productId === productId
              );

              const form = selectedProducts[productId] || {
                reason: "other",
                quantity: 1,
                description: "",
              };

              const deliveredAt = getDeliveredAt(order);

              const eligible =
                isDelivered(order) &&
                deliveredAt !== null &&
                Date.now() <= deliveredAt + RETURN_WINDOW_MS;

              const requestedQuantity = productRequests
                .filter(
                  (request) =>
                    !["rejected", "cancelled"].includes(
                      request.returnStatus.toLowerCase()
                    )
                )
                .reduce(
                  (total, request) =>
                    total + Number(request.quantity || 0),
                  0
                );

              const remainingQuantity = Math.max(
                0,
                item.quantity - requestedQuantity
              );

              return (
                <article
                  key={`${productId}-${index}`}
                  className="rounded-2xl border bg-white p-5"
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {item.name}
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Purchased: {item.quantity}
                      </p>
                    </div>

                    <p className="font-semibold">
                      ₹
                      {Number(
                        item.subtotal || 0
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>

                  {productRequests.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {productRequests.map((request) => (
                        <div
                          key={request.id}
                          className="rounded-lg border bg-gray-50 p-4"
                        >
                          <p className="font-semibold">
                            Return:{" "}
                            {labelStatus(request.returnStatus)}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            Refund:{" "}
                            {labelStatus(request.refundStatus)}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            Quantity: {request.quantity || 0}
                          </p>

                          {request.refundAmount ? (
                            <p className="mt-1 text-sm font-semibold">
                              Refund amount: ₹
                              {request.refundAmount.toLocaleString("en-IN")}
                            </p>
                          ) : null}

                          <p className="mt-2 break-all text-xs text-gray-500">
                            Request ID: {request.id}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {remainingQuantity > 0 ? (
                    <div className="mt-5 space-y-4 border-t pt-5">
                      {!eligible ? (
                        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                          {!isDelivered(order)
                            ? "Return request sirf delivered order ke liye available hai."
                            : deliveredAt === null
                              ? "Delivery timestamp verify nahi ho pa raha. Support se contact karein."
                              : "72-hour return window expire ho chuki hai."}
                        </p>
                      ) : (
                        <>
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
                                  productId,
                                  "reason",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border px-3 py-3"
                            >
                              {REASONS.map((reason) => (
                                <option
                                  key={reason.value}
                                  value={reason.value}
                                >
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
                              max={remainingQuantity}
                              step={1}
                              value={form.quantity}
                              onChange={(event) =>
                                updateProductForm(
                                  productId,
                                  "quantity",
                                  event.target.value === ""
                                    ? 0
                                    : Number(event.target.value)
                                )
                              }
                              className="w-full rounded-lg border px-3 py-3"
                            />

                            <p className="mt-1 text-xs text-gray-500">
                              Eligible quantity: {remainingQuantity}
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor={`description-${index}`}
                              className="mb-1 block text-sm font-medium"
                            >
                              Additional details
                            </label>

                            <textarea
                              id={`description-${index}`}
                              maxLength={1000}
                              rows={3}
                              value={form.description}
                              onChange={(event) =>
                                updateProductForm(
                                  productId,
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
                            disabled={
                              submittingProduct !== "" ||
                              loadingOrder ||
                              form.quantity < 1 ||
                              form.quantity > remainingQuantity
                            }
                            onClick={() =>
                              void submitReturn(productId)
                            }
                            className="w-full rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          >
                            {submittingProduct === productId
                              ? "Submitting..."
                              : "Request Return"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                      Is product ki saari eligible quantity ke liye
                      return request submit ho chuki hai.
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <p className="mt-8 text-sm text-gray-500">
          Return eligibility, product inspection aur final refund
          approval ANJIVO Return Policy ke anusaar honge.
        </p>
      </div>
    </main>
  );
}
