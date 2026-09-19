"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth } from "@/lib/firebase";

import {
  getUserOrders,
  type Order,
} from "@/lib/orders";

/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(value: unknown): string {
  if (!value) {
    return "Recently";
  }

  try {
    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value
    ) {
      const timestamp = value as {
        toDate: () => Date;
      };

      return timestamp
        .toDate()
        .toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
    }

    return new Date(String(value)).toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "Recently";
  }
}

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

export default function MyOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =======================================================
     AUTH + ORDERS
  ======================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace(
            "/login?redirect=/account/orders"
          );

          return;
        }

        try {
          setLoading(true);
          setError("");

          const result = await getUserOrders(
            user.uid
          );

          setOrders(result);
        } catch (err) {
          console.error(
            "Orders loading error:",
            err
          );

          setError(
            "Unable to load your orders."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [router]);

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
              Loading orders...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">

        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            My Account
          </p>

          <h1 className="mt-2 text-3xl font-black">
            My Orders
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Track and manage your ANJIVO orders.
          </p>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* =================================================
            EMPTY ORDERS
        ================================================= */}

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">

            <div className="text-5xl">
              📦
            </div>

            <h2 className="mt-4 text-xl font-black">
              No orders yet
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Your orders will appear here after you place an order.
            </p>

            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
            >
              Start Shopping
            </Link>

          </div>
        ) : (

          /* =================================================
             ORDER LIST
          ================================================= */

          <div className="space-y-4">

            {orders.map((order) => {
              const firstItem = order.items?.[0];

              /*
               * Order uses "id", not "orderId".
               */
              const orderId = order.id;

              /*
               * Calculate total quantity from order items.
               * Order type does not contain totalQuantity.
               */
              const totalQuantity =
                order.items?.reduce(
                  (total, item) =>
                    total + item.quantity,
                  0
                ) ?? 0;

              return (
                <Link
                  key={orderId}
                  href={`/account/orders/${orderId}`}
                  className="block rounded-3xl border border-gray-200 bg-white p-4 transition hover:border-black hover:shadow-sm sm:p-5"
                >

                  {/* =======================================
                      ORDER HEADER
                  ======================================= */}

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Order ID
                      </p>

                      <p className="mt-1 text-sm font-black">
                        #
                        {orderId.slice(
                          0,
                          12
                        )}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${statusClass(
                        order.status
                      )}`}
                    >
                      {statusLabel(
                        order.status
                      )}
                    </span>

                  </div>

                  {/* =======================================
                      DIVIDER
                  ======================================= */}

                  <div className="my-4 border-t border-gray-100" />

                  {/* =======================================
                      ORDER CONTENT
                  ======================================= */}

                  <div className="flex gap-4">

                    {/* IMAGE */}

                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">

                      {firstItem?.image ? (
                        <img
                          src={firstItem.image}
                          alt={
                            firstItem.name
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">
                          📦
                        </span>
                      )}

                    </div>

                    {/* ORDER INFO */}

                    <div className="min-w-0 flex-1">

                      <h2 className="truncate text-sm font-black text-gray-900">
                        {firstItem?.name ||
                          "Order Items"}
                      </h2>

                      {/* MORE ITEMS */}

                      {order.items.length > 1 && (
                        <p className="mt-1 text-xs text-gray-400">
                          +{" "}
                          {order.items.length - 1}{" "}
                          more item
                          {order.items.length - 1 >
                          1
                            ? "s"
                            : ""}
                        </p>
                      )}

                      {/* QUANTITY + DATE */}

                      <p className="mt-2 text-xs text-gray-500">
                        {totalQuantity}{" "}
                        unit
                        {totalQuantity > 1
                          ? "s"
                          : ""}{" "}
                        •{" "}
                        {formatDate(
                          order.createdAt
                        )}
                      </p>

                      {/* TOTAL */}

                      <p className="mt-2 text-base font-black text-gray-900">
                        ₹
                        {order.totalAmount.toLocaleString(
                          "en-IN"
                        )}
                      </p>

                    </div>

                    {/* ARROW */}

                    <div className="hidden items-center sm:flex">
                      <span className="text-lg text-gray-400">
                        →
                      </span>
                    </div>

                  </div>

                </Link>
              );
            })}

          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
