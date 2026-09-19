"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { logoutUser } from "@/lib/auth";

type UserProfile = {
  name?: string;
  email?: string;
  role?: string;
  phone?: string;
};

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          router.replace("/login");
          return;
        }

        setUser(currentUser);

        try {
          const userRef = doc(
            db,
            "users",
            currentUser.uid
          );

          const snapshot = await getDoc(userRef);

          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          }
        } catch (error) {
          console.error(
            "Failed to load user profile:",
            error
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [router]);

  async function handleLogout() {
    try {
      setLoggingOut(true);

      await logoutUser();

      router.replace("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa]">
        <AccountHeader />

        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
            <div className="text-3xl">⏳</div>

            <p className="mt-3 text-sm font-semibold text-gray-500">
              Loading your account...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName =
    profile?.name ||
    user.displayName ||
    "ANJIVO Customer";

  const email =
    profile?.email ||
    user.email ||
    "";

  const roleLabel =
    profile?.role === "WHOLESALE_CUSTOMER"
      ? "Wholesale Customer"
      : "Retail Customer";

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">

      <AccountHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">

        {/* ================= WELCOME ================= */}
        <section className="rounded-3xl bg-black p-5 text-white sm:p-7">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-xl font-black text-black">
                {displayName.charAt(0).toUpperCase()}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                  Welcome back
                </p>

                <h1 className="mt-1 text-2xl font-black">
                  {displayName}
                </h1>

                <p className="mt-1 text-xs text-gray-400">
                  {email}
                </p>
              </div>

            </div>

            <div className="rounded-xl bg-white/10 px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                Account Type
              </p>

              <p className="mt-1 text-xs font-black">
                {roleLabel}
              </p>
            </div>

          </div>

        </section>

        {/* ================= QUICK ACTIONS ================= */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

          <AccountAction
            href="/account/orders"
            icon="📦"
            title="My Orders"
            description="Track your orders"
          />

          <AccountAction
            href="/cart"
            icon="🛒"
            title="My Cart"
            description="View cart items"
          />

          <AccountAction
            href="/account/addresses"
            icon="📍"
            title="Addresses"
            description="Manage addresses"
          />

          <AccountAction
            href="/account/wishlist"
            icon="♡"
            title="Wishlist"
            description="Saved products"
          />

        </section>

        {/* ================= ACCOUNT MENU ================= */}
        <section className="mt-6">

          <h2 className="text-lg font-black">
            Account
          </h2>

          <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">

            <AccountMenuItem
              href="/account/orders"
              icon="📦"
              title="Orders"
              description="View and track your purchases"
            />

            <AccountMenuItem
              href="/account/addresses"
              icon="📍"
              title="Saved Addresses"
              description="Manage delivery addresses"
            />

            <AccountMenuItem
              href="/account/wishlist"
              icon="♡"
              title="Wishlist"
              description="Products you saved"
            />

            <AccountMenuItem
              href="/account/profile"
              icon="👤"
              title="Profile"
              description="Manage your personal information"
            />

          </div>

        </section>

        {/* ================= BUSINESS ================= */}
        <section className="mt-6">

          <h2 className="text-lg font-black">
            Business
          </h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">

            <Link
              href="/wholesale"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-black hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
                📦
              </div>

              <h3 className="mt-4 text-sm font-black">
                Wholesale Shopping
              </h3>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Buy in bulk and unlock quantity-based pricing.
              </p>

              <span className="mt-4 inline-block text-xs font-bold">
                Explore Wholesale →
              </span>
            </Link>

            <Link
              href="/seller/register"
              className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-black hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
                🏪
              </div>

              <h3 className="mt-4 text-sm font-black">
                Become a Seller
              </h3>

              <p className="mt-1 text-xs leading-5 text-gray-500">
                Start selling your products on ANJIVO.
              </p>

              <span className="mt-4 inline-block text-xs font-bold">
                Start Selling →
              </span>
            </Link>

          </div>

        </section>

        {/* ================= LOGOUT ================= */}
        <section className="mt-6">

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-left text-sm font-bold text-gray-700 transition hover:border-black hover:text-black disabled:opacity-50"
          >
            {loggingOut
              ? "Signing out..."
              : "↪ Sign Out"}
          </button>

        </section>

      </main>
    </div>
  );
}


/* =========================================
   ACCOUNT HEADER
========================================= */

function AccountHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">

        <Link
          href="/"
          className="relative block h-14 w-32"
          aria-label="ANJIVO Home"
        >
          <Image
            src="/logo/anjivo-logo.png"
            alt="ANJIVO"
            fill
            priority
            sizes="128px"
            className="object-contain object-left"
          />
        </Link>

        <Link
          href="/products"
          className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold transition hover:border-black"
        >
          Continue Shopping
        </Link>

      </div>

    </header>
  );
}


/* =========================================
   QUICK ACTION
========================================= */

function AccountAction({
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
      className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-black hover:shadow-lg"
    >
      <div className="text-xl">
        {icon}
      </div>

      <h3 className="mt-3 text-xs font-black">
        {title}
      </h3>

      <p className="mt-1 text-[10px] leading-4 text-gray-400">
        {description}
      </p>
    </Link>
  );
}


/* =========================================
   ACCOUNT MENU
========================================= */

function AccountMenuItem({
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
      className="flex items-center gap-4 border-b border-gray-100 p-4 last:border-b-0 transition hover:bg-gray-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold">
          {title}
        </h3>

        <p className="mt-0.5 text-xs text-gray-400">
          {description}
        </p>
      </div>

      <span className="text-gray-400">
        →
      </span>
    </Link>
  );
}
