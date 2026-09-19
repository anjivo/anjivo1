"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

import {
  getAllPayouts,
  getDefaultCommissionRate,
  updateDefaultCommissionRate,
  updatePayoutStatus,
  type AdminPayout,
} from "@/lib/admin-payouts";

type SellerInfo = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
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

function getTime(value: unknown) {
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
    return (
      (
        value as {
          seconds: number;
        }
      ).seconds * 1000
    );
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

function statusClass(
  status: AdminPayout["status"]
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

export default function AdminPayoutsPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [savingCommission, setSavingCommission] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [payouts, setPayouts] =
    useState<AdminPayout[]>([]);

  const [sellers, setSellers] =
    useState<SellerInfo[]>([]);

  const [commissionRate, setCommissionRate] =
    useState("5");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [updatingPayout, setUpdatingPayout] =
    useState<string | null>(null);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/admin/payouts"
            );
            return;
          }

          try {
            setLoading(true);
            setError("");

            const userDoc =
              await getDocs(
                collection(
                  db,
                  "users"
                )
              );

            const currentUser =
              userDoc.docs.find(
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

            const [
              payoutData,
              defaultRate,
              sellerSnapshot,
            ] = await Promise.all([
              getAllPayouts(),
              getDefaultCommissionRate(),
              getDocs(
                collection(
                  db,
                  "sellers"
                )
              ),
            ]);

            setPayouts(
              payoutData
            );

            setCommissionRate(
              String(
                defaultRate
              )
            );

            setSellers(
              sellerSnapshot.docs.map(
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

                    email:
                      String(
                        data.email ??
                          ""
                      ),
                  };
                }
              )
            );
          } catch (err) {
            console.error(
              "Admin payout page error:",
              err
            );

            setError(
              err instanceof Error
                ? err.message
                : "Unable to load payout management."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  const sellerMap = useMemo(
    () => {
      const map =
        new Map<
          string,
          SellerInfo
        >();

      sellers.forEach(
        (seller) => {
          map.set(
            seller.id,
            seller
          );
        }
      );

      return map;
    },
    [sellers]
  );

  const filteredPayouts =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return payouts.filter(
        (payout) => {
          const seller =
            sellerMap.get(
              payout.sellerId
            );

          const matchesStatus =
            statusFilter ===
              "all" ||
            payout.status ===
              statusFilter;

          const searchable = [
            payout.id,
            payout.orderId,
            payout.sellerId,
            seller?.businessName,
            seller?.ownerName,
            seller?.email,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !term ||
            searchable.includes(
              term
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      payouts,
      sellerMap,
      search,
      statusFilter,
    ]);

  const summary = useMemo(
    () => ({
      gross: payouts.reduce(
        (sum, item) =>
          sum + item.grossAmount,
        0
      ),

      commission:
        payouts.reduce(
          (sum, item) =>
            sum +
            item.commissionAmount,
          0
        ),

      net: payouts.reduce(
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
    }),
    [payouts]
  );

  async function saveCommission() {
    const rate =
      Number(
        commissionRate
      );

    if (
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      setError(
        "Commission must be between 0% and 100%."
      );
      return;
    }

    try {
      setSavingCommission(
        true
      );
      setError("");
      setSuccess("");

      await updateDefaultCommissionRate(
        rate
      );

      setSuccess(
        `Default commission rate updated to ${rate}%.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update commission."
      );
    } finally {
      setSavingCommission(
        false
      );
    }
  }

  async function changeStatus(
    payout: AdminPayout,
    status: AdminPayout["status"]
  ) {
    try {
      setUpdatingPayout(
        payout.id
      );

      setError("");
      setSuccess("");

      await updatePayoutStatus(
        payout.id,
        status
      );

      setPayouts(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              payout.id
                ? {
                    ...item,
                    status,
                  }
                : item
          )
      );

      setSuccess(
        `Payout #${payout.id.slice(
          0,
          8
        )} updated.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update payout."
      );
    } finally {
      setUpdatingPayout(
        null
      );
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">

          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">

            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading payout management...
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* HEADER */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              ANJIVO Admin
            </p>

            <h1 className="mt-2 text-3xl font-black">
              Commission & Payouts
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage marketplace commission and seller settlement records.
            </p>

          </div>

          <Link
            href="/admin"
            className="w-fit rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold"
          >
            ← Admin Dashboard
          </Link>

        </div>

        {/* MESSAGES */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">
              ✓ {success}
            </p>
          </div>
        )}

        {/* COMMISSION SETTINGS */}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div className="max-w-xl">

              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Marketplace Settings
              </p>

              <h2 className="mt-1 text-xl font-black">
                Default Commission
              </h2>

              <p className="mt-2 text-xs leading-5 text-gray-500">
                This rate is used when a seller does not have
                a separate commission configuration.
              </p>

            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <div className="relative">

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={
                    commissionRate
                  }
                  onChange={(event) =>
                    setCommissionRate(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm font-bold outline-none focus:border-black sm:w-32"
                />

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  %
                </span>

              </div>

              <button
                onClick={
                  saveCommission
                }
                disabled={
                  savingCommission
                }
                className="rounded-xl bg-black px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                {savingCommission
                  ? "Saving..."
                  : "Save Commission"}
              </button>

            </div>

          </div>

        </section>

        {/* SUMMARY */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <Summary
            title="Gross Sales"
            value={money(
              summary.gross
            )}
          />

          <Summary
            title="Commission"
            value={money(
              summary.commission
            )}
          />

          <Summary
            title="Net Seller Payable"
            value={money(
              summary.net
            )}
          />

          <Summary
            title="Pending"
            value={money(
              summary.pending
            )}
          />

          <Summary
            title="Paid"
            value={money(
              summary.paid
            )}
          />

        </section>

        {/* FILTERS */}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5">

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search seller, order ID, seller ID..."
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
            >
              <option value="all">
                All Status
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="processing">
                Processing
              </option>

              <option value="paid">
                Paid
              </option>

              <option value="failed">
                Failed
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>

          </div>

        </section>

        {/* PAYOUTS */}

        <section className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">

          <div className="border-b border-gray-100 p-5">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-lg font-black">
                  Seller Payout Records
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {filteredPayouts.length} records shown
                </p>

              </div>

            </div>

          </div>

          {filteredPayouts.length === 0 ? (
            <div className="p-12 text-center">

              <div className="text-5xl">
                💰
              </div>

              <h3 className="mt-4 text-lg font-black">
                No payout records
              </h3>

              <p className="mt-2 text-xs text-gray-500">
                Payout records will appear here after
                the settlement system creates them.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1100px]">

                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">

                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Seller
                    </th>

                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Order
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

                    <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredPayouts.map(
                    (payout) => {
                      const seller =
                        sellerMap.get(
                          payout.sellerId
                        );

                      return (
                        <tr
                          key={
                            payout.id
                          }
                          className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                        >

                          <td className="px-5 py-5">

                            <p className="text-xs font-black">
                              {seller?.businessName ??
                                "Unknown Seller"}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-400">
                              {seller?.ownerName ||
                                payout.sellerId.slice(
                                  0,
                                  12
                                )}
                            </p>

                          </td>

                          <td className="px-5 py-5">

                            <p className="text-xs font-bold">
                              {payout.orderId
                                ? `#${payout.orderId.slice(
                                    0,
                                    10
                                  )}`
                                : "—"}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-400">
                              {formatDate(
                                payout.createdAt
                              )}
                            </p>

                          </td>

                          <td className="px-5 py-5 text-right text-xs font-bold">
                            {money(
                              payout.grossAmount
                            )}
                          </td>

                          <td className="px-5 py-5 text-right">

                            <p className="text-xs font-bold text-red-600">
                              -{" "}
                              {money(
                                payout.commissionAmount
                              )}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-400">
                              {payout.commissionRate}%
                            </p>

                          </td>

                          <td className="px-5 py-5 text-right text-sm font-black">
                            {money(
                              payout.netAmount
                            )}
                          </td>

                          <td className="px-5 py-5 text-center">

                            <span
                              className={`rounded-full px-3 py-1.5 text-[10px] font-bold capitalize ${statusClass(
                                payout.status
                              )}`}
                            >
                              {payout.status}
                            </span>

                          </td>

                          <td className="px-5 py-5 text-center">

                            <select
                              value={
                                payout.status
                              }
                              disabled={
                                updatingPayout ===
                                payout.id
                              }
                              onChange={(
                                event
                              ) =>
                                changeStatus(
                                  payout,
                                  event
                                    .target
                                    .value as AdminPayout["status"]
                                )
                              }
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold outline-none disabled:opacity-50"
                            >

                              <option value="pending">
                                Pending
                              </option>

                              <option value="processing">
                                Processing
                              </option>

                              <option value="paid">
                                Paid
                              </option>

                              <option value="failed">
                                Failed
                              </option>

                              <option value="cancelled">
                                Cancelled
                              </option>

                            </select>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

      </main>

      <Footer />

    </div>
  );
}

function Summary({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">

      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </p>

      <p className="mt-3 text-xl font-black">
        {value}
      </p>

    </div>
  );
}
