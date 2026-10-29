
import Link from "next/link";

export default function AdminFeaturedPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-gray-500 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold">Featured Products</h1>
        <p className="mt-2 text-gray-600">
          Manage products that may be highlighted across the ANJIVO
          marketplace.
        </p>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Featured Product Management</h2>

        <p className="mt-2 text-sm text-gray-600">
          Connect this section to the product database to select products
          and manage their featured status.
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No featured product data is currently loaded.
        </div>

        <Link
          href="/admin/products"
          className="mt-5 inline-block rounded-lg bg-black px-5 py-3 text-white"
        >
          Open Product Management
        </Link>

        <p className="mt-4 text-sm text-amber-700">
          Selecting featured products and publishing them on the homepage
          are not implemented on this page yet.
        </p>
      </section>
    </main>
  );
}
