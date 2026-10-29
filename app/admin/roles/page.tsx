
import Link from "next/link";

export default function AdminRolesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Admin Roles & Permissions</h1>
        <p className="mt-2 text-gray-600">
          Manage administrative roles and access permissions for ANJIVO.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Role Management</h2>

        <p className="mt-2 text-sm text-gray-600">
          Role information can be displayed here after connecting a secure
          server-side roles and permissions service.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No role records are currently loaded.
        </div>

        <p className="mt-4 text-sm text-amber-700">
          Creating roles, assigning permissions, and changing admin access
          are not implemented on this page.
        </p>
      </section>
    </main>
  );
}
