import Image from "next/image";
import Link from "next/link";

const shopLinks = [
  ["All Products", "/products"],
  ["New Arrivals", "/products?sort=new"],
  ["Best Sellers", "/products?sort=best"],
  ["Flash Deals", "/products?deal=true"],
  ["Wholesale", "/wholesale"],
  ["Categories", "/categories"],
];

const customerLinks = [
  ["My Account", "/account"],
  ["My Orders", "/account/orders"],
  ["Track Order", "/track-order"],
  ["Returns & Refunds", "/returns"],
  ["Shipping Information", "/shipping"],
  ["Contact Support", "/contact"],
];

const businessLinks = [
  ["Become a Seller", "/seller/register"],
  ["Seller Login", "/seller/login"],
  ["Wholesale Account", "/wholesale/register"],
  ["Sell on ANJIVO", "/seller"],
  ["Seller Benefits", "/seller/benefits"],
  ["Seller Support", "/seller/support"],
];

export default function Footer() {
  return (
    <footer className="mt-12 bg-[#111111] text-white">

      {/* ================= MAIN FOOTER ================= */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:py-14 md:py-16">

        {/* ================= TOP GRID ================= */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">

          {/* ================= BRAND ================= */}
          <div className="sm:col-span-2 lg:col-span-2">

            <Link
              href="/"
              className="relative block h-24 w-48 sm:h-28 sm:w-56"
              aria-label="ANJIVO Home"
            >
              <Image
                src="/logo/anjivo-logo.png"
                alt="ANJIVO"
                fill
                sizes="224px"
                className="object-contain object-left"
              />
            </Link>

            <p className="mt-3 max-w-md text-sm leading-6 text-gray-400">
              ANJIVO is a multi-seller marketplace where customers
              can shop retail, buy wholesale and discover products
              from verified sellers.
            </p>

            {/* Brand Highlights */}
            <div className="mt-6 grid max-w-md grid-cols-2 gap-3">

              <div className="rounded-xl border border-gray-800 bg-[#181818] p-3">
                <p className="text-xs font-black text-white">
                  Retail + Wholesale
                </p>
                <p className="mt-1 text-[10px] text-gray-500">
                  One marketplace
                </p>
              </div>

              <div className="rounded-xl border border-gray-800 bg-[#181818] p-3">
                <p className="text-xs font-black text-white">
                  Multi-Seller
                </p>
                <p className="mt-1 text-[10px] text-gray-500">
                  Discover more sellers
                </p>
              </div>

            </div>

            {/* ================= SOCIAL ================= */}
            <div className="mt-6 flex gap-3">

              <a
                href="#"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:border-white hover:bg-white hover:text-black"
              >
                ◎
              </a>

              <a
                href="#"
                aria-label="Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:border-white hover:bg-white hover:text-black"
              >
                f
              </a>

              <a
                href="#"
                aria-label="YouTube"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:border-white hover:bg-white hover:text-black"
              >
                ▶
              </a>

              <a
                href="#"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-sm transition hover:border-white hover:bg-white hover:text-black"
              >
                ☎
              </a>

            </div>
          </div>

          {/* ================= SHOP ================= */}
          <FooterColumn
            title="Shop"
            links={shopLinks}
          />

          {/* ================= CUSTOMER ================= */}
          <FooterColumn
            title="Customer"
            links={customerLinks}
          />

          {/* ================= BUSINESS ================= */}
          <FooterColumn
            title="Business"
            links={businessLinks}
          />

        </div>

        {/* ================= TRUST FEATURES ================= */}
        <div className="mt-12 grid grid-cols-2 gap-3 border-y border-gray-800 py-7 md:grid-cols-4 md:gap-6">

          <TrustItem
            icon="🔒"
            title="Secure Payments"
            description="Safe & protected checkout"
          />

          <TrustItem
            icon="✓"
            title="Verified Sellers"
            description="Trusted marketplace sellers"
          />

          <TrustItem
            icon="📦"
            title="Retail + Wholesale"
            description="Buy in any quantity"
          />

          <TrustItem
            icon="💬"
            title="Customer Support"
            description="We're here to help"
          />

        </div>

        {/* ================= NEWSLETTER ================= */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-gray-800 bg-[#181818]">

          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">

            <div>
              <div className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-300">
                ANJIVO Updates
              </div>

              <h3 className="text-xl font-black sm:text-2xl">
                Get the latest deals
              </h3>

              <p className="mt-1 max-w-lg text-sm leading-6 text-gray-400">
                Get offers, wholesale deals and new arrivals
                directly in your inbox.
              </p>
            </div>

            <div className="flex w-full max-w-md gap-2">

              <input
                type="email"
                placeholder="Enter your email"
                className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-[#111111] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-white"
              />

              <button
                type="button"
                className="shrink-0 rounded-xl bg-white px-4 py-3 text-xs font-bold text-black transition hover:bg-gray-200 sm:px-5 sm:text-sm"
              >
                Subscribe
              </button>

            </div>

          </div>
        </div>

        {/* ================= PAYMENT / SECURITY ================= */}
        <div className="mt-8 flex flex-col gap-4 border-b border-gray-800 pb-8 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Shop with confidence
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Secure checkout • Order tracking • Seller verification
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <span className="rounded-lg border border-gray-800 px-3 py-2 text-[9px] font-bold text-gray-400">
              🔒 SECURE
            </span>

            <span className="rounded-lg border border-gray-800 px-3 py-2 text-[9px] font-bold text-gray-400">
              ✓ VERIFIED
            </span>

            <span className="rounded-lg border border-gray-800 px-3 py-2 text-[9px] font-bold text-gray-400">
              📦 TRACKED
            </span>

          </div>

        </div>

      </div>

      {/* ================= BOTTOM FOOTER ================= */}
      <div className="border-t border-gray-800">

        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">

          <p>
            © 2026 ANJIVO. All rights reserved.
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-2">

            <Link
              href="/privacy"
              className="transition hover:text-white"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms"
              className="transition hover:text-white"
            >
              Terms & Conditions
            </Link>

            <Link
              href="/refund-policy"
              className="transition hover:text-white"
            >
              Refund Policy
            </Link>

            <Link
              href="/seller-policy"
              className="transition hover:text-white"
            >
              Seller Policy
            </Link>

          </div>

        </div>

      </div>

    </footer>
  );
}

/* =========================================================
   FOOTER COLUMN
========================================================= */

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: string[][];
}) {
  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-wider text-white">
        {title}
      </h3>

      <div className="mt-5 space-y-3">

        {links.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            className="block text-sm text-gray-400 transition hover:translate-x-0.5 hover:text-white"
          >
            {label}
          </Link>
        ))}

      </div>
    </div>
  );
}

/* =========================================================
   TRUST ITEM
========================================================= */

function TrustItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#181818] text-sm">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold text-white sm:text-sm">
          {title}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-gray-500">
          {description}
        </p>
      </div>

    </div>
  );
}
