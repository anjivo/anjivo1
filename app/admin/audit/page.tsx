
import Link from "next/link";

export default function AdminAuditPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="mt-2 text-gray-600">
          Review administrative activities and important system changes.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Activity History</h2>
        <p className="mt-2 text-sm text-gray-600">
          Audit records will appear here after an authenticated audit-log
          data source is connected.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No audit records are loaded by this page.
        </div>
      </section>
    </main>
  );
}
