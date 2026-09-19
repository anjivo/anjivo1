"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "@/lib/firebase";

export default function OrderSuccessPage() {
  const params = useParams();

  const orderId =
    typeof params.orderId === "string"
      ? params.orderId
      : "";

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] =
    useState(false);

  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user || !orderId) {
          setLoading(false);
          return;
        }

        try {
          const orderSnap = await getDoc(
            doc(db, "orders", orderId)
          );

          if (!orderSnap.exists()) {
            setLoading(false);
            return;
          }

          const data = orderSnap.data();

          if (data.userId !== user.uid) {
            setLoading(false);
            return;
          }

          setOrder({
            id: orderSnap.id,
            ...data,
          });

          setAuthorized(true);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-20">
          <div className="rounded-3xl border bg-white p-10 text-center">
            Loading order...
          </div>
        </div>
      </main>
    );
  }

  if (!authorized || !order) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-20">
          <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">⚠️</div>

            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Order Not Found
            </h1>

            <p className="mt-2 text-slate-500">
              We could not find this order.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white"
            >
              Go Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b bg-slate-900 px-6 py-10 text-center text-white sm:px-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-4xl">
              ✓
            </div>

            <h1 className="mt-5 text-3xl font-black">
              Order Placed!
            </h1>

            <p className="mt-2 text-slate-300">
              Thank you for shopping with ANJIVO.
            </p>
          </div>

          <div className="p-6 sm:p-10">
            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Order ID
                  </p>

                  <p className="mt-1 break-all font-bold text-slate-900">
                    #{order.id}
                  </p>
                </div>

                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-700">
                  {order.status || "pending"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Info
                label="Payment"
                value="Cash on Delivery"
              />

              <Info
                label="Items"
                value={String(
                  Array.isArray(order.items)
                    ? order.items.reduce(
                        (
                          sum: number,
                          item: any
                        ) =>
                          sum +
                          Number(
                            item.quantity || 0
                          ),
                        0
                      )
                    : 0
                )}
              />

              <Info
                label="Total"
                value={`₹${Number(
                  order.totalAmount || 0
                ).toLocaleString("en-IN")}`}
              />
            </div>

            <div className="mt-8">
              <h2 className="font-bold text-slate-900">
                Delivery Address
              </h2>

              <div className="mt-3 rounded-2xl border p-4 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-900">
                  {order.shippingAddress?.fullName}
                </p>

                <p>
                  {order.shippingAddress?.addressLine1}
                </p>

                {order.shippingAddress
                  ?.addressLine2 && (
                  <p>
                    {
                      order.shippingAddress
                        .addressLine2
                    }
                  </p>
                )}

                <p>
                  {order.shippingAddress?.city},{" "}
                  {order.shippingAddress?.state}{" "}
                  -{" "}
                  {
                    order.shippingAddress
                      ?.pincode
                  }
                </p>

                <p className="mt-2 font-medium text-slate-900">
                  📞{" "}
                  {order.shippingAddress?.phone}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="font-bold text-slate-900">
                Order Items
              </h2>

              <div className="mt-3 space-y-3">
                {Array.isArray(order.items) &&
                  order.items.map(
                    (item: any, index: number) => (
                      <div
                        key={`${item.productId}-${index}`}
                        className="flex items-center gap-3 rounded-2xl border p-3"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              📦
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                            {item.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Qty: {item.quantity} •{" "}
                            {item.pricingType ===
                            "wholesale"
                              ? "Wholesale"
                              : "Retail"}
                          </p>
                        </div>

                        <p className="font-bold text-slate-900">
                          ₹
                          {Number(
                            item.subtotal || 0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>
                    )
                  )}
              </div>
            </div>

            <div className="mt-8 border-t pt-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Subtotal
                </span>

                <span className="font-semibold">
                  ₹
                  {Number(
                    order.subtotal || 0
                  ).toLocaleString("en-IN")}
                </span>
              </div>

              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-500">
                  Shipping
                </span>

                <span className="font-semibold text-emerald-600">
                  FREE
                </span>
              </div>

              <div className="mt-4 flex justify-between border-t pt-4">
                <span className="font-bold text-slate-900">
                  Total
                </span>

                <span className="text-2xl font-black text-slate-900">
                  ₹
                  {Number(
                    order.totalAmount || 0
                  ).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                href="/products"
                className="rounded-xl border px-5 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Continue Shopping
              </Link>

              <Link
                href="/"
                className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-1 font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}
