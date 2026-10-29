
import Link from "next/link";

export default function SellerBenefitsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Seller Benefits on ANJIVO</h1>

      <p className="mt-4 text-gray-600">
        Join ANJIVO to showcase your products and grow your business online.
        Manage your product listings and orders from your seller account.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border p-5">
          <h2 className="font-semibold">Online Product Listings</h2>
          <p className="mt-2 text-sm text-gray-600">
            Display your products to customers through ANJIVO.
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <h2 className="font-semibold">Order Management</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your seller account to manage product orders.
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <h2 className="font-semibold">Business Growth</h2>
          <p className="mt-2 text-sm text-gray-600">
            Build your online presence and reach more potential customers.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/seller/register"
          className="rounded-lg bg-black px-6 py-3 text-white"
        >
          Become a Seller
        </Link>

        <Link
          href="/seller"
          className="rounded-lg border px-6 py-3"
        >
          Seller Dashboard
        </Link>
      </div>
    </main>
  );
}
