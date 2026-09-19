"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
} from "firebase/auth";
import {
  useParams,
  useRouter,
} from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth } from "@/lib/firebase";
import {
  getOrderById,
  type Order,
} from "@/lib/orders";

function statusLabel(
  status: Order["status"]
) {
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

    default:
      return "Pending";
  }
}

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

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              `/login?redirect=/account/orders/${orderId}`
            );
            return;
          }

          try {
            const result =
              await getOrderById(
                orderId
              );

            if (
              !result ||
              result.userId !== user.uid
            ) {
              setError(
                "Order not found."
              );
              return;
            }

            setOrder(result);
          } catch (err) {
            console.error(err);

            setError(
              "Unable to load order."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-5xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            ⏳ Loading order...
          </div>
        </main>

        <Footer />
      </div>
    );
  }

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
              {error || "Order not found"}
            </h1>

            <Link
              href="/account/orders"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              My Orders
            </Link>

          </div>

        </main>

        <Footer />
      </div>
    );
  }

  const address =
    order.shippingAddress;

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">

        <Link
          href="/account/orders"
          className="text-xs font-bold text-gray-500 hover:text-black"
        >
          ← Back to My Orders
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Order Details
            </p>

            <h1 className="mt-2 text-2xl font-black">
              #{order.orderId}
            </h1>
          </div>

          <span className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white">
            {statusLabel(
              order.status
            )}
          </span>

        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">

          {/* ITEMS */}
          <section className="rounded-3xl border border-gray-200 bg-white p-5">

            <h2 className="text-lg font-black">
              Order Items
            </h2>

            <div className="mt-5 space-y-3">

              {order.items.map(
                (item) => (
                  <div
                    key={`${item.productId}-${item.pricingType}`}
                    className="flex gap-3 rounded-2xl border border-gray-100 p-3"
                  >

                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">

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

                      <p className="text-sm font-black">
                        {item.name}
                      </p>

                      <p className="mt-1 text-[10px] uppercase text-gray-400">
                        {item.pricingType}
                      </p>

                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">

                        <span className="text-gray-500">
                          Qty:{" "}
                          {item.quantity}
                        </span>

                        <span className="font-black">
                          ₹
                          {(
                            item.selectedPrice *
                            item.quantity
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </span>

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>

          </section>

          {/* SUMMARY */}
          <div className="space-y-5">

            {/* STATUS */}
            <section className="rounded-3xl border border-gray-200 bg-white p-5">

              <h2 className="text-lg font-black">
                Order Status
              </h2>

              <div className="mt-5">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                    ✓
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
                    {order.paymentMethod}
                  </strong>
                  <br />
                  Payment status:{" "}
                  <strong className="text-gray-900">
                    {order.paymentStatus}
                  </strong>
                </div>

              </div>

            </section>

            {/* ADDRESS */}
            <section className="rounded-3xl border border-gray-200 bg-white p-5">

              <h2 className="text-lg font-black">
                Delivery Address
              </h2>

              <div className="mt-4 text-sm leading-6 text-gray-600">

                <p className="font-black text-gray-900">
                  {address.name}
                </p>

                <p>
                  {address.phone}
                </p>

                <p className="mt-2">
                  {address.addressLine1}
                </p>

                {address.addressLine2 && (
                  <p>
                    {address.addressLine2}
                  </p>
                )}

                <p>
                  {address.city},{" "}
                  {address.state} -{" "}
                  {address.pincode}
                </p>

              </div>

            </section>

            {/* PRICE */}
            <section className="rounded-3xl border border-gray-200 bg-white p-5">

              <h2 className="text-lg font-black">
                Price Details
              </h2>

              <div className="mt-4 space-y-3 text-sm">

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

                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Delivery
                  </span>

                  <span className="font-bold">
                    {order.shippingCharge ===
                    0
                      ? "FREE"
                      : `₹${order.shippingCharge}`}
                  </span>
                </div>

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

      </main>

      <Footer />

    </div>
  );
}
