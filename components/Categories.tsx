import Link from "next/link";

const categories = [
  {
    icon: "👗",
    name: "Fashion",
    count: "10K+ Products",
    description: "Clothing & Style",
    href: "/categories/fashion",
  },
  {
    icon: "💄",
    name: "Beauty",
    count: "5K+ Products",
    description: "Beauty & Care",
    href: "/categories/beauty",
  },
  {
    icon: "🧸",
    name: "Toys",
    count: "3K+ Products",
    description: "Kids & Toys",
    href: "/categories/toys",
  },
  {
    icon: "💍",
    name: "Jewellery",
    count: "4K+ Products",
    description: "Fashion Jewellery",
    href: "/categories/jewellery",
  },
  {
    icon: "👟",
    name: "Footwear",
    count: "6K+ Products",
    description: "Shoes & Sandals",
    href: "/categories/footwear",
  },
  {
    icon: "📱",
    name: "Electronics",
    count: "8K+ Products",
    description: "Gadgets & More",
    href: "/categories/electronics",
  },
  {
    icon: "🏠",
    name: "Home",
    count: "7K+ Products",
    description: "Home & Living",
    href: "/categories/home",
  },
  {
    icon: "🛒",
    name: "Grocery",
    count: "12K+ Products",
    description: "Daily Essentials",
    href: "/categories/grocery",
  },
];

export default function Categories() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:py-12 md:py-14">

      {/* ================= SECTION HEADER ================= */}
      <div className="mb-6 flex items-end justify-between gap-4">

        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
              Explore
            </p>
          </div>

          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
            Shop by Category
          </h2>

          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            Discover products across popular categories
          </p>
        </div>

        <Link
          href="/categories"
          className="shrink-0 text-xs font-bold text-gray-700 transition hover:text-black sm:text-sm"
        >
          View All →
        </Link>

      </div>

      {/* ================= CATEGORY GRID ================= */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">

        {categories.map((category) => (
          <Link
            key={category.name}
            href={category.href}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-center transition duration-300 hover:-translate-y-1 hover:border-black hover:shadow-xl sm:p-5"
          >

            {/* Subtle background decoration */}
            <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-gray-50 transition duration-300 group-hover:scale-150" />

            {/* ================= ICON ================= */}
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl transition duration-300 group-hover:scale-110 group-hover:bg-black group-hover:shadow-lg sm:h-[68px] sm:w-[68px] sm:text-[2rem]">
              <span className="transition duration-300 group-hover:grayscale group-hover:brightness-0 group-hover:invert">
                {category.icon}
              </span>
            </div>

            {/* ================= NAME ================= */}
            <h3 className="mt-3 text-sm font-black text-gray-900">
              {category.name}
            </h3>

            {/* ================= DESCRIPTION ================= */}
            <p className="mt-1 hidden text-[10px] text-gray-400 sm:block">
              {category.description}
            </p>

            {/* ================= PRODUCT COUNT ================= */}
            <p className="mt-1 text-[10px] font-semibold text-gray-500">
              {category.count}
            </p>

            {/* ================= MOBILE / HOVER ARROW ================= */}
            <div className="mt-2 text-[10px] font-bold text-gray-400 transition group-hover:text-black">
              Explore →
            </div>

          </Link>
        ))}

      </div>

      {/* ================= MOBILE VIEW ALL ================= */}
      <div className="mt-5 text-center sm:hidden">
        <Link
          href="/categories"
          className="inline-flex rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-bold text-gray-800 transition hover:border-black hover:bg-black hover:text-white"
        >
          View All Categories →
        </Link>
      </div>

    </section>
  );
}
