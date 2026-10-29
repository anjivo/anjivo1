
import Link from "next/link";

export default function AdminCustomerReportsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Customer Reports</h1>
        <p className="mt-2 text-gray-600">
          Review customer activity and marketplace customer statistics.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Customer Analytics</h2>

        <p className="mt-2 text-sm text-gray-600">
          Customer report data can be displayed here after connecting a
          secure server-side data source.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No customer report data is currently loaded.
        </div>

        <p className="mt-4 text-sm text-amber-700">
          Customer counts, registrations, purchase history, and retention
          metrics are not calculated by this page yet.
        </p>
      </section>
    </main>
  );
}
