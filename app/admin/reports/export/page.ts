
import Link from "next/link";

export default function AdminReportsExportPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Export Reports</h1>
        <p className="mt-2 text-gray-600">
          Export ANJIVO marketplace reports for business analysis.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Available Reports</h2>

        <p className="mt-2 text-sm text-gray-600">
          Select a report category to open the corresponding report section.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/admin/reports"
            className="rounded-lg border px-5 py-3"
          >
            General Reports
          </Link>

          <Link
            href="/admin/reports/customers"
            className="rounded-lg border px-5 py-3"
          >
            Customer Reports
          </Link>

          <Link
            href="/admin/products"
            className="rounded-lg border px-5 py-3"
          >
            Product Management
          </Link>

          <Link
            href="/admin/orders"
            className="rounded-lg border px-5 py-3"
          >
            Order Management
          </Link>
        </div>

        <p className="mt-5 text-sm text-amber-700">
          CSV, Excel, and PDF export functionality is not implemented on
          this page yet.
        </p>
      </section>
    </main>
  );
}
