"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth } from "@/lib/firebase";

import {
  getOrderById,
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
   STATUS CLASS
========================================================= */

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

  /* =======================================================
     AUTH + ORDER
  ======================================================= */

  useEffect(() => {
    if (!orderId) {
      setError(
        "Invalid order ID."
      );

      setLoading(false);

      return;
    }

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
            setLoading(true);
            setError("");

            const result =
              await getOrderById(
                orderId,
                user.uid
              );

            if (!result) {
              setError(
                "Order not found."
              );

              return;
            }

            setOrder(result);
          } catch (err) {
            console.error(
              "Order loading error:",
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

    return () => {
      unsubscribe();
    };
  }, [
    orderId,
    router,
  ]);

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

                      <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                        {
                          item.pricingType
                        }
                      </p>

                      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
                        <span className="text-gray-500">
                          Qty:{" "}
                          {
                            item.quantity
                          }
                        </span>

                        <span className="font-black text-gray-900">
                          ₹
                          {(
                            item.selectedPrice *
                            item.quantity
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </span>
                      </div>

                      <p className="mt-1 text-[10px] text-gray-400">
                        ₹
                        {item.selectedPrice.toLocaleString(
                          "en-IN"
                        )}{" "}
                        / unit
                      </p>
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
                      order.status ===
                      "cancelled"
                        ? "bg-red-500"
                        : order.status ===
                            "delivered"
                          ? "bg-green-500"
                          : "bg-black"
                    }`}
                  >
                    {order.status ===
                    "cancelled"
                      ? "×"
                      : order.status ===
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
      </main>

      <Footer />
    </div>
  );
}
