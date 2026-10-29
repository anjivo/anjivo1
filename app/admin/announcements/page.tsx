
import Link from "next/link";

export default function AdminAnnouncementsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="mt-2 text-gray-600">
            Manage important updates for the ANJIVO marketplace.
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Announcement Management</h2>
        <p className="mt-2 text-sm text-gray-600">
          The announcement management interface is ready for future
          integration with Firebase.
        </p>
        <p className="mt-4 text-sm text-amber-700">
          No announcements are being published or saved by this page yet.
        </p>
      </section>
    </main>
  );
}
