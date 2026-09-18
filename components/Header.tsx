"use client";

import { useState } from "react";

export default function Header() {
  const [search, setSearch] = useState("");

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
        
        <div className="text-2xl font-black tracking-tight">
          ANJIVO
        </div>

        <div className="hidden flex-1 md:block">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, brands and categories..."
            className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
          />
        </div>

        <button className="hidden rounded-lg px-3 py-2 md:block">
          Login
        </button>

        <button className="rounded-lg bg-black px-4 py-2 text-white">
          Cart
        </button>

      </div>

      <div className="border-t">
        <nav className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-3 text-sm">
          <span>All Categories</span>
          <span>Fashion</span>
          <span>Beauty</span>
          <span>Toys</span>
          <span>Jewellery</span>
          <span>Home & Living</span>
          <span>Wholesale</span>
        </nav>
      </div>
    </header>
  );
}
