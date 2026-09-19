"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
} from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

import {
  createSellerSettlement,
  previewSellerSettlement,
  type SettlementPreview,
} from "@/lib/admin-settlement";

type Seller = {
  id: string;
  businessName: string;
  ownerName: string;
};

type DeliveredOrder = {
  id: string;
  createdAt?: unknown;
  totalAmount: number;
};

function money(value: number) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatDate(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (
      value as {
        seconds?: unknown;
      }
    ).seconds === "number"
  ) {
    const date = new Date(
      (
        value as {
          seconds: number;
        }
      ).seconds * 1000
    );

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ).format(date);
  }

  return "—";
}

export default function AdminSettlementsPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [orders, setOrders] =
    useState<DeliveredOrder[]>([]);

  const [sellers, setSellers] =
    useState<Seller[]>([]);

  const [selectedOrder, setSelectedOrder] =
    useState("");

  const [selectedSeller, setSelectedSeller] =
    useState("");

  const [preview, setPreview] =
    useState<SettlementPreview | null>(
      null
    );

  const [loadingPreview, setLoadingPreview] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/admin/settlements"
            );
            return;
          }

          try {
            setLoading(true);
            setError("");

            /*
             * Admin verification
             */

            const usersSnapshot =
              await getDocs(
                collection(
                  db,
                  "users"
                )
              );

            const currentUser =
              usersSnapshot.docs.find(
                (item) =>
                  item.id ===
                  user.uid
              );

            if (
              !currentUser ||
              currentUser.data()
                .role !== "ADMIN"
            ) {
              setError(
                "Admin access required."
              );

              setLoading(false);
              return;
            }

            /*
             * Sellers
             */

            const sellersSnapshot =
              await getDocs(
                collection(
                  db,
                  "sellers"
                )
              );

            setSellers(
              sellersSnapshot.docs.map(
                (item) => {
                  const data =
                    item.data();

                  return {
                    id: item.id,

                    businessName:
                      String(
                        data.businessName ??
                          "Seller"
                      ),

                    ownerName:
                      String(
                        data.ownerName ??
                          ""
                      ),
                  };
                }
              )
            );

            /*
             * Orders
             */

            const ordersSnapshot =
              await getDocs(
                collection(
                  db,
                  "orders"
                )
              );

            const delivered =
              ordersSnapshot.docs
                .filter(
                  (item) =>
                    String(
                      item.data()
                        .status ??
                        ""
                    ).toLowerCase() ===
                    "delivered"
                )
                .map(
                  (item) => {
                    const data =
                      item.data();

                    return {
                      id: item.id,

                      createdAt:
                        data.createdAt,

                      totalAmount:
                        Number(
                          data.totalAmount ??
                            0
                        ),
                    };
                  }
                );

            setOrders(
              delivered
            );
          } catch (err) {
            console.error(
              "Settlement page error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "Unable to load settlement data."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  async function generatePreview() {
    if (!selectedOrder) {
      setError(
        "Select an order first."
      );
      return;
    }

    if (!selectedSeller) {
      setError(
        "Select a seller first."
      );
      return;
    }

    try {
      setLoadingPreview(
        true
      );

      setError("");
      setSuccess("");
      setPreview(null);

      const result =
        await previewSellerSettlement(
          selectedOrder,
          selectedSeller
        );

      setPreview(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to calculate settlement."
      );
    } finally {
      setLoadingPreview(
        false
      );
    }
  }

  async function createSettlement() {
    if (!selectedOrder) {
      setError(
        "Select an order first."
      );
      return;
    }

    if (!selectedSeller) {
      setError(
        "Select a seller first."
      );
      return;
    }

    try {
      setCreating(true);

      setError("");
      setSuccess("");

      const payoutId =
        await createSellerSettlement(
          selectedOrder,
          selectedSeller
        );

      setSuccess(
        `Settlement created successfully. Payout ID: ${payoutId}`
      );

      setPreview(null);

      setSelectedOrder("");
      setSelectedSeller("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create settlement."
      );
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-6xl px-4 py-10">

          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">

            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading settlements...
            </p>

          </div>

        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">

        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              ANJIVO Admin
            </p>

            <h1 className="mt-2 text-3xl font-black">
              Seller Settlements
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Generate seller payout records from delivered orders.
            </p>

          </div>

          <Link
            href="/admin/payouts"
            className="w-fit rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold"
          >
            View Payouts →
          </Link>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">

            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>

          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">

            <p className="text-sm font-semibold text-green-700">
              ✓ {success}
            </p>

          </div>
        )}

        {/* SETTLEMENT FORM */}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Create Settlement
          </p>

          <h2 className="mt-1 text-xl font-black">
            Order → Seller Payout
          </h2>

          <p className="mt-2 text-xs leading-5 text-gray-500">
            Only delivered orders can be converted into seller
            settlement records.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">

            {/* ORDER */}

            <div>

              <label className="text-xs font-bold text-gray-700">
                Delivered Order
              </label>

              <select
                value={
                  selectedOrder
                }
                onChange={(event) => {
                  setSelectedOrder(
                    event.target.value
                  );

                  setPreview(
                    null
                  );
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
              >

                <option value="">
                  Select delivered order
                </option>

                {orders.map(
                  (order) => (
                    <option
                      key={
                        order.id
                      }
                      value={
                        order.id
                      }
                    >
                      #{order.id.slice(
                        0,
                        10
                      )} —{" "}
                      {money(
                        order.totalAmount
                      )} —{" "}
                      {formatDate(
                        order.createdAt
                      )}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* SELLER */}

            <div>

              <label className="text-xs font-bold text-gray-700">
                Seller
              </label>

              <select
                value={
                  selectedSeller
                }
                onChange={(event) => {
                  setSelectedSeller(
                    event.target.value
                  );

                  setPreview(
                    null
                  );
                }}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
              >

                <option value="">
                  Select seller
                </option>

                {sellers.map(
                  (seller) => (
                    <option
                      key={
                        seller.id
                      }
                      value={
                        seller.id
                      }
                    >
                      {
                        seller.businessName
                      }{" "}
                      —{" "}
                      {
                        seller.ownerName
                      }
                    </option>
                  )
                )}

              </select>

            </div>

          </div>

          <button
            onClick={
              generatePreview
            }
            disabled={
              loadingPreview
            }
            className="mt-6 rounded-xl bg-black px-6 py-3 text-xs font-bold text-white disabled:opacity-50"
          >
            {loadingPreview
              ? "Calculating..."
              : "Calculate Settlement"}
          </button>

        </section>

        {/* PREVIEW */}

        {preview && (
          <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Settlement Preview
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Order #
                  {preview.orderId.slice(
                    0,
                    10
                  )}
                </h2>

              </div>

              <div className="rounded-xl bg-green-100 px-4 py-2 text-xs font-bold text-green-700">
                Ready for Payout
              </div>

            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <AmountBox
                title="Seller Gross"
                value={money(
                  preview.grossAmount
                )}
              />

              <AmountBox
                title={`Commission (${preview.commissionRate}%)`}
                value={`- ${money(
                  preview.commissionAmount
                )}`}
              />

              <AmountBox
                title="Shipping / Charges"
                value={`- ${money(
                  preview.shippingCharge +
                    preview.otherCharges
                )}`}
              />

              <AmountBox
                title="Seller Net"
                value={money(
                  preview.netAmount
                )}
                highlight
              />

            </div>

            <div className="mt-6 rounded-2xl bg-gray-50 p-5">

              <div className="grid gap-4 sm:grid-cols-3">

                <div>

                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    Seller
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {preview.sellerId}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    Items
                  </p>

                  <p className="mt-1 text-sm font-black">
                    {preview.itemCount}
                  </p>

                </div>

                <div>

                  <p className="text-[10px] font-bold uppercase text-gray-400">
                    Status
                  </p>

                  <p className="mt-1 text-sm font-black">
                    Pending
                  </p>

                </div>

              </div>

            </div>

            <button
              onClick={
                createSettlement
              }
              disabled={
                creating
              }
              className="mt-6 w-full rounded-xl bg-black px-6 py-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {creating
                ? "Creating Settlement..."
                : "Create Seller Payout"}
            </button>

          </section>
        )}

        {/* INFO */}

        <section className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">

          <p className="text-xs font-black text-yellow-800">
            Settlement Rule
          </p>

          <p className="mt-2 text-xs leading-5 text-yellow-700">
            A payout is created only for a delivered order.
            The system checks whether a payout already exists
            for the same seller and order to prevent duplicate
            settlement records.
          </p>

        </section>

      </main>

      <Footer />

    </div>
  );
}

function AmountBox({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        highlight
          ? "bg-black text-white"
          : "bg-gray-50"
      }`}
    >

      <p
        className={`text-[10px] font-bold uppercase tracking-wider ${
          highlight
            ? "text-gray-400"
            : "text-gray-400"
        }`}
      >
        {title}
      </p>

      <p className="mt-3 text-xl font-black">
        {value}
      </p>

    </div>
  );
}
