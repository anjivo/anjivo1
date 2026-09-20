"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type SettlementStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "on_hold";

type Seller = {
  id: string;
  userId: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  status: string;
  sellerVerified: boolean;
  bankVerified: boolean;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
  createdAt?: unknown;
};

type OrderItem = {
  sellerId: string;
  sellerName: string;
  quantity: number;
  total: number;
  pricingType: string;
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  items: OrderItem[];
  createdAt?: unknown;
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
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

function booleanValue(value: unknown): boolean {
  return value === true;
}

function timestampValue(
  value: unknown
): number {
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

function formatCurrency(
  value: number
): string {
  return `₹${Math.round(
    value
  ).toLocaleString("en-IN")}`;
}

function mapSeller(
  id: string,
  data: Record<string, unknown>
): Seller {
  return {
    id,

    userId:
      stringValue(data.userId) ||
      id,

    businessName:
      stringValue(
        data.businessName
      ) ||
      "Unnamed Seller",

    ownerName:
      stringValue(
        data.ownerName
      ),

    email:
      stringValue(data.email),

    phone:
      stringValue(data.phone),

    status:
      stringValue(data.status) ||
      "pending",

    sellerVerified:
      booleanValue(
        data.sellerVerified
      ),

    bankVerified:
      booleanValue(
        data.bankVerified
      ),

    bankAccountName:
      stringValue(
        data.bankAccountName
      ),

    bankAccountNumber:
      stringValue(
        data.bankAccountNumber
      ),

    ifscCode:
      stringValue(
        data.ifscCode
      ),

    createdAt:
      data.createdAt,
  };
}

function mapOrder(
  id: string,
  data: Record<string, unknown>
): Order {
  const rawItems = Array.isArray(
    data.items
  )
    ? data.items
    : [];

  const items: OrderItem[] =
    rawItems.map((raw) => {
      const item =
        typeof raw === "object" &&
        raw !== null
          ? (raw as Record<
              string,
              unknown
            >)
          : {};

      return {
        sellerId:
          stringValue(
            item.sellerId
          ),

        sellerName:
          stringValue(
            item.sellerName
          ),

        quantity:
          numberValue(
            item.quantity
          ),

        total:
          numberValue(
            item.total
          ) ||
          numberValue(
            item.selectedPrice
          ) *
            numberValue(
              item.quantity
            ),

        pricingType:
          stringValue(
            item.pricingType
          ) || "retail",
      };
    });

  return {
    id,

    status:
      stringValue(
        data.status
      ) || "pending",

    paymentStatus:
      stringValue(
        data.paymentStatus
      ) || "pending",

    items,

    createdAt:
      data.createdAt,
  };
}

function mapSettlement(
  id: string,
  data: Record<string, unknown>
): Settlement {
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

    status:
      data.status ===
        "processing" ||
      data.status === "paid" ||
      data.status === "failed" ||
      data.status === "on_hold"
        ? data.status
        : "pending",

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

export default function AdminSettlementsPage() {
  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [sellers, setSellers] =
    useState<Seller[]>([]);

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [settlements, setSettlements] =
    useState<Settlement[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedSellerId, setSelectedSellerId] =
    useState("all");

  const [selectedSettlement, setSelectedSettlement] =
    useState<Settlement | null>(
      null
    );

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            window.location.href =
              "/login?redirect=/admin/settlements";
            return;
          }

          try {
            const adminSnap =
              await getDoc(
                doc(
                  db,
                  "users",
                  user.uid
                )
              );

            if (
              !adminSnap.exists() ||
              adminSnap.data().role !==
                "ADMIN"
            ) {
              window.location.href =
                "/account";
              return;
            }

            setAuthorized(true);

            await loadData();
          } catch (error) {
            console.error(
              "Settlement authorization error:",
              error
            );

            window.location.href =
              "/";
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, []);

  async function loadData() {
    try {
      const [
        sellerSnapshot,
        orderSnapshot,
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
            "orders"
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
          (item) =>
            mapSeller(
              item.id,
              item.data()
            )
        );

      const orderList =
        orderSnapshot.docs.map(
          (item) =>
            mapOrder(
              item.id,
              item.data()
            )
        );

      const settlementList =
        settlementSnapshot.docs.map(
          (item) =>
            mapSettlement(
              item.id,
              item.data()
            )
        );

      sellerList.sort((a, b) =>
        a.businessName.localeCompare(
          b.businessName,
          "en-IN"
        )
      );

      settlementList.sort(
        (a, b) =>
          timestampValue(
            b.createdAt
          ) -
          timestampValue(
            a.createdAt
          )
      );

      setSellers(sellerList);
      setOrders(orderList);
      setSettlements(
        settlementList
      );
    } catch (error) {
      console.error(
        "Load settlement data error:",
        error
      );

      alert(
        "Settlement data load nahi ho paaya. Firestore rules check karein."
      );
    }
  }

  const sellerSales = useMemo(() => {
    const map =
      new Map<
        string,
        number
      >();

    orders.forEach((order) => {
      if (
        order.status ===
          "cancelled" ||
        order.status ===
          "returned"
      ) {
        return;
      }

      order.items.forEach(
        (item) => {
          if (!item.sellerId) {
            return;
          }

          const current =
            map.get(
              item.sellerId
            ) || 0;

          map.set(
            item.sellerId,
            current + item.total
          );
        }
      );
    });

    return map;
  }, [orders]);

  const filteredSettlements =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return settlements.filter(
        (settlement) => {
          const searchMatch =
            !query ||
            settlement.id
              .toLowerCase()
              .includes(query) ||
            settlement.sellerName
              .toLowerCase()
              .includes(query) ||
            settlement.transactionId
              .toLowerCase()
              .includes(query);

          const statusMatch =
            statusFilter ===
              "all" ||
            settlement.status ===
              statusFilter;

          const sellerMatch =
            selectedSellerId ===
              "all" ||
            settlement.sellerId ===
              selectedSellerId;

          return (
            searchMatch &&
            statusMatch &&
            sellerMatch
          );
        }
      );
    }, [
      settlements,
      search,
      statusFilter,
      selectedSellerId,
    ]);

  const stats = useMemo(() => {
    const totalGross =
      settlements.reduce(
        (sum, item) =>
          sum +
          item.grossSales,
        0
      );

    const totalCommission =
      settlements.reduce(
        (sum, item) =>
          sum +
          item.commissionAmount,
        0
      );

    const totalPayable =
      settlements.reduce(
        (sum, item) =>
          sum +
          item.payableAmount,
        0
      );

    const paid =
      settlements
        .filter(
          (item) =>
            item.status === "paid"
        )
        .reduce(
          (sum, item) =>
            sum +
            item.payableAmount,
          0
        );

    const pending =
      settlements
        .filter(
          (item) =>
            item.status ===
              "pending" ||
            item.status ===
              "processing"
        )
        .reduce(
          (sum, item) =>
            sum +
            item.payableAmount,
          0
        );

    const onHold =
      settlements
        .filter(
          (item) =>
            item.status ===
            "on_hold"
        )
        .reduce(
          (sum, item) =>
            sum +
            item.payableAmount,
          0
        );

    return {
      totalGross,
      totalCommission,
      totalPayable,
      paid,
      pending,
      onHold,
    };
  }, [settlements]);

  async function updateSettlementStatus(
    settlement: Settlement,
    status: SettlementStatus
  ) {
    if (
      status === "paid" &&
      !settlement.transactionId
    ) {
      const transactionId =
        window.prompt(
          "Payment / UTR / Transaction ID enter karein:"
        );

      if (!transactionId?.trim()) {
        alert(
          "Paid settlement ke liye transaction ID required hai."
        );

        return;
      }

      try {
        await updateDoc(
          doc(
            db,
            "settlements",
            settlement.id
          ),
          {
            status,
            transactionId:
              transactionId.trim(),
            paidAt:
              serverTimestamp(),
            updatedAt:
              serverTimestamp(),
          }
        );

        await loadData();

        setSelectedSettlement(
          null
        );
      } catch (error) {
        console.error(
          "Settlement payment update error:",
          error
        );

        alert(
          "Settlement status update nahi ho saka."
        );
      }

      return;
    }

    try {
      await updateDoc(
        doc(
          db,
          "settlements",
          settlement.id
        ),
        {
          status,
          updatedAt:
            serverTimestamp(),
        }
      );

      await loadData();

      setSelectedSettlement(
        null
      );
    } catch (error) {
      console.error(
        "Settlement status update error:",
        error
      );

      alert(
        "Settlement status update nahi ho saka."
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-600">
            Loading settlements...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="shrink-0"
            >
              <img
                src="/logo/anjivo-logo.png"
                alt="ANJIVO"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="hidden border-l pl-4 sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin Panel
              </p>

              <h1 className="text-lg font-bold text-slate-900">
                Seller Settlements
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/seller-analytics"
              className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:block"
            >
              Seller Analytics
            </Link>

            <button
              onClick={loadData}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              Finance & Payouts
            </p>

            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Seller Settlements & Commission
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Seller sales se platform commission calculate karke
              payable settlement amount manage karein.
            </p>
          </div>

          <button
            onClick={() =>
              setShowCreateModal(
                true
              )
            }
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            + Create Settlement
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Gross Sales"
            value={formatCurrency(
              stats.totalGross
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
            label="Total Payable"
            value={formatCurrency(
              stats.totalPayable
            )}
            icon="💰"
          />

          <StatCard
            label="Paid"
            value={formatCurrency(
              stats.paid
            )}
            icon="✓"
          />

          <StatCard
            label="Pending"
            value={formatCurrency(
              stats.pending
            )}
            icon="⏳"
          />

          <StatCard
            label="On Hold"
            value={formatCurrency(
              stats.onHold
            )}
            icon="🔒"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_220px_190px_auto]">
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
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <select
                value={
                  selectedSellerId
                }
                onChange={(event) =>
                  setSelectedSellerId(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">
                  All Sellers
                </option>

                {sellers.map(
                  (seller) => (
                    <option
                      key={seller.id}
                      value={seller.id}
                    >
                      {
                        seller.businessName
                      }
                    </option>
                  )
                )}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
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
                onClick={loadData}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {filteredSettlements.length ===
          0 ? (
            <EmptyState
              title="No settlements found"
              description={
                settlements.length ===
                0
                  ? "Abhi settlements collection mein koi settlement record nahi hai."
                  : "Current filters ke according koi settlement nahi mila."
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSettlements.map(
                (settlement) => (
                  <SettlementRow
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
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-bold text-amber-900">
            Important Finance Note
          </h3>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            Ye module settlement workflow aur calculation ka
            admin layer hai. Actual bank payout / Razorpay payout
            integration abhi connected nahi hai. Paid status ko
            production mein backend/webhook verification ke baad
            hi update karna chahiye.
          </p>
        </section>
      </div>

      {selectedSettlement && (
        <SettlementDetailsModal
          settlement={
            selectedSettlement
          }
          onClose={() =>
            setSelectedSettlement(
              null
            )
          }
          onStatusChange={
            updateSettlementStatus
          }
        />
      )}

      {showCreateModal && (
        <CreateSettlementModal
          sellers={sellers}
          sellerSales={
            sellerSales
          }
          creating={creating}
          onClose={() =>
            setShowCreateModal(
              false
            )
          }
          onCreate={async (
            data
          ) => {
            setCreating(true);

            try {
              const seller =
                sellers.find(
                  (item) =>
                    item.id ===
                    data.sellerId
                );

              if (!seller) {
                throw new Error(
                  "Seller not found."
                );
              }

              const grossSales =
                data.grossSales;

              const commissionAmount =
                (grossSales *
                  data.commissionRate) /
                100;

              const payableAmount =
                Math.max(
                  0,
                  grossSales -
                    data.refunds -
                    commissionAmount +
                    data.shippingAdjustments +
                    data.otherAdjustments
                );

              const settlementRef =
                doc(
                  collection(
                    db,
                    "settlements"
                  )
                );

              await setDoc(
                settlementRef,
                {
                  sellerId:
                    seller.id,

                  sellerName:
                    seller.businessName,

                  periodStart:
                    data.periodStart,

                  periodEnd:
                    data.periodEnd,

                  grossSales,

                  refunds:
                    data.refunds,

                  commissionRate:
                    data.commissionRate,

                  commissionAmount,

                  shippingAdjustments:
                    data.shippingAdjustments,

                  otherAdjustments:
                    data.otherAdjustments,

                  payableAmount,

                  status:
                    "pending",

                  transactionId:
                    "",

                  paidAt: null,

                  createdAt:
                    serverTimestamp(),

                  updatedAt:
                    serverTimestamp(),
                }
              );

              setShowCreateModal(
                false
              );

              await loadData();
            } catch (error) {
              console.error(
                "Create settlement error:",
                error
              );

              alert(
                "Settlement create nahi ho saka."
              );
            } finally {
              setCreating(false);
            }
          }}
        />
      )}
    </main>
  );
}

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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SettlementRow({
  settlement,
  onOpen,
}: {
  settlement: Settlement;
  onOpen: () => void;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-500">
              #{settlement.id}
            </span>

            <SettlementStatusBadge
              status={
                settlement.status
              }
            />
          </div>

          <h3 className="mt-2 text-base font-bold text-slate-900">
            {settlement.sellerName}
          </h3>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>
              Period:{" "}
              {settlement.periodStart ||
                "—"}{" "}
              →{" "}
              {settlement.periodEnd ||
                "—"}
            </span>

            <span>
              • Gross:{" "}
              {formatCurrency(
                settlement.grossSales
              )}
            </span>

            <span>
              • Commission:{" "}
              {formatCurrency(
                settlement.commissionAmount
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 xl:justify-end">
          <div className="text-right">
            <p className="text-xs text-slate-400">
              Seller Payable
            </p>

            <p className="text-lg font-bold text-slate-900">
              {formatCurrency(
                settlement.payableAmount
              )}
            </p>
          </div>

          <button
            onClick={onOpen}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Manage
          </button>
        </div>
      </div>
    </div>
  );
}

function SettlementStatusBadge({
  status,
}: {
  status: SettlementStatus;
}) {
  const styles: Record<
    SettlementStatus,
    string
  > = {
    pending:
      "bg-amber-100 text-amber-700",

    processing:
      "bg-blue-100 text-blue-700",

    paid:
      "bg-emerald-100 text-emerald-700",

    failed:
      "bg-red-100 text-red-700",

    on_hold:
      "bg-orange-100 text-orange-700",
  };

  const labels: Record<
    SettlementStatus,
    string
  > = {
    pending: "Pending",
    processing: "Processing",
    paid: "Paid",
    failed: "Failed",
    on_hold: "On Hold",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function SettlementDetailsModal({
  settlement,
  onClose,
  onStatusChange,
}: {
  settlement: Settlement;
  onClose: () => void;
  onStatusChange: (
    settlement: Settlement,
    status: SettlementStatus
  ) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Settlement
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {settlement.sellerName}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <SettlementStatusBadge
                status={
                  settlement.status
                }
              />

              {settlement.transactionId && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  TXN:{" "}
                  {
                    settlement.transactionId
                  }
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailCard
                label="Settlement ID"
                value={
                  settlement.id
                }
              />

              <DetailCard
                label="Seller"
                value={
                  settlement.sellerName
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

              <DetailCard
                label="Gross Sales"
                value={formatCurrency(
                  settlement.grossSales
                )}
              />

              <DetailCard
                label="Refunds"
                value={formatCurrency(
                  settlement.refunds
                )}
              />

              <DetailCard
                label="Commission Rate"
                value={`${settlement.commissionRate}%`}
              />

              <DetailCard
                label="Commission"
                value={formatCurrency(
                  settlement.commissionAmount
                )}
              />

              <DetailCard
                label="Shipping Adjustments"
                value={formatCurrency(
                  settlement.shippingAdjustments
                )}
              />

              <DetailCard
                label="Other Adjustments"
                value={formatCurrency(
                  settlement.otherAdjustments
                )}
              />
            </div>

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-sm text-slate-300">
                Seller Payable
              </p>

              <p className="mt-1 text-3xl font-bold">
                {formatCurrency(
                  settlement.payableAmount
                )}
              </p>

              <p className="mt-2 text-xs text-slate-400">
                Gross Sales − Refunds − Commission
                + Adjustments
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Settlement Actions
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {settlement.status ===
                  "pending" && (
                  <button
                    onClick={() =>
                      onStatusChange(
                        settlement,
                        "processing"
                      )
                    }
                    className="rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                  >
                    Start Processing
                  </button>
                )}

                {(
                  [
                    "pending",
                    "processing",
                  ] as SettlementStatus[]
                ).includes(
                  settlement.status
                ) && (
                  <button
                    onClick={() =>
                      onStatusChange(
                        settlement,
                        "paid"
                      )
                    }
                    className="rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
                  >
                    Mark Paid
                  </button>
                )}

                {settlement.status !==
                  "on_hold" &&
                  settlement.status !==
                    "paid" && (
                    <button
                      onClick={() =>
                        onStatusChange(
                          settlement,
                          "on_hold"
                        )
                      }
                      className="rounded-xl bg-orange-100 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-200"
                    >
                      Put On Hold
                    </button>
                  )}

                {settlement.status !==
                  "failed" &&
                  settlement.status !==
                    "paid" && (
                    <button
                      onClick={() =>
                        onStatusChange(
                          settlement,
                          "failed"
                        )
                      }
                      className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-200"
                    >
                      Mark Failed
                    </button>
                  )}

                {settlement.status ===
                  "on_hold" && (
                  <button
                    onClick={() =>
                      onStatusChange(
                        settlement,
                        "processing"
                      )
                    }
                    className="rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>

            {settlement.paidAt && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-800">
                  Payment Completed
                </p>

                <p className="mt-1 text-xs text-emerald-700">
                  Paid at:{" "}
                  {formatDate(
                    settlement.paidAt
                  )}
                </p>

                {settlement.transactionId && (
                  <p className="mt-1 break-all text-xs text-emerald-700">
                    Transaction ID:{" "}
                    {
                      settlement.transactionId
                    }
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateSettlementModal({
  sellers,
  sellerSales,
  creating,
  onClose,
  onCreate,
}: {
  sellers: Seller[];
  sellerSales: Map<string, number>;
  creating: boolean;
  onClose: () => void;
  onCreate: (data: {
    sellerId: string;
    periodStart: string;
    periodEnd: string;
    grossSales: number;
    refunds: number;
    commissionRate: number;
    shippingAdjustments: number;
    otherAdjustments: number;
  }) => Promise<void>;
}) {
  const [sellerId, setSellerId] =
    useState("");

  const [periodStart, setPeriodStart] =
    useState("");

  const [periodEnd, setPeriodEnd] =
    useState("");

  const [grossSales, setGrossSales] =
    useState("");

  const [refunds, setRefunds] =
    useState("0");

  const [commissionRate, setCommissionRate] =
    useState("10");

  const [shippingAdjustments, setShippingAdjustments] =
    useState("0");

  const [otherAdjustments, setOtherAdjustments] =
    useState("0");

  useEffect(() => {
    if (
      sellerId &&
      grossSales === ""
    ) {
      const sales =
        sellerSales.get(
          sellerId
        ) || 0;

      setGrossSales(
        String(
          Math.round(sales)
        )
      );
    }
  }, [
    sellerId,
    grossSales,
    sellerSales,
  ]);

  const gross =
    numberValue(grossSales);

  const refund =
    numberValue(refunds);

  const rate =
    numberValue(
      commissionRate
    );

  const shipping =
    numberValue(
      shippingAdjustments
    );

  const other =
    numberValue(
      otherAdjustments
    );

  const commission =
    (gross * rate) / 100;

  const payable = Math.max(
    0,
    gross -
      refund -
      commission +
      shipping +
      other
  );

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!sellerId) {
      alert("Seller select karein.");
      return;
    }

    if (!periodStart || !periodEnd) {
      alert(
        "Settlement period select karein."
      );
      return;
    }

    if (
      new Date(periodEnd) <
      new Date(periodStart)
    ) {
      alert(
        "Period end date period start se pehle nahi ho sakti."
      );
      return;
    }

    if (gross <= 0) {
      alert(
        "Gross sales 0 se greater honi chahiye."
      );
      return;
    }

    if (rate < 0 || rate > 100) {
      alert(
        "Commission rate 0–100% ke beech honi chahiye."
      );
      return;
    }

    await onCreate({
      sellerId,
      periodStart,
      periodEnd,
      grossSales: gross,
      refunds: refund,
      commissionRate: rate,
      shippingAdjustments:
        shipping,
      otherAdjustments: other,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Finance
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Create Settlement
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={creating}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto p-5 sm:p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Seller
              </label>

              <select
                value={sellerId}
                onChange={(event) => {
                  setSellerId(
                    event.target.value
                  );

                  setGrossSales("");
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
                required
              >
                <option value="">
                  Select Seller
                </option>

                {sellers
                  .filter(
                    (seller) =>
                      seller.status ===
                      "approved"
                  )
                  .map(
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
                        }
                      </option>
                    )
                  )}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Period Start"
                type="date"
                value={
                  periodStart
                }
                onChange={
                  setPeriodStart
                }
                required
              />

              <InputField
                label="Period End"
                type="date"
                value={
                  periodEnd
                }
                onChange={
                  setPeriodEnd
                }
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Gross Sales"
                type="number"
                value={
                  grossSales
                }
                onChange={
                  setGrossSales
                }
                min="0"
                required
              />

              <InputField
                label="Refunds"
                type="number"
                value={refunds}
                onChange={setRefunds}
                min="0"
              />

              <InputField
                label="Commission %"
                type="number"
                value={
                  commissionRate
                }
                onChange={
                  setCommissionRate
                }
                min="0"
                max="100"
                step="0.01"
                required
              />

              <InputField
                label="Shipping Adjustment"
                type="number"
                value={
                  shippingAdjustments
                }
                onChange={
                  setShippingAdjustments
                }
                step="0.01"
              />

              <InputField
                label="Other Adjustment"
                type="number"
                value={
                  otherAdjustments
                }
                onChange={
                  setOtherAdjustments
                }
                step="0.01"
              />
            </div>

            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-300">
                  Gross Sales
                </span>

                <span>
                  {formatCurrency(
                    gross
                  )}
                </span>
              </div>

              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-slate-300">
                  Refunds
                </span>

                <span>
                  -
                  {formatCurrency(
                    refund
                  )}
                </span>
              </div>

              <div className="mt-2 flex justify-between gap-4 text-sm">
                <span className="text-slate-300">
                  Commission
                </span>

                <span>
                  -
                  {formatCurrency(
                    commission
                  )}
                </span>
              </div>

              <div className="my-3 border-t border-slate-700" />

              <div className="flex justify-between gap-4">
                <span className="font-bold">
                  Seller Payable
                </span>

                <span className="text-xl font-bold">
                  {formatCurrency(
                    payable
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {creating
                ? "Creating..."
                : "Create Settlement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  min,
  max,
  step,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  min?: string;
  max?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        min={min}
        max={max}
        step={step}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        💰
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
