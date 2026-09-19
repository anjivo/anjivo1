"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

type PayoutStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

type Payout = {
  id: string;
  sellerId: string;
  orderId?: string;
  grossAmount: number;
  commissionAmount: number;
  shippingCharge: number;
  otherCharges: number;
  netAmount: number;
  status: PayoutStatus;
  createdAt?: unknown;
  paidAt?: unknown;
  reference?: string;
};

function getTime(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (
      (value as { seconds: number }).seconds *
      1000
    );
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function formatDate(value: unknown) {
  const time = getTime(value);

  if (!time) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(time));
}

function currency(value: number) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function statusClass(
  status: PayoutStatus
) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";

    case "processing":
      return "bg-blue-100 text-blue-700";

    case "failed":
      return "bg-red-100 text-red-700";

    case "cancelled":
      return "bg-gray-200 text-gray-700";

    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

export default function SellerPayoutsPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [sellerId, setSellerId] =
    useState("");

  const [error, setError] =
    useState("");

  const [payouts, setPayouts] =
    useState<Payout[]>([]);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/seller/payouts"
            );
            return;
          }

          try {
            setLoading(true);
            setError("");
            setSellerId(user.uid);

            /*
             * Verify seller account
             */

            const userSnapshot =
              await getDocs(
                query(
                  collection(
                    db,
                    "users"
                  ),
                  where(
                    "__name__",
                    "==",
                    user.uid
                  )
                )
              );

            if (
              userSnapshot.empty
            ) {
              setError(
                "Seller account not found."
              );
              return;
            }

            const userData =
              userSnapshot.docs[0].data();

            if (
              userData.role !==
              "SELLER"
            ) {
              setError(
                "Seller access is required."
              );
              return;
            }

            /*
             * Load seller payouts
             */

            const payoutQuery =
              query(
                collection(
                  db,
                  "sellerPayouts"
                ),
                where(
                  "sellerId",
                  "==",
                  user.uid
                )
              );

            const snapshot =
              await getDocs(
                payoutQuery
              );

            const rows: Payout[] =
              snapshot.docs.map(
                (item) => {
                  const data =
                    item.data();

                  return {
                    id: item.id,

                    sellerId:
                      String(
                        data.sellerId ??
                          user.uid
                      ),

                    orderId:
                      typeof data.orderId ===
                      "string"
                        ? data.orderId
                        : undefined,

                    grossAmount:
                      Number(
                        data.grossAmount ??
                          0
                      ),

                    commissionAmount:
                      Number(
                        data.commissionAmount ??
                          0
                      ),

                    shippingCharge:
                      Number(
                        data.shippingCharge ??
                          0
                      ),

                    otherCharges:
                      Number(
                        data.otherCharges ??
                          0
                      ),

                    netAmount:
                      Number(
                        data.netAmount ??
                          0
                      ),

                    status:
                      data.status ===
                        "processing" ||
                      data.status ===
                        "paid" ||
                      data.status ===
                        "failed" ||
                      data.status ===
                        "cancelled"
                        ? data.status
                        : "pending",

                    createdAt:
                      data.createdAt,

                    paidAt:
                      data.paidAt,

                    reference:
                      typeof data.reference ===
                      "string"
                        ? data.reference
                        : undefined,
                  };
                }
              );

            rows.sort(
              (a, b) =>
                getTime(
                  b.createdAt
                ) -
                getTime(
                  a.createdAt
                )
            );

            setPayouts(rows);
          } catch (err) {
            console.error(
              "Seller payout error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "Unable to load payouts."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  const summary = useMemo(() => {
    return {
      totalGross:
        payouts.reduce(
          (sum, item) =>
            sum + item.grossAmount,
          0
        ),

      totalCommission:
        payouts.reduce(
          (sum, item) =>
            sum +
            item.commissionAmount,
          0
        ),

      totalShipping:
        payouts.reduce(
          (sum, item) =>
            sum +
            item.shippingCharge,
          0
        ),

      totalNet:
        payouts.reduce(
          (sum, item) =>
            sum + item.netAmount,
          0
        ),

      pending:
        payouts
          .filter(
            (item) =>
              item.status ===
                "pending" ||
              item.status ===
                "processing"
          )
          .reduce(
            (sum, item) =>
              sum + item.netAmount,
            0
          ),

      paid:
        payouts
          .filter(
            (item) =>
              item.status === "paid"
          )
          .reduce(
            (sum, item) =>
              sum + item.netAmount,
            0
          ),
    };
  }, [payouts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">

            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-500">
              Loading payout information...
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

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <Link
              href="/seller"
              className="text-xs font-bold text-gray-400 hover:text-black"
            >
              ← Seller Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-black">
              Payouts
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Track your sales settlement, ANJIVO
              commission and payout history.
            </p>

          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">

            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Seller ID
            </p>

            <p className="mt-1 font-mono text-xs font-bold">
              {sellerId.slice(0, 12)}
              ...
            </p>

          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* =================================================
            SUMMARY
        ================================================= */}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <SummaryCard
            title="Gross Sales"
            value={currency(
              summary.totalGross
            )}
            icon="₹"
          />

          <SummaryCard
            title="ANJIVO Commission"
            value={currency(
              summary.totalCommission
            )}
            icon="%"
          />

          <SummaryCard
            title="Pending Payout"
            value={currency(
              summary.pending
            )}
            icon="⏳"
          />

          <SummaryCard
            title="Paid Payout"
            value={currency(
              summary.paid
            )}
            icon="✓"
          />

        </section>

        {/* =================================================
            SETTLEMENT EXPLANATION
        ================================================= */}

        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <h2 className="text-lg font-black">
            Settlement Summary
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            This shows how a seller order value is converted
            into the net payout amount.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-5">

            <FlowBox
              title="Gross Sales"
              value={currency(
                summary.totalGross
              )}
            />

            <FlowArrow />

            <FlowBox
              title="Commission"
              value={`- ${currency(
                summary.totalCommission
              )}`}
            />

            <FlowArrow />

            <FlowBox
              title="Net Payout"
              value={currency(
                summary.totalNet
              )}
            />

          </div>

          {summary.totalShipping > 0 && (
            <div className="mt-5 rounded-2xl bg-gray-50 p-4">

              <div className="flex items-center justify-between">

                <span className="text-xs font-semibold text-gray-500">
                  Shipping / Other adjustments
                </span>

                <span className="text-sm font-black">
                  {currency(
                    summary.totalShipping
                  )}
                </span>

              </div>

            </div>
          )}

        </section>

        {/* =================================================
            PAYOUT TABLE
        ================================================= */}

        <section className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          <div className="border-b border-gray-100 p-5 sm:p-7">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="text-lg font-black">
                  Payout History
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Order-wise settlement records
                </p>

              </div>

              <div className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold">
                {payouts.length} Records
              </div>

            </div>

          </div>

          {payouts.length === 0 ? (
            <div className="p-12 text-center">

              <div className="text-5xl">
                💰
              </div>

              <h3 className="mt-4 text-lg font-black">
                No payouts yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-gray-500">
                Once your products start generating completed
                orders and settlement records are created,
                your payout history will appear here.
              </p>

              <Link
                href="/seller/products"
                className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
              >
                Manage Products
              </Link>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px]">

                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">

                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Order
                    </th>

                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Date
                    </th>

                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Gross
                    </th>

                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Commission
                    </th>

                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Net
                    </th>

                    <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {payouts.map(
                    (payout) => (
                      <tr
                        key={payout.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >

                        <td className="px-5 py-5">

                          <p className="text-xs font-black">
                            {payout.orderId
                              ? `#${payout.orderId.slice(
                                  0,
                                  10
                                )}`
                              : `#${payout.id.slice(
                                  0,
                                  10
                                )}`}
                          </p>

                          {payout.reference && (
                            <p className="mt-1 text-[10px] text-gray-400">
                              {payout.reference}
                            </p>
                          )}

                        </td>

                        <td className="px-5 py-5 text-xs text-gray-500">
                          {formatDate(
                            payout.createdAt
                          )}
                        </td>

                        <td className="px-5 py-5 text-right text-xs font-bold">
                          {currency(
                            payout.grossAmount
                          )}
                        </td>

                        <td className="px-5 py-5 text-right text-xs font-bold text-red-600">
                          -{" "}
                          {currency(
                            payout.commissionAmount
                          )}
                        </td>

                        <td className="px-5 py-5 text-right text-sm font-black">
                          {currency(
                            payout.netAmount
                          )}
                        </td>

                        <td className="px-5 py-5 text-center">

                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold capitalize ${statusClass(
                              payout.status
                            )}`}
                          >
                            {payout.status}
                          </span>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* =================================================
            IMPORTANT NOTE
        ================================================= */}

        <section className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">

          <p className="text-xs font-black text-yellow-800">
            Settlement Note
          </p>

          <p className="mt-2 text-xs leading-5 text-yellow-700">
            Payout records are generated by the ANJIVO
            settlement system. Sellers cannot manually change
            commission, payout amount or payout status.
          </p>

        </section>

      </main>

      <Footer />

    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-xs font-bold text-gray-400">
            {title}
          </p>

          <p className="mt-3 text-2xl font-black">
            {value}
          </p>

        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-lg font-black">
          {icon}
        </div>

      </div>

    </div>
  );
}

/* =========================================================
   FLOW BOX
========================================================= */

function FlowBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">

      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </p>

      <p className="mt-2 text-lg font-black">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   FLOW ARROW
========================================================= */

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center md:flex">

      <span className="text-xl text-gray-300">
        →
      </span>

    </div>
  );
}
