
import Link from "next/link";

export default function AdminModerationPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Content Moderation</h1>
        <p className="mt-2 text-gray-600">
          Review product listings and marketplace content for ANJIVO.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Moderation Queue</h2>

        <p className="mt-2 text-sm text-gray-600">
          Products and content requiring review can appear here after a
          secure moderation data source is connected.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No moderation records are currently loaded.
        </div>

        <Link
          href="/admin/products"
          className="mt-5 inline-block rounded-lg bg-black px-5 py-3 text-white"
        >
          Open Product Management
        </Link>

        <p className="mt-4 text-sm text-amber-700">
          Approve, reject, hide, and restore actions are not implemented
          on this page yet.
        </p>
      </section>
    </main>
  );
}
