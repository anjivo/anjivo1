"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

/* =========================================================
   TYPES
========================================================= */

type SettlementStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "on_hold";

type Seller = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  status: string;
};

type Settlement = {
  id: string;

  sellerId: string;
  sellerName: string;

  periodStart: string;
  periodEnd: string;

  grossSales: number;
  refunds: number;

  commissionRate: number;
  commissionAmount: number;

  shippingAdjustments: number;
  otherAdjustments: number;

  payableAmount: number;

  status: SettlementStatus;

  transactionId: string;

  paidAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

/* =========================================================
   HELPERS
========================================================= */

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value
    : "";
}

function numberValue(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  return 0;
}

function timestampValue(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const time =
      new Date(value).getTime();

    return Number.isFinite(time)
      ? time
      : 0;
  }

  return 0;
}

function formatCurrency(
  value: number
): string {
  return `₹${Math.round(
    value
  ).toLocaleString("en-IN")}`;
}

function formatDate(
  value: unknown
): string {
  const millis =
    timestampValue(value);

  if (!millis) return "—";

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(new Date(millis));
}

function mapSeller(
  id: string,
  data: Record<string, unknown>
): Seller {
  return {
    id,

    businessName:
      stringValue(
        data.businessName
      ) ||
      stringValue(
        data.shopName
      ) ||
      "Seller",

    ownerName:
      stringValue(
        data.ownerName
      ),

    email:
      stringValue(
        data.email
      ),

    phone:
      stringValue(
        data.phone
      ),

    status:
      stringValue(
        data.status
      ) || "pending",
  };
}

function mapSettlement(
  id: string,
  data: Record<string, unknown>
): Settlement {
  const rawStatus =
    stringValue(
      data.status
    );

  const status: SettlementStatus =
    rawStatus === "processing" ||
    rawStatus === "paid" ||
    rawStatus === "failed" ||
    rawStatus === "on_hold"
      ? rawStatus
      : "pending";

  return {
    id,

    sellerId:
      stringValue(
        data.sellerId
      ),

    sellerName:
      stringValue(
        data.sellerName
      ) || "Seller",

    periodStart:
      stringValue(
        data.periodStart
      ),

    periodEnd:
      stringValue(
        data.periodEnd
      ),

    grossSales:
      numberValue(
        data.grossSales
      ),

    refunds:
      numberValue(
        data.refunds
      ),

    commissionRate:
      numberValue(
        data.commissionRate
      ),

    commissionAmount:
      numberValue(
        data.commissionAmount
      ),

    shippingAdjustments:
      numberValue(
        data.shippingAdjustments
      ),

    otherAdjustments:
      numberValue(
        data.otherAdjustments
      ),

    payableAmount:
      numberValue(
        data.payableAmount
      ),

    status,

    transactionId:
      stringValue(
        data.transactionId
      ),

    paidAt:
      data.paidAt,

    createdAt:
      data.createdAt,

    updatedAt:
      data.updatedAt,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminCommissionsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [sellers, setSellers] =
    useState<Seller[]>([]);

  const [settlements, setSettlements] =
    useState<Settlement[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [sellerFilter, setSellerFilter] =
    useState("all");

  const [selectedSettlement, setSelectedSettlement] =
    useState<Settlement | null>(
      null
    );

  const [error, setError] =
    useState("");

  /* =======================================================
     AUTH
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/commissions";

            return;
          }

          try {
            const adminSnapshot =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !adminSnapshot.exists() ||
              adminSnapshot.data()
                .role !== "ADMIN"
            ) {
              window.location.href =
                "/account";

              return;
            }

            setAuthorized(true);

            await loadData();
          } catch (err) {
            console.error(
              "Commission authorization error:",
              err
            );

            setError(
              "Admin authorization failed."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadData() {
    try {
      setError("");

      const [
        sellerSnapshot,
        settlementSnapshot,
      ] = await Promise.all([
        getDocs(
          collection(
            db,
            "sellers"
          )
        ),

        getDocs(
          collection(
            db,
            "settlements"
          )
        ),
      ]);

      const sellerList =
        sellerSnapshot.docs.map(
          (sellerDoc) =>
            mapSeller(
              sellerDoc.id,
              sellerDoc.data()
            )
        );

      const settlementList =
        settlementSnapshot.docs.map(
          (settlementDoc) =>
            mapSettlement(
              settlementDoc.id,
              settlementDoc.data()
            )
        );

      settlementList.sort(
        (a, b) =>
          timestampValue(
            b.updatedAt ||
              b.createdAt
          ) -
          timestampValue(
            a.updatedAt ||
              a.createdAt
          )
      );

      setSellers(sellerList);
      setSettlements(
        settlementList
      );
    } catch (err) {
      console.error(
        "Commission data error:",
        err
      );

      setError(
        "Commission data load nahi ho saka."
      );
    }
  }

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    const grossSales =
      settlements.reduce(
        (sum, item) =>
          sum + item.grossSales,
        0
      );

    const totalCommission =
      settlements.reduce(
        (sum, item) =>
          sum + item.commissionAmount,
        0
      );

    const totalRefunds =
      settlements.reduce(
        (sum, item) =>
          sum + item.refunds,
        0
      );

    const totalPayable =
      settlements.reduce(
        (sum, item) =>
          sum + item.payableAmount,
        0
      );

    const paidCommission =
      settlements
        .filter(
          (item) =>
            item.status === "paid"
        )
        .reduce(
          (sum, item) =>
            sum +
            item.commissionAmount,
          0
        );

    const pendingCommission =
      settlements
        .filter(
          (item) =>
            item.status === "pending" ||
            item.status === "processing"
        )
        .reduce(
          (sum, item) =>
            sum +
            item.commissionAmount,
          0
        );

    const averageRate =
      settlements.length
        ? settlements.reduce(
            (sum, item) =>
              sum +
              item.commissionRate,
            0
          ) / settlements.length
        : 0;

    return {
      grossSales,
      totalCommission,
      totalRefunds,
      totalPayable,
      paidCommission,
      pendingCommission,
      averageRate,
    };
  }, [settlements]);

  /* =======================================================
     FILTERED DATA
  ======================================================= */

  const filteredSettlements =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return settlements.filter(
        (settlement) => {
          if (
            statusFilter !==
              "all" &&
            settlement.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            sellerFilter !==
              "all" &&
            settlement.sellerId !==
              sellerFilter
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable =
            `${settlement.id}
             ${settlement.sellerName}
             ${settlement.sellerId}
             ${settlement.transactionId}
             ${settlement.periodStart}
             ${settlement.periodEnd}
             ${settlement.status}`
              .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      settlements,
      search,
      statusFilter,
      sellerFilter,
    ]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

            <p className="mt-4 text-sm font-semibold text-slate-500">
              Loading commissions...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center"
            >
              <img
                src="/logo/anjivo-logo.png"
                alt="ANJIVO"
                className="h-10 w-auto"
              />
            </Link>

            <div className="hidden h-7 w-px bg-slate-200 sm:block" />

            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Admin
              </p>

              <p className="text-sm font-bold text-slate-900">
                Commissions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-slate-400"
            >
              Dashboard
            </Link>

            <Link
              href="/admin/payouts"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-slate-400"
            >
              Payouts
            </Link>

            <Link
              href="/admin/reports/finance"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-slate-400"
            >
              Financial Reports
            </Link>

            <button
              type="button"
              onClick={loadData}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================
          CONTENT
      =================================================== */}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* TITLE */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
              Finance / Commissions
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              Seller Commissions
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Seller settlements se
              commission, gross sales,
              refunds aur payable amount
              monitor karein.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total Platform Commission
            </p>

            <p className="mt-1 text-2xl font-black text-slate-900">
              {formatCurrency(
                stats.totalCommission
              )}
            </p>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Gross Sales"
            value={formatCurrency(
              stats.grossSales
            )}
            icon="₹"
          />

          <StatCard
            label="Commission"
            value={formatCurrency(
              stats.totalCommission
            )}
            icon="%"
          />

          <StatCard
            label="Seller Payable"
            value={formatCurrency(
              stats.totalPayable
            )}
            icon="💰"
          />

          <StatCard
            label="Average Rate"
            value={`${stats.averageRate.toFixed(
              2
            )}%`}
            icon="📊"
          />

          <StatCard
            label="Refunds"
            value={formatCurrency(
              stats.totalRefunds
            )}
            icon="↩"
          />

          <StatCard
            label="Paid Commission"
            value={formatCurrency(
              stats.paidCommission
            )}
            icon="✓"
          />

          <StatCard
            label="Pending Commission"
            value={formatCurrency(
              stats.pendingCommission
            )}
            icon="⏳"
          />

          <StatCard
            label="Settlements"
            value={String(
              settlements.length
            )}
            icon="📄"
          />
        </section>

        {/* =================================================
            FILTERS
        ================================================= */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔎
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search settlement, seller, transaction ID..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={sellerFilter}
              onChange={(event) =>
                setSellerFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none"
            >
              <option value="all">
                All Sellers
              </option>

              {sellers
                .slice()
                .sort(
                  (a, b) =>
                    a.businessName.localeCompare(
                      b.businessName
                    )
                )
                .map((seller) => (
                  <option
                    key={seller.id}
                    value={seller.id}
                  >
                    {seller.businessName}
                  </option>
                ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none"
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

              <option value="on_hold">
                On Hold
              </option>
            </select>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSellerFilter(
                  "all"
                );
                setStatusFilter(
                  "all"
                );
              }}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-slate-400"
            >
              Clear
            </button>
          </div>
        </section>

        {/* =================================================
            COMMISSION TABLE
        ================================================= */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Commission Settlements
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {filteredSettlements.length}{" "}
                settlement
                {filteredSettlements.length !==
                1
                  ? "s"
                  : ""}{" "}
                found
              </p>
            </div>
          </div>

          {filteredSettlements.length ===
          0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-4xl">
                💰
              </div>

              <h3 className="mt-4 text-lg font-black text-slate-900">
                No commission records
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Current search/filter ke
                according koi settlement
                nahi mila.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP HEADER */}

              <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 xl:grid">
                <div>Seller</div>
                <div>Period</div>
                <div>Gross Sales</div>
                <div>Commission</div>
                <div>Payable</div>
                <div></div>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredSettlements.map(
                  (settlement) => (
                    <CommissionRow
                      key={
                        settlement.id
                      }
                      settlement={
                        settlement
                      }
                      onOpen={() =>
                        setSelectedSettlement(
                          settlement
                        )
                      }
                    />
                  )
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ===================================================
          DETAIL MODAL
      =================================================== */}

      {selectedSettlement && (
        <CommissionModal
          settlement={
            selectedSettlement
          }
          onClose={() =>
            setSelectedSettlement(
              null
            )
          }
        />
      )}
    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xl font-black text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ROW
========================================================= */

function CommissionRow({
  settlement,
  onOpen,
}: {
  settlement: Settlement;
  onOpen: () => void;
}) {
  return (
    <div className="p-5">
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto] xl:items-center">
        {/* SELLER */}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-black text-slate-900">
              {settlement.sellerName}
            </h3>

            <StatusBadge
              status={
                settlement.status
              }
            />
          </div>

          <p className="mt-1 font-mono text-[10px] text-slate-400">
            #{settlement.id}
          </p>

          {settlement.transactionId && (
            <p className="mt-1 text-[10px] text-slate-400">
              TXN:{" "}
              {settlement.transactionId}
            </p>
          )}
        </div>

        {/* PERIOD */}

        <div>
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
            Period
          </p>

          <p className="mt-1 text-xs font-bold text-slate-700">
            {settlement.periodStart ||
              "—"}
          </p>

          <p className="text-[10px] text-slate-400">
            →{" "}
            {settlement.periodEnd ||
              "—"}
          </p>
        </div>

        {/* GROSS */}

        <div>
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
            Gross Sales
          </p>

          <p className="mt-1 text-sm font-black text-slate-900">
            {formatCurrency(
              settlement.grossSales
            )}
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            Refunds:{" "}
            {formatCurrency(
              settlement.refunds
            )}
          </p>
        </div>

        {/* COMMISSION */}

        <div>
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
            Commission
          </p>

          <p className="mt-1 text-sm font-black text-indigo-600">
            {formatCurrency(
              settlement.commissionAmount
            )}
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            Rate:{" "}
            {settlement.commissionRate}%
          </p>
        </div>

        {/* PAYABLE */}

        <div>
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
            Seller Payable
          </p>

          <p className="mt-1 text-sm font-black text-slate-900">
            {formatCurrency(
              settlement.payableAmount
            )}
          </p>
        </div>

        {/* ACTION */}

        <button
          type="button"
          onClick={onOpen}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        >
          View
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  status,
}: {
  status: SettlementStatus;
}) {
  const config = {
    pending: {
      label: "Pending",
      className:
        "bg-amber-100 text-amber-700",
    },

    processing: {
      label: "Processing",
      className:
        "bg-blue-100 text-blue-700",
    },

    paid: {
      label: "Paid",
      className:
        "bg-emerald-100 text-emerald-700",
    },

    failed: {
      label: "Failed",
      className:
        "bg-red-100 text-red-700",
    },

    on_hold: {
      label: "On Hold",
      className:
        "bg-orange-100 text-orange-700",
    },
  }[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black ${config.className}`}
    >
      {config.label}
    </span>
  );
}

/* =========================================================
   MODAL
========================================================= */

function CommissionModal({
  settlement,
  onClose,
}: {
  settlement: Settlement;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* HEADER */}

        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
              Commission Details
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              {settlement.sellerName}
            </h2>

            <p className="mt-1 font-mono text-[10px] text-slate-400">
              #{settlement.id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        {/* BODY */}

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-5">
            {/* STATUS */}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                  Settlement Status
                </p>

                <div className="mt-2">
                  <StatusBadge
                    status={
                      settlement.status
                    }
                  />
                </div>
              </div>

              {settlement.transactionId && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                    Transaction ID
                  </p>

                  <p className="mt-1 font-mono text-xs font-bold text-slate-700">
                    {
                      settlement.transactionId
                    }
                  </p>
                </div>
              )}
            </div>

            {/* BASIC */}

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailCard
                label="Seller"
                value={
                  settlement.sellerName
                }
              />

              <DetailCard
                label="Seller ID"
                value={
                  settlement.sellerId ||
                  "—"
                }
              />

              <DetailCard
                label="Period Start"
                value={
                  settlement.periodStart ||
                  "—"
                }
              />

              <DetailCard
                label="Period End"
                value={
                  settlement.periodEnd ||
                  "—"
                }
              />
            </div>

            {/* FINANCIAL */}

            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-black text-slate-900">
                Commission Calculation
              </h3>

              <div className="mt-4 space-y-3">
                <MoneyRow
                  label="Gross Sales"
                  value={
                    settlement.grossSales
                  }
                />

                <MoneyRow
                  label="Refunds"
                  value={
                    settlement.refunds
                  }
                  negative
                />

                <MoneyRow
                  label={`Commission (${settlement.commissionRate}%)`}
                  value={
                    settlement.commissionAmount
                  }
                  negative
                />

                <MoneyRow
                  label="Shipping Adjustments"
                  value={
                    settlement.shippingAdjustments
                  }
                />

                <MoneyRow
                  label="Other Adjustments"
                  value={
                    settlement.otherAdjustments
                  }
                />

                <div className="border-t border-slate-200 pt-4">
                  <MoneyRow
                    label="Seller Payable"
                    value={
                      settlement.payableAmount
                    }
                    bold
                  />
                </div>
              </div>
            </div>

            {/* PLATFORM REVENUE */}

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-xs font-semibold text-slate-300">
                Platform Commission
              </p>

              <p className="mt-1 text-3xl font-black">
                {formatCurrency(
                  settlement.commissionAmount
                )}
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-400">
                Commission amount is read
                directly from the settlement
                record.
              </p>
            </div>

            {/* TIMESTAMPS */}

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailCard
                label="Created"
                value={formatDate(
                  settlement.createdAt
                )}
              />

              <DetailCard
                label="Updated"
                value={formatDate(
                  settlement.updatedAt
                )}
              />

              <DetailCard
                label="Paid At"
                value={formatDate(
                  settlement.paidAt
                )}
              />
            </div>

            {/* LINKS */}

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/payouts"
                className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white"
              >
                Open Payouts
              </Link>

              <Link
                href="/admin/reports/finance"
                className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700"
              >
                Financial Reports
              </Link>
            </div>

            {/* INFO */}

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs leading-5 text-blue-800">
                <strong>Calculation:</strong>{" "}
                Gross Sales − Refunds −
                Commission + Shipping
                Adjustments + Other
                Adjustments = Seller Payable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DETAIL CARD
========================================================= */

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

/* =========================================================
   MONEY ROW
========================================================= */

function MoneyRow({
  label,
  value,
  negative,
  bold,
}: {
  label: string;
  value: number;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          bold
            ? "text-sm font-black text-slate-900"
            : "text-sm text-slate-500"
        }
      >
        {label}
      </span>

      <span
        className={
          bold
            ? "text-base font-black text-slate-900"
            : "text-sm font-bold text-slate-800"
        }
      >
        {negative ? "- " : ""}
        {formatCurrency(value)}
      </span>
    </div>
  );
}
