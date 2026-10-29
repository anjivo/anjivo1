
import Link from "next/link";

export default function AdminLogsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">System Logs</h1>
        <p className="mt-2 text-gray-600">
          Review application events and operational issues for ANJIVO.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Application Log Viewer</h2>

        <p className="mt-2 text-sm text-gray-600">
          Application logs can be displayed here after a secure server-side
          logging source is connected.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No system logs are currently loaded.
        </div>

        <p className="mt-4 text-sm text-amber-700">
          This page does not currently fetch Firebase logs, server logs,
          errors, or audit events.
        </p>
      </section>
    </main>
  );
}
