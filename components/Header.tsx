"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";

const categories = [
  "Fashion",
  "Beauty",
  "Toys",
  "Jewellery",
  "Footwear",
  "Electronics",
  "Home & Living",
  "Grocery",
  "New Arrivals",
];

function getCategorySlug(category: string) {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "-");
}

export default function Header() {
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(auth.currentUser);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  function handleSearch() {
    const query = search.trim();

    if (!query) {
      window.location.href = "/products";
      return;
    }

    window.location.href = `/products?q=${encodeURIComponent(query)}`;
  }

  function handleSearchKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      handleSearch();
    }
  }

  function closeMenus() {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* =====================================================
          TOP OFFER BAR
      ===================================================== */}
      <div className="hidden bg-black px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-white md:block">
        🚚 Free shipping on selected orders
        <span className="mx-3 text-gray-500">•</span>
        🏪 Wholesale buyers get special pricing
        <span className="mx-3 text-gray-500">•</span>
        ✓ Verified sellers
      </div>

      {/* =====================================================
          MAIN HEADER
      ===================================================== */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 md:py-3">

          {/* ================= LOGO ================= */}
          <Link
            href="/"
            onClick={closeMenus}
            className="relative h-12 w-24 shrink-0 sm:h-14 sm:w-28 md:h-16 md:w-32 lg:h-18 lg:w-36"
            aria-label="ANJIVO Home"
          >
            <Image
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              fill
              priority
              sizes="144px"
              className="object-contain object-left"
            />
          </Link>

          {/* ================= LOCATION ================= */}
          <button
            type="button"
            className="hidden shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-left transition hover:border-gray-400 lg:block"
          >
            <div className="text-[9px] font-medium uppercase tracking-wider text-gray-400">
              Deliver to
            </div>

            <div className="mt-0.5 text-xs font-bold text-gray-800">
              📍 Select Location
            </div>
          </button>

          {/* ================= DESKTOP SEARCH ================= */}
          <div className="relative hidden min-w-0 flex-1 md:block">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search products, brands, categories & sellers..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-14 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
            />

            <button
              type="button"
              onClick={handleSearch}
              aria-label="Search"
              className="absolute right-1 top-1 flex h-9 w-10 items-center justify-center rounded-lg bg-black text-base text-white transition hover:bg-gray-800"
            >
              🔍
            </button>
          </div>

          {/* ================= MOBILE SEARCH ICON ================= */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);

              const input = document.getElementById(
                "mobile-search"
              ) as HTMLInputElement | null;

              input?.focus();
            }}
            aria-label="Search"
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-lg transition hover:bg-gray-50 md:hidden"
          >
            🔍
          </button>

          {/* ================= WHOLESALE ================= */}
          <Link
            href="/wholesale"
            className="hidden shrink-0 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold transition hover:border-black hover:bg-gray-50 xl:flex"
          >
            <span className="text-base">🏪</span>
            Wholesale
          </Link>

          {/* =================================================
              DESKTOP ACCOUNT
          ================================================= */}
          <div className="relative hidden shrink-0 lg:block">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setAccountMenuOpen(!accountMenuOpen)
                  }
                  className="text-left"
                >
                  <div className="text-[10px] text-gray-400">
                    Hello,{" "}
                    {user.displayName ||
                      user.email?.split("@")[0] ||
                      "User"}
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-gray-800">
                    Account & Orders
                    <span className="text-[10px]">
                      {accountMenuOpen ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 top-14 z-[60] w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
                    <div className="border-b border-gray-100 px-3 py-3">
                      <p className="text-xs text-gray-400">
                        Signed in as
                      </p>

                      <p className="mt-1 truncate text-sm font-bold text-gray-900">
                        {user.email}
                      </p>
                    </div>

                    <Link
                      href="/account"
                      onClick={closeMenus}
                      className="block rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      👤 My Account
                    </Link>

                    <Link
                      href="/account/orders"
                      onClick={closeMenus}
                      className="block rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      📦 My Orders
                    </Link>

                    <Link
                      href="/cart"
                      onClick={closeMenus}
                      className="block rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      🛒 My Cart
                    </Link>

                    <Link
                      href="/account/wishlist"
                      onClick={closeMenus}
                      className="block rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      ❤️ Wishlist
                    </Link>

                    <div className="my-1 border-t border-gray-100" />

                    <Link
                      href="/seller/register"
                      onClick={closeMenus}
                      className="block rounded-xl px-3 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      🏪 Become a Seller
                    </Link>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await auth.signOut();
                          closeMenus();
                          window.location.href = "/";
                        } catch (error) {
                          console.error(
                            "Logout error:",
                            error
                          );
                          alert("Logout failed.");
                        }
                      }}
                      className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      🚪 Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div>
                <div className="text-[10px] text-gray-400">
                  Hello, Sign in
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="text-xs font-bold text-gray-800 transition hover:text-black"
                  >
                    Login
                  </Link>

                  <span className="text-gray-300">
                    |
                  </span>

                  <Link
                    href="/register"
                    className="text-xs font-bold text-gray-800 transition hover:text-black"
                  >
                    Register
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ================= MOBILE ACCOUNT ================= */}
          <Link
            href={user ? "/account" : "/login"}
            aria-label="Account"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-lg transition hover:bg-gray-50 lg:hidden"
          >
            👤
          </Link>

          {/* ================= CART ================= */}
          <Link
            href="/cart"
            aria-label="Shopping Cart"
            className="relative flex h-10 shrink-0 items-center rounded-xl bg-black px-3 text-sm font-bold text-white transition hover:bg-gray-800 sm:h-11 sm:px-4"
          >
            <span className="text-base sm:text-lg">
              🛒
            </span>

            <span className="ml-1.5 hidden sm:inline">
              Cart
            </span>

            {/* Cart count will be connected to Firebase later */}
            <span className="absolute -right-1.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-black shadow-md ring-1 ring-gray-200">
              0
            </span>
          </Link>

          {/* ================= MOBILE MENU BUTTON ================= */}
          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen(!mobileMenuOpen)
            }
            aria-label="Menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-lg transition hover:bg-gray-50 md:hidden"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* =====================================================
            MOBILE SEARCH BAR
        ===================================================== */}
        <div className="px-3 pb-3 md:hidden">
          <div className="relative">
            <input
              id="mobile-search"
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              onKeyDown={handleSearchKeyDown}
              placeholder="Search products, brands & sellers..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-12 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
            />

            <button
              type="button"
              onClick={handleSearch}
              aria-label="Search"
              className="absolute right-1 top-1 flex h-9 w-10 items-center justify-center rounded-lg bg-black text-white"
            >
              🔍
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          CATEGORY NAVIGATION
      ===================================================== */}
      <div className="border-b border-gray-100 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-3 py-2.5 text-xs font-semibold whitespace-nowrap scrollbar-hide sm:gap-5 sm:px-4">

          {/* All Categories */}
          <Link
            href="/categories"
            className="flex shrink-0 items-center gap-1.5 font-black text-gray-900 transition hover:text-gray-500"
          >
            <span className="text-sm">☰</span>
            All Categories
          </Link>

          <span className="h-4 w-px shrink-0 bg-gray-200" />

          {categories.map((category) => {
            const slug = getCategorySlug(category);

            if (category === "New Arrivals") {
              return (
                <Link
                  key={category}
                  href="/products?sort=new"
                  className="shrink-0 text-gray-700 transition hover:text-black"
                >
                  {category}
                </Link>
              );
            }

            return (
              <Link
                key={category}
                href={`/products?category=${encodeURIComponent(
                  slug
                )}`}
                className="shrink-0 text-gray-700 transition hover:text-black"
              >
                {category}
              </Link>
            );
          })}

          <Link
            href="/products?deal=true"
            className="shrink-0 font-black text-gray-900 transition hover:text-red-600"
          >
            🔥 Deals
          </Link>

          <Link
            href="/wholesale"
            className="shrink-0 font-black text-gray-900"
          >
            🏪 Wholesale
          </Link>
        </nav>
      </div>

      {/* =====================================================
          MOBILE QUICK NAV
      ===================================================== */}
      <div className="border-b border-gray-100 bg-gray-50 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-600">

          <Link
            href="/products"
            className="flex items-center gap-1"
          >
            🛍️ Shop
          </Link>

          <Link
            href="/wholesale"
            className="flex items-center gap-1"
          >
            🏪 Wholesale
          </Link>

          <Link
            href="/products?sort=new"
            className="flex items-center gap-1"
          >
            ✨ New
          </Link>

          <Link
            href="/products?deal=true"
            className="flex items-center gap-1"
          >
            🔥 Deals
          </Link>
        </div>
      </div>

      {/* =====================================================
          MOBILE MENU
      ===================================================== */}
      {mobileMenuOpen && (
        <div className="border-b border-gray-200 bg-white shadow-lg md:hidden">
          <div className="mx-auto max-w-7xl px-3 py-4">

            {user ? (
              <div className="mb-4 rounded-2xl bg-gray-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Signed in as
                </p>

                <p className="mt-1 truncate text-sm font-bold text-gray-900">
                  {user.displayName ||
                    user.email ||
                    "User"}
                </p>

                <Link
                  href="/account"
                  onClick={closeMenus}
                  className="mt-3 block rounded-xl bg-black px-4 py-3 text-center text-xs font-bold text-white"
                >
                  Open My Account
                </Link>
              </div>
            ) : (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={closeMenus}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-center text-sm font-bold text-gray-900"
                >
                  🔐 Login
                </Link>

                <Link
                  href="/register"
                  onClick={closeMenus}
                  className="rounded-xl bg-black px-4 py-3 text-center text-sm font-bold text-white"
                >
                  ✨ Register
                </Link>
              </div>
            )}

            <div className="space-y-1">
              <MobileMenuLink
                href="/"
                onClick={closeMenus}
              >
                🏠 Home
              </MobileMenuLink>

              <MobileMenuLink
                href="/products"
                onClick={closeMenus}
              >
                🛍️ Shop All Products
              </MobileMenuLink>

              <MobileMenuLink
                href="/categories"
                onClick={closeMenus}
              >
                🗂️ All Categories
              </MobileMenuLink>

              <MobileMenuLink
                href="/wholesale"
                onClick={closeMenus}
              >
                🏪 Wholesale
              </MobileMenuLink>

              <MobileMenuLink
                href="/cart"
                onClick={closeMenus}
              >
                🛒 Cart
              </MobileMenuLink>

              {user && (
                <>
                  <MobileMenuLink
                    href="/account/orders"
                    onClick={closeMenus}
                  >
                    📦 My Orders
                  </MobileMenuLink>

                  <MobileMenuLink
                    href="/account/wishlist"
                    onClick={closeMenus}
                  >
                    ❤️ Wishlist
                  </MobileMenuLink>
                </>
              )}

              <MobileMenuLink
                href="/products?sort=new"
                onClick={closeMenus}
              >
                ✨ New Arrivals
              </MobileMenuLink>

              <MobileMenuLink
                href="/products?deal=true"
                onClick={closeMenus}
              >
                🔥 Deals
              </MobileMenuLink>

              <MobileMenuLink
                href="/seller/register"
                onClick={closeMenus}
              >
                🏪 Become a Seller
              </MobileMenuLink>

              {user && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await auth.signOut();
                      closeMenus();
                      window.location.href = "/";
                    } catch (error) {
                      console.error(
                        "Logout error:",
                        error
                      );
                      alert("Logout failed.");
                    }
                  }}
                  className="mt-2 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  🚪 Logout
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MobileMenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-100"
    >
      {children}
    </Link>
  );
}
