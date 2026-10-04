"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";

type SettlementStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "on_hold";

type Settlement = {
  id: string;
  sellerId: string;
  sellerName: string;
  periodStart: unknown;
  periodEnd: unknown;
  grossSales: number;
  refunds: number;
  commissionRate: number;
  commissionAmount: number;
  shippingAdjustments: number;
  otherAdjustments: number;
  payableAmount: number;
  status: SettlementStatus;
  transactionId: string;
  paidAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
};

type Seller = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankVerified: boolean;
};

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function stringValue(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

function getMillis(value: unknown) {
  if (!value) return 0;

  if (value instanceof Date) return value.getTime();

  if (typeof value === "object") {
    const item = value as {
      seconds?: unknown;
      nanoseconds?: unknown;
    };

    if (typeof item.seconds === "number") {
      return item.seconds * 1000 + numberValue(item.nanoseconds) / 1_000_000;
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  return 0;
}

function formatDate(value: unknown) {
  const time = getMillis(value);
  if (!time) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(time));
}

function formatDateTime(value: unknown) {
  const time = getMillis(value);
  if (!time) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function normalizeStatus(value: unknown): SettlementStatus {
  switch (String(value || "pending").toLowerCase()) {
    case "processing":
      return "processing";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "on_hold":
    case "on-hold":
      return "on_hold";
    default:
      return "pending";
  }
}

function statusLabel(status: SettlementStatus) {
  switch (status) {
    case "on_hold":
      return "On Hold";
    case "processing":
      return "Processing";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

function statusClass(status: SettlementStatus) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "processing":
      return "bg-blue-100 text-blue-700";
    case "failed":
      return "bg-red-100 text-red-700";
    case "on_hold":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

function maskAccount(value: string) {
  const account = value.trim();
  if (!account) return "—";
  if (account.length <= 4) return account;
  return `${"•".repeat(Math.max(0, account.length - 4))}${account.slice(-4)}`;
}

function mapSettlement(id: string, data: Record<string, unknown>): Settlement {
  return {
    id,
    sellerId: stringValue(data.sellerId),
    sellerName: stringValue(data.sellerName, "Seller"),
    periodStart: data.periodStart ?? null,
    periodEnd: data.periodEnd ?? null,
    grossSales: numberValue(data.grossSales),
    refunds: numberValue(data.refunds),
    commissionRate: numberValue(data.commissionRate),
    commissionAmount: numberValue(data.commissionAmount),
    shippingAdjustments: numberValue(data.shippingAdjustments),
    otherAdjustments: numberValue(data.otherAdjustments),
    payableAmount: numberValue(data.payableAmount),
    status: normalizeStatus(data.status),
    transactionId: stringValue(data.transactionId),
    paidAt: data.paidAt ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function Summary({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
      <p className="mt-3 text-xl font-black">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-gray-400">{hint}</p> : null}
    </div>
  );
}

export default function AdminPayoutsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [settlementSnapshot, sellerSnapshot] = await Promise.all([
        getDocs(collection(db, "settlements")),
        getDocs(collection(db, "sellers")),
      ]);

      const settlementRows = settlementSnapshot.docs
        .map((item) => mapSettlement(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

      const sellerRows: Seller[] = sellerSnapshot.docs.map((item) => {
        const data = item.data() as Record<string, unknown>;

        return {
          id: item.id,
          businessName: stringValue(data.businessName, "Seller"),
          ownerName: stringValue(data.ownerName),
          email: stringValue(data.email),
          phone: stringValue(data.phone),
          bankAccountName: stringValue(data.bankAccountName),
          bankAccountNumber: stringValue(data.bankAccountNumber),
          ifscCode: stringValue(data.ifscCode),
          bankVerified: Boolean(data.bankVerified),
        };
      });

      setSettlements(settlementRows);
      setSellers(sellerRows);
    } catch (err) {
      console.error("Admin payouts load error:", err);
      setError(err instanceof Error ? err.message : "Unable to load payouts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/admin/payouts");
        return;
      }

      try {
        const userSnapshot = await getDocs(collection(db, "users"));
        const currentUser = userSnapshot.docs.find((item) => item.id === user.uid);

        if (!currentUser || currentUser.data().role !== "ADMIN") {
          setError("Admin access required.");
          setLoading(false);
          return;
        }

        await loadData();
      } catch (err) {
        console.error("Admin payout auth error:", err);
        setError(err instanceof Error ? err.message : "Unable to verify admin access.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const sellerMap = useMemo(() => {
    const map = new Map<string, Seller>();
    sellers.forEach((seller) => map.set(seller.id, seller));
    return map;
  }, [sellers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return settlements.filter((settlement) => {
      const seller = sellerMap.get(settlement.sellerId);

      const matchesStatus = statusFilter === "all" || settlement.status === statusFilter;
      const matchesSeller = sellerFilter === "all" || settlement.sellerId === sellerFilter;

      const searchable = [
        settlement.id,
        settlement.sellerId,
        settlement.sellerName,
        settlement.transactionId,
        seller?.businessName,
        seller?.ownerName,
        seller?.email,
        seller?.ifscCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesSeller && (!term || searchable.includes(term));
    });
  }, [search, settlements, sellerFilter, sellerMap, statusFilter]);

  const summary = useMemo(() => {
    const pending = settlements.filter((x) => x.status === "pending").reduce((s, x) => s + x.payableAmount, 0);
    const processing = settlements.filter((x) => x.status === "processing").reduce((s, x) => s + x.payableAmount, 0);
    const paid = settlements.filter((x) => x.status === "paid").reduce((s, x) => s + x.payableAmount, 0);
    const onHold = settlements.filter((x) => x.status === "on_hold").reduce((s, x) => s + x.payableAmount, 0);
    const failed = settlements.filter((x) => x.status === "failed").reduce((s, x) => s + x.payableAmount, 0);

    return {
      totalPayable: settlements.reduce((s, x) => s + x.payableAmount, 0),
      pending,
      processing,
      paid,
      onHold,
      failed,
    };
  }, [settlements]);

  async function updateStatus(settlement: Settlement, nextStatus: SettlementStatus) {
    if (nextStatus === "paid") {
      const utr = transactionId.trim();
      if (!utr) {
        setError("Paid karne se pehle UTR / Transaction ID enter karein.");
        return;
      }
    }

    try {
      setUpdatingId(settlement.id);
      setError("");
      setSuccess("");

      const updateData: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };

      if (nextStatus === "paid") {
        updateData.transactionId = transactionId.trim();
        updateData.paidAt = serverTimestamp();
      }

      await updateDoc(doc(db, "settlements", settlement.id), updateData);

      setSettlements((current) =>
        current.map((item) =>
          item.id === settlement.id
            ? {
                ...item,
                status: nextStatus,
                transactionId: nextStatus === "paid" ? transactionId.trim() : item.transactionId,
                paidAt: nextStatus === "paid" ? new Date() : item.paidAt,
              }
            : item
        )
      );

      if (selected?.id === settlement.id) {
        setSelected((item) =>
          item
            ? {
                ...item,
                status: nextStatus,
                transactionId: nextStatus === "paid" ? transactionId.trim() : item.transactionId,
                paidAt: nextStatus === "paid" ? new Date() : item.paidAt,
              }
            : item
        );
      }

      setSuccess(`Settlement #${settlement.id.slice(0, 8)} marked as ${statusLabel(nextStatus)}.`);
      if (nextStatus === "paid") setTransactionId("");
    } catch (err) {
      console.error("Payout status update error:", err);
      setError(err instanceof Error ? err.message : "Unable to update payout status.");
    } finally {
      setUpdatingId(null);
    }
  }

  function openSettlement(settlement: Settlement) {
    setSelected(settlement);
    setTransactionId(settlement.transactionId || "");
    setError("");
    setSuccess("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">⏳</div>
            <p className="mt-4 text-sm font-bold text-gray-500">Loading seller payouts...</p>
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">ANJIVO Admin</p>
            <h1 className="mt-2 text-3xl font-black">Seller Payouts</h1>
            <p className="mt-2 text-sm text-gray-500">
              Process seller settlement payouts using the settlement records as the source of truth.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold"
            >
              ↻ Refresh
            </button>
            <Link href="/admin" className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-xs font-bold">
              ← Admin Dashboard
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-700">✓ {success}</p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Summary title="Total Payable" value={money(summary.totalPayable)} />
          <Summary title="Pending" value={money(summary.pending)} hint="Ready for processing" />
          <Summary title="Processing" value={money(summary.processing)} />
          <Summary title="Paid" value={money(summary.paid)} />
          <Summary title="On Hold" value={money(summary.onHold)} />
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_260px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search seller, settlement ID, UTR, IFSC..."
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="on_hold">On Hold</option>
            </select>

            <select
              value={sellerFilter}
              onChange={(event) => setSellerFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
            >
              <option value="all">All Sellers</option>
              {sellers
                .slice()
                .sort((a, b) => a.businessName.localeCompare(b.businessName))
                .map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.businessName}
                  </option>
                ))}
            </select>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-lg font-black">Settlement Payout Queue</h2>
            <p className="mt-1 text-xs text-gray-500">{filtered.length} settlement records shown</p>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl">🏦</div>
              <h3 className="mt-4 text-lg font-black">No payout records</h3>
              <p className="mt-2 text-xs text-gray-500">
                Payouts will appear after seller settlements are created.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Seller</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Period</th>
                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Gross</th>
                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Commission</th>
                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Payable</th>
                    <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Bank</th>
                    <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-5 py-4 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((settlement) => {
                    const seller = sellerMap.get(settlement.sellerId);

                    return (
                      <tr key={settlement.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-5">
                          <p className="text-xs font-black">{seller?.businessName || settlement.sellerName || "Unknown Seller"}</p>
                          <p className="mt-1 text-[10px] text-gray-400">{seller?.ownerName || settlement.sellerId.slice(0, 12)}</p>
                        </td>

                        <td className="px-5 py-5">
                          <p className="text-xs font-bold">{formatDate(settlement.periodStart)} – {formatDate(settlement.periodEnd)}</p>
                          <p className="mt-1 text-[10px] text-gray-400">#{settlement.id.slice(0, 10)}</p>
                        </td>

                        <td className="px-5 py-5 text-right text-xs font-bold">{money(settlement.grossSales)}</td>

                        <td className="px-5 py-5 text-right">
                          <p className="text-xs font-bold text-red-600">− {money(settlement.commissionAmount)}</p>
                          <p className="mt-1 text-[10px] text-gray-400">{settlement.commissionRate}%</p>
                        </td>

                        <td className="px-5 py-5 text-right text-sm font-black">{money(settlement.payableAmount)}</td>

                        <td className="px-5 py-5 text-center">
                          {seller?.bankVerified ? (
                            <span className="rounded-full bg-green-100 px-3 py-1.5 text-[10px] font-bold text-green-700">Verified</span>
                          ) : (
                            <span className="rounded-full bg-red-100 px-3 py-1.5 text-[10px] font-bold text-red-700">Not Verified</span>
                          )}
                        </td>

                        <td className="px-5 py-5 text-center">
                          <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${statusClass(settlement.status)}`}>
                            {statusLabel(settlement.status)}
                          </span>
                        </td>

                        <td className="px-5 py-5 text-center">
                          <button
                            onClick={() => openSettlement(settlement)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[10px] font-bold hover:border-black"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary title="Failed" value={money(summary.failed)} />
          <Summary title="On Hold" value={money(summary.onHold)} />
          <Summary title="Processing" value={money(summary.processing)} />
          <Summary title="Paid" value={money(summary.paid)} />
        </section>
      </main>

      <Footer />

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Settlement</p>
                <h2 className="mt-1 text-xl font-black">#{selected.id.slice(0, 12)}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold">✕</button>
            </div>

            <div className="space-y-5 p-5">
              {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}
              {success ? <div className="rounded-xl bg-green-50 p-3 text-xs font-semibold text-green-700">✓ {success}</div> : null}

              {(() => {
                const seller = sellerMap.get(selected.sellerId);
                return (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info label="Seller" value={seller?.businessName || selected.sellerName} />
                      <Info label="Owner" value={seller?.ownerName || "—"} />
                      <Info label="Email" value={seller?.email || "—"} />
                      <Info label="Phone" value={seller?.phone || "—"} />
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Bank Details</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Info label="Account Name" value={seller?.bankAccountName || "—"} />
                        <Info label="Account Number" value={maskAccount(seller?.bankAccountNumber || "")} />
                        <Info label="IFSC" value={seller?.ifscCode || "—"} />
                        <Info label="Bank Verification" value={seller?.bankVerified ? "Verified" : "Not Verified"} />
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Gross Sales" value={money(selected.grossSales)} />
                <Info label="Refunds" value={money(selected.refunds)} />
                <Info label="Commission" value={`${money(selected.commissionAmount)} (${selected.commissionRate}%)`} />
                <Info label="Shipping Adjustment" value={money(selected.shippingAdjustments)} />
                <Info label="Other Adjustment" value={money(selected.otherAdjustments)} />
                <Info label="Seller Payable" value={money(selected.payableAmount)} />
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Settlement Period</p>
                <p className="mt-2 text-sm font-black">{formatDate(selected.periodStart)} – {formatDate(selected.periodEnd)}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payout Information</p>
                <div className="mt-3">
                  <label className="text-xs font-bold text-gray-600">UTR / Transaction ID</label>
                  <input
                    value={transactionId}
                    onChange={(event) => setTransactionId(event.target.value)}
                    placeholder="Enter UTR after bank transfer"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
                  />
                  <p className="mt-2 text-[10px] text-gray-400">Required when marking this settlement as Paid.</p>
                </div>

                {selected.transactionId ? (
                  <p className="mt-3 text-xs font-semibold text-gray-600">Current UTR: {selected.transactionId}</p>
                ) : null}
                {selected.paidAt ? <p className="mt-1 text-[10px] text-gray-400">Paid: {formatDateTime(selected.paidAt)}</p> : null}
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Change Status</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(["pending", "processing", "paid", "failed", "on_hold"] as SettlementStatus[]).map((status) => (
                    <button
                      key={status}
                      disabled={updatingId === selected.id || selected.status === status}
                      onClick={() => updateStatus(selected, status)}
                      className={`rounded-xl border px-3 py-3 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${selected.status === status ? "border-black bg-black text-white" : "border-gray-200 bg-white"}`}
                    >
                      {updatingId === selected.id && selected.status !== status ? "..." : statusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-gray-800">{value}</p>
    </div>
  );
}
