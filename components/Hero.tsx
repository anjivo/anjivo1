export default function Hero() {
  return (
    <section className="bg-gray-100">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest">
            ANJIVO MARKETPLACE
          </p>

          <h1 className="text-4xl font-black leading-tight md:text-6xl">
            Retail bhi.
            <br />
            Wholesale bhi.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-gray-600">
            Products ko retail quantity mein bhi kharido aur bulk
            quantity mein wholesale price par bhi.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <button className="rounded-xl bg-black px-6 py-3 font-semibold text-white">
              Shop Retail
            </button>

            <button className="rounded-xl border border-black px-6 py-3 font-semibold">
              Buy Wholesale
            </button>
          </div>
        </div>

        <div className="flex min-h-72 items-center justify-center rounded-3xl bg-white p-10 shadow-sm">
          <div className="text-center">
            <div className="text-6xl">🛒</div>
            <p className="mt-4 text-xl font-bold">
              One Platform
            </p>
            <p className="text-gray-500">
              Retail + Wholesale
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
