
import Link from "next/link";

export default function AdminAnalyticsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:underline"
        >
          ← Back to Admin Dashboard
        </Link>

        <h1 className="mt-3 text-3xl font-bold">Analytics</h1>

        <p className="mt-2 text-gray-600">
          Review ANJIVO business performance and marketplace activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">Sales Analytics</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review sales reports and order performance.
          </p>
          <Link
            href="/admin/reports"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            View Reports
          </Link>
        </section>

        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">Product Analytics</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access product administration and catalogue management.
          </p>
          <Link
            href="/admin/products"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            Manage Products
          </Link>
        </section>

        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">Order Analytics</h2>
          <p className="mt-2 text-sm text-gray-600">
            Open the order management section to review orders.
          </p>
          <Link
            href="/admin/orders"
            className="mt-4 inline-block text-sm font-medium underline"
          >
            Manage Orders
          </Link>
        </section>
      </div>
    </main>
  );
}
