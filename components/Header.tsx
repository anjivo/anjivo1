"use client";

import Image from "next/image";
import { useState } from "react";

export default function Header() {
  const [search, setSearch] = useState("");

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">

      {/* ================= TOP OFFER BAR ================= */}
      <div className="hidden bg-black px-4 py-2 text-center text-xs font-medium text-white md:block">
        🚚 Free shipping on selected orders
        <span className="mx-2 text-gray-500">•</span>
        Wholesale buyers get special pricing
      </div>

      {/* ================= MAIN HEADER ================= */}
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 md:px-4">

          {/* ================= LOGO ================= */}
          <div className="relative h-14 w-28 shrink-0 sm:h-16 sm:w-32 md:h-20 md:w-40">
            <Image
              src="/logo/anjivo-logo.png"
              alt="ANJIVO"
              fill
              priority
              sizes="(max-width: 640px) 112px, (max-width: 768px) 128px, 160px"
              className="object-contain object-left"
            />
          </div>

          {/* ================= LOCATION ================= */}
          <button
            type="button"
            className="hidden rounded-xl border border-gray-200 px-3 py-2 text-left transition hover:border-black lg:block"
          >
            <div className="text-[9px] uppercase tracking-wide text-gray-400">
              Deliver to
            </div>

            <div className="mt-0.5 text-xs font-bold text-gray-800">
              📍 Select Location
            </div>
          </button>

          {/* ================= SEARCH ================= */}
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, brands, categories & sellers..."
              className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 pr-14 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-black focus:bg-white focus:ring-2 focus:ring-black/5"
            />

            <button
              type="button"
              aria-label="Search"
              className="absolute right-1 top-1 flex h-9 w-10 items-center justify-center rounded-lg bg-black text-white transition hover:bg-gray-800"
            >
              🔍
            </button>
          </div>

          {/* ================= WHOLESALE ================= */}
          <button
            type="button"
            className="hidden rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-bold transition hover:border-black hover:bg-gray-50 xl:block"
          >
            🏪 Wholesale
          </button>

          {/* ================= ACCOUNT ================= */}
          <button
            type="button"
            className="hidden text-left lg:block"
          >
            <div className="text-[10px] text-gray-400">
              Hello, Sign in
            </div>

            <div className="text-xs font-bold text-gray-800">
              Account & Orders
            </div>
          </button>

          {/* ================= CART ================= */}
          <button
            type="button"
            aria-label="Shopping Cart"
            className="relative flex h-11 shrink-0 items-center rounded-xl bg-black px-3 text-sm font-bold text-white transition hover:bg-gray-800 sm:px-4"
          >
            <span className="text-lg">🛒</span>

            <span className="ml-1.5 hidden sm:inline">
              Cart
            </span>

            {/* Cart Count */}
            <span className="absolute -right-1.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-black shadow-md ring-1 ring-gray-200">
              0
            </span>
          </button>
        </div>
      </div>

      {/* ================= CATEGORY NAVIGATION ================= */}
      <div className="border-b bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-3 py-3 text-xs font-semibold whitespace-nowrap md:px-4">

          {/* All Categories */}
          <button
            type="button"
            className="shrink-0 font-black text-gray-900"
          >
            ☰ All Categories
          </button>

          <span className="h-4 w-px shrink-0 bg-gray-200" />

          <button type="button" className="shrink-0 hover:text-gray-500">
            Fashion
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            Beauty
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            Toys
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            Jewellery
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            Footwear
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            Electronics
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            Home & Living
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            Grocery
          </button>

          <button type="button" className="shrink-0 hover:text-gray-500">
            New Arrivals
          </button>

          <button
            type="button"
            className="shrink-0 font-black text-gray-900"
          >
            🔥 Deals
          </button>

          <button
            type="button"
            className="shrink-0 font-black text-gray-900"
          >
            🏪 Wholesale
          </button>
        </nav>
      </div>
    </header>
  );
}
