"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { auth, db } from "@/lib/firebase";

type SellerUser = {
  name?: string;
  email?: string;
  role?: string;
  sellerStatus?: string;
};

export default function SellerDashboard() {
  const router = useRouter();

  const [userData, setUserData] =
    useState<SellerUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login?redirect=/seller"
            );
            return;
          }

          try {
            const userRef = doc(
              db,
              "users",
              user.uid
            );

            const snapshot =
              await getDoc(userRef);

            if (!snapshot.exists()) {
              setError(
                "Seller profile not found."
              );
              return;
            }

            const data =
              snapshot.data() as SellerUser;

            if (
              data.role !== "SELLER"
            ) {
              setError(
                "You do not have seller access."
              );
              return;
            }

            setUserData(data);
          } catch (err) {
            console.error(err);

            setError(
              "Unable to load seller dashboard."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            ⏳ Loading seller dashboard...
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <Header />

        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-3xl border border-red-200 bg-white p-8 text-center">

            <div className="text-5xl">
              🔒
            </div>

            <h1 className="mt-4 text-xl font-black">
              Seller Access Required
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {error}
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              Go Home
            </Link>

          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const sellerStatus =
    userData?.sellerStatus ||
    "pending";

  return (
    <div className="min-h-screen bg-[#f7f8fa]">

      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-10">

        {/* HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              ANJIVO Seller Panel
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Welcome,{" "}
              {userData?.name ||
                "Seller"}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage products, orders and your marketplace business.
            </p>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-xs font-bold ${
              sellerStatus ===
              "approved"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            Seller:{" "}
            {sellerStatus}
          </span>

        </div>

        {/* STATS */}
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-2xl">
              📦
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Products
            </p>

            <p className="mt-1 text-2xl font-black">
              0
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-2xl">
              🛒
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Orders
            </p>

            <p className="mt-1 text-2xl font-black">
              0
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-2xl">
              ₹
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Sales
            </p>

            <p className="mt-1 text-2xl font-black">
              ₹0
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-2xl">
              💰
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Payout
            </p>

            <p className="mt-1 text-2xl font-black">
              ₹0
            </p>
          </div>

        </div>

        {/* QUICK ACTIONS */}
        <section className="mt-7">

          <h2 className="text-lg font-black">
            Quick Actions
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <Link
              href="/seller/products"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-black"
            >
              <div className="text-2xl">
                📦
              </div>

              <p className="mt-3 text-sm font-black">
                My Products
              </p>

              <p className="mt-1 text-[10px] text-gray-400">
                Add and manage products
              </p>
            </Link>

            <Link
              href="/seller/orders"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-black"
            >
              <div className="text-2xl">
                🛒
              </div>

              <p className="mt-3 text-sm font-black">
                Orders
              </p>

              <p className="mt-1 text-[10px] text-gray-400">
                Manage customer orders
              </p>
            </Link>

            <Link
              href="/seller/profile"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-black"
            >
              <div className="text-2xl">
                👤
              </div>

              <p className="mt-3 text-sm font-black">
                Seller Profile
              </p>

              <p className="mt-1 text-[10px] text-gray-400">
                Business and KYC details
              </p>
            </Link>

            <Link
              href="/seller/payouts"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-black"
            >
              <div className="text-2xl">
                💳
              </div>

              <p className="mt-3 text-sm font-black">
                Payouts
              </p>

              <p className="mt-1 text-[10px] text-gray-400">
                Sales and payout history
              </p>
            </Link>

          </div>

        </section>

        {/* SELLER STATUS */}
        <section className="mt-7 rounded-3xl border border-gray-200 bg-white p-6">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Account Status
              </p>

              <h2 className="mt-2 text-xl font-black">
                {sellerStatus ===
                "approved"
                  ? "Your seller account is approved"
                  : "Your seller account is under review"}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                {sellerStatus ===
                "approved"
                  ? "You can manage products and receive marketplace orders."
                  : "ANJIVO admin will verify your seller profile before product publishing is enabled."}
              </p>

            </div>

            <div className="text-4xl">
              {sellerStatus ===
              "approved"
                ? "✅"
                : "⏳"}
            </div>

          </div>

        </section>

      </main>

      <Footer />

    </div>
  );
}
