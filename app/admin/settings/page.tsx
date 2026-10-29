
import Link from "next/link";

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Admin Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage and review ANJIVO marketplace configuration.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Product Management</h2>
          <p className="mt-2 text-sm text-gray-600">
            Open the admin product catalogue to review product listings.
          </p>
          <Link
            href="/admin/products"
            className="mt-4 inline-block font-medium underline"
          >
            Manage Products
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Order Management</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access order management and review marketplace orders.
          </p>
          <Link
            href="/admin/orders"
            className="mt-4 inline-block font-medium underline"
          >
            Manage Orders
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="mt-2 text-sm text-gray-600">
            Open the available marketplace reporting section.
          </p>
          <Link
            href="/admin/reports"
            className="mt-4 inline-block font-medium underline"
          >
            View Reports
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">System Configuration</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review your project's environment variables and configuration
            through the appropriate deployment and server settings.
          </p>
          <p className="mt-3 text-sm text-amber-700">
            Environment variables and security settings cannot be changed
            from this page.
          </p>
        </section>
      </div>

      <div className="mt-8 rounded-xl border p-5">
        <h2 className="font-semibold">Configuration Status</h2>
        <p className="mt-2 text-sm text-gray-600">
          This page currently provides navigation only. Saving settings,
          changing platform fees, configuring payments, and updating
          marketplace policies require separate backend functionality.
        </p>
      </div>
    </main>
  );
}
