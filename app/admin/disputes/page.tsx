
import Link from "next/link";

export default function AdminDisputesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Order Disputes</h1>
        <p className="mt-2 text-gray-600">
          Review and manage disputes between customers and sellers on ANJIVO.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Dispute Management</h2>

        <p className="mt-2 text-sm text-gray-600">
          Dispute records will appear here after a secure server-side data
          source is connected.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No dispute records are currently loaded.
        </div>

        <p className="mt-4 text-sm text-amber-700">
          Dispute assignment, evidence review, resolution, and refund actions
          are not implemented on this page yet.
        </p>
      </section>
    </main>
  );
}
