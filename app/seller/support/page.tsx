
import Link from "next/link";

export default function SellerSupportPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Seller Support</h1>

      <p className="mt-3 text-gray-600">
        Need help with your ANJIVO seller account, product listings, or orders?
        Start with the options below.
      </p>

      <div className="mt-8 space-y-4">
        <section className="rounded-xl border p-5">
          <h2 className="text-lg font-semibold">Seller Registration</h2>
          <p className="mt-2 text-sm text-gray-600">
            Visit the seller registration page to get started.
          </p>
          <Link
            href="/seller/register"
            className="mt-4 inline-block font-medium underline"
          >
            Register as a Seller
          </Link>
        </section>

        <section className="rounded-xl border p-5">
          <h2 className="text-lg font-semibold">Product Management</h2>
          <p className="mt-2 text-sm text-gray-600">
            Access the seller section to manage your products.
          </p>
          <Link
            href="/seller"
            className="mt-4 inline-block font-medium underline"
          >
            Open Seller Section
          </Link>
        </section>

        <section className="rounded-xl border p-5">
          <h2 className="text-lg font-semibold">Order Management</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to access available order-management
            options.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block font-medium underline"
          >
            Login
          </Link>
        </section>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        For further assistance, use the official contact details provided by
        ANJIVO.
      </p>
    </main>
  );
}
