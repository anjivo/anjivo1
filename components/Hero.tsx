import Link from "next/link";

export default function Hero() {
  return (
    <section className="overflow-hidden bg-[#f3f4f6]">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 sm:py-10 md:grid-cols-[1.08fr_.92fr] md:gap-10 md:py-14 lg:py-16">

        {/* ================= LEFT CONTENT ================= */}
        <div className="min-w-0">

          {/* Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-[11px] font-bold tracking-wide text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            ANJIVO MARKETPLACE
          </div>

          {/* Heading */}
          <h1 className="max-w-3xl text-[2.45rem] font-black leading-[1.02] tracking-[-0.04em] text-gray-950 sm:text-5xl md:text-6xl lg:text-[4.2rem]">
            Retail mein shopping.
            <br />
            <span className="text-gray-500">
              Wholesale mein saving.
            </span>
          </h1>

          {/* Description */}
          <p className="mt-5 max-w-xl text-sm leading-6 text-gray-600 sm:text-base sm:leading-7 md:text-lg">
            Discover products from multiple sellers. Buy a single
            piece for yourself or unlock better prices when you
            buy in bulk.
          </p>

          {/* ================= ACTIONS ================= */}
          <div className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">

            <Link
              href="/products"
              className="flex items-center justify-center rounded-xl bg-black px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-gray-800 sm:px-6"
            >
              🛒 Shop Retail
            </Link>

            <Link
              href="/wholesale"
              className="flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3.5 text-sm font-bold text-gray-900 transition hover:border-black hover:bg-black hover:text-white sm:px-6"
            >
              📦 Buy Wholesale
            </Link>

          </div>

          {/* ================= BENEFITS ================= */}
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 border-t border-gray-200 pt-6">

            <div>
              <div className="text-lg font-black text-gray-950">
                ✓
              </div>

              <p className="mt-1 text-[11px] font-bold text-gray-800 sm:text-xs">
                Verified Sellers
              </p>

              <p className="mt-1 hidden text-[10px] text-gray-500 sm:block">
                Trusted marketplace partners
              </p>
            </div>

            <div>
              <div className="text-lg font-black text-gray-950">
                ₹
              </div>

              <p className="mt-1 text-[11px] font-bold text-gray-800 sm:text-xs">
                Bulk Pricing
              </p>

              <p className="mt-1 hidden text-[10px] text-gray-500 sm:block">
                Better price on quantity
              </p>
            </div>

            <div>
              <div className="text-lg font-black text-gray-950">
                🔒
              </div>

              <p className="mt-1 text-[11px] font-bold text-gray-800 sm:text-xs">
                Secure Checkout
              </p>

              <p className="mt-1 hidden text-[10px] text-gray-500 sm:block">
                Safe & simple payments
              </p>
            </div>

          </div>

        </div>

        {/* ================= RIGHT PANEL ================= */}
        <div className="relative overflow-hidden rounded-[2rem] bg-black p-5 text-white shadow-2xl sm:p-7 md:p-8">

          {/* Decorative circles */}
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/[0.07]" />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-white/[0.05]" />

          <div className="relative">

            {/* Small heading */}
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                One Marketplace
              </div>

              <div className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold">
                RETAIL + B2B
              </div>
            </div>

            {/* Main text */}
            <h2 className="mt-5 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">
              Buy 1.
              <br />
              Buy 100.
              <br />
              <span className="text-gray-400">
                Your choice.
              </span>
            </h2>

            {/* Retail / Wholesale cards */}
            <div className="mt-7 grid grid-cols-2 gap-3">

              {/* Retail */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm transition hover:bg-white/[0.12]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl">
                  🛍️
                </div>

                <p className="mt-4 text-sm font-black">
                  Retail
                </p>

                <p className="mt-1 text-[11px] leading-5 text-gray-400">
                  Single & small quantities
                </p>

                <div className="mt-4 text-[10px] font-bold text-gray-300">
                  BUY FOR YOURSELF →
                </div>
              </div>

              {/* Wholesale */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm transition hover:bg-white/[0.12]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl">
                  📦
                </div>

                <p className="mt-4 text-sm font-black">
                  Wholesale
                </p>

                <p className="mt-1 text-[11px] leading-5 text-gray-400">
                  MOQ & quantity pricing
                </p>

                <div className="mt-4 text-[10px] font-bold text-gray-300">
                  BUY IN BULK →
                </div>
              </div>

            </div>

            {/* ================= BULK PRICE ================= */}
            <div className="mt-4 rounded-2xl bg-white p-4 text-black sm:p-5">

              <div className="flex items-center justify-between gap-3">

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Wholesale Example
                  </div>

                  <div className="mt-1 text-sm font-bold">
                    Buy more. Pay less.
                  </div>
                </div>

                <div className="rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-black">
                  MOQ 20
                </div>

              </div>

              <div className="mt-4 flex items-end justify-between">

                <div>
                  <span className="text-3xl font-black sm:text-4xl">
                    ₹149
                  </span>

                  <span className="ml-1 text-xs text-gray-500">
                    / piece
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-gray-400">
                    Starting from
                  </div>

                  <div className="text-xs font-black text-gray-800">
                    20 pieces
                  </div>
                </div>

              </div>

              {/* Quantity tiers */}
              <div className="mt-4 grid grid-cols-4 gap-1.5">

                <div className="rounded-lg bg-gray-100 p-2 text-center">
                  <div className="text-[9px] text-gray-500">
                    20+
                  </div>
                  <div className="text-[10px] font-black">
                    ₹149
                  </div>
                </div>

                <div className="rounded-lg bg-gray-100 p-2 text-center">
                  <div className="text-[9px] text-gray-500">
                    50+
                  </div>
                  <div className="text-[10px] font-black">
                    ₹139
                  </div>
                </div>

                <div className="rounded-lg bg-gray-100 p-2 text-center">
                  <div className="text-[9px] text-gray-500">
                    100+
                  </div>
                  <div className="text-[10px] font-black">
                    ₹129
                  </div>
                </div>

                <div className="rounded-lg bg-black p-2 text-center text-white">
                  <div className="text-[9px] text-gray-400">
                    250+
                  </div>
                  <div className="text-[10px] font-black">
                    ₹119
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
