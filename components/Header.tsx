"use client";

import { useState } from "react";

export default function Header() {
  const [search, setSearch] = useState("");

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">

      {/* Top Bar */}
      <div className="hidden bg-black px-4 py-2 text-center text-xs font-medium text-white md:block">
        🚚 Free shipping on selected orders &nbsp; • &nbsp;
        Wholesale buyers get special pricing
      </div>

      {/* Main Header */}
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">

          {/* Logo */}
          <div className="shrink-0">
            <div className="text-2xl font-black tracking-tight md:text-3xl">
              ANJIVO
            </div>
            <div className="hidden text-[8px] font-bold uppercase tracking-[0.25em] text-gray-400 sm:block">
              Retail • Wholesale
            </div>
          </div>

          {/* Location */}
          <button className="hidden rounded-xl border px-3 py-2 text-left lg:block">
            <div className="text-[9px] uppercase text-gray-400">
              Deliver to
            </div>
            <div className="text-xs font-bold">
              📍 Select Location
            </div>
          </button>

          {/* Search */}
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, brands, categories & sellers..."
              className="w-full rounded-xl border bg-gray-50 px-4 py-3 pr-12 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-black"
            />

            <button className="absolute right-1 top-1 rounded-lg bg-black px-4 py-2.5 text-white">
              🔍
            </button>
          </div>

          {/* Wholesale */}
          <button className="hidden rounded-xl border px-3 py-2 text-xs font-bold xl:block">
            🏪 Wholesale
          </button>

          {/* Account */}
          <button className="hidden text-left lg:block">
            <div className="text-[10px] text-gray-400">
              Hello, Sign in
            </div>
            <div className="text-xs font-bold">
              Account & Orders
            </div>
          </button>

          {/* Cart */}
          <button className="relative rounded-xl bg-black px-4 py-3 text-sm font-bold text-white">
            🛒
            <span className="ml-1 hidden sm:inline">
              Cart
            </span>

            <span className="absolute -right-1 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-black shadow">
              0
            </span>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b bg-white">
        <nav className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 py-3 text-xs font-semibold whitespace-nowrap">
          <button className="font-black">
            ☰ All Categories
          </button>
          <button>Fashion</button>
          <button>Beauty</button>
          <button>Toys</button>
          <button>Jewellery</button>
          <button>Footwear</button>
          <button>Electronics</button>
          <button>Home & Living</button>
          <button>Grocery</button>
          <button>New Arrivals</button>
          <button>🔥 Deals</button>
          <button>🏪 Wholesale</button>
        </nav>
      </div>
    </header>
  );
}
