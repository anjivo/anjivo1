"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

type Stats = {
  users: number;
  sellers: number;
  products: number;
  activeProducts: number;
  draftProducts: number;
  blockedProducts: number;
  outOfStockProducts: number;

  orders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;

  categories: number;
  reviews: number;
  pendingReviews: number;

  pendingSellers: number;
  approvedSellers: number;
  blockedSellers: number;

  wholesaleEnquiries: number;
  returns: number;
  pendingReturns: number;
  coupons: number;

  notifications: number;
};

type AdminModule = {
  title: string;
  description: string;
  href: string;
  icon: string;
  badge?: string;
  badgeType?: "important" | "new";
};

type ModuleSection = {
  title: string;
  description: string;
  items: AdminModule[];
};

const moduleSections: ModuleSection[] = [
  {
    title: "Marketplace Management",
    description:
      "Products, sellers, customers, categories and marketplace operations.",
    items: [
      {
        title: "Products",
        description:
          "Approve, block, edit, feature and manage marketplace products.",
        href: "/admin/products",
        icon: "📦",
      },
      {
        title: "Categories",
        description:
          "Manage categories, subcategories and marketplace taxonomy.",
        href: "/admin/categories",
        icon: "🗂️",
      },
      {
        title: "Sellers",
        description:
          "Applications, KYC, approval, suspension and seller accounts.",
        href: "/admin/sellers",
        icon: "🏪",
        badge: "Important",
        badgeType: "important",
      },
      {
        title: "Customers",
        description:
          "Retail and wholesale customers, accounts and activity.",
        href: "/admin/customers",
        icon: "👥",
      },
      {
        title: "Brands",
        description:
          "Manage brands, brand approvals and seller brand associations.",
        href: "/admin/brands",
        icon: "🏷️",
      },
      {
        title: "Inventory",
        description:
          "Stock monitoring, low stock and out-of-stock products.",
        href: "/admin/inventory",
        icon: "📊",
      },
    ],
  },

  {
    title: "Orders & Commerce",
    description:
      "Control the complete customer-to-seller order lifecycle.",
    items: [
      {
        title: "Orders",
        description:
          "View and manage all marketplace orders.",
        href: "/admin/orders",
        icon: "🛒",
      },
      {
        title: "Wholesale",
        description:
          "B2B enquiries, RFQ, quotations, MOQ and wholesale orders.",
        href: "/admin/wholesale",
        icon: "🏢",
      },
      {
        title: "Returns",
        description:
          "Returns, refunds, disputes and wrong-product claims.",
        href: "/admin/returns",
        icon: "↩️",
      },
      {
        title: "Coupons",
        description:
          "Create and manage marketplace discount coupons.",
        href: "/admin/coupons",
        icon: "🎟️",
      },
      {
        title: "Shipping",
        description:
          "Shipping rules, courier partners, tracking and delivery.",
        href: "/admin/shipping",
        icon: "🚚",
      },
      {
        title: "RTO / NDR",
        description:
          "Monitor failed deliveries, RTO and NDR cases.",
        href: "/admin/rto",
        icon: "📍",
      },
    ],
  },

  {
    title: "Finance & Payments",
    description:
      "Marketplace revenue, seller commission, settlements and refunds.",
    items: [
      {
        title: "Payments",
        description:
          "Online payments, COD, failed payments and reconciliation.",
        href: "/admin/payments",
        icon: "💳",
      },
      {
        title: "Commissions",
        description:
          "Seller commission rules, earnings and platform revenue.",
        href: "/admin/commissions",
        icon: "💰",
      },
      {
        title: "Payouts",
        description:
          "Seller settlements, payout status and settlement history.",
        href: "/admin/payouts",
        icon: "🏦",
      },
      {
        title: "Refunds",
        description:
          "Customer refunds and refund processing.",
        href: "/admin/refunds",
        icon: "💸",
      },
      {
        title: "Tax & GST",
        description:
          "Tax configuration and marketplace tax reports.",
        href: "/admin/tax",
        icon: "🧾",
      },
      {
        title: "Financial Reports",
        description:
          "Revenue, GMV, commission, payout and settlement reports.",
        href: "/admin/reports/finance",
        icon: "📈",
      },
    ],
  },

  {
    title: "Marketing & Growth",
    description:
      "Control promotions, discovery and customer engagement.",
    items: [
      {
        title: "Campaigns",
        description:
          "Create marketplace promotional campaigns.",
        href: "/admin/campaigns",
        icon: "🚀",
      },
      {
        title: "Coupons",
        description:
          "Discount codes, usage limits and promotional rules.",
        href: "/admin/coupons",
        icon: "🎟️",
      },
      {
        title: "Banners",
        description:
          "Homepage banners, promotional banners and placements.",
        href: "/admin/banners",
        icon: "🖼️",
      },
      {
        title: "Featured Products",
        description:
          "Control featured, trending and promoted products.",
        href: "/admin/featured",
        icon: "🔥",
      },
      {
        title: "Notifications",
        description:
          "Push, email and marketplace notifications.",
        href: "/admin/notifications",
        icon: "🔔",
      },
      {
        title: "Announcements",
        description:
          "Seller and customer marketplace announcements.",
        href: "/admin/announcements",
        icon: "📢",
      },
    ],
  },

  {
    title: "Trust, Safety & Support",
    description:
      "Protect customers and sellers and maintain marketplace quality.",
    items: [
      {
        title: "Reviews",
        description:
          "Moderate product reviews and reported reviews.",
        href: "/admin/reviews",
        icon: "⭐",
      },
      {
        title: "Disputes",
        description:
          "Customer-seller disputes and admin decisions.",
        href: "/admin/disputes",
        icon: "⚖️",
      },
      {
        title: "Complaints",
        description:
          "Customer and seller complaints.",
        href: "/admin/complaints",
        icon: "📣",
      },
      {
        title: "Support Tickets",
        description:
          "Manage customer and seller support tickets.",
        href: "/admin/support",
        icon: "🎧",
      },
      {
        title: "Fraud & Risk",
        description:
          "Suspicious activity, fake orders and risk monitoring.",
        href: "/admin/fraud",
        icon: "🛡️",
      },
      {
        title: "Moderation",
        description:
          "Marketplace content and policy moderation.",
        href: "/admin/moderation",
        icon: "🔎",
      },
    ],
  },

  {
    title: "Reports & Analytics",
    description:
      "Business intelligence and marketplace performance.",
    items: [
      {
        title: "Analytics",
        description:
          "Overall marketplace performance and growth.",
        href: "/admin/analytics",
        icon: "📊",
      },
      {
        title: "Sales Reports",
        description:
          "Daily, weekly, monthly and custom sales reports.",
        href: "/admin/reports/sales",
        icon: "📈",
      },
      {
        title: "Seller Reports",
        description:
          "Seller performance, sales and order reports.",
        href: "/admin/reports/sellers",
        icon: "🏪",
      },
      {
        title: "Product Reports",
        description:
          "Product sales, views, stock and performance.",
        href: "/admin/reports/products",
        icon: "📦",
      },
      {
        title: "Customer Reports",
        description:
          "Customer acquisition, retention and activity.",
        href: "/admin/reports/customers",
        icon: "👥",
      },
      {
        title: "Export Center",
        description:
          "Export marketplace data and operational reports.",
        href: "/admin/reports/export",
        icon: "⬇️",
      },
    ],
  },

  {
    title: "Platform & Security",
    description:
      "System configuration, access control and administrative security.",
    items: [
      {
        title: "Admin Users",
        description:
          "Manage administrators and internal access.",
        href: "/admin/users",
        icon: "👨‍💼",
      },
      {
        title: "Roles & Permissions",
        description:
          "Configure admin roles and permissions.",
        href: "/admin/roles",
        icon: "🔐",
      },
      {
        title: "Activity Logs",
        description:
          "Track important administrative actions.",
        href: "/admin/logs",
        icon: "📋",
      },
      {
        title: "Audit Trail",
        description:
          "Review sensitive marketplace changes.",
        href: "/admin/audit",
        icon: "🕵️",
      },
      {
        title: "Settings",
        description:
          "Marketplace-wide configuration and controls.",
        href: "/admin/settings",
        icon: "⚙️",
      },
      {
        title: "System Health",
        description:
          "Monitor marketplace services and integrations.",
        href: "/admin/system",
        icon: "🖥️",
      },
    ],
  },
];

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<Stats>({
    users: 0,
    sellers: 0,
    products: 0,
    activeProducts: 0,
    draftProducts: 0,
    blockedProducts: 0,
    outOfStockProducts: 0,

    orders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,

    categories: 0,
    reviews: 0,
    pendingReviews: 0,

    pendingSellers: 0,
    approvedSellers: 0,
    blockedSellers: 0,

    wholesaleEnquiries: 0,
    returns: 0,
    pendingReturns: 0,
    coupons: 0,

    notifications: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          router.replace("/login?redirect=/admin");
          return;
        }

        try {
          setError("");

          const userSnapshot = await getCountFromServer(
            query(
              collection(db, "users"),
              where("uid", "==", user.uid)
            )
          );

          if (userSnapshot.data().count === 0) {
            setError("Admin account not found.");
            setLoading(false);
            return;
          }

          /*
           * NOTE:
           * Firestore security rules remain the final authority.
           * The query above only confirms that a user document exists.
           *
           * Actual admin access is enforced by Firestore rules.
           */

          await loadStats();
        } catch (err) {
          console.error("Admin dashboard error:", err);
          setError(
            "Unable to load Admin Dashboard. Please check Firestore permissions."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  async function loadStats() {
    setRefreshing(true);
    setError("");

    try {
      const [
        usersCount,
        sellersCount,
        productsCount,
        activeProductsCount,
        draftProductsCount,
        blockedProductsCount,
        outOfStockProductsCount,

        ordersCount,
        pendingOrdersCount,
        deliveredOrdersCount,
        cancelledOrdersCount,

        categoriesCount,
        reviewsCount,
        pendingReviewsCount,

        pendingSellersCount,
        approvedSellersCount,
        blockedSellersCount,

        wholesaleEnquiriesCount,
        returnsCount,
        pendingReturnsCount,
        couponsCount,
        notificationsCount,
      ] = await Promise.all([
        countCollection("users"),

        countCollection("sellers"),

        countCollection("products"),

        countWhere("products", "status", "==", "active"),

        countWhere("products", "status", "==", "draft"),

        countWhere("products", "status", "==", "blocked"),

        countWhere("products", "status", "==", "out_of_stock"),

        countCollection("orders"),

        countWhere("orders", "status", "==", "pending"),

        countWhere("orders", "status", "==", "delivered"),

        countWhere("orders", "status", "==", "cancelled"),

        countCollection("categories"),

        countCollection("reviews"),

        countWhere("reviews", "status", "==", "pending"),

        countWhere("sellers", "status", "==", "pending"),

        countWhere("sellers", "status", "==", "approved"),

        countWhere("sellers", "status", "==", "blocked"),

        countCollection("wholesaleEnquiries"),

        countCollection("returns"),

        countWhere("returns", "status", "==", "pending"),

        countCollection("coupons"),

        countCollection("notifications"),
      ]);

      setStats({
        users: usersCount,
        sellers: sellersCount,

        products: productsCount,
        activeProducts: activeProductsCount,
        draftProducts: draftProductsCount,
        blockedProducts: blockedProductsCount,
        outOfStockProducts: outOfStockProductsCount,

        orders: ordersCount,
        pendingOrders: pendingOrdersCount,
        deliveredOrders: deliveredOrdersCount,
        cancelledOrders: cancelledOrdersCount,

        categories: categoriesCount,
        reviews: reviewsCount,
        pendingReviews: pendingReviewsCount,

        pendingSellers: pendingSellersCount,
        approvedSellers: approvedSellersCount,
        blockedSellers: blockedSellersCount,

        wholesaleEnquiries: wholesaleEnquiriesCount,
        returns: returnsCount,
        pendingReturns: pendingReturnsCount,
        coupons: couponsCount,

        notifications: notificationsCount,
      });
    } catch (err) {
      console.error("Stats error:", err);

      setError(
        "Some dashboard statistics could not be loaded. Check whether the related Firestore collections exist and whether Admin permissions allow reading them."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function countCollection(collectionName: string) {
    try {
      const result = await getCountFromServer(
        collection(db, collectionName)
      );

      return result.data().count;
    } catch {
      return 0;
    }
  }

  async function countWhere(
    collectionName: string,
    field: string,
    operator: "==" | ">=" | "<=",
    value: unknown
  ) {
    try {
      const result = await getCountFromServer(
        query(
          collection(db, collectionName),
          where(field, operator, value)
        )
      );

      return result.data().count;
    } catch {
      return 0;
    }
  }

  const attentionItems = useMemo(
    () => [
      {
        title: "Pending Seller Applications",
        value: stats.pendingSellers,
        href: "/admin/sellers",
        icon: "🏪",
        urgent: stats.pendingSellers > 0,
      },
      {
        title: "Pending Product Approval",
        value: stats.draftProducts,
        href: "/admin/products",
        icon: "📦",
        urgent: stats.draftProducts > 0,
      },
      {
        title: "Pending Orders",
        value: stats.pendingOrders,
        href: "/admin/orders",
        icon: "🛒",
        urgent: stats.pendingOrders > 0,
      },
      {
        title: "Pending Returns",
        value: stats.pendingReturns,
        href: "/admin/returns",
        icon: "↩️",
        urgent: stats.pendingReturns > 0,
      },
      {
        title: "Pending Reviews",
        value: stats.pendingReviews,
        href: "/admin/reviews",
        icon: "⭐",
        urgent: stats.pendingReviews > 0,
      },
      {
        title: "Out of Stock",
        value: stats.outOfStockProducts,
        href: "/admin/inventory",
        icon: "⚠️",
        urgent: stats.outOfStockProducts > 0,
      },
    ],
    [stats]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading ANJIVO Admin...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (error && stats.users === 0 && stats.sellers === 0) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-black text-red-800">
              Admin Dashboard Error
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
              >
                Try Again
              </button>

              <Link
                href="/"
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-xs font-bold"
              >
                Go Home
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">

        {/* =====================================================
            DASHBOARD HEADER
        ====================================================== */}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
              ANJIVO CONTROL CENTER
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Admin Dashboard
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Complete control center for sellers, products, customers,
              orders, wholesale, payments, logistics, marketing,
              support, reports and marketplace security.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              target="_blank"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold text-gray-700 hover:border-black"
            >
              View Marketplace
            </Link>

            <button
              type="button"
              onClick={() => loadStats()}
              disabled={refreshing}
              className="rounded-xl bg-black px-4 py-3 text-xs font-bold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "↻ Refresh Data"}
            </button>
          </div>
        </section>

        {/* =====================================================
            SYSTEM NOTICE
        ====================================================== */}

        {error && (
          <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs font-semibold text-yellow-800">
            ⚠️ {error}
          </div>
        )}

        {/* =====================================================
            MAIN KPI
        ====================================================== */}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.users}
            icon="👥"
            href="/admin/customers"
          />

          <StatCard
            title="Total Sellers"
            value={stats.sellers}
            icon="🏪"
            href="/admin/sellers"
          />

          <StatCard
            title="Total Products"
            value={stats.products}
            icon="📦"
            href="/admin/products"
          />

          <StatCard
            title="Total Orders"
            value={stats.orders}
            icon="🛒"
            href="/admin/orders"
          />
        </section>

        {/* =====================================================
            MARKETPLACE HEALTH
        ====================================================== */}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <MiniStat
            title="Active Products"
            value={stats.activeProducts}
            href="/admin/products"
          />

          <MiniStat
            title="Draft Products"
            value={stats.draftProducts}
            href="/admin/products"
            urgent={stats.draftProducts > 0}
          />

          <MiniStat
            title="Out of Stock"
            value={stats.outOfStockProducts}
            href="/admin/inventory"
            urgent={stats.outOfStockProducts > 0}
          />

          <MiniStat
            title="Approved Sellers"
            value={stats.approvedSellers}
            href="/admin/sellers"
          />

          <MiniStat
            title="Pending Sellers"
            value={stats.pendingSellers}
            href="/admin/sellers"
            urgent={stats.pendingSellers > 0}
          />

          <MiniStat
            title="Delivered"
            value={stats.deliveredOrders}
            href="/admin/orders"
          />

          <MiniStat
            title="Returns"
            value={stats.returns}
            href="/admin/returns"
          />

          <MiniStat
            title="Reviews"
            value={stats.reviews}
            href="/admin/reviews"
          />
        </section>

        {/* =====================================================
            ATTENTION CENTER
        ====================================================== */}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Operations
              </p>

              <h2 className="mt-1 text-xl font-black">
                Attention Center
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Items that may require admin action.
              </p>
            </div>

            <span className="text-xs font-bold text-gray-400">
              Live Firestore counts
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attentionItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                  item.urgent
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                    {item.icon}
                  </div>

                  <span className="text-xs font-black text-gray-400">
                    Manage →
                  </span>
                </div>

                <p className="mt-4 text-xs font-bold text-gray-600">
                  {item.title}
                </p>

                <p className="mt-1 text-2xl font-black">
                  {item.value.toLocaleString("en-IN")}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* =====================================================
            QUICK ACTIONS
        ====================================================== */}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
          <h2 className="text-xl font-black">
            Quick Actions
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Frequently used marketplace controls.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              href="/admin/sellers"
              icon="🏪"
              title="Review Sellers"
              description={`${stats.pendingSellers} pending applications`}
            />

            <QuickAction
              href="/admin/products"
              icon="📦"
              title="Review Products"
              description={`${stats.draftProducts} products need attention`}
            />

            <QuickAction
              href="/admin/orders"
              icon="🛒"
              title="Manage Orders"
              description={`${stats.pendingOrders} pending orders`}
            />

            <QuickAction
              href="/admin/returns"
              icon="↩️"
              title="Review Returns"
              description={`${stats.pendingReturns} pending returns`}
            />

            <QuickAction
              href="/admin/wholesale"
              icon="🏢"
              title="Wholesale Desk"
              description={`${stats.wholesaleEnquiries} enquiries`}
            />

            <QuickAction
              href="/admin/inventory"
              icon="📊"
              title="Inventory"
              description={`${stats.outOfStockProducts} out of stock`}
            />

            <QuickAction
              href="/admin/payouts"
              icon="💳"
              title="Seller Payouts"
              description="Manage settlements"
            />

            <QuickAction
              href="/admin/reports"
              icon="📈"
              title="Reports"
              description="Business intelligence"
            />
          </div>
        </section>

        {/* =====================================================
            ORDER OVERVIEW
        ====================================================== */}

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <DashboardPanel
            title="Order Overview"
            subtitle="Current order distribution"
            icon="🛒"
          >
            <ProgressRow
              label="All Orders"
              value={stats.orders}
              total={Math.max(stats.orders, 1)}
            />

            <ProgressRow
              label="Pending"
              value={stats.pendingOrders}
              total={Math.max(stats.orders, 1)}
            />

            <ProgressRow
              label="Delivered"
              value={stats.deliveredOrders}
              total={Math.max(stats.orders, 1)}
            />

            <ProgressRow
              label="Cancelled"
              value={stats.cancelledOrders}
              total={Math.max(stats.orders, 1)}
            />

            <Link
              href="/admin/orders"
              className="mt-5 inline-flex text-xs font-black hover:underline"
            >
              Open Order Management →
            </Link>
          </DashboardPanel>

          <DashboardPanel
            title="Seller Overview"
            subtitle="Seller account distribution"
            icon="🏪"
          >
            <ProgressRow
              label="All Sellers"
              value={stats.sellers}
              total={Math.max(stats.sellers, 1)}
            />

            <ProgressRow
              label="Approved"
              value={stats.approvedSellers}
              total={Math.max(stats.sellers, 1)}
            />

            <ProgressRow
              label="Pending"
              value={stats.pendingSellers}
              total={Math.max(stats.sellers, 1)}
            />

            <ProgressRow
              label="Blocked"
              value={stats.blockedSellers}
              total={Math.max(stats.sellers, 1)}
            />

            <Link
              href="/admin/sellers"
              className="mt-5 inline-flex text-xs font-black hover:underline"
            >
              Open Seller Management →
            </Link>
          </DashboardPanel>
        </section>

        {/* =====================================================
            ALL ADMIN MODULES
        ====================================================== */}

        <div className="mt-10 space-y-9">
          {moduleSections.map((section) => (
            <section key={section.title}>
              <div className="mb-4">
                <h2 className="text-xl font-black">
                  {section.title}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {section.description}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.items.map((item) => (
                  <AdminModuleCard
                    key={`${section.title}-${item.href}`}
                    item={item}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* =====================================================
            ADMIN ARCHITECTURE
        ====================================================== */}

        <section className="mt-12 overflow-hidden rounded-3xl bg-black p-6 text-white sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
            ANJIVO ADMIN ARCHITECTURE
          </p>

          <h2 className="mt-2 text-2xl font-black">
            One control center for the complete marketplace.
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
            The Admin Panel is designed as the central operational layer
            between customers, sellers, payments, orders, logistics,
            marketing, support and marketplace governance.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminFeature
              icon="🔐"
              title="Access Control"
              text="Admin-only marketplace management"
            />

            <AdminFeature
              icon="📊"
              title="Live Data"
              text="Firestore-backed operational counts"
            />

            <AdminFeature
              icon="⚙️"
              title="Operations"
              text="Centralized marketplace workflows"
            />

            <AdminFeature
              icon="🛡️"
              title="Governance"
              text="Trust, safety, moderation and audit"
            />
          </div>
        </section>

        {/* =====================================================
            FOOTER NOTE
        ====================================================== */}

        <div className="py-10 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            ANJIVO ADMIN CONTROL CENTER
          </p>

          <p className="mt-2 text-xs text-gray-400">
            Marketplace management infrastructure
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: number;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-2xl transition group-hover:bg-black group-hover:grayscale">
          {icon}
        </div>

        <span className="text-xs font-black text-gray-300 group-hover:text-black">
          →
        </span>
      </div>

      <p className="mt-5 text-xs font-bold text-gray-400">
        {title}
      </p>

      <p className="mt-1 text-3xl font-black tracking-tight">
        {value.toLocaleString("en-IN")}
      </p>
    </Link>
  );
}

/* =========================================================
   MINI STAT
========================================================= */

function MiniStat({
  title,
  value,
  href,
  urgent = false,
}: {
  title: string;
  value: number;
  href: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        urgent
          ? "border-yellow-200 bg-yellow-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {title}
      </p>

      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-black">
          {value.toLocaleString("en-IN")}
        </p>

        <span className="text-[10px] font-bold text-gray-400">
          →
        </span>
      </div>
    </Link>
  );
}

/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-gray-200 p-4 transition hover:border-black hover:shadow-sm"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black">
          {title}
        </p>

        <p className="mt-1 truncate text-[10px] text-gray-500">
          {description}
        </p>
      </div>

      <span className="ml-auto text-xs font-bold text-gray-300 group-hover:text-black">
        →
      </span>
    </Link>
  );
}

/* =========================================================
   ADMIN MODULE CARD
========================================================= */

function AdminModuleCard({
  item,
}: {
  item: AdminModule;
}) {
  return (
    <Link
      href={item.href}
      className="group rounded-3xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-2xl transition group-hover:bg-black group-hover:grayscale">
          {item.icon}
        </div>

        {item.badge && (
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
              item.badgeType === "new"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {item.badge}
          </span>
        )}
      </div>

      <h3 className="mt-5 text-sm font-black">
        {item.title}
      </h3>

      <p className="mt-1 min-h-[40px] text-xs leading-5 text-gray-500">
        {item.description}
      </p>

      <div className="mt-5 text-[10px] font-black uppercase tracking-wide text-gray-400 group-hover:text-black">
        Open Module →
      </div>
    </Link>
  );
}

/* =========================================================
   DASHBOARD PANEL
========================================================= */

function DashboardPanel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-black">
            {title}
          </h2>

          <p className="text-xs text-gray-500">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}

/* =========================================================
   PROGRESS ROW
========================================================= */

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = Math.min(
    100,
    Math.round((value / Math.max(total, 1)) * 100)
  );

  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-gray-600">
          {label}
        </span>

        <span className="text-xs font-black">
          {value.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-black transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN FEATURE
========================================================= */

function AdminFeature({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xl">
        {icon}
      </div>

      <p className="mt-3 text-xs font-black">
        {title}
      </p>

      <p className="mt-1 text-[10px] leading-5 text-gray-500">
        {text}
      </p>
    </div>
  );
}
