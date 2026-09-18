import Image from "next/image";

export default function Footer() {
  return (
    <footer className="mt-12 bg-[#111111] text-white">

      {/* ================= MAIN FOOTER ================= */}
      <div className="mx-auto max-w-7xl px-4 py-12 md:py-16">

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">

          {/* ================= BRAND ================= */}
          <div className="lg:col-span-2">

            <div className="relative h-28 w-56">
              <Image
                src="/logo/anjivo-logo.png"
                alt="ANJIVO"
                fill
                sizes="224px"
                className="object-contain object-left"
              />
            </div>

            <p className="mt-3 max-w-md text-sm leading-6 text-gray-400">
              ANJIVO is a multi-seller marketplace where customers
              can shop retail, buy wholesale and discover products
              from verified sellers.
            </p>

            {/* Social */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:bg-white hover:text-black"
              >
                ◎
              </button>

              <button
                type="button"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:bg-white hover:text-black"
              >
                f
              </button>

              <button
                type="button"
                aria-label="YouTube"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:bg-white hover:text-black"
              >
                ▶
              </button>

              <button
                type="button"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:bg-white hover:text-black"
              >
                ☎
              </button>
            </div>
          </div>

          {/* ================= SHOP ================= */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              Shop
            </h3>

            <div className="mt-5 space-y-3 text-sm text-gray-400">
              <button className="block transition hover:text-white">
                All Products
              </button>

              <button className="block transition hover:text-white">
                New Arrivals
              </button>

              <button className="block transition hover:text-white">
                Best Sellers
              </button>

              <button className="block transition hover:text-white">
                Flash Deals
              </button>

              <button className="block transition hover:text-white">
                Wholesale
              </button>

              <button className="block transition hover:text-white">
                Categories
              </button>
            </div>
          </div>

          {/* ================= CUSTOMER ================= */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              Customer
            </h3>

            <div className="mt-5 space-y-3 text-sm text-gray-400">
              <button className="block transition hover:text-white">
                My Account
              </button>

              <button className="block transition hover:text-white">
                My Orders
              </button>

              <button className="block transition hover:text-white">
                Track Order
              </button>

              <button className="block transition hover:text-white">
                Returns & Refunds
              </button>

              <button className="block transition hover:text-white">
                Shipping Information
              </button>

              <button className="block transition hover:text-white">
                Contact Support
              </button>
            </div>
          </div>

          {/* ================= BUSINESS ================= */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              Business
            </h3>

            <div className="mt-5 space-y-3 text-sm text-gray-400">
              <button className="block transition hover:text-white">
                Become a Seller
              </button>

              <button className="block transition hover:text-white">
                Seller Login
              </button>

              <button className="block transition hover:text-white">
                Wholesale Account
              </button>

              <button className="block transition hover:text-white">
                Sell on ANJIVO
              </button>

              <button className="block transition hover:text-white">
                Seller Benefits
              </button>

              <button className="block transition hover:text-white">
                Seller Support
              </button>
            </div>
          </div>

        </div>

        {/* ================= TRUST FEATURES ================= */}
        <div className="mt-12 grid grid-cols-2 gap-3 border-y border-gray-800 py-7 md:grid-cols-4">

          <div className="flex items-center gap-3">
            <div className="text-xl">🔒</div>
            <div>
              <p className="text-sm font-bold">
                Secure Payments
              </p>
              <p className="text-xs text-gray-500">
                Safe & protected checkout
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xl">✓</div>
            <div>
              <p className="text-sm font-bold">
                Verified Sellers
              </p>
              <p className="text-xs text-gray-500">
                Trusted marketplace sellers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xl">📦</div>
            <div>
              <p className="text-sm font-bold">
                Retail + Wholesale
              </p>
              <p className="text-xs text-gray-500">
                Buy in any quantity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xl">💬</div>
            <div>
              <p className="text-sm font-bold">
                Customer Support
              </p>
              <p className="text-xs text-gray-500">
                We're here to help
              </p>
            </div>
          </div>

        </div>

        {/* ================= NEWSLETTER ================= */}
        <div className="mt-10 rounded-2xl border border-gray-800 bg-[#181818] p-6 md:flex md:items-center md:justify-between md:p-8">

          <div>
            <h3 className="text-xl font-black">
              Get the latest deals
            </h3>

            <p className="mt-1 text-sm text-gray-400">
              Offers, wholesale deals and new arrivals directly
              to your inbox.
            </p>
          </div>

          <div className="mt-5 flex max-w-md gap-2 md:mt-0">
            <input
              type="email"
              placeholder="Enter your email"
              className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-[#111111] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white"
            />

            <button
              type="button"
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-gray-200"
            >
              Subscribe
            </button>
          </div>

        </div>

      </div>

      {/* ================= BOTTOM FOOTER ================= */}
      <div className="border-t border-gray-800">

        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">

          <p>
            © 2026 ANJIVO. All rights reserved.
          </p>

          <div className="flex flex-wrap gap-5">
            <button className="transition hover:text-white">
              Privacy Policy
            </button>

            <button className="transition hover:text-white">
              Terms & Conditions
            </button>

            <button className="transition hover:text-white">
              Refund Policy
            </button>

            <button className="transition hover:text-white">
              Seller Policy
            </button>
          </div>

        </div>

      </div>

    </footer>
  );
}
