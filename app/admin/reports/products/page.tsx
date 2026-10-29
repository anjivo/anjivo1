
import Link from "next/link";

export default function AdminProductReportsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Product Reports</h1>
        <p className="mt-2 text-gray-600">
          Review product catalogue performance across the ANJIVO marketplace.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Product Analytics</h2>

        <p className="mt-2 text-sm text-gray-600">
          Product report data can be displayed here after connecting a
          secure server-side data source.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No product report data is currently loaded.
        </div>

        <Link
          href="/admin/products"
          className="mt-5 inline-block rounded-lg bg-black px-5 py-3 text-white"
        >
          Open Product Management
        </Link>

        <p className="mt-4 text-sm text-amber-700">
          Product counts, sales rankings, stock analysis, and category
          performance are not calculated by this page yet.
        </p>
      </section>
    </main>
  );
}
