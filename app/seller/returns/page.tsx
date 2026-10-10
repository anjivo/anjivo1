"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";

type ReturnRequest = {
  id: string;
  orderId?: string;
  productId?: string;
  productName?: string;
  customerName?: string;
  quantity?: number;
  amount?: number;
  reason?: string;
  description?: string;
  returnStatus?: string;
  refundStatus?: string;
  refundAmount?: number;
  qcStatus?: string;
  dispute?: boolean;
  createdAt?: unknown;
};

type Filter = "all" | "requested" | "approved" | "rejected" | "picked_up" | "received" | "qc_passed" | "qc_failed" | "refund_pending" | "completed" | "disputed";
const filters: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Requested", value: "requested" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Picked up", value: "picked_up" },
  { label: "Received", value: "received" },
  { label: "QC passed", value: "qc_passed" },
  { label: "QC failed", value: "qc_failed" },
  { label: "Refund pending", value: "refund_pending" },
  { label: "Completed", value: "completed" },
  { label: "Disputed", value: "disputed" },
];

function dateLabel(value: unknown): string {
  try {
    if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().toLocaleString("en-IN");
    }
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN");
  } catch {
    return "—";
  }
}

function money(value: unknown): string {
  const amount = Number(value);
  return `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function label(value: unknown): string {
  return String(value || "requested").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SellerReturnsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [sellerName, setSellerName] = useState("Seller");
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadReturns = useCallback(async (token: string, selectedFilter: Filter = "all") => {
    setLoadingReturns(true);
    setError("");
    try {
      const response = await fetch(`/api/seller/returns?status=${encodeURIComponent(selectedFilter)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not load return requests.");
      setReturns(Array.isArray(result.returns) ? result.returns : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load return requests.");
    } finally {
      setLoadingReturns(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login?redirect=/seller/returns");
        return;
      }
      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        if (!userSnapshot.exists()) {
          router.replace("/login");
          return;
        }
        const userData = userSnapshot.data();
        if (userData.role !== "SELLER") {
          router.replace("/account");
          return;
        }
        if (userData.sellerStatus !== "approved") {
          router.replace("/seller/application");
          return;
        }
        setSellerName(typeof userData.name === "string" ? userData.name : "Seller");
        await loadReturns(await user.getIdToken(), "all");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load seller account.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadReturns, router]);

  const visibleReturns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return returns;
    return returns.filter((item) => [item.id, item.orderId, item.productName, item.customerName, item.reason, item.returnStatus].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [returns, search]);

  async function changeFilter(nextFilter: Filter) {
    setFilter(nextFilter);
    const user = auth.currentUser;
    if (user) await loadReturns(await user.getIdToken(), nextFilter);
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-slate-500">Seller workspace / {sellerName}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Return requests</h1>
              <p className="mt-2 text-sm text-slate-600">View return requests for products sold by your store. Status decisions and refunds are managed by the admin team.</p>
            </div>
            <Link href="/seller/orders" className="inline-flex w-fit items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">← Back to orders</Link>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Visible requests</p><p className="mt-1 text-2xl font-bold text-slate-900">{returns.length}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Awaiting review</p><p className="mt-1 text-2xl font-bold text-amber-600">{returns.filter((item) => (item.returnStatus || "requested") === "requested").length}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">Disputed</p><p className="mt-1 text-2xl font-bold text-rose-600">{returns.filter((item) => item.dispute || item.returnStatus === "disputed").length}</p></div>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => <button key={item.value} type="button" onClick={() => void changeFilter(item.value)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === item.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{item.label}</button>)}
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, order, customer…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 lg:max-w-xs" />
          </div>

          {error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          {(loading || loadingReturns) && <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading return requests…</div>}
          {!loading && !loadingReturns && !error && visibleReturns.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-10 text-center"><h2 className="font-semibold text-slate-900">No return requests found</h2><p className="mt-1 text-sm text-slate-500">Requests for your products will appear here.</p></div>}

          {!loading && !loadingReturns && visibleReturns.length > 0 && <div className="space-y-4">{visibleReturns.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{item.productName || "Product"}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{label(item.returnStatus)}</span>{(item.dispute || item.returnStatus === "disputed") && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">Disputed</span>}</div>
                <p className="mt-2 text-sm text-slate-500">Return ID: <span className="font-mono">{item.id}</span> · Order: <span className="font-mono">{item.orderId || "—"}</span></p>
                <p className="mt-1 text-sm text-slate-600">Customer: {item.customerName || "Customer"} · Requested: {dateLabel(item.createdAt)}</p></div>
              <div className="text-left md:text-right"><p className="text-xl font-bold text-slate-900">{money(item.amount)}</p><p className="text-sm text-slate-500">Qty: {Number(item.quantity) || 0}</p></div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Reason</p><p className="mt-1 text-sm font-medium text-slate-800">{label(item.reason)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Refund status</p><p className="mt-1 text-sm font-medium text-slate-800">{label(item.refundStatus || "pending")}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">QC status</p><p className="mt-1 text-sm font-medium text-slate-800">{label(item.qcStatus || "pending")}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Refund amount</p><p className="mt-1 text-sm font-medium text-slate-800">{money(item.refundAmount)}</p></div>
            </div>
            {item.description && <div className="mt-4 rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer description</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.description}</p></div>}
          </article>)}</div>}
        </div>
      </main>
      <Footer />
    </>
  );
}
