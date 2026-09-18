import Link from "next/link";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";

/* =========================================================
   DEMO PRODUCTS
   Later these will come from database
========================================================= */

const products = [
  {
    name: "Premium Women's Kurti",
    category: "Fashion",
    price: 399,
    wholesalePrice: 219,
    oldPrice: 699,
    rating: 4.6,
    reviews: 1284,
    image: "👗",
    badge: "Bestseller",
    seller: "Style Hub",
    moq: 10,
    stock: 18,
    verifiedSeller: true,
  },
  {
    name: "Matte Liquid Lipstick",
    category: "Beauty",
    price: 199,
    wholesalePrice: 89,
    oldPrice: 299,
    rating: 4.5,
    reviews: 856,
    image: "💄",
    badge: "Trending",
    seller: "Beauty World",
    moq: 20,
    stock: 9,
    verifiedSeller: true,
  },
  {
    name: "Remote Control Racing Car",
    category: "Toys",
    price: 599,
    wholesalePrice: 329,
    oldPrice: 999,
    rating: 4.4,
    reviews: 642,
    image: "🏎️",
    badge: "Hot Deal",
    seller: "Kids Planet",
    moq: 10,
    stock: 7,
    verifiedSeller: true,
  },
  {
    name: "Artificial Jewellery Set",
    category: "Jewellery",
    price: 299,
    wholesalePrice: 119,
    oldPrice: 599,
    rating: 4.7,
    reviews: 2130,
    image: "💍",
    badge: "Top Rated",
    seller: "Fashion Jewels",
    moq: 25,
    stock: 32,
    verifiedSeller: true,
  },
  {
    name: "Casual Men's Sneakers",
    category: "Footwear",
    price: 799,
    wholesalePrice: 449,
    oldPrice: 1299,
    rating: 4.3,
    reviews: 921,
    image: "👟",
    badge: "New",
    seller: "Urban Footwear",
    moq: 10,
    stock: 14,
    verifiedSeller: true,
  },
  {
    name: "Modern Home Organizer",
    category: "Home",
    price: 249,
    wholesalePrice: 129,
    oldPrice: 399,
    rating: 4.5,
    reviews: 518,
    image: "🏠",
    badge: "Value Buy",
    seller: "Home Essentials",
    moq: 20,
    stock: 21,
    verifiedSeller: true,
  },
];

/* =========================================================
   WHOLESALE PRODUCTS
========================================================= */

const wholesaleProducts = [
  {
    name: "Cotton T-Shirt Combo",
    category: "Fashion",
    price: 299,
    wholesalePrice: 129,
    moq: 20,
    image: "👕",
    seller: "Fashion Hub",
  },
  {
    name: "Ladies Leggings",
    category: "Fashion",
    price: 299,
    wholesalePrice: 99,
    moq: 25,
    image: "👖",
    seller: "Style Wholesale",
  },
  {
    name: "Cosmetic Combo",
    category: "Beauty",
    price: 499,
    wholesalePrice: 199,
    moq: 10,
    image: "💋",
    seller: "Beauty Wholesale",
  },
  {
    name: "Kids Toy Combo",
    category: "Toys",
    price: 699,
    wholesalePrice: 299,
    moq: 10,
    image: "🧸",
    seller: "Kids Wholesale",
  },
];

/* =========================================================
   QUICK ACTIONS
========================================================= */

const quickActions = [
  {
    icon: "⚡",
    title: "Flash Deals",
    subtitle: "Limited offers",
    href: "/products?deal=true",
  },
  {
    icon: "📦",
    title: "Wholesale",
    subtitle: "Bulk prices",
    href: "/wholesale",
  },
  {
    icon: "✨",
    title: "New Arrivals",
    subtitle: "Fresh products",
    href: "/products?sort=new",
  },
  {
    icon: "🔥",
    title: "Trending",
    subtitle: "What people buy",
    href: "/products?sort=trending",
  },
  {
    icon: "🏪",
    title: "Top Sellers",
    subtitle: "Verified stores",
    href: "/sellers",
  },
];

/* =========================================================
   HOME PAGE
========================================================= */

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-950">

      {/* ================= HEADER ================= */}
      <Header />

      <main>

        {/* ================= HERO ================= */}
        <Hero />

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-5 sm:py-7">

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">

            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group rounded-2xl border border-gray-200 bg-white p-4 transition duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg"
              >

                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl transition group-hover:bg-black group-hover:grayscale group-hover:brightness-0 group-hover:invert">
                    {action.icon}
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-black sm:text-sm">
                      {action.title}
                    </h3>

                    <p className="mt-0.5 truncate text-[10px] text-gray-500 sm:text-xs">
                      {action.subtitle}
                    </p>
                  </div>

                </div>

              </Link>
            ))}

          </div>
        </section>

        {/* ================= CATEGORIES ================= */}
        <Categories />

        {/* =================================================
            FLASH SALE
        ================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-7 sm:py-9">

          <div className="overflow-hidden rounded-[1.75rem] bg-black text-white shadow-xl">

            {/* Flash Sale Header */}
            <div className="flex flex-col gap-5 px-5 py-6 sm:px-7 md:flex-row md:items-center md:justify-between md:px-8">

              <div>

                <div className="flex flex-wrap items-center gap-3">

                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-black">
                    Live Deal
                  </span>

                  <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                    Flash Sale
                  </h2>

                </div>

                <p className="mt-2 text-xs text-gray-400 sm:text-sm">
                  Grab today's deals before they disappear.
                </p>

              </div>

              {/* Countdown */}
              <div className="flex items-center gap-2">

                {[
                  ["08", "HRS"],
                  ["42", "MIN"],
                  ["17", "SEC"],
                ].map(([time, label]) => (
                  <div
                    key={label}
                    className="text-center"
                  >
                    <div className="min-w-12 rounded-xl bg-white px-3 py-2 text-lg font-black text-black">
                      {time}
                    </div>

                    <span className="mt-1 block text-[8px] font-bold text-gray-500">
                      {label}
                    </span>
                  </div>
                ))}

              </div>

            </div>

            {/* Products */}
            <div className="grid grid-cols-2 gap-3 border-t border-gray-800 p-3 sm:p-4 md:grid-cols-4">

              {products.slice(0, 4).map((product) => (
                <ProductCard
                  key={product.name}
                  {...product}
                />
              ))}

            </div>

            {/* View All */}
            <div className="border-t border-gray-800 px-4 py-4 text-center">

              <Link
                href="/products?deal=true"
                className="text-xs font-bold text-gray-300 transition hover:text-white"
              >
                View All Flash Deals →
              </Link>

            </div>

          </div>
        </section>

        {/* =================================================
            WHOLESALE ZONE
        ================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-7 sm:py-9">

          {/* Heading */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                ANJIVO BUSINESS
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Wholesale Zone
              </h2>

              <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                Buy more. Pay less. Grow your business.
              </p>

            </div>

            <Link
              href="/wholesale"
              className="w-fit rounded-xl bg-black px-5 py-3 text-xs font-bold text-white transition hover:bg-gray-800 sm:text-sm"
            >
              Explore Wholesale →
            </Link>

          </div>

          {/* Wholesale Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">

            {wholesaleProducts.map((product) => (
              <div
                key={product.name}
                className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-xl"
              >

                {/* Image */}
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gray-100 sm:h-48">

                  <span className="text-6xl transition duration-500 group-hover:scale-110 sm:text-7xl">
                    {product.image}
                  </span>

                  <span className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[9px] font-black text-white">
                    WHOLESALE
                  </span>

                </div>

                {/* Info */}
                <div className="p-3.5 sm:p-4">

                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    {product.category}
                  </p>

                  <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-black">
                    {product.name}
                  </h3>

                  <div className="mt-3 flex items-end justify-between gap-2">

                    <div>
                      <p className="text-[9px] uppercase text-gray-400">
                        Starting from
                      </p>

                      <p className="text-lg font-black">
                        ₹{product.wholesalePrice.toLocaleString("en-IN")}
                      </p>

                      <p className="text-[9px] text-gray-400">
                        / piece
                      </p>
                    </div>

                    <span className="shrink-0 rounded-lg bg-gray-100 px-2 py-1.5 text-[9px] font-black">
                      MOQ {product.moq}
                    </span>

                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-[9px] text-gray-500">
                    <span>🏪</span>
                    <span className="truncate">
                      {product.seller}
                    </span>
                    <span>✓</span>
                  </div>

                  <Link
                    href="/wholesale"
                    className="mt-3 block w-full rounded-xl border border-black py-2.5 text-center text-[11px] font-bold transition hover:bg-black hover:text-white"
                  >
                    View Bulk Price
                  </Link>

                </div>

              </div>
            ))}

          </div>
        </section>

        {/* =================================================
            RETAIL + BUSINESS BANNERS
        ================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-7 sm:py-9">

          <div className="grid gap-4 md:grid-cols-2">

            {/* Retail */}
            <div className="relative overflow-hidden rounded-[1.75rem] bg-gray-900 p-6 text-white sm:p-8">

              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/[0.05]" />

              <div className="relative">

                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  For Retail Customers
                </span>

                <h2 className="mt-3 max-w-md text-2xl font-black tracking-tight sm:text-3xl">
                  Shop your favourites.
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-gray-400">
                  Discover trending products from verified sellers
                  and shop in single or small quantities.
                </p>

                <Link
                  href="/products"
                  className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-xs font-bold text-black transition hover:bg-gray-200 sm:text-sm"
                >
                  Start Shopping →
                </Link>

              </div>

            </div>

            {/* Business */}
            <div className="relative overflow-hidden rounded-[1.75rem] bg-gray-200 p-6 text-black sm:p-8">

              <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-black/[0.05]" />

              <div className="relative">

                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                  For Businesses
                </span>

                <h2 className="mt-3 max-w-md text-2xl font-black tracking-tight sm:text-3xl">
                  Source at wholesale prices.
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
                  Find products, compare sellers and order in bulk
                  with quantity-based pricing.
                </p>

                <Link
                  href="/wholesale"
                  className="mt-6 inline-flex rounded-xl bg-black px-5 py-3 text-xs font-bold text-white transition hover:bg-gray-800 sm:text-sm"
                >
                  Enter Wholesale →
                </Link>

              </div>

            </div>

          </div>
        </section>

        {/* =================================================
            BEST SELLERS
        ================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-7 sm:py-9">

          <div className="mb-6 flex items-end justify-between gap-4">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Customer Favourites
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Best Sellers
              </h2>

              <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                Products customers are buying right now
              </p>

            </div>

            <Link
              href="/products?sort=best"
              className="shrink-0 text-xs font-bold text-gray-700 transition hover:text-black sm:text-sm"
            >
              View All →
            </Link>

          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">

            {products.map((product) => (
              <ProductCard
                key={product.name}
                {...product}
              />
            ))}

          </div>

        </section>

        {/* =================================================
            SELLER CTA
        ================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10">

          <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm sm:p-8 md:p-10">

            <div className="grid items-center gap-8 md:grid-cols-2">

              {/* Content */}
              <div>

                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider">
                  For Sellers
                </span>

                <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  Turn your products
                  <br />
                  into a business.
                </h2>

                <p className="mt-4 max-w-lg text-sm leading-6 text-gray-600">
                  Manufacturers, wholesalers and retailers can
                  reach customers across India through ANJIVO.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">

                  <Link
                    href="/seller/register"
                    className="rounded-xl bg-black px-5 py-3 text-xs font-bold text-white transition hover:bg-gray-800 sm:px-6 sm:text-sm"
                  >
                    Become a Seller
                  </Link>

                  <Link
                    href="/seller/benefits"
                    className="rounded-xl border border-gray-300 px-5 py-3 text-xs font-bold text-gray-900 transition hover:border-black sm:px-6 sm:text-sm"
                  >
                    Seller Benefits
                  </Link>

                </div>

              </div>

              {/* Seller Benefits */}
              <div className="grid grid-cols-2 gap-3">

                {[
                  ["📈", "Grow Sales", "Reach new customers"],
                  ["📦", "Bulk Orders", "Wholesale buyers"],
                  ["🛍️", "Retail Orders", "Direct customers"],
                  ["📊", "Seller Dashboard", "Manage everything"],
                ].map(([icon, title, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl bg-gray-50 p-4 transition hover:bg-gray-100 sm:p-5"
                  >

                    <div className="text-2xl sm:text-3xl">
                      {icon}
                    </div>

                    <h3 className="mt-3 text-sm font-black sm:text-base">
                      {title}
                    </h3>

                    <p className="mt-1 text-[10px] leading-4 text-gray-500 sm:text-xs">
                      {text}
                    </p>

                  </div>
                ))}

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            TRUST FEATURES
        ================================================= */}
        <section className="border-y border-gray-200 bg-white">

          <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">

            {[
              ["✓", "Verified Sellers", "Seller verification"],
              ["₹", "Wholesale Pricing", "Bulk savings"],
              ["↻", "Easy Returns", "Simple return process"],
              ["🔒", "Secure Payments", "Protected checkout"],
            ].map(([icon, title, subtitle]) => (
              <div
                key={title}
                className="border-b border-gray-100 p-5 text-center last:border-b-0 sm:p-6 md:border-b-0 md:border-r md:last:border-r-0"
              >

                <div className="text-xl font-black sm:text-2xl">
                  {icon}
                </div>

                <h3 className="mt-2 text-xs font-black sm:text-sm">
                  {title}
                </h3>

                <p className="mt-1 text-[10px] text-gray-500 sm:text-xs">
                  {subtitle}
                </p>

              </div>
            ))}

          </div>

        </section>

        {/* =================================================
            APP / MOBILE CTA
        ================================================= */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:py-12">

          <div className="overflow-hidden rounded-[2rem] bg-black px-6 py-10 text-white sm:px-8 md:px-12">

            <div className="grid items-center gap-10 md:grid-cols-2">

              {/* Text */}
              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  ANJIVO APP
                </p>

                <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  Shopping that moves
                  <br />
                  with your business.
                </h2>

                <p className="mt-4 max-w-lg text-sm leading-6 text-gray-400">
                  Shop retail, discover wholesale deals and manage
                  your business from anywhere.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">

                  <button
                    type="button"
                    className="rounded-xl bg-white px-5 py-3 text-xs font-bold text-black transition hover:bg-gray-200 sm:text-sm"
                  >
                    Google Play
                  </button>

                  <button
                    type="button"
                    className="rounded-xl border border-gray-700 px-5 py-3 text-xs font-bold text-white sm:text-sm"
                  >
                    Coming Soon
                  </button>

                </div>

              </div>

              {/* Phone Mockup */}
              <div className="flex justify-center">

                <div className="relative flex h-64 w-40 items-center justify-center rounded-[2.5rem] border-4 border-gray-700 bg-gray-900 shadow-2xl">

                  <div className="absolute left-1/2 top-2 h-1 w-12 -translate-x-1/2 rounded-full bg-gray-700" />

                  <div className="text-center">

                    <div className="text-2xl font-black tracking-tight">
                      ANJIVO
                    </div>

                    <div className="mt-2 text-[10px] text-gray-500">
                      Retail + Wholesale
                    </div>

                    <div className="mx-auto mt-5 h-px w-16 bg-gray-700" />

                    <div className="mt-4 text-[9px] text-gray-500">
                      Coming Soon
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>

      </main>

      {/* ================= FOOTER ================= */}
      <Footer />

    </div>
  );
}
