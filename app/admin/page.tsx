"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getCountFromServer,
  getDoc,
  doc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

type Stats = {
  users: number;
  sellers: number;
  products: number;
  orders: number;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<Stats>({
    users: 0,
    sellers: 0,
    products: 0,
    orders: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

      try {
        const userSnapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        if (!userSnapshot.exists()) {
          window.location.href = "/";
          return;
        }

        const userData = userSnapshot.data();

        if (userData.role !== "ADMIN") {
          window.location.href = "/account";
          return;
        }

        setAuthorized(true);

        const [
          usersCount,
          sellersCount,
          productsCount,
          ordersCount,
        ] = await Promise.all([
          getCountFromServer(collection(db, "users")),
          getCountFromServer(collection(db, "sellers")),
          getCountFromServer(collection(db, "products")),
          getCountFromServer(collection(db, "orders")),
        ]);

        setStats({
          users: usersCount.data().count,
          sellers: sellersCount.data().count,
          products: productsCount.data().count,
          orders: ordersCount.data().count,
        });
      } catch (error) {
        console.error("Admin dashboard error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <p className="text-sm text-gray-500">
            Loading admin dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  const cards = [
    {
      title: "Total Users",
      value: stats.users,
      icon: "👥",
      href: "/admin/users",
    },
    {
      title: "Total Sellers",
      value: stats.sellers,
      icon: "🏪",
      href: "/admin/sellers",
    },
    {
      title: "Total Products",
      value: stats.products,
      icon: "📦",
      href: "/admin/products",
    },
    {
      title: "Total Orders",
      value: stats.orders,
      icon: "🛒",
      href: "/admin/orders",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/">
            <img
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              View Store
            </Link>

            <Link
              href="/account"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
            >
              Account
            </Link>
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-500">
            ANJIVO ADMIN
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Admin Dashboard
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Manage sellers, products, orders and users.
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {card.title}
                  </p>

                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {card.value}
                  </p>
                </div>

                <span className="text-2xl">
                  {card.icon}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Management */}
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Management
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/sellers"
              className="rounded-2xl border bg-white p-6 hover:shadow-md"
            >
              <div className="text-3xl">🏪</div>

              <h3 className="mt-4 text-lg font-bold">
                Seller Applications
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Review, approve or reject seller applications.
              </p>

              <span className="mt-4 inline-block text-sm font-semibold">
                Manage Sellers →
              </span>
            </Link>

            <Link
              href="/admin/products"
              className="rounded-2xl border bg-white p-6 hover:shadow-md"
            >
              <div className="text-3xl">📦</div>

              <h3 className="mt-4 text-lg font-bold">
                Products
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Manage seller products and product approvals.
              </p>

              <span className="mt-4 inline-block text-sm font-semibold">
                Manage Products →
              </span>
            </Link>

            <Link
              href="/admin/orders"
              className="rounded-2xl border bg-white p-6 hover:shadow-md"
            >
              <div className="text-3xl">🛒</div>

              <h3 className="mt-4 text-lg font-bold">
                Orders
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                View and manage customer orders.
              </p>

              <span className="mt-4 inline-block text-sm font-semibold">
                Manage Orders →
              </span>
            </Link>

            <Link
              href="/admin/users"
              className="rounded-2xl border bg-white p-6 hover:shadow-md"
            >
              <div className="text-3xl">👥</div>

              <h3 className="mt-4 text-lg font-bold">
                Users
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                View customer and seller accounts.
              </p>

              <span className="mt-4 inline-block text-sm font-semibold">
                Manage Users →
              </span>
            </Link>

            <Link
              href="/admin/settings"
              className="rounded-2xl border bg-white p-6 hover:shadow-md"
            >
              <div className="text-3xl">⚙️</div>

              <h3 className="mt-4 text-lg font-bold">
                Settings
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Manage marketplace settings.
              </p>

              <span className="mt-4 inline-block text-sm font-semibold">
                Open Settings →
              </span>
            </Link>

            <Link
              href="/admin/commissions"
              className="rounded-2xl border bg-white p-6 hover:shadow-md"
            >
              <div className="text-3xl">💰</div>

              <h3 className="mt-4 text-lg font-bold">
                Commissions
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Manage seller commission and payouts.
              </p>

              <span className="mt-4 inline-block text-sm font-semibold">
                Manage Finance →
              </span>
            </Link>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Quick Actions
          </h2>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/sellers"
              className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
            >
              Review Sellers
            </Link>

            <Link
              href="/admin/products"
              className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold"
            >
              Review Products
            </Link>

            <Link
              href="/admin/orders"
              className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold"
            >
              View Orders
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
