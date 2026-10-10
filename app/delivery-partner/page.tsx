"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type ShippingAddress = {
  fullName?: string;
  name?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  image?: string;
  unitPrice: number;
};

type DeliveryOrder = {
  id: string;
  shippingAddress: ShippingAddress | null;
  items: OrderItem[];
  subtotal: number;
  shippingCharge: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  orderStatus: string;
  fulfillmentStatus: string;
  deliveryAssignmentStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type Partner = { id: string; name: string; phone: string };
type ApiResponse = {
  success?: boolean;
  error?: string;
  partner?: Partner;
  orders?: DeliveryOrder[];
  order?: DeliveryOrder;
};

const STATUS_LABELS: Record<string, string> = {
  placed: "Placed",
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Picked up / Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
};

function normalizeStatus(value?: string) {
  return String(value ?? "placed").trim().toLowerCase().replace(/\s+/g, "_");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getAddressLines(address: ShippingAddress | null) {
  if (!address) return [];
  return [
    address.addressLine1,
    address.addressLine2,
    address.address,
    [address.city, address.state].filter(Boolean).join(", "),
    address.pincode ? `PIN: ${address.pincode}` : "",
  ].filter((line): line is string => Boolean(line?.trim()));
}

export default function DeliveryPartnerDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "delivered">("all");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const loadOrders = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/delivery-partner/orders", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load assigned orders.");
      }
      setPartner(data.partner ?? null);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setPartner(null);
      setOrders([]);
      setError(err instanceof Error ? err.message : "Unable to load assigned orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadOrders(user);
    else {
      setPartner(null);
      setOrders([]);
    }
  }, [user, loadOrders]);

  const filteredOrders = useMemo(() => {
    if (filter === "delivered") {
      return orders.filter((order) => normalizeStatus(order.status || order.orderStatus) === "delivered");
    }
    if (filter === "active") {
      return orders.filter((order) => !["delivered", "cancelled", "returned", "refunded"].includes(normalizeStatus(order.status || order.orderStatus)));
    }
    return orders;
  }, [filter, orders]);

  const stats = useMemo(() => {
    const delivered = orders.filter((order) => normalizeStatus(order.status || order.orderStatus) === "delivered").length;
    const active = orders.filter((order) => !["delivered", "cancelled", "returned", "refunded"].includes(normalizeStatus(order.status || order.orderStatus))).length;
    return { total: orders.length, active, delivered };
  }, [orders]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
      setNotice("Login successful. Loading your assigned orders…");
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "auth/user-disabled") {
        setError("Your account is inactive. Please contact the ANJIVO admin.");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Email or password is incorrect.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
      }
    } finally {
      setLoginLoading(false);
    }
  }

  async function updateStatus(order: DeliveryOrder, status: "shipped" | "out_for_delivery" | "delivered") {
    if (!user) return;
    setError("");
    setNotice("");
    setUpdatingOrderId(order.id);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/delivery-partner/orders", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: order.id, status }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to update delivery status.");
      }
      if (data.order) {
        setOrders((current) => current.map((item) => item.id === order.id ? data.order! : item));
      } else {
        await loadOrders(user);
      }
      setNotice(`Order #${order.id.slice(-8)} updated to ${STATUS_LABELS[status] ?? status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update delivery status.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function handleLogout() {
    setError("");
    setNotice("");
    await signOut(auth);
  }

  if (!authReady) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-600">Loading ANJIVO Delivery…</main>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white">A</div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-600">ANJIVO Delivery</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Partner login</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in with the email and temporary password provided by the ANJIVO admin. Inactive accounts cannot sign in.</p>
          {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="delivery-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
              <input id="delivery-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="delivery-password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input id="delivery-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100" placeholder="Enter your password" />
            </div>
            <button type="submit" disabled={loginLoading} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">{loginLoading ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="mt-5 text-xs leading-5 text-slate-400">If your account has not been activated, contact your administrator.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">ANJIVO Delivery</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Delivery dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">{partner?.name ? `Welcome, ${partner.name}` : user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void loadOrders(user)} disabled={loading} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh orders"}</button>
            <button onClick={() => void handleLogout()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Assigned orders" value={stats.total} />
          <StatCard label="In progress" value={stats.active} />
          <StatCard label="Delivered" value={stats.delivered} />
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">My deliveries</h2>
            <p className="mt-1 text-sm text-slate-500">Only orders assigned to your account are shown here.</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter orders">
            {(["all", "active", "delivered"] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${filter === value ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}>{value === "all" ? "All orders" : value === "active" ? "In progress" : "Delivered"}</button>
            ))}
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading your assigned orders…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <div className="text-lg font-semibold text-slate-800">No orders found</div>
            <p className="mt-2 text-sm text-slate-500">When the admin assigns an order to you, it will appear here.</p>
          </div>
        ) : (
          <section className="mt-5 space-y-4">
            {filteredOrders.map((order) => {
              const status = normalizeStatus(order.status || order.orderStatus);
              const address = order.shippingAddress;
              const customerName = address?.fullName || address?.name || "Customer";
              const addressLines = getAddressLines(address);
              const isUpdating = updatingOrderId === order.id;
              const terminal = ["delivered", "cancelled", "returned", "refunded"].includes(status);
              return (
                <article key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Order ID</p>
                      <h3 className="mt-1 break-all text-lg font-bold">#{order.id}</h3>
                      <p className="mt-1 text-xs text-slate-500">Placed: {formatDate(order.createdAt)}</p>
                    </div>
                    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-bold ${status === "delivered" ? "bg-emerald-100 text-emerald-800" : status === "cancelled" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}`}>{STATUS_LABELS[status] ?? status.replace(/_/g, " ")}</span>
                  </div>

                  <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[1fr_1fr]">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Customer & delivery address</h4>
                      <p className="mt-3 font-semibold">{customerName}</p>
                      {address?.phone ? <a className="mt-1 inline-block text-sm font-medium text-blue-700 underline" href={`tel:${address.phone}`}>{address.phone}</a> : <p className="mt-1 text-sm text-slate-500">Phone number not available</p>}
                      <div className="mt-2 space-y-1 text-sm leading-5 text-slate-600">{addressLines.length ? addressLines.map((line, index) => <p key={`${order.id}-address-${index}`}>{line}</p>) : <p>Address not available in this order.</p>}</div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Order summary</h4>
                      <div className="mt-3 space-y-3">
                        {order.items.map((item, index) => (
                          <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0"><p className="font-medium text-slate-800">{item.productName}</p><p className="mt-0.5 text-slate-500">Qty: {item.quantity}</p></div>
                            <p className="shrink-0 font-semibold">{formatMoney(item.unitPrice * item.quantity)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
                        <div className="flex justify-between gap-3 text-slate-500"><span>Shipping</span><span>{formatMoney(order.shippingCharge)}</span></div>
                        <div className="mt-2 flex justify-between gap-3 font-bold text-slate-900"><span>Order total</span><span>{formatMoney(order.total)}</span></div>
                        <p className="mt-2 text-xs text-slate-500">Payment: {order.paymentMethod || "Not specified"} · {order.paymentStatus || "Status unavailable"}</p>
                      </div>
                    </div>
                  </div>

                  {!terminal && (
                    <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                      {status !== "shipped" && status !== "out_for_delivery" && <button disabled={isUpdating} onClick={() => void updateStatus(order, "shipped")} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50">{isUpdating ? "Updating…" : "Mark picked up"}</button>}
                      {status !== "out_for_delivery" && <button disabled={isUpdating} onClick={() => void updateStatus(order, "out_for_delivery")} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">Out for delivery</button>}
                      <button disabled={isUpdating || status === "delivered"} onClick={() => void updateStatus(order, "delivered")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Mark delivered</button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p></div>;
}
