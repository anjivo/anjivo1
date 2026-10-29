
import Link from "next/link";

export default function AdminSalesReportsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Sales Reports</h1>
        <p className="mt-2 text-gray-600">
          Review ANJIVO marketplace sales and order performance.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Sales Analytics</h2>

        <p className="mt-2 text-sm text-gray-600">
          Sales data can be displayed here after connecting a secure
          server-side reporting API.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No sales report data is currently loaded.
        </div>

        <Link
          href="/admin/orders"
          className="mt-5 inline-block rounded-lg bg-black px-5 py-3 text-white"
        >
          Open Order Management
        </Link>

        <p className="mt-4 text-sm text-amber-700">
          Revenue, completed orders, refunds, and sales trends are not
          calculated by this page yet.
        </p>
      </section>
    </main>
  );
}
