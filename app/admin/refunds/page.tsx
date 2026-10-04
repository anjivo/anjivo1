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
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type RefundStatus =
  | "not_applicable"
  | "pending"
  | "approved"
  | "initiated"
  | "completed"
  | "failed";

type ReturnStatus =
  | "requested" | "approved" | "rejected" | "pickup_pending"
  | "picked_up" | "received" | "qc_pending" | "qc_passed"
  | "qc_failed" | "refund_pending" | "refund_initiated"
  | "completed" | "disputed";

type Refund = {
  id: string; orderId: string; productId: string; productName: string;
  customerId: string; customerName: string; customerEmail: string; customerPhone: string;
  sellerId: string; sellerName: string; amount: number; refundAmount: number;
  refundStatus: RefundStatus; returnStatus: ReturnStatus; reason: string;
  dispute: boolean; createdAt?: unknown; updatedAt?: unknown;
};

const refundStatuses: RefundStatus[] = ["not_applicable", "pending", "approved", "initiated", "completed", "failed"];

function str(v: unknown) { return v == null ? "" : String(v); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function bool(v: unknown) { return v === true; }
function time(v: unknown) {
  if (v && typeof v === "object" && "seconds" in v) return Number((v as { seconds?: unknown }).seconds ?? 0) * 1000;
  if (v instanceof Date) return v.getTime();
  return 0;
}
function date(v: unknown) { const t = time(v); return t ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(t)) : "—"; }
function money(v: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v); }
function normalizeRefund(v: unknown): RefundStatus { const s = str(v); return refundStatuses.includes(s as RefundStatus) ? s as RefundStatus : "not_applicable"; }
function normalizeReturn(v: unknown): ReturnStatus { const s = str(v); const allowed: ReturnStatus[] = ["requested","approved","rejected","pickup_pending","picked_up","received","qc_pending","qc_passed","qc_failed","refund_pending","refund_initiated","completed","disputed"]; return allowed.includes(s as ReturnStatus) ? s as ReturnStatus : "requested"; }
function statusStyle(s: RefundStatus) {
  if (s === "completed") return "bg-green-100 text-green-700";
  if (s === "failed") return "bg-red-100 text-red-700";
  if (s === "initiated") return "bg-blue-100 text-blue-700";
  if (s === "approved") return "bg-purple-100 text-purple-700";
  if (s === "pending") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-600";
}
function label(s: string) { return s.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()); }

function mapRefund(id: string, data: Record<string, unknown>): Refund {
  return {
    id,
    orderId: str(data.orderId), productId: str(data.productId || data.id),
    productName: str(data.productName || data.name), customerId: str(data.customerId || data.userId),
    customerName: str(data.customerName), customerEmail: str(data.customerEmail), customerPhone: str(data.customerPhone),
    sellerId: str(data.sellerId), sellerName: str(data.sellerName), amount: num(data.amount || data.orderAmount),
    refundAmount: num(data.refundAmount), refundStatus: normalizeRefund(data.refundStatus),
    returnStatus: normalizeReturn(data.returnStatus || data.status), reason: str(data.reason),
    dispute: bool(data.dispute), createdAt: data.createdAt, updatedAt: data.updatedAt,
  };
}

export default function AdminRefundsPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filter, setFilter] = useState<"all" | RefundStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Refund | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) { window.location.href = "/login?redirect=/admin/refunds"; return; }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) { window.location.href = "/"; return; }
        if (snap.data().role !== "ADMIN") { window.location.href = "/account"; return; }
        setAuthorized(true);
        await loadRefunds();
      } catch (e) { console.error(e); setError("Admin access verify nahi ho saka."); }
      finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  async function loadRefunds() {
    try {
      setError("");
      const snap = await getDocs(collection(db, "returns"));
      const list = snap.docs.map(d => mapRefund(d.id, d.data())).filter(x => x.refundAmount > 0 || x.refundStatus !== "not_applicable");
      list.sort((a,b) => time(b.createdAt) - time(a.createdAt));
      setRefunds(list);
    } catch (e) { console.error(e); setError("Refund records load nahi ho paaye."); }
  }

  async function updateRefund(refund: Refund, status: RefundStatus) {
    if (refund.refundStatus === status) return;
    if (status === "completed" && refund.refundAmount <= 0) { setError("Completed refund ke liye valid refund amount required hai."); return; }
    if (!window.confirm(`Refund #${refund.id.slice(0, 10)} ko "${label(status)}" status dena hai?`)) return;
    try {
      setProcessing(refund.id); setError(""); setSuccess("");
      const payload: Record<string, unknown> = { refundStatus: status, updatedAt: serverTimestamp() };
      if (status === "completed") payload.returnStatus = "completed";
      await updateDoc(doc(db, "returns", refund.id), payload);
      setRefunds(current => current.map(x => x.id === refund.id ? { ...x, refundStatus: status, returnStatus: status === "completed" ? "completed" : x.returnStatus } : x));
      setSelected(current => current && current.id === refund.id ? { ...current, refundStatus: status, returnStatus: status === "completed" ? "completed" : current.returnStatus } : current);
      setSuccess(`Refund #${refund.id.slice(0, 8)} updated.`);
    } catch (e) { console.error(e); setError(e instanceof Error ? e.message : "Refund update nahi ho saka."); }
    finally { setProcessing(null); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return refunds.filter(r => {
      const statusOk = filter === "all" || r.refundStatus === filter;
      const text = [r.id,r.orderId,r.productId,r.productName,r.customerName,r.customerEmail,r.customerPhone,r.sellerName,r.reason].join(" ").toLowerCase();
      return statusOk && (!q || text.includes(q));
    });
  }, [refunds, filter, search]);

  const stats = useMemo(() => ({
    all: refunds.length,
    pending: refunds.filter(x => x.refundStatus === "pending").length,
    approved: refunds.filter(x => x.refundStatus === "approved").length,
    initiated: refunds.filter(x => x.refundStatus === "initiated").length,
    completed: refunds.filter(x => x.refundStatus === "completed").length,
    failed: refunds.filter(x => x.refundStatus === "failed").length,
    pendingValue: refunds.filter(x => ["pending","approved","initiated"].includes(x.refundStatus)).reduce((s,x) => s + x.refundAmount, 0),
    completedValue: refunds.filter(x => x.refundStatus === "completed").reduce((s,x) => s + x.refundAmount, 0),
  }), [refunds]);

  if (loading) return <main className="min-h-screen bg-[#f5f6f8]"><div className="mx-auto max-w-7xl px-4 py-20 text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" /><p className="mt-4 text-sm font-bold text-gray-500">Loading Refund Management...</p></div></main>;
  if (!authorized) return null;

  return <main className="min-h-screen bg-[#f5f6f8]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/"><img src="/logo/anjivo-logo.png" alt="ANJIVO" className="h-10 w-auto" /></Link>
      <div className="flex flex-wrap gap-2"><Link href="/admin" className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold">Admin Dashboard</Link><Link href="/admin/returns" className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold">Returns</Link><button onClick={loadRefunds} className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white">↻ Refresh</button></div>
    </div></header>

    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">ADMIN / REFUNDS</p><h1 className="mt-2 text-3xl font-black tracking-tight">Refund Management</h1><p className="mt-2 max-w-3xl text-sm text-gray-500">Customer refunds ko existing returns workflow ke saath manage karein.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border bg-white px-5 py-4"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Pending Value</p><p className="mt-1 text-xl font-black">{money(stats.pendingValue)}</p></div><div className="rounded-2xl border bg-white px-5 py-4"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Completed</p><p className="mt-1 text-xl font-black">{money(stats.completedValue)}</p></div></div></div>

      {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {success && <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">✓ {success}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {(["all","pending","approved","initiated","completed","failed"] as const).map(s => <button key={s} onClick={() => setFilter(s)} className={`rounded-2xl border p-4 text-left ${filter === s ? "border-black bg-black text-white" : "border-gray-200 bg-white"}`}><p className="text-[10px] font-black uppercase">{label(s)}</p><p className="mt-1 text-2xl font-black">{s === "all" ? stats.all : stats[s]}</p></button>)}
      </section>

      <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5"><div className="flex flex-col gap-3 md:flex-row"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search refund, order, customer, seller, product..." className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black" /><button onClick={() => {setSearch("");setFilter("all");}} className="rounded-xl border border-gray-200 px-5 py-3 text-xs font-black">Clear</button></div></section>

      <section className="mt-5 overflow-hidden rounded-3xl border border-gray-200 bg-white"><div className="overflow-x-auto"><table className="min-w-[1100px] w-full"><thead className="bg-gray-50"><tr className="text-left text-[10px] font-black uppercase tracking-wide text-gray-400"><th className="px-5 py-4">Refund</th><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Seller</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map(r => <tr key={r.id} className="text-sm"><td className="px-5 py-4"><p className="font-black">#{r.id.slice(0,10)}</p><p className="text-xs text-gray-500">Order: {r.orderId || "—"}</p><p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">{r.productName || "Product"}</p></td><td className="px-5 py-4"><p className="font-bold">{r.customerName || "—"}</p><p className="text-xs text-gray-500">{r.customerEmail || r.customerPhone || "—"}</p></td><td className="px-5 py-4 font-bold">{r.sellerName || "—"}</td><td className="px-5 py-4"><p className="font-black">{money(r.refundAmount)}</p><p className="text-xs text-gray-400">Order amount: {money(r.amount)}</p></td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${statusStyle(r.refundStatus)}`}>{label(r.refundStatus).toUpperCase()}</span>{r.dispute && <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-[9px] font-black text-red-700">DISPUTED</span>}</td><td className="px-5 py-4 text-xs text-gray-500">{date(r.createdAt)}</td><td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={() => setSelected(r)} className="rounded-xl border px-3 py-2 text-xs font-black">View</button><select value={r.refundStatus} disabled={processing === r.id} onChange={e => updateRefund(r, e.target.value as RefundStatus)} className="rounded-xl border px-3 py-2 text-xs font-bold"><option value="not_applicable">N/A</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="initiated">Initiated</option><option value="completed">Completed</option><option value="failed">Failed</option></select></div></td></tr>)}{filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No refund records found.</td></tr>}</tbody></table></div></section>
    </div>

    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"><div className="mx-auto mt-10 max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-gray-400">Refund Details</p><h2 className="mt-1 text-2xl font-black">#{selected.id.slice(0,12)}</h2></div><button onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2 text-xs font-black">Close</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Info title="Order ID" value={selected.orderId || "—"}/><Info title="Product" value={selected.productName || "—"}/><Info title="Customer" value={selected.customerName || "—"}/><Info title="Customer Contact" value={selected.customerEmail || selected.customerPhone || "—"}/><Info title="Seller" value={selected.sellerName || "—"}/><Info title="Refund Amount" value={money(selected.refundAmount)}/><Info title="Reason" value={selected.reason || "Not specified"}/><Info title="Created" value={date(selected.createdAt)}/></div><div className="mt-6 rounded-2xl bg-gray-50 p-5"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Refund Status</p><select value={selected.refundStatus} disabled={processing === selected.id} onChange={e => updateRefund(selected, e.target.value as RefundStatus)} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm font-black"><option value="not_applicable">Not Applicable</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="initiated">Initiated</option><option value="completed">Completed</option><option value="failed">Failed</option></select></div><div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-800"><b>Existing workflow:</b> Return request → approval → pickup → received → QC → refund approval → refund initiated → completed.</div></div></div>}
  </main>;
}

function Info({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{title}</p><p className="mt-1 break-words text-sm font-bold text-gray-800">{value}</p></div>; }
