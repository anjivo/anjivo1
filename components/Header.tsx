"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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

export default function Header() {
  const [search, setSearch] = useState("");

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">

      {/* ================= TOP OFFER BAR ================= */}
      <div className="hidden bg-black px-4 py-2 text-center text-[11px] font-semibold tracking-wide text-white md:block">
        🚚 Free shipping on selected orders
        <span className="mx-3 text-gray-500">•</span>
        🏪 Wholesale buyers get special pricing
        <span className="mx-3 text-gray-500">•</span>
        ✓ Verified sellers
      </div>

      {/* ================= MAIN HEADER ================= */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 md:py-3">

          {/* ================= LOGO ================= */}
          <Link
            href="/"
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, brands, categories & sellers..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-14 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
            />

            <button
              type="button"
              aria-label="Search"
              className="absolute right-1 top-1 flex h-9 w-10 items-center justify-center rounded-lg bg-black text-base text-white transition hover:bg-gray-800"
            >
              🔍
            </button>
          </div>

          {/* ================= MOBILE SEARCH ICON ================= */}
          <button
            type="button"
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

          {/* ================= ACCOUNT ================= */}
          <Link
            href="/login"
            className="hidden shrink-0 text-left lg:block"
          >
            <div className="text-[10px] text-gray-400">
              Hello, Sign in
            </div>

            <div className="text-xs font-bold text-gray-800">
              Account & Orders
            </div>
          </Link>

          {/* ================= MOBILE ACCOUNT ================= */}
          <Link
            href="/login"
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
            <span className="text-base sm:text-lg">🛒</span>

            <span className="ml-1.5 hidden sm:inline">
              Cart
            </span>

            {/* Cart Count */}
            <span className="absolute -right-1.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-black shadow-md ring-1 ring-gray-200">
              0
            </span>
          </Link>
        </div>

        {/* ================= MOBILE SEARCH BAR ================= */}
        <div className="px-3 pb-3 md:hidden">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, brands & sellers..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-12 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white"
            />

            <button
              type="button"
              aria-label="Search"
              className="absolute right-1 top-1 flex h-9 w-10 items-center justify-center rounded-lg bg-black text-white"
            >
              🔍
            </button>
          </div>
        </div>
      </div>

      {/* ================= CATEGORY NAVIGATION ================= */}
      <div className="border-b border-gray-100 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-3 py-2.5 text-xs font-semibold whitespace-nowrap scrollbar-hide sm:gap-5 sm:px-4">

          {/* All Categories */}
          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 font-black text-gray-900"
          >
            <span className="text-sm">☰</span>
            All Categories
          </button>

          <span className="h-4 w-px shrink-0 bg-gray-200" />

          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className="shrink-0 text-gray-700 transition hover:text-black"
            >
              {category}
            </button>
          ))}

          <button
            type="button"
            className="shrink-0 font-black text-gray-900"
          >
            🔥 Deals
          </button>

          <Link
            href="/wholesale"
            className="shrink-0 font-black text-gray-900"
          >
            🏪 Wholesale
          </Link>
        </nav>
      </div>

      {/* ================= MOBILE QUICK NAV ================= */}
      <div className="border-b border-gray-100 bg-gray-50 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-600">

          <Link href="/products" className="flex items-center gap-1">
            🛍️ Shop
          </Link>

          <Link href="/wholesale" className="flex items-center gap-1">
            🏪 Wholesale
          </Link>

          <Link href="/products?sort=new" className="flex items-center gap-1">
            ✨ New
          </Link>

          <Link href="/products?deal=true" className="flex items-center gap-1">
            🔥 Deals
          </Link>

        </div>
      </div>
    </header>
  );
}
