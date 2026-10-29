
import Link from "next/link";

export default function AdminSupportPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Support Center</h1>
        <p className="mt-2 text-gray-600">
          Manage customer and seller support requests for ANJIVO.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Customer Support</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review customer issues related to orders and purchases.
          </p>
          <Link
            href="/admin/complaints"
            className="mt-4 inline-block font-medium underline"
          >
            View Complaints
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Order Disputes</h2>
          <p className="mt-2 text-sm text-gray-600">
            Open the dispute management section to review reported issues.
          </p>
          <Link
            href="/admin/disputes"
            className="mt-4 inline-block font-medium underline"
          >
            View Disputes
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Seller Support</h2>
          <p className="mt-2 text-sm text-gray-600">
            Open the seller support information page.
          </p>
          <Link
            href="/seller/support"
            className="mt-4 inline-block font-medium underline"
          >
            Seller Support
          </Link>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Support Workflow</h2>
          <p className="mt-2 text-sm text-gray-600">
            A ticket system can be connected here to assign requests,
            update statuses, and record resolutions.
          </p>
          <p className="mt-3 text-sm text-amber-700">
            Ticket creation and status management are not implemented yet.
          </p>
        </section>
      </div>
    </main>
  );
}
