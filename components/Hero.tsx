export default function Hero() {
  return (
    <section className="bg-[#f0f1f3]">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 md:grid-cols-[1.15fr_.85fr] md:py-16">

        <div>
          <div className="mb-4 inline-flex rounded-full bg-black px-4 py-2 text-xs font-bold text-white">
            ANJIVO MARKETPLACE
          </div>

          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Retail mein shopping.
            <br />
            Wholesale mein saving.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-gray-600 md:text-lg">
            Discover products from multiple sellers, shop in
            single pieces or unlock special prices when you buy
            in bulk.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button className="rounded-xl bg-black px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5">
              🛒 Shop Retail
            </button>

            <button className="rounded-xl border border-black bg-white px-6 py-3.5 text-sm font-bold transition hover:bg-black hover:text-white">
              📦 Buy Wholesale
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-5 text-xs font-semibold text-gray-600">
            <span>✓ Verified Sellers</span>
            <span>✓ Bulk Pricing</span>
            <span>✓ Secure Checkout</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-black p-6 text-white shadow-2xl md:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-white/5" />

          <div className="relative">
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
              One Marketplace
            </div>

            <h2 className="mt-4 text-3xl font-black">
              Buy 1.
              <br />
              Buy 100.
              <br />
              Your choice.
            </h2>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="text-3xl">🛍️</div>
                <p className="mt-3 font-bold">
                  Retail
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Single & small quantities
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="text-3xl">📦</div>
                <p className="mt-3 font-bold">
                  Wholesale
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  MOQ & bulk pricing
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 text-black">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Example bulk price
                </span>
                <span className="text-xs font-bold">
                  MOQ 20
                </span>
              </div>

              <div className="mt-1 flex items-end justify-between">
                <span className="text-3xl font-black">
                  ₹149
                </span>
                <span className="text-xs text-gray-500">
                  /piece
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
