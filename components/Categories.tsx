const categories = [
  ["👗", "Fashion", "10K+ Products"],
  ["💄", "Beauty", "5K+ Products"],
  ["🧸", "Toys", "3K+ Products"],
  ["💍", "Jewellery", "4K+ Products"],
  ["👟", "Footwear", "6K+ Products"],
  ["📱", "Electronics", "8K+ Products"],
  ["🏠", "Home", "7K+ Products"],
  ["🛒", "Grocery", "12K+ Products"],
];

export default function Categories() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            EXPLORE
          </p>
          <h2 className="mt-1 text-3xl font-black">
            Shop by Category
          </h2>
        </div>

        <button className="text-sm font-bold">
          View All →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {categories.map(([icon, name, count]) => (
          <button
            key={name}
            className="group rounded-2xl border bg-white p-4 text-center transition hover:-translate-y-1 hover:border-black hover:shadow-lg"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl transition group-hover:scale-110">
              {icon}
            </div>

            <h3 className="mt-3 text-sm font-black">
              {name}
            </h3>

            <p className="mt-1 text-[10px] text-gray-400">
              {count}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
