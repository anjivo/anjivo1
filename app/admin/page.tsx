"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

import { auth, db } from "@/lib/firebase";

type Stats = {
  users: number;
  sellers: number;
  products: number;
  activeProducts: number;
  orders: number;
  categories: number;
  reviews: number;
  pendingSellers: number;
};

type ManagementItem = {
  title: string;
  description: string;
  href: string;
  icon: string;
  badge?: string;
};

const managementSections: {
  title: string;
  description: string;
  items: ManagementItem[];
}[] = [
  {
    title: "Marketplace",
    description:
      "Core marketplace management",
    items: [
      {
        title: "Products",
        description:
          "Approve, block, edit and manage products",
        href: "/admin/products",
        icon: "📦",
      },
      {
        title: "Categories",
        description:
          "Manage categories and subcategories",
        href: "/admin/categories",
        icon: "🗂️",
      },
      {
        title: "Sellers",
        description:
          "Seller applications, KYC and accounts",
        href: "/admin/sellers",
        icon: "🏪",
        badge: "Important",
      },
      {
        title: "Customers",
        description:
          "Retail and wholesale customer accounts",
        href: "/admin/users",
        icon: "👥",
      },
    ],
  },

  {
    title: "Orders & Commerce",
    description:
      "Manage marketplace transactions",
    items: [
      {
        title: "Orders",
        description:
          "View and manage all customer orders",
        href: "/admin/orders",
        icon: "🛒",
      },
      {
        title: "Wholesale",
        description:
          "Wholesale quotes and B2B requests",
        href: "/admin/wholesale",
        icon: "🏢",
      },
      {
        title: "Returns",
        description:
          "Returns, refunds and disputes",
        href: "/admin/returns",
        icon: "↩️",
      },
      {
        title: "Coupons",
        description:
          "Create and manage discount coupons",
        href: "/admin/coupons",
        icon: "🎟️",
      },
    ],
  },

  {
    title: "Finance",
    description:
      "Marketplace money management",
    items: [
      {
        title: "Commissions",
        description:
          "Seller commission and earnings",
        href: "/admin/commissions",
        icon: "💰",
      },
      {
        title: "Payouts",
        description:
          "Seller settlement management",
        href: "/admin/payouts",
        icon: "💳",
      },
      {
        title: "Reports",
        description:
          "Sales, revenue and marketplace reports",
        href: "/admin/reports",
        icon: "📊",
      },
    ],
  },

  {
    title: "Trust & Communication",
    description:
      "Keep the marketplace reliable",
    items: [
      {
        title: "Reviews",
        description:
          "Approve and moderate product reviews",
        href: "/admin/reviews",
        icon: "⭐",
      },
      {
        title: "Notifications",
        description:
          "Manage marketplace notifications",
        href: "/admin/notifications",
        icon: "🔔",
      },
      {
        title: "Settings",
        description:
          "Marketplace configuration and controls",
        href: "/admin/settings",
        icon: "⚙️",
      },
    ],
  },
];

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [stats, setStats] =
    useState<Stats>({
      users: 0,
      sellers: 0,
      products: 0,
      activeProducts: 0,
      orders: 0,
      categories: 0,
      reviews: 0,
      pendingSellers: 0,
    });

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/admin"
            );
            return;
          }

          try {
            setError("");

            const userSnapshot =
              await getDocs(
                query(
                  collection(db, "users"),
                  where(
                    "uid",
                    "==",
                    user.uid
                  )
                )
              );

            if (
              userSnapshot.empty ||
              userSnapshot.docs[0].data()
                .role !== "ADMIN"
            ) {
              setError(
                "Admin access required."
              );
              setLoading(false);
              return;
            }

            await loadStats();
          } catch (err) {
            console.error(
              "Admin dashboard error:",
              err
            );

            setError(
              "Unable to load dashboard."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  async function loadStats() {
    const [
      usersCount,
      sellersCount,
      productsCount,
      activeProductsCount,
      ordersCount,
      categoriesCount,
      reviewsCount,
      pendingSellersCount,
    ] = await Promise.all([
      getCountFromServer(
        collection(db, "users")
      ),

      getCountFromServer(
        collection(db, "sellers")
      ),

      getCountFromServer(
        collection(db, "products")
      ),

      getCountFromServer(
        query(
          collection(db, "products"),
          where(
            "status",
            "==",
            "active"
          )
        )
      ),

      getCountFromServer(
        collection(db, "orders")
      ),

      getCountFromServer(
        collection(db, "categories")
      ),

      getCountFromServer(
        collection(db, "reviews")
      ),

      getCountFromServer(
        query(
          collection(db, "sellers"),
          where(
            "status",
            "==",
            "pending"
          )
        )
      ),
    ]);

    setStats({
      users:
        usersCount.data().count,

      sellers:
        sellersCount.data().count,

      products:
        productsCount.data().count,

      activeProducts:
        activeProductsCount.data()
          .count,

      orders:
        ordersCount.data().count,

      categories:
        categoriesCount.data().count,

      reviews:
        reviewsCount.data().count,

      pendingSellers:
        pendingSellersCount.data()
          .count,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="text-4xl">
              ⏳
            </div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading ANJIVO Admin...
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f6f8]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-black text-red-800">
              Admin Access Denied
            </h1>

            <p className="mt-2 text-sm text-red-700">
              {error}
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              Go Home
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
              ANJIVO CONTROL CENTER
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Admin Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Manage the complete ANJIVO
              marketplace from one place.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              target="_blank"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold text-gray-700 hover:border-black"
            >
              View Marketplace
            </Link>

            <button
              type="button"
              onClick={() =>
                loadStats()
              }
              className="rounded-xl bg-black px-4 py-3 text-xs font-bold text-white hover:bg-gray-800"
            >
              ↻ Refresh
            </button>
          </div>

        </div>

        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="Total Users"
            value={stats.users}
            icon="👥"
            href="/admin/users"
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

        </div>

        {/* =================================================
            SECONDARY STATS
        ================================================= */}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <SmallStat
            title="Active Products"
            value={stats.activeProducts}
            href="/admin/products"
          />

          <SmallStat
            title="Pending Sellers"
            value={stats.pendingSellers}
            href="/admin/sellers"
            urgent={
              stats.pendingSellers > 0
            }
          />

          <SmallStat
            title="Categories"
            value={stats.categories}
            href="/admin/categories"
          />

          <SmallStat
            title="Reviews"
            value={stats.reviews}
            href="/admin/reviews"
          />

        </div>

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 sm:p-7">

          <div>
            <h2 className="text-xl font-black">
              Quick Actions
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Frequently used marketplace controls.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <QuickAction
              href="/admin/sellers"
              icon="🏪"
              title="Review Sellers"
              description={
                stats.pendingSellers > 0
                  ? `${stats.pendingSellers} pending`
                  : "No pending applications"
              }
            />

            <QuickAction
              href="/admin/products"
              icon="📦"
              title="Review Products"
              description="Product approval & moderation"
            />

            <QuickAction
              href="/admin/orders"
              icon="🛒"
              title="Manage Orders"
              description="View all marketplace orders"
            />

            <QuickAction
              href="/admin/categories"
              icon="🗂️"
              title="Manage Categories"
              description="Categories & subcategories"
            />

          </div>
        </section>

        {/* =================================================
            MANAGEMENT SECTIONS
        ================================================= */}

        <div className="mt-8 space-y-8">

          {managementSections.map(
            (section) => (
              <section
                key={section.title}
              >
                <div className="mb-4">
                  <h2 className="text-xl font-black">
                    {section.title}
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    {section.description}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                  {section.items.map(
                    (item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group rounded-3xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between">

                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-2xl transition group-hover:bg-black group-hover:grayscale">
                            {item.icon}
                          </div>

                          {item.badge && (
                            <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[9px] font-black uppercase text-yellow-700">
                              {item.badge}
                            </span>
                          )}

                        </div>

                        <h3 className="mt-5 text-sm font-black">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          {item.description}
                        </p>

                        <div className="mt-5 text-[10px] font-black uppercase tracking-wide text-gray-400 group-hover:text-black">
                          Manage →
                        </div>
                      </Link>
                    )
                  )}

                </div>
              </section>
            )
          )}

        </div>

        {/* =================================================
            ADMIN ARCHITECTURE
        ================================================= */}

        <section className="mt-10 rounded-3xl bg-black p-6 text-white sm:p-8">

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            ANJIVO ADMIN
          </p>

          <h2 className="mt-2 text-2xl font-black">
            One control center for the
            complete marketplace.
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
            Products, sellers, customers,
            orders, wholesale, payments,
            commissions, returns, reviews,
            notifications and marketplace
            settings will all be controlled
            through the Admin Panel.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">

            <AdminFeature
              icon="🔐"
              title="Access Control"
              text="Admin-only management"
            />

            <AdminFeature
              icon="📊"
              title="Marketplace Data"
              text="Centralized business overview"
            />

            <AdminFeature
              icon="⚙️"
              title="Operations"
              text="Control marketplace workflow"
            />

          </div>

        </section>

      </main>

      <Footer />
    </div>
  );
}

/* =========================================================
   COMPONENTS
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
      className="rounded-3xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-xl">
          {icon}
        </div>

        <span className="text-xs font-bold text-gray-300">
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

function SmallStat({
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
      className={`rounded-2xl border p-4 transition hover:shadow-md ${
        urgent
          ? "border-yellow-200 bg-yellow-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {title}
      </p>

      <div className="mt-2 flex items-end justify-between">
        <p className="text-2xl font-black">
          {value.toLocaleString("en-IN")}
        </p>

        <span className="text-xs font-bold text-gray-400">
          Manage →
        </span>
      </div>
    </Link>
  );
}

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
      className="flex items-center gap-4 rounded-2xl border border-gray-200 p-4 transition hover:border-black hover:shadow-sm"
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
    </Link>
  );
}

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

      <p className="mt-1 text-[10px] text-gray-500">
        {text}
      </p>
    </div>
  );
}
