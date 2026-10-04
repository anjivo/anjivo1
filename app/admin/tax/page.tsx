"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Row = {
  id: string;
  customer: string;
  sellers: string[];
  subtotal: number;
  discount: number;
  total: number;
  taxAmount: number;
  gstRate: number | null;
  gstin: string;
  hsn: string[];
  status: string;
  createdAt?: unknown;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown) => typeof v === "string" ? v.trim() : "";

const time = (v: unknown) => {
  if (!v) return 0;
  if (typeof v === "object" && v !== null && "seconds" in v)
    return Number((v as {seconds?: unknown}).seconds ?? 0) * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

function mapRow(id: string, d: Record<string, any>): Row {
  const items = Array.isArray(d.items) ? d.items : [];
  return {
    id,
    customer: str(d.customerName || d.name || d.email) || "Customer",
    sellers: Array.from(new Set(items.map((x: any) => str(x?.sellerName || x?.sellerId)).filter(Boolean))),
    subtotal: num(d.subtotal),
    discount: num(d.discount),
    total: num(d.totalAmount ?? d.total ?? d.grandTotal),
    taxAmount: num(d.taxAmount ?? d.gstAmount ?? d.totalTax ?? d.tax),
    gstRate: d.gstRate ?? d.taxRate ?? d.taxPercentage ?? null,
    gstin: str(d.gstin || d.customerGSTIN || d.sellerGSTIN || d.sellerGstin),
    hsn: Array.from(new Set(items.map((x: any) => str(x?.hsnCode || x?.hsn || x?.HSN)).filter(Boolean))),
    status: str(d.fulfillmentStatus || d.orderStatus || d.status) || "pending",
    createdAt: d.createdAt,
  };
}

export default function AdminTaxPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"all" | "today" | "7d" | "30d">("all");

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const u = await getDoc(doc(db, "users", user.uid));
    if (!u.exists() || u.data().role !== "ADMIN") return;
    setAuthorized(true);
    const snap = await getDocs(collection(db, "orders"));
    setRows(snap.docs.map(x => mapRow(x.id, x.data())).sort((a,b) => time(b.createdAt)-time(a.createdAt)));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setLoading(true);
      setError("");
      try {
        if (!user) {
          window.location.href = "/login?redirect=/admin/tax";
          return;
        }
        const u = await getDoc(doc(db, "users", user.uid));
        if (!u.exists()) { window.location.href = "/"; return; }
        if (u.data().role !== "ADMIN") { window.location.href = "/account"; return; }
        await load();
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Unable to load tax data.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return rows.filter(r => {
      const q = search.toLowerCase().trim();
      const text = [r.id,r.customer,r.gstin,r.status,...r.sellers,...r.hsn].join(" ").toLowerCase();
      if (q && !text.includes(q)) return false;
      const t = time(r.createdAt);
      if (period === "7d") return t >= now - 7*86400000;
      if (period === "30d") return t >= now - 30*86400000;
      if (period === "today") {
        const d = new Date(); d.setHours(0,0,0,0);
        return t >= d.getTime();
      }
      return true;
    });
  }, [rows,search,period]);

  const stats = useMemo(() => {
    const taxRows = rows.filter(r => r.taxAmount > 0 || r.gstRate !== null || r.gstin || r.hsn.length);
    return {
      orders: rows.length,
      records: taxRows.length,
      taxable: taxRows.reduce((s,r) => s + Math.max(0,r.subtotal-r.discount),0),
      tax: taxRows.reduce((s,r) => s+r.taxAmount,0),
      gstin: rows.filter(r=>r.gstin).length,
      hsn: rows.filter(r=>r.hsn.length).length,
    };
  }, [rows]);

  if (loading) return <main className="min-h-screen bg-[#f5f6f8] p-20 text-center"><p className="font-bold">Loading Tax & GST...</p></main>;
  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-[#f5f6f8]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-gray-400">ANJIVO ADMIN</p><h1 className="text-xl font-black">Tax & GST</h1></div>
          <div className="flex gap-2">
            <Link href="/admin" className="rounded-xl border px-4 py-2.5 text-xs font-bold">← Admin Dashboard</Link>
            <Link href="/admin/reports/finance" className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white">Financial Reports</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7">
        <p className="text-xs font-black uppercase tracking-[.2em] text-gray-400">FINANCE / TAX</p>
        <h2 className="mt-2 text-3xl font-black">Tax & GST Management</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500">Existing order records me stored tax/GST information ka operational view. Page fabricated GST rates ya HSN values create nahi karta.</p>

        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Orders" value={stats.orders}/>
          <Stat label="Tax Records" value={stats.records}/>
          <Stat label="Taxable Value" value={`₹${stats.taxable.toLocaleString("en-IN")}`}/>
          <Stat label="Tax Amount" value={`₹${stats.tax.toLocaleString("en-IN")}`}/>
          <Stat label="GSTIN Records" value={stats.gstin}/>
          <Stat label="HSN Records" value={stats.hsn}/>
        </div>

        {rows.length > 0 && stats.records === 0 && <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          <b>Notice:</b> current orders me dedicated taxAmount/gstRate/GSTIN/HSN values populated nahi dikh rahe. Isliye tax figures invent nahi kiye gaye hain.
        </div>}

        <section className="mt-7 rounded-3xl border bg-white p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 lg:flex-row">
            <div><h3 className="text-lg font-black">Tax Records</h3><p className="text-xs text-gray-500">Order, customer, seller, GSTIN aur HSN search karein.</p></div>
            <div className="flex gap-2">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="w-64 rounded-xl border px-4 py-3 text-sm outline-none"/>
              <select value={period} onChange={e=>setPeriod(e.target.value as any)} className="rounded-xl border bg-white px-3 text-sm font-semibold">
                <option value="all">All Time</option><option value="today">Today</option><option value="7d">7 Days</option><option value="30d">30 Days</option>
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[1050px] w-full">
              <thead><tr className="border-b text-left">{["Order","Customer","Seller","Taxable","GST / Tax","GSTIN","HSN","Date"].map(x=><th key={x} className="px-3 py-3 text-[10px] font-black uppercase text-gray-400">{x}</th>)}</tr></thead>
              <tbody>{filtered.map(r => {
                const taxable = Math.max(0,r.subtotal-r.discount);
                return <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-4"><Link href={`/admin/orders?order=${encodeURIComponent(r.id)}`} className="text-xs font-black hover:underline">#{r.id.slice(0,12)}</Link><p className="text-[10px] text-gray-400">{r.status}</p></td>
                  <td className="px-3 py-4 text-xs font-bold">{r.customer}</td>
                  <td className="px-3 py-4 text-xs">{r.sellers.length ? r.sellers.join(", ") : "—"}</td>
                  <td className="px-3 py-4 text-xs font-black">₹{taxable.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-4 text-xs font-black">₹{r.taxAmount.toLocaleString("en-IN")}<p className="text-[10px] font-normal text-gray-400">{r.gstRate !== null ? `${r.gstRate}%` : "Rate not stored"}</p></td>
                  <td className="px-3 py-4 text-xs">{r.gstin || "—"}</td>
                  <td className="px-3 py-4 text-xs">{r.hsn.length ? r.hsn.join(", ") : "—"}</td>
                  <td className="px-3 py-4 text-xs text-gray-500">{time(r.createdAt) ? new Date(time(r.createdAt)).toLocaleDateString("en-IN") : "—"}</td>
                </tr>;
              })}</tbody>
            </table>
            {!filtered.length && <div className="py-14 text-center text-sm font-bold">No tax records found.</div>}
          </div>
        </section>

        <div className="mt-7 rounded-3xl border bg-white p-5">
          <h3 className="text-sm font-black">Important implementation note</h3>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            Current ANJIVO order model clearly stores subtotal, shippingCharge, discount, totalAmount, payment data and seller/item data. Dedicated tax calculation/storage is not consistently present in the inspected source. This page therefore acts as a reporting layer over tax fields when they exist; it does not silently introduce a GST calculation rule.
          </p>
        </div>
      </div>
    </main>
  );
}

function Stat({label,value}:{label:string;value:string|number}) {
  return <div className="rounded-2xl border bg-white p-5"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>;
}
