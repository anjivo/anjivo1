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
import { getSellerProducts } from "@/lib/seller-products";
import type { Product } from "@/types/product";

type OrderSummary = {
  id: string;
  status: string;
  totalAmount: number;
  sellerSubtotal: number;
  createdAt?: unknown;
  customerName: string;
};

type SellerDashboardData = {
  businessName: string;
  sellerStatus: string;
  sellerVerified: boolean;
  products: Product[];
  orders: OrderSummary[];
};

function getTimestampValue(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function formatDate(value: unknown) {
  const timestamp = getTimestampValue(value);

  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case "delivered":
      return "bg-green-100 text-green-700";

    case "shipped":
      return "bg-blue-100 text-blue-700";

    case "processing":
      return "bg-purple-100 text-purple-700";

    case "confirmed":
      return "bg-indigo-100 text-indigo-700";

    case "cancelled":
      return "bg-red-100 text-red-700";

    case "returned":
      return "bg-orange-100 text-orange-700";

    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

export default function SellerDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState("");
  const [error, setError] = useState("");

  const [dashboard, setDashboard] =
    useState<SellerDashboardData | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace("/login?redirect=/seller");
          return;
        }

        try {
          setLoading(true);
          setError("");
          setSellerId(user.uid);

          const userRef = collection(db, "users");

          const userQuery = query(
            userRef,
            where("__name__", "==", user.uid)
          );

          const userSnapshot = await getDocs(userQuery);

          if (userSnapshot.empty) {
            setError("Seller account information was not found.");
            setLoading(false);
            return;
          }

          const userData = userSnapshot.docs[0].data();

          if (userData.role !== "SELLER") {
            setError("Seller access is required.");
            setLoading(false);
            return;
          }

          const sellerRef = collection(db, "sellers");

          const sellerQuery = query(
            sellerRef,
            where("__name__", "==", user.uid)
          );

          const sellerSnapshot =
            await getDocs(sellerQuery);

          let businessName =
            String(
              userData.businessName ??
                userData.name ??
                user.displayName ??
                "ANJIVO Seller"
            );

          let sellerStatus =
            String(
              userData.sellerStatus ??
                "pending"
            );

          let sellerVerified = false;

          if (!sellerSnapshot.empty) {
            const sellerData =
              sellerSnapshot.docs[0].data();

            businessName =
              String(
                sellerData.businessName ??
                  businessName
              );

            sellerStatus =
              String(
                sellerData.status ??
                  sellerData.sellerStatus ??
                  sellerStatus
              );

            sellerVerified =
              sellerData.sellerVerified === true;
          }

          const products =
            await getSellerProducts(user.uid);

          /*
           * Seller orders
           */
          const ordersQuery = query(
            collection(db, "orders"),
            where(
              "sellerIds",
              "array-contains",
              user.uid
            )
          );

          const ordersSnapshot =
            await getDocs(ordersQuery);

          const orders: OrderSummary[] =
            ordersSnapshot.docs.map(
              (orderDoc) => {
                const data =
                  orderDoc.data();

                const items =
                  Array.isArray(data.items)
                    ? data.items
                    : [];

                const sellerItems =
                  items.filter(
                    (item) =>
                      item &&
                      typeof item === "object" &&
                      (item as {
                        sellerId?: unknown;
                      }).sellerId ===
                        user.uid
                  );

                const sellerSubtotal =
                  sellerItems.reduce(
                    (sum, item) => {
                      const current =
                        item as {
                          selectedPrice?: unknown;
                          quantity?: unknown;
                          price?: unknown;
                        };

                      const price =
                        Number(
                          current.selectedPrice ??
                            current.price ??
                            0
                        );

                      const quantity =
                        Number(
                          current.quantity ?? 0
                        );

                      return (
                        sum +
                        price * quantity
                      );
                    },
                    0
                  );

                return {
                  id: orderDoc.id,

                  status: String(
                    data.status ??
                      "pending"
                  ),

                  totalAmount: Number(
                    data.totalAmount ?? 0
                  ),

                  sellerSubtotal,

                  createdAt:
                    data.createdAt,

                  customerName:
                    String(
                      data.customerName ??
                        data.userName ??
                        "Customer"
                    ),
                };
              }
            );

          orders.sort(
            (a, b) =>
              getTimestampValue(
                b.createdAt
              ) -
              getTimestampValue(
                a.createdAt
              )
          );

          setDashboard({
            businessName,
            sellerStatus,
            sellerVerified,
            products,
            orders,
          });
        } catch (err) {
          console.error(
            "Seller dashboard error:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Unable to load seller dashboard."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  const stats = useMemo(() => {
    const products =
      dashboard?.products ?? [];

    const orders =
      dashboard?.orders ?? [];

    return {
      totalProducts: products.length,

      activeProducts:
        products.filter(
          (product) =>
            product.status === "active"
        ).length,

      draftProducts:
        products.filter(
          (product) =>
            product.status === "draft"
        ).length,

      outOfStock:
        products.filter(
          (product) =>
            product.status ===
              "out_of_stock" ||
            product.stock <= 0
        ).length,

      blockedProducts:
        products.filter(
          (product) =>
            product.status === "blocked"
        ).length,

      totalStock:
        products.reduce(
          (sum, product) =>
            sum + product.stock,
          0
        ),

      totalOrders: orders.length,

      pendingOrders:
        orders.filter(
          (order) =>
            order.status ===
              "pending" ||
            order.status === "confirmed"
        ).length,

      processingOrders:
        orders.filter(
          (order) =>
            order.status ===
              "processing" ||
            order.status === "shipped"
        ).length,

      deliveredOrders:
        orders.filter(
          (order) =>
            order.status ===
            "delivered"
        ).length,

      cancelledOrders:
        orders.filter(
          (order) =>
            order.status ===
            "cancelled"
        ).length,

      totalSellerValue:
        orders.reduce(
          (sum, order) =>
            sum + order.sellerSubtotal,
          0
        ),
    };
  }, [dashboard]);

  const recentOrders =
    dashboard?.orders.slice(0, 5) ?? [];

  const lowStockProducts =
    dashboard?.products
      .filter(
        (product) =>
          product.stock > 0 &&
          product.stock <= 10
      )
      .sort(
        (a, b) =>
          a.stock - b.stock
      )
      .slice(0, 5) ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-semibold text-gray-500">
              Loading seller dashboard...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-black text-red-800">
              Unable to load dashboard
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error ||
                "Seller dashboard data is unavailable."}
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              Go Home
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const normalizedStatus =
    dashboard.sellerStatus.toLowerCase();

  const isApproved =
    normalizedStatus === "approved";

  const isPending =
    normalizedStatus === "pending";

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              ANJIVO Seller Center
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Welcome,{" "}
              {dashboard.businessName}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Manage your products, orders, inventory,
              business profile and seller operations from
              one place.
            </p>
          </div>

          <div
            className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${
              isApproved
                ? "bg-green-100 text-green-700"
                : isPending
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {dashboard.sellerVerified
              ? "✓ Verified Seller"
              : `Seller ${dashboard.sellerStatus}`}
          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              {error}
            </p>
          </div>
        )}

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <section className="mt-8">

          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">
                Quick Actions
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Frequently used seller tools
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <Link
              href="/seller/products/new"
              className="group rounded-2xl bg-black p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="text-2xl">
                ＋
              </div>

              <p className="mt-4 text-sm font-black">
                Add Product
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Create a new product listing
              </p>
            </Link>

            <Link
              href="/seller/products"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="text-2xl">
                📦
              </div>

              <p className="mt-4 text-sm font-black">
                Manage Products
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Products, stock and pricing
              </p>
            </Link>

            <Link
              href="/seller/orders"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="text-2xl">
                🛒
              </div>

              <p className="mt-4 text-sm font-black">
                Manage Orders
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Process and update orders
              </p>
            </Link>

            <Link
              href="/seller/profile"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="text-2xl">
                🏪
              </div>

              <p className="mt-4 text-sm font-black">
                Business Profile
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Update business information
              </p>
            </Link>

          </div>
        </section>

        {/* =================================================
            MAIN STATS
        ================================================= */}

        <section className="mt-8">

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <StatCard
              icon="📦"
              title="Total Products"
              value={stats.totalProducts}
              subtitle={`${stats.activeProducts} active`}
            />

            <StatCard
              icon="🛒"
              title="Total Orders"
              value={stats.totalOrders}
              subtitle={`${stats.pendingOrders} need attention`}
            />

            <StatCard
              icon="📊"
              title="Total Stock"
              value={stats.totalStock}
              subtitle={`${stats.outOfStock} out of stock`}
            />

            <StatCard
              icon="₹"
              title="Order Value"
              value={formatCurrency(
                stats.totalSellerValue
              )}
              subtitle="Seller order value"
            />

          </div>

        </section>

        {/* =================================================
            PRODUCT BREAKDOWN
        ================================================= */}

        <section className="mt-6">

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

            <MiniStat
              title="Active"
              value={stats.activeProducts}
              icon="✓"
              className="text-green-700"
            />

            <MiniStat
              title="Draft"
              value={stats.draftProducts}
              icon="📝"
              className="text-yellow-700"
            />

            <MiniStat
              title="Out of Stock"
              value={stats.outOfStock}
              icon="!"
              className="text-red-700"
            />

            <MiniStat
              title="Blocked"
              value={stats.blockedProducts}
              icon="×"
              className="text-gray-700"
            />

            <MiniStat
              title="Low Stock"
              value={lowStockProducts.length}
              icon="⚠"
              className="text-orange-700"
            />

          </div>

        </section>

        {/* =================================================
            ORDER BREAKDOWN
        ================================================= */}

        <section className="mt-6">

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <MiniStat
              title="Pending"
              value={stats.pendingOrders}
              icon="⏳"
              className="text-yellow-700"
            />

            <MiniStat
              title="Processing"
              value={stats.processingOrders}
              icon="⚙"
              className="text-blue-700"
            />

            <MiniStat
              title="Delivered"
              value={stats.deliveredOrders}
              icon="✓"
              className="text-green-700"
            />

            <MiniStat
              title="Cancelled"
              value={stats.cancelledOrders}
              icon="×"
              className="text-red-700"
            />

          </div>

        </section>

        {/* =================================================
            RECENT ORDERS + LOW STOCK
        ================================================= */}

        <section className="mt-8 grid gap-6 lg:grid-cols-3">

          {/* RECENT ORDERS */}

          <div className="rounded-3xl border border-gray-200 bg-white lg:col-span-2">

            <div className="flex items-center justify-between border-b border-gray-100 p-5">

              <div>
                <h2 className="text-lg font-black">
                  Recent Orders
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Latest orders containing your products
                </p>
              </div>

              <Link
                href="/seller/orders"
                className="text-xs font-bold text-black hover:underline"
              >
                View All →
              </Link>

            </div>

            {recentOrders.length === 0 ? (
              <div className="p-10 text-center">

                <div className="text-4xl">
                  🛒
                </div>

                <p className="mt-3 text-sm font-bold">
                  No orders yet
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Your recent seller orders will appear here.
                </p>

              </div>
            ) : (
              <div className="divide-y divide-gray-100">

                {recentOrders.map(
                  (order) => (
                    <Link
                      key={order.id}
                      href="/seller/orders"
                      className="block p-5 transition hover:bg-gray-50"
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div>

                          <p className="text-sm font-black">
                            #{order.id.slice(
                              0,
                              8
                            )}
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {order.customerName}
                            {" • "}
                            {formatDate(
                              order.createdAt
                            )}
                          </p>

                        </div>

                        <div className="flex items-center justify-between gap-4 sm:justify-end">

                          <div className="text-right">

                            <p className="text-sm font-black">
                              {formatCurrency(
                                order.sellerSubtotal
                              )}
                            </p>

                            <p className="text-[10px] text-gray-400">
                              Seller value
                            </p>

                          </div>

                          <span
                            className={`rounded-full px-3 py-1.5 text-[10px] font-bold capitalize ${getStatusClass(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>

                        </div>

                      </div>

                    </Link>
                  )
                )}

              </div>
            )}

          </div>

          {/* LOW STOCK */}

          <div className="rounded-3xl border border-gray-200 bg-white">

            <div className="border-b border-gray-100 p-5">

              <h2 className="text-lg font-black">
                Low Stock
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Products that need restocking
              </p>

            </div>

            {lowStockProducts.length === 0 ? (
              <div className="p-8 text-center">

                <div className="text-3xl">
                  ✓
                </div>

                <p className="mt-3 text-sm font-bold">
                  Inventory looks good
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  No products are currently low on stock.
                </p>

              </div>
            ) : (
              <div className="divide-y divide-gray-100">

                {lowStockProducts.map(
                  (product) => (
                    <Link
                      key={product.id}
                      href={`/seller/products/${product.id}`}
                      className="block p-4 transition hover:bg-gray-50"
                    >

                      <div className="flex items-center gap-3">

                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">

                          {product.images?.[0] ? (
                            <img
                              src={
                                product.images[0]
                              }
                              alt={
                                product.name
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-lg">
                              📦
                            </div>
                          )}

                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-xs font-bold">
                            {product.name}
                          </p>

                          <p className="mt-1 text-[10px] text-gray-400">
                            {product.categoryName ||
                              "Uncategorized"}
                          </p>

                        </div>

                        <div className="text-right">

                          <p className="text-sm font-black text-orange-600">
                            {product.stock}
                          </p>

                          <p className="text-[9px] text-gray-400">
                            units
                          </p>

                        </div>

                      </div>

                    </Link>
                  )
                )}

              </div>
            )}

            <div className="border-t border-gray-100 p-4">

              <Link
                href="/seller/products"
                className="block rounded-xl bg-gray-100 px-4 py-3 text-center text-xs font-bold hover:bg-gray-200"
              >
                Manage Inventory
              </Link>

            </div>

          </div>

        </section>

        {/* =================================================
            SELLER HEALTH
        ================================================= */}

        <section className="mt-8">

          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Seller Center
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Seller Account Health
                </h2>

                <p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">
                  Keep your business profile, products,
                  inventory and order processing updated to
                  operate smoothly on ANJIVO.
                </p>

              </div>

              <Link
                href="/seller/profile"
                className="rounded-xl bg-black px-5 py-3 text-center text-xs font-bold text-white"
              >
                Manage Profile
              </Link>

            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">

              <HealthItem
                title="Business Profile"
                complete={
                  Boolean(
                    dashboard.businessName
                  )
                }
              />

              <HealthItem
                title="Seller Verification"
                complete={
                  dashboard.sellerVerified
                }
              />

              <HealthItem
                title="Product Catalog"
                complete={
                  stats.totalProducts > 0
                }
              />

            </div>

          </div>

        </section>

      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">

      <div className="flex items-start justify-between">

        <div>
          <p className="text-xs font-bold text-gray-400">
            {title}
          </p>

          <p className="mt-3 text-2xl font-black tracking-tight">
            {value}
          </p>

          <p className="mt-1 text-[10px] text-gray-400">
            {subtitle}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-lg">
          {icon}
        </div>

      </div>

    </div>
  );
}

/* =========================================================
   MINI STAT
========================================================= */

function MiniStat({
  title,
  value,
  icon,
  className,
}: {
  title: string;
  value: number;
  icon: string;
  className: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {title}
          </p>

          <p className="mt-2 text-xl font-black">
            {value}
          </p>
        </div>

        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-sm font-black ${className}`}
        >
          {icon}
        </span>

      </div>

    </div>
  );
}

/* =========================================================
   HEALTH ITEM
========================================================= */

function HealthItem({
  title,
  complete,
}: {
  title: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-4">

      <span className="text-xs font-bold text-gray-700">
        {title}
      </span>

      <span
        className={`rounded-full px-3 py-1 text-[10px] font-bold ${
          complete
            ? "bg-green-100 text-green-700"
            : "bg-yellow-100 text-yellow-700"
        }`}
      >
        {complete
          ? "Complete"
          : "Pending"}
      </span>

    </div>
  );
}
