
import Link from "next/link";

export default function AdminSystemPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">System Overview</h1>
        <p className="mt-2 text-gray-600">
          Review ANJIVO application management and operational resources.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Product Catalogue</h2>
          <p className="mt-2 text-sm text-gray-600">
            Open the admin product management section.
          </p>
          <Link
            href="/admin/products"
            className="mt-4 inline-block font-medium underline"
          >
            Manage Products
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Order Operations</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access order management for marketplace operations.
          </p>
          <Link
            href="/admin/orders"
            className="mt-4 inline-block font-medium underline"
          >
            Manage Orders
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Application Logs</h2>
          <p className="mt-2 text-sm text-gray-600">
            Open the system logs section.
          </p>
          <Link
            href="/admin/logs"
            className="mt-4 inline-block font-medium underline"
          >
            View Logs
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Deployment Configuration</h2>
          <p className="mt-2 text-sm text-gray-600">
            Manage environment variables and deployment settings through
            your hosting provider.
          </p>
          <p className="mt-3 text-sm text-amber-700">
            This page does not run health checks or change server settings.
          </p>
        </section>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="font-semibold">System Status</h2>
        <p className="mt-2 text-sm text-gray-600">
          Live server status, Firebase connectivity, scheduled jobs, and
          error monitoring have not been connected to this page.
        </p>
      </section>
    </main>
  );
}
