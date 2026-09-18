import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";

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
  },
];

const wholesaleProducts = [
  {
    name: "Cotton T-Shirt Combo",
    price: 299,
    wholesalePrice: 129,
    moq: 20,
    image: "👕",
  },
  {
    name: "Ladies Leggings",
    price: 299,
    wholesalePrice: 99,
    moq: 25,
    image: "👖",
  },
  {
    name: "Cosmetic Combo",
    price: 499,
    wholesalePrice: 199,
    moq: 10,
    image: "💋",
  },
  {
    name: "Kids Toy Combo",
    price: 699,
    wholesalePrice: 299,
    moq: 10,
    image: "🧸",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <Header />

      <main>
        <Hero />

        {/* Quick Actions */}
        <section className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["⚡", "Flash Deals", "Limited offers"],
              ["📦", "Wholesale", "Bulk prices"],
              ["✨", "New Arrivals", "Fresh products"],
              ["🔥", "Trending", "What people buy"],
              ["🏪", "Top Sellers", "Verified stores"],
            ].map(([icon, title, subtitle]) => (
              <div
                key={title}
                className="group cursor-pointer rounded-2xl border bg-white p-4 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Categories />

        {/* Flash Sale */}
        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="overflow-hidden rounded-3xl bg-black text-white">
            <div className="flex flex-col justify-between gap-4 px-6 py-5 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
                    LIVE DEAL
                  </span>
                  <h2 className="text-2xl font-black md:text-3xl">
                    Flash Sale
                  </h2>
                </div>
                <p className="mt-1 text-sm text-gray-300">
                  Grab today's deals before they disappear.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {["08", "42", "17"].map((time, index) => (
                  <div key={time} className="text-center">
                    <div className="rounded-lg bg-white px-3 py-2 text-lg font-black text-black">
                      {time}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {index === 0 ? "HRS" : index === 1 ? "MIN" : "SEC"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gray-800 p-4 md:grid-cols-4">
              {products.slice(0, 4).map((product) => (
                <ProductCard key={product.name} {...product} />
              ))}
            </div>
          </div>
        </section>

        {/* Wholesale Zone */}
        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <div className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">
                ANJIVO BUSINESS
              </div>
              <h2 className="text-3xl font-black">
                Wholesale Zone
              </h2>
              <p className="mt-1 text-gray-500">
                Buy more. Pay less. Grow your business.
              </p>
            </div>

            <button className="w-fit rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">
              Explore Wholesale →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {wholesaleProducts.map((product) => (
              <div
                key={product.name}
                className="overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-40 items-center justify-center bg-gray-100 text-7xl">
                  {product.image}
                </div>

                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-500">
                    WHOLESALE
                  </p>

                  <h3 className="mt-1 line-clamp-1 font-bold">
                    {product.name}
                  </h3>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-gray-500">
                        Starting from
                      </p>
                      <p className="text-xl font-black">
                        ₹{product.wholesalePrice}
                      </p>
                    </div>

                    <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold">
                      MOQ {product.moq}
                    </span>
                  </div>

                  <button className="mt-4 w-full rounded-xl border border-black py-2.5 text-sm font-bold transition hover:bg-black hover:text-white">
                    View Bulk Price
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Promotional banners */}
        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-gradient-to-r from-gray-900 to-gray-700 p-8 text-white">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                For Retail Customers
              </span>
              <h2 className="mt-3 text-3xl font-black">
                Shop your favourites
              </h2>
              <p className="mt-2 max-w-md text-gray-300">
                Discover trending products from verified sellers.
              </p>
              <button className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">
                Start Shopping →
              </button>
            </div>

            <div className="rounded-3xl bg-gray-200 p-8 text-black">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-600">
                For Businesses
              </span>
              <h2 className="mt-3 text-3xl font-black">
                Source at wholesale prices
              </h2>
              <p className="mt-2 max-w-md text-gray-600">
                Find products, compare sellers and order in bulk.
              </p>
              <button className="mt-6 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">
                Enter Wholesale →
              </button>
            </div>
          </div>
        </section>

        {/* Best Sellers */}
        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-gray-500">
                CUSTOMER FAVOURITES
              </p>
              <h2 className="mt-1 text-3xl font-black">
                Best Sellers
              </h2>
            </div>

            <button className="text-sm font-bold">
              View All →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {products.map((product) => (
              <ProductCard key={product.name} {...product} />
            ))}
          </div>
        </section>

        {/* Seller section */}
        <section className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-3xl bg-white p-6 shadow-sm md:p-10">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">
                  FOR SELLERS
                </span>

                <h2 className="mt-4 text-4xl font-black">
                  Turn your products
                  <br />
                  into a business.
                </h2>

                <p className="mt-4 max-w-lg text-gray-600">
                  Manufacturers, wholesalers and retailers can
                  reach customers across India through ANJIVO.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="rounded-xl bg-black px-6 py-3 font-bold text-white">
                    Become a Seller
                  </button>

                  <button className="rounded-xl border px-6 py-3 font-bold">
                    Seller Benefits
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ["📈", "Grow Sales", "Reach new customers"],
                  ["📦", "Bulk Orders", "Wholesale buyers"],
                  ["🛍️", "Retail Orders", "Direct customers"],
                  ["📊", "Seller Dashboard", "Manage everything"],
                ].map(([icon, title, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl bg-gray-50 p-5"
                  >
                    <div className="text-3xl">{icon}</div>
                    <h3 className="mt-3 font-black">{title}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="border-y bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
            {[
              ["✓", "Verified Sellers", "Seller verification"],
              ["₹", "Wholesale Pricing", "Bulk savings"],
              ["↻", "Easy Returns", "Simple return process"],
              ["🔒", "Secure Payments", "Protected checkout"],
            ].map(([icon, title, subtitle]) => (
              <div
                key={title}
                className="p-6 text-center"
              >
                <div className="text-2xl font-black">{icon}</div>
                <h3 className="mt-2 font-bold">{title}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {subtitle}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* App CTA */}
        <section className="mx-auto max-w-7xl px-4 py-12">
          <div className="overflow-hidden rounded-3xl bg-black px-6 py-10 text-white md:px-12">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-gray-400">
                  ANJIVO APP
                </p>

                <h2 className="mt-3 text-3xl font-black md:text-4xl">
                  Shopping that moves
                  <br />
                  with your business.
                </h2>

                <p className="mt-4 text-gray-400">
                  Shop retail, discover wholesale deals and
                  manage your business from anywhere.
                </p>

                <div className="mt-6 flex gap-3">
                  <button className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">
                    Google Play
                  </button>

                  <button className="rounded-xl border border-gray-600 px-5 py-3 text-sm font-bold">
                    Coming Soon
                  </button>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="flex h-64 w-40 items-center justify-center rounded-[2.5rem] border-4 border-gray-700 bg-gray-900 shadow-2xl">
                  <div className="text-center">
                    <div className="text-3xl font-black">
                      ANJIVO
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Retail + Wholesale
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
